import { useEffect, useRef, useState } from "react";
import {
  AttributionControl,
  getVersion,
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  ScaleControl,
  setWorkerUrl,
} from "maplibre-gl";
import {
  Building2,
  EyeOff,
  Grid3x3,
  Layers,
  LoaderCircle,
  Map as MapIcon,
  MonitorX,
  Mountain,
  Satellite,
  ZoomIn,
} from "lucide-react";
import { API_BASE_URL } from "../api";
import { formatNumber } from "../format";
import { DENSITY_STOPS, NO_DATA_COLOR, PVOUT_RAMP, densityColorExpression, pvoutColorExpression } from "./colors";
import "./SolarMap.css";

// MapLibre 6 ships its worker as a separate module. Bundling it through webpack/Babel breaks
// it, so `npm start` and `npm run build` copy it untouched into public/ (see package.json).
setWorkerUrl(`${process.env.PUBLIC_URL}/maplibre-gl-worker.mjs?v=${getVersion()}`);

// Kota and Kabupaten Bogor, from public.batas_bogor.
const STUDY_BOUNDS = [
  [106.401214, -6.788518],
  [107.227782, -6.302244],
];
// Roof tiles exist from zoom 15; below that the map shows the summed grid cells.
export const ROOF_ZOOM = 15;

const BASEMAPS = [
  { id: "gray", label: "Abu-abu", icon: MapIcon },
  { id: "osm", label: "Berwarna", icon: Mountain },
  { id: "satellite", label: "Satelit", icon: Satellite },
];

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const BUILDINGS_ATTRIBUTION = "Bangunan &copy; Google Open Buildings · PVOUT &copy; Global Solar Atlas";

// Part of every tile URL. Browsers once kept tiles for a day; bumping this makes them fetch
// fresh ones. The server now has browsers revalidate each tile, so re-imports show up anyway.
const TILE_VERSION = 2;

// Layer settings the viewer can change, remembered in this browser.
const SETTINGS_KEY = "solarroofgis.map-settings";
const DEFAULT_SETTINGS = { basemap: "gray", roofs: true, cells: true, opacity: 0.9 };

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// Roofs fade in over the first half zoom level they appear at.
function roofOpacity(opacity) {
  return ["interpolate", ["linear"], ["zoom"], ROOF_ZOOM, 0.35 * opacity, ROOF_ZOOM + 0.4, opacity];
}

// Sparse cells stay see-through so the dense kampung and town centres stand out, and the
// cells fade out as the roofs fade in.
function cellOpacity(opacity) {
  const byDensity = ["interpolate", ["linear"], ["get", "density"], 0, 0.33 * opacity, 50, 0.72 * opacity, 200, 0.94 * opacity];
  return ["interpolate", ["linear"], ["zoom"], 8, byDensity, 14.6, byDensity, ROOF_ZOOM + 0.2, 0];
}

