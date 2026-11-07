# SolarRoofGIS

Project for exploring rooftop solar potential in Kabupaten Bogor and Kota Bogor. The frontend is Create React App with MapLibre GL JS (WebGL vector-tile rendering), React Router, and Lucide icons; the backend is Express.js + `pg` serving a PostGIS API.

## Project layout

```text
SolarRoofGIS/
├── backend/       # Express.js API for PostGIS
├── frontend/      # Create React App + MapLibre GL
└── data_bogor/    # Bogor photovoltaic GeoTIFF layers
```

`ref/` (local-only scripts, the separate layer-checking webmap, and source data) and `docs/` (project charter, WBS, and reports) are excluded from Git. So is everything in `data_bogor/` except `photovoltaic/`: the building data (the approximately 700 MB Google building GeoPackage, the Open Buildings 2.5D CSV, the GeoJSON exports) and the boundary files are shared separately rather than stored in the repository.

## Run locally

Setting up from scratch (PostgreSQL + PostGIS, importing the building and boundary GeoPackages from the team's Google Drive with QGIS or ogr2ogr): see [SETUP.md](SETUP.md), in Indonesian.

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

The frontend opens at `http://localhost:3000` with three pages: Beranda (`/`, summary statistics and a live example roof), Peta (`/peta`, the map, with a Lapisan menu for the basemap, the roof polygons and solar overlay on/off, and a separate opacity for each, remembered per browser; a Gambar atap tool for drawing a roof outline or reshaping a database roof; `/peta?atap=<id>` opens a roof directly), and Tentang (`/tentang`, data, method, and limitations).

MapLibre GL 6 ships its Web Worker as a separate module that breaks when webpack/Babel bundles it, so `npm start` and `npm run build` first copy `node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs` into `public/` (the copy is gitignored). The map needs a browser with WebGL2; without it the map page shows an explanation instead.

## PostGIS API

The API reads `public.bogor_buildings` and `public.batas_bogor` from PostgreSQL with PostGIS enabled. Import the separately shared Google building GeoPackage through QGIS as `public.bogor_buildings`. It combines two Google Open Buildings v3 S2 cells, `2e7` and `2e5` (the western Kabupaten, Jasinga–Nanggung), each clipped to the union of the BIG Bogor polygons; footprints crossing the boundary are cut, and their source attributes are kept. Available routes:

- `GET /api/health`
- `GET /api/tiles/buildings/{z}/{x}/{y}.pbf` (Mapbox vector tiles of every building, zoom 15–16)
- `GET /api/tiles/overview/{z}/{x}/{y}.pbf` (buildings summed into grid cells, zoom 8–14)
- `GET /api/buildings/:id` (building details, geometry, and rooftop solar estimate for the info panel)
- `POST /api/roofs/estimate` with `{ "geometry": <GeoJSON Polygon or MultiPolygon> }` (the same estimate for a roof drawn on the map)
- `GET /api/stats` (building count, roof area, and technical potential per region, for the home page)
- `GET /api/method` (calculation assumptions and PVOUT range, for the about page)
- `GET /api/boundaries` (simplified Kota and Kabupaten Bogor outlines)
- `GET /api/pvout` (color-scale range for the PVOUT legend)
- `GET /api/pvout/grid` (annual PVOUT grid for the solar overlay on the zoomed-out map)
- `GET /api/buildings?dataset=google&bbox=west,south,east,north&zoom=16` (GeoJSON by bounding box, max 2,500 features; no longer used by the frontend)

The map draws all 2.67 million buildings from vector tiles that PostGIS builds with `ST_AsMVT`; the backend caches recent tiles in memory and sends them with `Cache-Control: no-cache`, so browsers revalidate (ETag, 304) and see a re-import after a reload. MapLibre parses tiles in Web Workers and draws them on the GPU, so panning and zooming stay smooth.

- **Roofs (zoom 15+):** each roof carries `id`, `area` (m²), and `pvout` (kWh/kWp per year, from `data_bogor/photovoltaic/PVOUT.tif` at the building centroid) and is colored from yellow (lower) to orange (higher). Tiles exist for zoom 15–16 only: a zoom-14 tile over central Bogor already holds about 17,000 roofs (over 1 MB), and MapLibre overzooms the zoom-16 tiles (0.15 m precision) for closer views.
- **Overview (zoom 8–14):** buildings are summed into square cells of about six screen pixels (0.002°, ~220 m, at zoom 11, halving per zoom), with the building count, roof area, mean PVOUT, and a rough yearly energy if every suitable roof had panels. Cells are colored by their mean PVOUT and belong to the roof layer in the Lapisan menu (its switch and opacity); hovering one shows its figures and clicking it zooms to its roofs. Cells without buildings are filled by a solar overlay underneath, the annual PVOUT grid (`/api/pvout/grid`) colored on the same scale, smoothed, and clipped to the Bogor boundary in the browser ([`frontend/src/map/solarOverlay.js`](frontend/src/map/solarOverlay.js)). Zoom 8–11 tiles are built in the background when the server starts.
- **Summary statistics:** `/api/stats` counts buildings per region against the subdivided boundaries once at startup (about 15 s).

The overview cells and the statistics use a fast approximation of the panel count that treats each roof as a square for the edge setback ([`backend/buildingSql.js`](backend/buildingSql.js)); the per-roof figures in the info panel buffer the real outline.

## Rooftop solar estimate

Clicking a roof shows the building attributes and a solar estimate from `GET /api/buildings/:id` in the floating info panel (a bottom sheet on phones; the interface is in Indonesian). The whole roof cannot hold panels, so the estimate works in steps (assumptions live in [`backend/solar.js`](backend/solar.js)):

1. **Setback area:** PostGIS shrinks the footprint by a 0.5 m edge clearance (`ST_Buffer` in UTM 48S).
2. **Usable area:** 70% of the setback area, for roof pitch, obstructions, shading, and access.
3. **Panels:** whole 550 Wp modules (1.134 × 2.278 m ≈ 2.58 m²) that fit in the usable area; roofs fitting fewer than 2 are marked unsuitable.
4. **Energy:** installed kWp × PVOUT (kWh/kWp, losses already included by Global Solar Atlas), yearly and per month from the monthly PVOUT layers.
5. **Indicators:** electricity value at the PLN R-1 tariff (Rp1,444.70/kWh), CO₂ avoided at 0.87 kg/kWh, and how the location's PVOUT ranks against the rest of the Bogor study area.

## Drawn roofs

Where the Google outline is missing or does not fit, the **Gambar atap** button on the map lets the viewer click the corners of a roof (corners snap to nearby building corners and edges; hold Alt to place freely). Double-click, Enter, or clicking the first corner closes the outline; Backspace removes the last corner and Esc cancels. **Ubah bentuknya** in a selected roof's panel copies its outline for reshaping instead. While reshaping, corners can be dragged, the small midpoints add a corner, and right-click or double-click removes one ([`frontend/src/map/roofDrawing.js`](frontend/src/map/roofDrawing.js)).

The outline is sent to `POST /api/roofs/estimate` ([`backend/routes/roofs.js`](backend/routes/roofs.js)), which repairs self-crossing outlines with `ST_MakeValid`, requires the roof to lie in Kota or Kabupaten Bogor, and runs the same steps as a database roof ([`backend/roofEstimate.js`](backend/roofEstimate.js)). The drawn roof is kept in the browser's local storage and can be downloaded as GeoJSON with its estimate. Up to two drawn roofs are kept; drawing another replaces the oldest.

## Photovoltaic data

The 19 clipped Global Solar Atlas GeoTIFFs are in [`data_bogor/photovoltaic`](data_bogor/photovoltaic/). They can be opened directly in QGIS. The backend reads `PVOUT.tif` straight from this folder at startup (override with `PVOUT_PATH`), so the rasters do not need to be imported into PostGIS.
