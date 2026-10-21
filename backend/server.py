#!/usr/bin/env python3
"""Small local GeoJSON API backed by PostGIS for the Bogor webmap."""

from __future__ import annotations

from contextlib import contextmanager
import gzip
import json
import math
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import psycopg2


HOST = os.environ.get("API_HOST", "127.0.0.1")
PORT = int(os.environ.get("API_PORT", "8765"))
MAX_FEATURES = 2500
MIN_BUILDING_ZOOM = 15.5
STUDY_BOUNDS = (106.401214, -6.788518, 107.227782, -6.302244)
DATASETS = {
    "google": {"table": "buildings_google", "marker": "bangunan_google.complete.json"},
}


@contextmanager
def db_connection():
    connection = connect_db()
    try:
        yield connection
    finally:
        connection.close()


def connect_db():
    """Connect using DATABASE_URL or standard PG* variables."""
    dsn = os.environ.get("DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn, connect_timeout=5)

    options = {
        "dbname": os.environ.get("PGDATABASE", "SolarRoofGIS"),
        "user": os.environ.get("PGUSER", "postgres"),
        "host": os.environ.get("PGHOST", "127.0.0.1"),
        "port": int(os.environ.get("PGPORT", "5433")),
        "connect_timeout": 5,
    }
    if os.environ.get("PGPASSWORD"):
        options["password"] = os.environ["PGPASSWORD"]
    if os.environ.get("PGSSLMODE"):
        options["sslmode"] = os.environ["PGSSLMODE"]
    return psycopg2.connect(**options)


def json_bytes(payload: dict) -> bytes:
    return json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def empty_collection(message: str | None = None, **extra) -> dict:
    result = {"type": "FeatureCollection", "features": [], "count": 0, "truncated": False}
    if message:
        result["message"] = message
    result.update(extra)
    return result


class WebmapHandler(BaseHTTPRequestHandler):
    server_version = "SolarRoofBogorAPI/0.2"

    def end_headers(self) -> None:
        origin = self.headers.get("Origin", "")
        if origin.startswith("http://localhost:") or origin.startswith("http://127.0.0.1:"):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self._send_json(self._health())
            return
        if parsed.path != "/api/buildings":
            self._send_json({"error": "Endpoint tidak ditemukan."}, status=404)
            return

        query = parse_qs(parsed.query)
        dataset = query.get("dataset", [""])[0].lower()
        if dataset not in DATASETS:
            self._send_json({"error": "Dataset yang tersedia: google."}, status=400)
            return

        try:
            bbox = [float(part) for part in query.get("bbox", [""])[0].split(",")]
            zoom = float(query.get("zoom", ["0"])[0])
        except ValueError:
            self._send_json({"error": "bbox dan zoom harus berupa angka."}, status=400)
            return
        if len(bbox) != 4 or not all(math.isfinite(value) for value in [*bbox, zoom]):
            self._send_json({"error": "bbox tidak valid."}, status=400)
            return

        west, south, east, north = bbox
        if west >= east or south >= north or east - west > 180 or north - south > 90:
            self._send_json({"error": "Urutan bbox tidak valid."}, status=400)
            return
        if zoom < MIN_BUILDING_ZOOM:
            self._send_json(empty_collection("Perbesar peta untuk menampilkan bangunan.", minZoom=MIN_BUILDING_ZOOM))
            return

        west = max(west, STUDY_BOUNDS[0])
        south = max(south, STUDY_BOUNDS[1])
        east = min(east, STUDY_BOUNDS[2])
        north = min(north, STUDY_BOUNDS[3])
        if west >= east or south >= north:
            self._send_json(empty_collection())
            return

        started = time.monotonic()
        try:
            payload = self._query_buildings(dataset, (west, south, east, north))
        except Exception as error:  # Keep the local service alive and return an actionable response.
            print(f"API error for {dataset}: {error}", file=sys.stderr, flush=True)
            self._send_json({"error": "Data PostGIS tidak dapat dibaca.", "detail": str(error)}, status=500)
            return
        payload["dataset"] = dataset
        payload["bbox"] = [west, south, east, north]
        payload["elapsedMs"] = round((time.monotonic() - started) * 1000)
        self._send_json(payload)
        print(
            f"{dataset}: {payload['count']:,} feature(s), truncated={payload['truncated']}, "
            f"{payload['elapsedMs']} ms",
            flush=True,
        )

    def _query_buildings(self, dataset: str, bbox: tuple[float, float, float, float]) -> dict:
        table = DATASETS[dataset]["table"]  # Table names are fixed above; query values stay parameterized.
        sql = f"""
            WITH query_box AS (
                SELECT ST_MakeEnvelope(%s, %s, %s, %s, 4326) AS geom
            )
            SELECT b.id,
                   ST_AsGeoJSON(b.geom, 6) AS geometry,
                   to_jsonb(b) - 'geom' - 'id' AS properties
            FROM public.{table} AS b
            CROSS JOIN query_box AS q
            WHERE b.geom && q.geom
              AND ST_Intersects(b.geom, q.geom)
            LIMIT %s
        """
        with db_connection() as connection, connection.cursor() as cursor:
            cursor.execute(sql, (*bbox, MAX_FEATURES + 1))
            rows = cursor.fetchall()

        truncated = len(rows) > MAX_FEATURES
        rows = rows[:MAX_FEATURES]
        features = []
        for feature_id, geometry, properties in rows:
            if isinstance(geometry, str):
                geometry = json.loads(geometry)
            if isinstance(properties, str):
                properties = json.loads(properties)
            features.append({
                "type": "Feature",
                "id": feature_id,
                "properties": properties or {},
                "geometry": geometry,
            })
        return {
            "type": "FeatureCollection",
            "features": features,
            "count": len(features),
            "truncated": truncated,
            "limit": MAX_FEATURES,
        }

    def _health(self) -> dict:
        try:
            with db_connection() as connection, connection.cursor() as cursor:
                cursor.execute("SELECT current_database(), PostGIS_Full_Version()")
                database, postgis_version = cursor.fetchone()
                datasets = {}
                for key, config in DATASETS.items():
                    cursor.execute("SELECT to_regclass(%s) IS NOT NULL", (f"public.{config['table']}",))
                    available = cursor.fetchone()[0]
                    marker_path = Path(__file__).resolve().parent.parent / "data_bogor" / config["marker"]
                    marker = json.loads(marker_path.read_text(encoding="utf-8")) if marker_path.is_file() else {}
                    datasets[key] = {"available": available, "features": marker.get("feature_count")}
            return {
                "ok": all(item["available"] for item in datasets.values()),
                "storage": "PostGIS",
                "database": database,
                "postgisVersion": postgis_version,
                "datasets": datasets,
                "minZoom": MIN_BUILDING_ZOOM,
                "maxFeaturesPerLayer": MAX_FEATURES,
            }
        except Exception as error:
            return {
                "ok": False,
                "storage": "PostGIS",
                "error": str(error),
                "datasets": {key: {"available": False} for key in DATASETS},
                "minZoom": MIN_BUILDING_ZOOM,
                "maxFeaturesPerLayer": MAX_FEATURES,
            }

    def _send_json(self, payload: dict, status: int = 200) -> None:
        body = json_bytes(payload)
        encoding = self.headers.get("Accept-Encoding", "")
        if "gzip" in encoding and len(body) > 1024:
            body = gzip.compress(body)
            compressed = True
        else:
            compressed = False
        self.send_response(status)
        self.send_header("Content-Type", "application/geo+json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        if compressed:
            self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    ThreadingHTTPServer.daemon_threads = True
    server = ThreadingHTTPServer((HOST, PORT), WebmapHandler)
    print(f"Bogor building API ready at http://{HOST}:{PORT} (PostGIS)", flush=True)
    server.serve_forever()
