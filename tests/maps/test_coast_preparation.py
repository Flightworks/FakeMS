from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PREPARE = ROOT / "scripts" / "prepare-mission-coast.py"
VALIDATE = ROOT / "scripts" / "validate-mission-coast.py"
BBOX = [4.8, 42.8, 6.5, 43.5]


OSM_FIXTURE = {
    "version": 0.6,
    "generator": "unit-test fixture",
    "elements": [
        {
            "type": "way",
            "id": 10,
            "tags": {"natural": "coastline", "name": "Civilian Harbour"},
            "geometry": [
                {"lat": 43.0, "lon": 5.0},
                {"lat": 43.2, "lon": 5.1},
                {"lat": 43.0, "lon": 5.2},
                {"lat": 43.3, "lon": 5.3},
            ],
        },
        {
            "type": "way",
            "id": 20,
            "tags": {"natural": "coastline"},
            "geometry": [
                {"lat": 43.1, "lon": 5.8},
                {"lat": 43.15, "lon": 5.9},
                {"lat": 43.1, "lon": 6.0},
            ],
        },
        {
            "type": "way",
            "id": 30,
            "tags": {"natural": "water"},
            "geometry": [
                {"lat": 43.2, "lon": 5.4},
                {"lat": 43.25, "lon": 5.5},
            ],
        },
        {
            "type": "way",
            "id": 40,
            "tags": {"natural": "coastline", "place": "town"},
            "geometry": [
                {"lat": 43.25, "lon": 4.7},
                {"lat": 43.26, "lon": 4.9},
            ],
        },
    ],
}


def run_script(script: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(script), *arguments],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
    )


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, separators=(",", ":")) + "\n", encoding="utf-8")


def make_manifest(pack_dir: Path, geojson: object, *, crs: str = "WGS84") -> Path:
    asset_path = pack_dir / "coast-west.geojson"
    write_json(asset_path, geojson)
    payload = asset_path.read_bytes()
    features = geojson.get("features", []) if isinstance(geojson, dict) else []
    vertices = sum(
        len(feature["geometry"]["coordinates"])
        for feature in features
        if isinstance(feature, dict)
        and isinstance(feature.get("geometry"), dict)
        and isinstance(feature["geometry"].get("coordinates"), list)
    )
    manifest = {
        "schema": "fakems.coastal-pack",
        "schema_version": 1,
        "pack_version": "1.0.0",
        "generated_at": "2026-09-12T00:00:00Z",
        "crs": crs,
        "bbox": BBOX,
        "source": {
            "provider": "OpenStreetMap",
            "url": "https://overpass-api.de/api/interpreter",
            "query": "[out:json];way[\"natural\"=\"coastline\"](42.8,4.8,43.5,6.5);out geom;",
            "retrieved_at": "2026-09-12T00:00:00Z",
            "license": "ODbL-1.0",
            "attribution": "© OpenStreetMap contributors",
        },
        "tool": {"name": "prepare-mission-coast", "version": "1.0.0"},
        "assets": [
            {
                "id": "coast-west",
                "path": "coast-west.geojson",
                "sector": "west",
                "lod": "full",
                "features": len(features),
                "vertices": vertices,
                "bytes": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
            }
        ],
        "counts": {"features": len(features), "vertices": vertices, "bytes": len(payload)},
    }
    manifest_path = pack_dir / "manifest.json"
    write_json(manifest_path, manifest)
    return manifest_path