function mapStyle() {
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 19,
        attribution: OSM_ATTRIBUTION,
      },
      // OpenStreetMap has no imagery of its own; Esri World Imagery is free to use with attribution.
      esri: {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        maxzoom: 18,
        attribution: "Citra &copy; Esri, Maxar, Earthstar Geographics",
      },
      overview: {
        type: "vector",
        tiles: [`${API_BASE_URL}/api/tiles/overview/{z}/{x}/{y}.pbf?v=${TILE_VERSION}`],
        minzoom: 8,
        maxzoom: 14,
        bounds: STUDY_BOUNDS.flat(),
        attribution: BUILDINGS_ATTRIBUTION,
      },
      buildings: {
        type: "vector",
        tiles: [`${API_BASE_URL}/api/tiles/buildings/{z}/{x}/{y}.pbf?v=${TILE_VERSION}`],
        minzoom: ROOF_ZOOM,
        maxzoom: 16,
        bounds: STUDY_BOUNDS.flat(),
        promoteId: { buildings: "id" },
        attribution: BUILDINGS_ATTRIBUTION,
      },
      boundary: { type: "geojson", data: `${API_BASE_URL}/api/boundaries` },
      selected: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#e4ebe8" } },
      {
        id: "basemap-osm",
        type: "raster",
        source: "osm",
        paint: { "raster-saturation": -1, "raster-contrast": -0.12, "raster-brightness-min": 0.08 },
      },
      { id: "basemap-esri", type: "raster", source: "esri", layout: { visibility: "none" } },
      {
        id: "overview-fill",
        type: "fill",
        source: "overview",
        "source-layer": "cells",
        maxzoom: ROOF_ZOOM + 0.5,
        paint: {
          "fill-color": densityColorExpression(),
          "fill-opacity": cellOpacity(DEFAULT_SETTINGS.opacity),
        },
      },
      {
        id: "overview-hover",
        type: "line",
        source: "overview",
        "source-layer": "cells",
        maxzoom: ROOF_ZOOM,
        paint: {
          "line-color": "#10302b",
          "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 2, 0],
        },
      },
      {
        id: "buildings-fill",
        type: "fill",
        source: "buildings",
        "source-layer": "buildings",
        minzoom: ROOF_ZOOM,
        paint: {
          "fill-color": pvoutColorExpression(null),
          "fill-opacity": roofOpacity(DEFAULT_SETTINGS.opacity),
        },
      },
      {
        id: "buildings-line",
        type: "line",
        source: "buildings",
        "source-layer": "buildings",
        minzoom: ROOF_ZOOM + 0.5,
        paint: {
          "line-color": "#8a3a0a",
          "line-opacity": 0.6 * DEFAULT_SETTINGS.opacity,
          "line-width": ["interpolate", ["linear"], ["zoom"], 15.5, 0.3, 18, 1],
        },
      },
      {
        id: "buildings-hover",
        type: "line",
        source: "buildings",
        "source-layer": "buildings",
        minzoom: ROOF_ZOOM,
        paint: {
          "line-color": "#10302b",
          "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 2.2, 0],
        },
      },
      {
        id: "boundary-casing",
        type: "line",
        source: "boundary",
        paint: { "line-color": "#ffffff", "line-width": 4, "line-opacity": 0.6 },
      },
      {
        id: "boundary-line",
        type: "line",
        source: "boundary",
        paint: { "line-color": "#173a35", "line-width": 1.8, "line-dasharray": [3, 2] },
      },
      {
        id: "selected-glow",
        type: "line",
        source: "selected",
        paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.85 },
      },
      {
        id: "selected-line",
        type: "line",
        source: "selected",
        paint: { "line-color": "#10302b", "line-width": 3 },
      },
    ],
  };
}

function createMap(container) {
  return new MapLibreMap({
    container,
    style: mapStyle(),
    bounds: STUDY_BOUNDS,
    fitBoundsOptions: { padding: 40 },
    minZoom: 8,
    maxZoom: 20,
    maxBounds: [
      [105.9, -7.2],
      [107.75, -5.9],
    ],
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
    // Keep tiles across small pans and zooms instead of re-requesting them.
    maxTileCacheSize: 600,
  });
}

