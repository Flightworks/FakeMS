#!/usr/bin/env python3
"""Prepare an offline, line-only Toulon coastline pack from Overpass JSON.

The source is expected to be an Overpass JSON response containing way geometry.
Only ways tagged ``natural=coastline`` are retained.  The output deliberately
contains LineString features, never generated land polygons.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence


TOOL_NAME = "prepare-mission-coast"
TOOL_VERSION = "1.0.0"
PACK_VERSION = "1.0.0"
BBOX = [4.8, 42.8, 6.5, 43.5]
SECTOR_MIDPOINT = 5.65
DEFAULT_SOURCE_URL = "https://overpass-api.de/api/interpreter"
DEFAULT_SOURCE_QUERY = (
    '[out:json][timeout:60];way["natural"="coastline"]'
    "(42.8,4.8,43.5,6.5);out geom;"
)
ODBL_URL = "https://opendatacommons.org/licenses/odbl/1-0/"

SECTORS = (
    ("west", [4.8, 42.8, SECTOR_MIDPOINT, 43.5], "coast-west.geojson"),
    ("east", [SECTOR_MIDPOINT, 42.8, 6.5, 43.5], "coast-east.geojson"),
)


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _same_coordinate(first: Sequence[float], second: Sequence[float]) -> bool:
    return first[0] == second[0] and first[1] == second[1]


def _clamp(value: float, lower: float, upper: float) -> float:
    return min(max(value, lower), upper)


def _iso_from_mtime(path: Path) -> str:
    timestamp = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
    return timestamp.isoformat(timespec="seconds").replace("+00:00", "Z")


def _validate_generated_at(value: str) -> str:
    candidate = value.strip()
    if not candidate:
        raise ValueError("generated-at must not be empty")
    try:
        datetime.fromisoformat(candidate.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("generated-at must be an ISO-8601 date/time") from error
    return candidate


def _read_coordinates(way: dict[str, Any]) -> list[list[float]]:
    geometry = way.get("geometry")
    if not isinstance(geometry, list) or len(geometry) < 2:
        raise ValueError(f"coastline way {way.get('id', '<unknown>')} has no usable geometry")

    coordinates: list[list[float]] = []
    for point in geometry:
        if not isinstance(point, dict) or not _is_number(point.get("lon")) or not _is_number(point.get("lat")):
            raise ValueError(f"coastline way {way.get('id', '<unknown>')} has invalid geometry")
        longitude = float(point["lon"])
        latitude = float(point["lat"])
        if not -180 <= longitude <= 180 or not -90 <= latitude <= 90:
            raise ValueError(f"coastline way {way.get('id', '<unknown>')} has out-of-range coordinates")
        coordinates.append([longitude, latitude])
    return coordinates


def _clip_segment(
    first: Sequence[float], second: Sequence[float], bbox: Sequence[float]
) -> tuple[list[float], list[float]] | None:
    """Return the portion of one segment inside a rectangular bbox."""

    west, south, east, north = bbox
    x1, y1 = first
    x2, y2 = second
    dx = x2 - x1
    dy = y2 - y1
    t_enter = 0.0
    t_exit = 1.0

    # Liang-Barsky inequalities for x >= west, x <= east, y >= south, y <= north.
    for coefficient, constant in (
        (-dx, x1 - west),
        (dx, east - x1),
        (-dy, y1 - south),
        (dy, north - y1),
    ):
        if coefficient == 0:
            if constant < 0:
                return None
            continue
        ratio = constant / coefficient
        if coefficient < 0:
            if ratio > t_exit:
                return None
            t_enter = max(t_enter, ratio)
        else:
            if ratio < t_enter:
                return None
            t_exit = min(t_exit, ratio)

    if t_enter > t_exit:
        return None

    def point_at(fraction: float) -> list[float]:
        if fraction == 0:
            point = [x1, y1]
        elif fraction == 1:
            point = [x2, y2]
        else:
            point = [x1 + fraction * dx, y1 + fraction * dy]
        return [
            _clamp(point[0], west, east),
            _clamp(point[1], south, north),
        ]

    return point_at(t_enter), point_at(t_exit)


def clip_line_to_bbox(coordinates: Sequence[Sequence[float]], bbox: Sequence[float]) -> list[list[list[float]]]:
    """Clip a line without joining disjoint inside portions.

    A way can cross the requested bbox more than once.  Returning separate
    paths avoids inventing a segment over the omitted outside portion.
    """

    paths: list[list[list[float]]] = []
    current: list[list[float]] = []

    def flush() -> None:
        nonlocal current
        if len(current) >= 2:
            paths.append(current)
        current = []

    for first, second in zip(coordinates, coordinates[1:]):
        clipped = _clip_segment(first, second, bbox)
        if clipped is None:
            flush()
            continue
        segment_first, segment_second = clipped
        if not current:
            current = [segment_first]
        elif not _same_coordinate(current[-1], segment_first):
            flush()
            current = [segment_first]
        if not _same_coordinate(current[-1], segment_second):
            current.append(segment_second)

    flush()
    return paths


def _way_sort_key(item: tuple[int, int, dict[str, Any]]) -> tuple[int, int, int]:
    way_id, input_index, _ = item
    return (0 if way_id >= 0 else 1, way_id, input_index)


def _coastline_paths(source: dict[str, Any]) -> tuple[list[list[list[float]]], int, int]:
    elements = source.get("elements")
    if not isinstance(elements, list):
        raise ValueError("Overpass source must contain an elements array")

    matching: list[tuple[int, int, dict[str, Any]]] = []
    for input_index, element in enumerate(elements):
        if not isinstance(element, dict) or element.get("type") != "way":
            continue
        tags = element.get("tags")
        if not isinstance(tags, dict) or tags.get("natural") != "coastline":
            continue
        raw_id = element.get("id")
        way_id = raw_id if isinstance(raw_id, int) and not isinstance(raw_id, bool) else -1
        matching.append((way_id, input_index, element))

    matching.sort(key=_way_sort_key)
    regional_paths: list[list[list[float]]] = []
    source_vertices = 0
    for _, _, way in matching:
        coordinates = _read_coordinates(way)
        source_vertices += len(coordinates)
        regional_paths.extend(clip_line_to_bbox(coordinates, BBOX))

    return regional_paths, len(matching), source_vertices


def _feature_collection(name: str, bbox: Sequence[float], paths: Iterable[Sequence[Sequence[float]]]) -> dict[str, Any]:
    features = [
        {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "LineString",
                "coordinates": [[float(point[0]), float(point[1])] for point in path],
            },
        }
        for path in paths
        if len(path) >= 2
    ]
    return {
        "type": "FeatureCollection",
        "name": name,
        "bbox": list(bbox),
        "features": features,
    }


def _json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8")


def _asset_record(asset_id: str, sector: str, bbox: Sequence[float], filename: str, geojson: dict[str, Any]) -> tuple[dict[str, Any], bytes]:
    payload = _json_bytes(geojson)
    features = geojson["features"]
    vertices = sum(len(feature["geometry"]["coordinates"]) for feature in features)
    record = {
        "id": asset_id,
        "path": filename,
        "sector": sector,
        "lod": "full",
        "bbox": list(bbox),
        "features": len(features),
        "vertices": vertices,
        "bytes": len(payload),
        "feature_count": len(features),
        "vertex_count": vertices,
        "byte_count": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest(),
    }
    return record, payload


def prepare_pack(
    input_path: str | os.PathLike[str],
    output_dir: str | os.PathLike[str] = "public/maps/toulon",
    *,
    source_url: str = DEFAULT_SOURCE_URL,
    source_query: str = DEFAULT_SOURCE_QUERY,
    generated_at: str | None = None,
    pack_version: str = PACK_VERSION,
) -> dict[str, Any]:
    """Create a deterministic pack and return its manifest object."""

    source_path = Path(input_path)
    raw_source = source_path.read_bytes()
    try:
        source = json.loads(raw_source.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError(f"cannot parse Overpass JSON: {source_path}") from error
    if not isinstance(source, dict):
        raise ValueError("Overpass source must be a JSON object")

    retrieval_time = _validate_generated_at(generated_at) if generated_at is not None else _iso_from_mtime(source_path)
    regional_paths, source_way_count, source_vertex_count = _coastline_paths(source)
    if not regional_paths:
        raise ValueError("coastline extraction produced no line geometry inside the regional bbox")

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, Any]] = []
    payloads: list[tuple[Path, bytes]] = []
    for sector, sector_bbox, filename in SECTORS:
        sector_paths = [piece for regional_path in regional_paths for piece in clip_line_to_bbox(regional_path, sector_bbox)]
        geojson = _feature_collection(f"fakems-toulon-coast-{sector}", sector_bbox, sector_paths)
        if not geojson["features"]:
            raise ValueError(f"coastline extraction produced no features for sector {sector}")
        record, payload = _asset_record(f"coast-{sector}", sector, sector_bbox, filename, geojson)
        records.append(record)
        payloads.append((output_path / filename, payload))

    total_features = sum(record["features"] for record in records)
    total_vertices = sum(record["vertices"] for record in records)
    total_bytes = sum(record["bytes"] for record in records)
    manifest: dict[str, Any] = {
        "schema": "fakems.coastal-pack",
        "schema_version": 1,
        "pack_version": pack_version,
        "generated_at": retrieval_time,
        "crs": "WGS84",
        "bbox": list(BBOX),
        "source": {
            "provider": "OpenStreetMap",
            "url": source_url,
            "query": source_query,
            "retrieved_at": retrieval_time,
            "license": "ODbL-1.0",
            "license_url": ODBL_URL,
            "attribution": "© OpenStreetMap contributors",
            "input_sha256": hashlib.sha256(raw_source).hexdigest(),
            "input_bytes": len(raw_source),
            "coastline_ways": source_way_count,
            "source_vertices": source_vertex_count,
        },
        "tool": {"name": TOOL_NAME, "version": TOOL_VERSION},
        "tool_version": TOOL_VERSION,
        "assets": records,
        "counts": {
            "features": total_features,
            "vertices": total_vertices,
            "bytes": total_bytes,
        },
        "feature_count": total_features,
        "vertex_count": total_vertices,
        "byte_count": total_bytes,
        "land_surface": {
            "strategy": "natural-earth-global-fallback",
            "asset": "../ne_110m_land.geojson",
            "reason": (
                "Coastline lines are not assembled into land polygons because that is not "
                "topologically safe for a visual prototype."
            ),
        },
        "limitations": [
            "OSM coastline data is not survey-grade.",
            "Coverage and geometry depend on heterogeneous community updates.",
            "This pack is not a certified navigation chart.",
        ],
    }

    # Write only the generated files.  Existing unrelated map assets are left untouched.
    for destination, payload in payloads:
        destination.write_bytes(payload)
    (output_path / "manifest.json").write_bytes(_json_bytes(manifest))
    return manifest


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_json", help="Overpass JSON input containing way geometry")
    parser.add_argument(
        "output_dir",
        nargs="?",
        default=None,
        help="output pack directory (default: public/maps/toulon)",
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        "--output",
        dest="output_dir_option",
        help="output pack directory (alternative to the positional argument)",
    )
    parser.add_argument("--source-url", default=DEFAULT_SOURCE_URL, help="source endpoint recorded in manifest")
    parser.add_argument("--source-query", default=DEFAULT_SOURCE_QUERY, help="source query recorded in manifest")
    parser.add_argument("--generated-at", help="explicit ISO-8601 retrieval/generated timestamp")
    parser.add_argument("--pack-version", default=PACK_VERSION, help="version recorded in manifest")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_parser()
    arguments = parser.parse_args(argv)
    if arguments.output_dir is not None and arguments.output_dir_option is not None:
        parser.error("output directory was provided both positionally and with --output-dir")
    output_dir = arguments.output_dir_option or arguments.output_dir or "public/maps/toulon"
    try:
        manifest = prepare_pack(
            arguments.input_json,
            output_dir,
            source_url=arguments.source_url,
            source_query=arguments.source_query,
            generated_at=arguments.generated_at,
            pack_version=arguments.pack_version,
        )
    except (OSError, ValueError) as error:
        print(f"prepare-mission-coast: {error}", file=sys.stderr)
        return 1

    print(
        json.dumps(
            {
                "output": str(Path(output_dir)),
                "assets": [asset["path"] for asset in manifest["assets"]],
                "features": manifest["counts"]["features"],
                "vertices": manifest["counts"]["vertices"],
            },
            separators=(",", ":"),
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