class CoastPreparationTests(unittest.TestCase):
    def test_prepare_creates_versioned_sector_line_assets(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source.json"
            pack = root / "pack"
            write_json(source, OSM_FIXTURE)

            result = run_script(
                PREPARE,
                str(source),
                str(pack),
                "--generated-at",
                "2026-09-12T00:00:00Z",
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            manifest = json.loads((pack / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["schema"], "fakems.coastal-pack")
            self.assertEqual(manifest["pack_version"], "1.0.0")
            self.assertEqual(manifest["crs"], "WGS84")
            self.assertEqual(manifest["bbox"], BBOX)
            self.assertEqual(manifest["generated_at"], "2026-09-12T00:00:00Z")
            self.assertEqual(manifest["source"]["license"], "ODbL-1.0")
            self.assertIn("OpenStreetMap", manifest["source"]["attribution"])
            self.assertEqual(
                {asset["path"] for asset in manifest["assets"]},
                {"coast-west.geojson", "coast-east.geojson"},
            )

            all_features = []
            for asset in manifest["assets"]:
                asset_file = pack / asset["path"]
                self.assertTrue(asset_file.is_file())
                geojson = json.loads(asset_file.read_text(encoding="utf-8"))
                self.assertEqual(geojson["type"], "FeatureCollection")
                self.assertGreater(len(geojson["features"]), 0)
                all_features.extend(geojson["features"])
                for feature in geojson["features"]:
                    self.assertEqual(feature["type"], "Feature")
                    self.assertEqual(feature["geometry"]["type"], "LineString")
                    self.assertEqual(feature["properties"], {})
                    self.assertGreaterEqual(len(feature["geometry"]["coordinates"]), 2)
                    for longitude, latitude in feature["geometry"]["coordinates"]:
                        self.assertGreaterEqual(longitude, BBOX[0])
                        self.assertLessEqual(longitude, BBOX[2])
                        self.assertGreaterEqual(latitude, BBOX[1])
                        self.assertLessEqual(latitude, BBOX[3])
                self.assertEqual(asset["bytes"], asset_file.stat().st_size)
                self.assertEqual(
                    asset["sha256"], hashlib.sha256(asset_file.read_bytes()).hexdigest()
                )

            self.assertGreaterEqual(len(all_features), 3)
            self.assertNotIn("Civilian Harbour", json.dumps(all_features))
            self.assertIn(
                [[5.0, 43.0], [5.1, 43.2], [5.2, 43.0], [5.3, 43.3]],
                [feature["geometry"]["coordinates"] for feature in all_features],
            )
            self.assertTrue(
                any(
                    feature["geometry"]["coordinates"][0]
                    != feature["geometry"]["coordinates"][-1]
                    for feature in all_features
                )
            )
            self.assertEqual(
                manifest["counts"]["features"],
                sum(asset["features"] for asset in manifest["assets"]),
            )

    def test_prepare_is_reproducible_with_explicit_retrieval_time(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source.json"
            first = root / "first"
            second = root / "second"
            write_json(source, OSM_FIXTURE)
            arguments = (str(source), "--generated-at", "2026-09-12T00:00:00Z")

            first_result = run_script(PREPARE, *arguments[:1], str(first), *arguments[1:])
            second_result = run_script(PREPARE, *arguments[:1], str(second), *arguments[1:])

            self.assertEqual(first_result.returncode, 0, first_result.stderr)
            self.assertEqual(second_result.returncode, 0, second_result.stderr)
            for filename in ("manifest.json", "coast-west.geojson", "coast-east.geojson"):
                self.assertEqual(
                    (first / filename).read_bytes(),
                    (second / filename).read_bytes(),
                    filename,
                )

    def test_validator_accepts_generated_pack_and_checks_hashes_and_counts(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source.json"
            pack = root / "pack"
            write_json(source, OSM_FIXTURE)
            prepared = run_script(
                PREPARE,
                str(source),
                str(pack),
                "--generated-at",
                "2026-09-12T00:00:00Z",
            )
            self.assertEqual(prepared.returncode, 0, prepared.stderr)
            manifest_path = pack / "manifest.json"

            valid = run_script(VALIDATE, str(manifest_path))
            self.assertEqual(valid.returncode, 0, valid.stderr)

            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["assets"][0]["sha256"] = "0" * 64
            write_json(manifest_path, manifest)
            bad_hash = run_script(VALIDATE, str(manifest_path))
            self.assertNotEqual(bad_hash.returncode, 0)

            manifest["assets"][0]["sha256"] = hashlib.sha256(
                (pack / manifest["assets"][0]["path"]).read_bytes()
            ).hexdigest()
            manifest["counts"]["vertices"] += 1
            write_json(manifest_path, manifest)
            bad_count = run_script(VALIDATE, str(manifest_path))
            self.assertNotEqual(bad_count.returncode, 0)

    def test_validator_rejects_malformed_empty_wrong_crs_and_invalid_lines(self) -> None:
        invalid_cases = {
            "non_feature_collection": {"type": "GeometryCollection", "geometries": []},
            "empty": {"type": "FeatureCollection", "features": []},
            "wrong_crs": {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {},
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [[5.0, 43.0], [5.1, 43.1]],
                        },
                    }
                ],
            },
            "out_of_bounds": {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {},
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [[5.0, 43.0], [6.6, 43.1]],
                        },
                    }
                ],
            },
            "invalid_coordinates": {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {},
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [[5.0, 43.0], ["6.0", 43.1]],
                        },
                    }
                ],
            },
            "polygon_instead_of_line": {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {},
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [[[5.0, 43.0], [5.1, 43.0], [5.0, 43.0]]],
                        },
                    }
                ],
            },
        }

        for name, geojson in invalid_cases.items():
            with self.subTest(name=name), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                pack = root / "pack"
                pack.mkdir()
                manifest_path = make_manifest(
                    pack,
                    geojson,
                    crs="EPSG:3857" if name == "wrong_crs" else "WGS84",
                )
                result = run_script(VALIDATE, str(manifest_path))
                self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertIn("validate-mission-coast:", result.stderr)

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            pack = root / "pack"
            pack.mkdir()
            manifest = pack / "manifest.json"
            manifest.write_text("{", encoding="utf-8")
            result = run_script(VALIDATE, str(manifest))
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("validate-mission-coast:", result.stderr)

    def test_validator_rejects_manifest_for_asset_outside_pack(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            pack = root / "pack"
            pack.mkdir()
            geojson = {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {},
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [[5.0, 43.0], [5.1, 43.1]],
                        },
                    }
                ],
            }
            manifest_path = make_manifest(pack, geojson)
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["assets"][0]["path"] = "../outside.geojson"
            write_json(manifest_path, manifest)
            (root / "outside.geojson").write_bytes((pack / "coast-west.geojson").read_bytes())
            result = run_script(VALIDATE, str(manifest_path))
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("validate-mission-coast:", result.stderr)


if __name__ == "__main__":
    unittest.main()