// MapLibre draws with WebGL2 on the GPU; without it the map cannot start at all.
function supportsWebGL2() {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

function NoWebGL() {
  return (
    <div className="map-unsupported" role="alert">
      <span className="map-unsupported-icon" aria-hidden="true">
        <MonitorX size={28} />
      </span>
      <h2>Peta tidak dapat ditampilkan di browser ini</h2>
      <p>
        Peta memakai WebGL2 agar jutaan atap bisa digambar dengan lancar oleh kartu grafis. Buka di Chrome,
        Edge, Firefox, atau Safari versi terbaru, dan pastikan akselerasi perangkat keras (hardware
        acceleration) aktif di pengaturan browser.
      </p>
    </div>
  );
}

function buildingTooltip(properties) {
  const pvout =
    properties.pvout === undefined || properties.pvout === null
      ? "tidak ada data"
      : `${formatNumber(properties.pvout)} kWh/kWp`;
  return `<div class="map-tip">
    <div class="map-tip-row"><span>Sinar matahari</span><strong>${pvout}</strong></div>
    <div class="map-tip-row"><span>Luas atap</span><strong>${formatNumber(properties.area)} m²</strong></div>
    <p class="map-tip-hint">Klik untuk melihat potensi listrik</p>
  </div>`;
}

function cellTooltip(properties) {
  return `<div class="map-tip">
    <div class="map-tip-row"><span>Bangunan</span><strong>${formatNumber(properties.count)}</strong></div>
    <div class="map-tip-row"><span>Potensi listrik</span><strong>${formatNumber(properties.mwh)} MWh/thn</strong></div>
    <div class="map-tip-row"><span>Kepadatan</span><strong>${formatNumber(properties.density)} MWh/ha</strong></div>
    <p class="map-tip-hint">Klik untuk memperbesar ke atap</p>
  </div>`;
}

// Hover outline plus a tooltip for one interactive layer.
function bindHover(map, popup, layerId, source, sourceLayer, render) {
  let hovered = null;
  const clear = () => {
    if (hovered !== null) map.setFeatureState({ source, sourceLayer, id: hovered }, { hover: false });
    hovered = null;
  };

  map.on("mousemove", layerId, (event) => {
    const feature = event.features[0];
    if (!feature) return;
    map.getCanvas().style.cursor = "pointer";
    if (feature.id !== hovered) {
      clear();
      hovered = feature.id;
      if (hovered !== undefined) map.setFeatureState({ source, sourceLayer, id: hovered }, { hover: true });
      popup.setHTML(render(feature.properties));
    }
    popup.setLngLat(event.lngLat).addTo(map);
  });
  map.on("mouseleave", layerId, () => {
    map.getCanvas().style.cursor = "";
    clear();
    popup.remove();
  });
}

function MapSettings({ settings, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const set = (key, value) => onChange({ ...settings, [key]: value });

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  return (
    <div className="map-settings" ref={rootRef}>
      <button
        type="button"
        className="map-control-button"
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-expanded={open}
        title="Pengaturan peta"
      >
        <Layers size={18} />
        <span className="map-settings-label">Lapisan</span>
      </button>
      {open && (
        <div className="settings-panel">
          <p className="settings-heading">Peta dasar</p>
          <div className="basemap-options" role="radiogroup" aria-label="Peta dasar">
            {BASEMAPS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={id === settings.basemap}
                className={`basemap-option${id === settings.basemap ? " is-active" : ""}`}
                onClick={() => set("basemap", id)}
              >
                <span className={`basemap-thumb basemap-thumb-${id}`}>
                  <Icon size={16} />
                </span>
                {label}
              </button>
            ))}
          </div>

          <p className="settings-heading">Lapisan data</p>
          <label className="settings-toggle">
            <Building2 size={16} />
            <span>Poligon atap</span>
            <input type="checkbox" role="switch" checked={settings.roofs} onChange={(event) => set("roofs", event.target.checked)} />
            <i className="switch" aria-hidden="true" />
          </label>
          <label className="settings-toggle">
            <Grid3x3 size={16} />
            <span>Kotak kawasan</span>
            <input type="checkbox" role="switch" checked={settings.cells} onChange={(event) => set("cells", event.target.checked)} />
            <i className="switch" aria-hidden="true" />
          </label>

          <div className="settings-heading settings-heading-row">
            <label htmlFor="layer-opacity">Opasitas lapisan</label>
            <span>{Math.round(settings.opacity * 100)}%</span>
          </div>
          <input
            id="layer-opacity"
            className="opacity-slider"
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={settings.opacity}
            onChange={(event) => set("opacity", Number(event.target.value))}
            style={{ "--fill": `${((settings.opacity - 0.1) / 0.9) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

function Legend({ zoom, pvoutRange }) {
  const roofs = zoom >= ROOF_ZOOM;

  return (
    <div className="map-legend">
      <p className="map-legend-title">
        {roofs ? "Intensitas sinar matahari di atap" : "Potensi listrik atap per kawasan"}
      </p>
      <div className="map-legend-ramp" style={{ background: `linear-gradient(to right, ${PVOUT_RAMP.join(", ")})` }} />
      {roofs ? (
        <div className="map-legend-labels">
          <span>{pvoutRange ? formatNumber(pvoutRange.min) : "Rendah"}</span>
          <span>{pvoutRange ? `${formatNumber(pvoutRange.max)} kWh/kWp·thn` : "Tinggi"}</span>
        </div>
      ) : (
        <div className="map-legend-labels">
          <span>{DENSITY_STOPS[0]}</span>
          <span>{formatNumber(DENSITY_STOPS[DENSITY_STOPS.length - 1])}+ MWh/ha·thn</span>
        </div>
      )}
      <div className="map-legend-keys">
        {roofs && (
          <span>
            <i className="legend-swatch" style={{ background: NO_DATA_COLOR }} /> Tanpa data
          </span>
        )}
        <span>
          <i className="legend-dash" /> Batas Kota & Kab. Bogor
        </span>
      </div>
    </div>
  );
}

export default function SolarMap({ pvoutRange, selectedGeometry, focus, onSelect, padding }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const fittedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(10);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(loadSettings);
  const [supported, setSupported] = useState(supportsWebGL2);

  useEffect(() => {
    if (!supported) return undefined;
    let map;
    try {
      map = createMap(containerRef.current);
    } catch (error) {
      console.error("MapLibre could not start:", error);
      setSupported(false);
      return undefined;
    }
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");

    const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 12, className: "solar-popup" });
    bindHover(map, popup, "buildings-fill", "buildings", "buildings", buildingTooltip);
    bindHover(map, popup, "overview-fill", "overview", "cells", cellTooltip);

    map.on("click", "buildings-fill", (event) => {
      const id = event.features[0]?.properties.id;
      if (id !== undefined) onSelectRef.current(id);
    });
    map.on("click", "overview-fill", (event) => {
      if (map.getZoom() >= ROOF_ZOOM) return;
      map.flyTo({ center: event.lngLat, zoom: 16.5, speed: 1.6 });
    });

    const updateZoom = () => setZoom(map.getZoom());
    map.on("zoomend", updateZoom);
    map.on("dataloading", (event) => {
      if (event.sourceId === "buildings" || event.sourceId === "overview") setLoading(true);
    });
    map.on("idle", () => setLoading(false));
    map.on("load", () => {
      updateZoom();
      setReady(true);
    });

    return () => {
      popup.remove();
      map.remove();
      mapRef.current = null;
      fittedRef.current = false;
      setReady(false);
    };
  }, [supported]);

  useEffect(() => {
    if (ready) mapRef.current.setPaintProperty("buildings-fill", "fill-color", pvoutColorExpression(pvoutRange));
  }, [ready, pvoutRange]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Private windows may block storage; the settings then last for this visit only.
    }
  }, [settings]);

  const { basemap, roofs, cells, opacity } = settings;

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    const satellite = basemap === "satellite";
    map.setLayoutProperty("basemap-esri", "visibility", satellite ? "visible" : "none");
    map.setLayoutProperty("basemap-osm", "visibility", satellite ? "none" : "visible");
    map.setPaintProperty("basemap-osm", "raster-saturation", basemap === "gray" ? -1 : 0);
    map.setPaintProperty("basemap-osm", "raster-contrast", basemap === "gray" ? -0.12 : 0);
    map.setPaintProperty("basemap-osm", "raster-brightness-min", basemap === "gray" ? 0.08 : 0);
  }, [ready, basemap]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    const visibility = (on) => (on ? "visible" : "none");
    for (const id of ["buildings-fill", "buildings-line", "buildings-hover"]) {
      map.setLayoutProperty(id, "visibility", visibility(roofs));
    }
    for (const id of ["overview-fill", "overview-hover"]) {
      map.setLayoutProperty(id, "visibility", visibility(cells));
    }
    map.setPaintProperty("buildings-fill", "fill-opacity", roofOpacity(opacity));
    map.setPaintProperty("buildings-line", "line-opacity", 0.6 * opacity);
    map.setPaintProperty("overview-fill", "fill-opacity", cellOpacity(opacity));
  }, [ready, roofs, cells, opacity]);

  useEffect(() => {
    if (!ready) return;
    mapRef.current.getSource("selected").setData(
      selectedGeometry
        ? { type: "Feature", geometry: selectedGeometry, properties: {} }
        : { type: "FeatureCollection", features: [] },
    );
  }, [ready, selectedGeometry]);

  // Keep the map's visual center clear of the floating panel. The first time, also fit the
  // study area into the uncovered part; later the view slides as the panel opens or closes.
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    const edges = { top: 0, right: 0, bottom: 0, left: 0, ...padding };
    if (fittedRef.current) {
      map.easeTo({ padding: edges, duration: 300 });
    } else {
      fittedRef.current = true;
      map.setPadding(edges);
      map.fitBounds(STUDY_BOUNDS, { padding: 30, duration: 0 });
    }
  }, [ready, padding]);

  useEffect(() => {
    if (ready && focus) {
      mapRef.current.flyTo({ center: [focus.center[1], focus.center[0]], zoom: focus.zoom, speed: 1.4 });
    }
  }, [ready, focus]);

  const showRoofs = zoom >= ROOF_ZOOM;

  if (!supported) {
    return (
      <div className="solar-map">
        <NoWebGL />
      </div>
    );
  }

  return (
    <div className="solar-map">
      <div ref={containerRef} className="solar-map-canvas" />

      <div className="map-controls-top">
        <MapSettings settings={settings} onChange={setSettings} />
      </div>

      <div className="map-status" role="status">
        {loading ? (
          <span className="map-chip">
            <LoaderCircle size={15} className="spin" /> Memuat data…
          </span>
        ) : showRoofs && !roofs ? (
          <span className="map-chip">
            <EyeOff size={15} /> Poligon atap disembunyikan
          </span>
        ) : showRoofs ? (
          <span className="map-chip">
            <Building2 size={15} /> Klik atap untuk melihat potensinya
          </span>
        ) : (
          <span className="map-chip">
            <ZoomIn size={15} /> Perbesar atau klik kawasan untuk melihat atap
          </span>
        )}
      </div>

      <Legend zoom={zoom} pvoutRange={pvoutRange} />
    </div>
  );
}
