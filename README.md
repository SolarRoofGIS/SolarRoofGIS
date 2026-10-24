# SolarRoofGIS

Project for exploring rooftop solar potential in Kabupaten Bogor and Kota Bogor. The repository uses the same framework split as the choropleth reference project: Create React App + React Leaflet for the frontend, and Express.js + `pg` for the PostGIS API.

## Project layout

```text
SolarRoofGIS/
├── backend/       # Express.js API for PostGIS
├── frontend/      # Create React App + React Leaflet
└── data_bogor/    # Bogor photovoltaic GeoTIFF layers
```

`ref/` holds local-only scripts, the separate layer-checking webmap, source data, and documents. It is excluded from Git. The approximately 667 MB Google building GeoPackage is shared separately rather than stored in the repository.

## Run locally

Start the backend in one terminal:

```bash
cd backend
cp .env.example .env
# Set DB_PASSWORD in .env
npm install
npm run dev
```

The API listens on `http://localhost:5000`. Start the frontend separately:

```bash
cd frontend
npm install
npm start
```

The frontend opens at `http://localhost:3000`.

## PostGIS API

The API reads `public.bogor_buildings` from PostgreSQL with PostGIS enabled. The administrative-boundary table is named `public.batas_bogor`; the current API does not query it. Available routes:

- `GET /api/health`
- `GET /api/buildings?dataset=google&bbox=west,south,east,north&zoom=16`

The building endpoint clips requests to the Bogor study bounds, returns up to 2,500 features, and only returns buildings from zoom 15.5 and closer. Import the separately shared Google building GeoPackage through QGIS as `public.bogor_buildings`.

## Photovoltaic data

The 19 clipped Global Solar Atlas GeoTIFFs are in [`data_bogor/photovoltaic`](data_bogor/photovoltaic/). They can be opened directly in QGIS; importing them into PostGIS is optional.
