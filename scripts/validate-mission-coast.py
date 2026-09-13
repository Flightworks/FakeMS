#!/usr/bin/env python3
"""Validate an offline FakeMS coastal-data pack manifest and its assets."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
from pathlib import Path
from typing import Any, Sequence


EXPECTED_BBOX = (4.8, 42.8, 6.5, 43.5)
EXPECTED_SCHEMA = "fakems.coastal-pack"
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _is_wgs84(value: Any) -> bool:
    if isinstance(value, str):
        return value.strip().lower() in {
            "wgs84",
            "crs84",
            "epsg:4326",
            "urn:ogc:def:crs:ogc:1.3:crs84",
            "urn:ogc:def:crs:epsg::4326",
        }
    if isinstance(value, dict):
        properties = value.get("properties")
        if not isinstance(properties, dict):
            return False
        name = properties.get("name")
        return _is_wgs84(name)
    return False


def _valid_bbox(value: Any) -> bool:
    return (
        isinstance(value, list)
        and len(value) == 4
        and all(_is_number(item) for item in value)
        and value[0] < value[2]
        and value[1] < value[3]
    )


def _check_coordinate(
    coordinate: Any,
    *,
    asset_label: str,
    feature_index: int,
    coordinate_index: int,
    errors: list[str],
) -> None:
    if not isinstance(coordinate, list) or len(coordinate) != 2 or not all(_is_number(item) for item in coordinate):
        errors.append(
            f"{asset_label} feature {feature_index} coordinate {coordinate_index} "
            "must be a finite [longitude, latitude] pair"
        )
        return
    longitude, latitude = coordinate
    west, south, east, north = EXPECTED_BBOX
    if not west <= longitude <= east or not south <= latitude <= north:
        errors.append(
            f"{asset_label} feature {feature_index} coordinate {coordinate_index} "
            f"is outside bbox {list(EXPECTED_BBOX)}"
        )
    if not -180 <= longitude <= 180 or not -90 <= latitude <= 90:
        errors.append(
            f"{asset_label} feature {feature_index} coordinate {coordinate_index} "
            "is outside WGS84 coordinate ranges"
        )


def _inspect_geojson(geojson: Any, asset_label: str, errors: list[str]) -> tuple[int, int]:
    if not isinstance(geojson, dict) or geojson.get("type") != "FeatureCollection":
        errors.append(f"{asset_label} must be a GeoJSON FeatureCollection")
        return 0, 0
    if "crs" in geojson and not _is_wgs84(geojson["crs"]):
        errors.append(f"{asset_label} declares a CRS other than WGS84")
    features = geojson.get("features")
    if not isinstance(features, list) or not features:
        errors.append(f"{asset_label} must contain at least one feature")
        return 0, 0

    vertex_count = 0
    for feature_index, feature in enumerate(features):
        label = f"{asset_label} feature {feature_index}"
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            errors.append(f"{label} must be a GeoJSON Feature")
            continue
        properties = feature.get("properties", {})
        if properties not in ({}, None):
            errors.append(f"{label} must not carry civilian properties")
        geometry = feature.get("geometry")
        if not isinstance(geometry, dict) or geometry.get("type") != "LineString":
            errors.append(f"{label} geometry must be a LineString")
            continue
        coordinates = geometry.get("coordinates")
        if not isinstance(coordinates, list) or len(coordinates) < 2:
            errors.append(f"{label} LineString must contain at least two coordinates")
            continue
        for coordinate_index, coordinate in enumerate(coordinates):
            _check_coordinate(
                coordinate,
                asset_label=asset_label,
                feature_index=feature_index,
                coordinate_index=coordinate_index,
                errors=errors,
            )
        vertex_count += len(coordinates)
    return len(features), vertex_count


def _expected_count(record: dict[str, Any], plural: str, singular: str, actual: int, label: str, errors: list[str]) -> None:
    for key in (plural, singular):
        if key in record:
            value = record[key]
            if not isinstance(value, int) or isinstance(value, bool) or value != actual:
                errors.append(f"{label} {key} count is {value!r}, expected {actual}")


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_manifest(manifest_path: str | Path) -> list[str]:
    """Return validation errors for a manifest and every referenced asset."""

    path = Path(manifest_path)
    errors: list[str] = []
    try:
        manifest = _load_json(path)
    except OSError as error:
        return [f"cannot read manifest {path}: {error}"]
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        return [f"manifest is malformed JSON: {error}"]

    if not isinstance(manifest, dict):
        return ["manifest must be a JSON object"]
    if manifest.get("schema") != EXPECTED_SCHEMA:
        errors.append(f"manifest schema must be {EXPECTED_SCHEMA!r}")
    if manifest.get("schema_version") != 1:
        errors.append("manifest schema_version must be 1")
    if not isinstance(manifest.get("pack_version"), str) or not manifest["pack_version"].strip():
        errors.append("manifest pack_version must be a non-empty string")
    if not isinstance(manifest.get("generated_at"), str) or not manifest["generated_at"].strip():
        errors.append("manifest generated_at must be a non-empty string")
    if not _is_wgs84(manifest.get("crs")):
        errors.append("manifest CRS must be WGS84")
    if not _valid_bbox(manifest.get("bbox")):
        errors.append("manifest bbox must contain four ordered finite numbers")
    elif tuple(manifest["bbox"]) != EXPECTED_BBOX:
        errors.append(f"manifest bbox must be exactly {list(EXPECTED_BBOX)}")

    source = manifest.get("source")
    if not isinstance(source, dict):
        errors.append("manifest source provenance is required")
    else:
        for key in ("provider", "url", "query", "retrieved_at", "license", "attribution"):
            if not isinstance(source.get(key), str) or not source[key].strip():
                errors.append(f"manifest source.{key} must be a non-empty string")

    tool = manifest.get("tool")
    if not isinstance(tool, dict) or not isinstance(tool.get("version"), str) or not tool["version"].strip():
        errors.append("manifest tool.version is required")

    assets = manifest.get("assets")
    if not isinstance(assets, list) or not assets:
        errors.append("manifest assets must be a non-empty array")
        return errors

    try:
        manifest_root = path.resolve().parent
    except OSError as error:
        errors.append(f"cannot resolve manifest directory: {error}")
        return errors

    seen_paths: set[str] = set()
    actual_totals = {"features": 0, "vertices": 0, "bytes": 0}
    for index, record in enumerate(assets):
        label = f"asset {index}"
        if not isinstance(record, dict):
            errors.append(f"{label} manifest entry must be an object")
            continue
        relative_name = record.get("path")
        if not isinstance(relative_name, str) or not relative_name.strip():
            errors.append(f"{label} path must be a non-empty relative path")
            continue
        candidate = Path(relative_name)
        if candidate.is_absolute() or ".." in candidate.parts:
            errors.append(f"{label} path must stay inside the manifest directory")
            continue
        normalized_name = candidate.as_posix()
        if normalized_name in seen_paths:
            errors.append(f"{label} path is duplicated: {normalized_name}")
            continue
        seen_paths.add(normalized_name)
        asset_path = (manifest_root / candidate).resolve()
        try:
            asset_path.relative_to(manifest_root)
        except ValueError:
            errors.append(f"{label} path resolves outside the manifest directory")
            continue
        try:
            raw_asset = asset_path.read_bytes()
        except OSError as error:
            errors.append(f"{label} cannot be read: {error}")
            continue
        try:
            geojson = json.loads(raw_asset.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            errors.append(f"{label} is malformed JSON: {error}")
            continue

        feature_count, vertex_count = _inspect_geojson(geojson, label, errors)
        byte_count = len(raw_asset)
        actual_totals["features"] += feature_count
        actual_totals["vertices"] += vertex_count
        actual_totals["bytes"] += byte_count
        _expected_count(record, "features", "feature_count", feature_count, label, errors)
        _expected_count(record, "vertices", "vertex_count", vertex_count, label, errors)
        _expected_count(record, "bytes", "byte_count", byte_count, label, errors)
        expected_hash = record.get("sha256")
        if not isinstance(expected_hash, str) or not SHA256_PATTERN.fullmatch(expected_hash):
            errors.append(f"{label} sha256 must be a lowercase SHA-256 hex digest")
        elif hashlib.sha256(raw_asset).hexdigest() != expected_hash:
            errors.append(f"{label} sha256 does not match the asset bytes")

    counts = manifest.get("counts")
    if not isinstance(counts, dict):
        errors.append("manifest counts are required")
    else:
        for key in actual_totals:
            value = counts.get(key)
            if not isinstance(value, int) or isinstance(value, bool) or value != actual_totals[key]:
                errors.append(f"manifest counts.{key} is {value!r}, expected {actual_totals[key]}")

    for plural, singular in (("features", "feature_count"), ("vertices", "vertex_count"), ("bytes", "byte_count")):
        if singular in manifest and manifest[singular] != actual_totals[plural]:
            errors.append(
                f"manifest {singular} is {manifest[singular]!r}, expected {actual_totals[plural]}"
            )

    return errors


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", help="path to the coastal pack manifest.json")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    arguments = _build_parser().parse_args(argv)
    errors = validate_manifest(arguments.manifest)
    if errors:
        for error in errors:
            print(f"validate-mission-coast: {error}", file=sys.stderr)
        return 1

    print(json.dumps({"manifest": arguments.manifest, "valid": True}, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
