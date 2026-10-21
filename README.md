# SolarRoofGIS

Project for exploring rooftop solar potential in Kabupaten Bogor and Kota Bogor. The repository contains the backend API, a minimal React + Next.js frontend scaffold, and the clipped photovoltaic GeoTIFF layers. The Google building GeoPackage is about 667 MB and is shared separately rather than stored in Git.

## Project layout

```text
SolarRoofGIS/
├── backend/       # Python API for PostGIS
├── data_bogor/    # Bogor photovoltaic GeoTIFF layers
└── frontend/      # React + Next.js App Router scaffold
```

`ref/` holds local-only scripts, the layer-checking webmap, source data, and documents. It is excluded from Git.

## Backend

The API reads the `public.buildings_google` table from a PostgreSQL database with PostGIS enabled. The Bogor administrative-boundary table is named `public.batas_bogor`; the current API does not query it. Install the Python packages with `python3 -m pip install -r backend/requirements.txt`, configure the `PGHOST`, `PGPORT`, `PGDATABASE`, and `PGUSER` environment variables, then run `python3 backend/server.py`.

On this device, the database is `SolarRoofGIS` on `127.0.0.1:5433`. Keep its password in `~/.pgpass`, not in this repository. The API provides `/api/health` and `/api/buildings`.

To load the separately shared Google building GeoPackage, connect QGIS to the target PostGIS database and import it as `public.buildings_google`. The database user needs permission to create the table.

## Photovoltaic data

The 19 clipped Global Solar Atlas GeoTIFFs are in [`data_bogor/photovoltaic`](data_bogor/photovoltaic/). They can be opened directly in QGIS; importing them into PostGIS is optional.
