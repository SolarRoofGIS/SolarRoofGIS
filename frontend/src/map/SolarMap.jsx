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
  Check,
  EyeOff,
  Layers,
  LoaderCircle,
  Map as MapIcon,
  MonitorX,
  Mountain,
  PenLine,
  Satellite,
  Sun,
  Undo2,
  X,
  ZoomIn,
} from "lucide-react";
import { API_BASE_URL, fetchJson } from "../api";
import { formatNumber } from "../format";
import { PVOUT_RAMP, pvoutColorExpression } from "./colors";
import { RoofEditor } from "./roofDrawing";
import { EMPTY_IMAGE, buildSolarOverlay } from "./solarOverlay";
import "./SolarMap.css";

// MapLibre 6 ships its worker as a separate module. Bundling it through webpack/Babel breaks
// it, so `npm start` and `npm run build` copy it untouched into public/ (see package.json).
setWorkerUrl(`${process.env.PUBLIC_URL}/maplibre-gl-worker.mjs?v=${getVersion()}`);

// Kota and Kabupaten Bogor, from public.batas_bogor.
const STUDY_BOUNDS = [
  [106.401214, -6.788518],
  [107.227782, -6.302244],
];
// Roof tiles exist from zoom 15; below that the map shows the PVOUT overlay.
export const ROOF_ZOOM = 15;
// Below this a roof is a few pixels wide; "Gambar atap" first zooms in to DRAW_START_ZOOM.
const DRAW_MIN_ZOOM = 16;
const DRAW_START_ZOOM = 17.5;
// Roofs the viewer drew or reshaped, kept apart from the PVOUT colors of the data.
const DRAWN_COLOR = "#1f4a3f";

const BASEMAPS = [
  { id: "gray", label: "Abu-abu", icon: MapIcon },
  { id: "osm", label: "Berwarna", icon: Mountain },
  { id: "satellite", label: "Satelit", icon: Satellite },
];

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const BUILDINGS_ATTRIBUTION = "Bangunan &copy; Google Open Buildings · PVOUT &copy; Global Solar Atlas";

// Part of every tile URL. Browsers once kept tiles for a day; bumping this makes them fetch
// fresh ones. The server now has browsers revalidate each tile, so re-imports show up anyway.
const TILE_VERSION = 3;

// Layer settings the viewer can change, remembered in this browser.
const SETTINGS_KEY = "solarroofgis.map-settings";
const DEFAULT_SETTINGS = { basemap: "gray", roofs: true, solar: true, roofOpacity: 0.9, solarOpacity: 0.8 };

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// Roofs fade in over the first half zoom level they appear at.
function roofFade(opacity) {
  return ["interpolate", ["linear"], ["zoom"], ROOF_ZOOM, 0.35 * opacity, ROOF_ZOOM + 0.4, opacity];
}

// The overlay and the cells of buildings above it fade out as the roofs fade in.
function solarFade(opacity) {
  return ["interpolate", ["linear"], ["zoom"], 14.6, opacity, ROOF_ZOOM + 0.2, 0];
}

function cellFade(opacity) {
  return ["interpolate", ["linear"], ["zoom"], 14.4, opacity, ROOF_ZOOM, 0];
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
      // Drawn in the browser from /api/pvout/grid once the map has loaded.
      solar: {
        type: "image",
        url: EMPTY_IMAGE,
        coordinates: [
          [STUDY_BOUNDS[0][0], STUDY_BOUNDS[1][1]],
          [STUDY_BOUNDS[1][0], STUDY_BOUNDS[1][1]],
          [STUDY_BOUNDS[1][0], STUDY_BOUNDS[0][1]],
          [STUDY_BOUNDS[0][0], STUDY_BOUNDS[0][1]],
        ],
      },
      boundary: { type: "geojson", data: `${API_BASE_URL}/api/boundaries` },
      selected: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      // The roof outline the viewer drew, and the outline being drawn or reshaped right now.
      custom: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      draft: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
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
        id: "solar-overlay",
        type: "raster",
        source: "solar",
        maxzoom: ROOF_ZOOM + 0.5,
        paint: {
          "raster-opacity": solarFade(DEFAULT_SETTINGS.solarOpacity),
          "raster-resampling": "linear",
          "raster-fade-duration": 0,
        },
      },
      // Cells with buildings, colored by their mean PVOUT over the overlay; hovering shows
      // the buildings in a cell and clicking zooms to them.
      {
        id: "overview-fill",
        type: "fill",
        source: "overview",
        "source-layer": "cells",
        maxzoom: ROOF_ZOOM,
        paint: {
          "fill-color": pvoutColorExpression(null),
          "fill-opacity": cellFade(DEFAULT_SETTINGS.roofOpacity),
          "fill-antialias": false,
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
          "fill-opacity": roofFade(DEFAULT_SETTINGS.roofOpacity),
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
          "line-opacity": 0.6 * DEFAULT_SETTINGS.roofOpacity,
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
      {
        id: "custom-fill",
        type: "fill",
        source: "custom",
        paint: { "fill-color": DRAWN_COLOR, "fill-opacity": ["case", ["get", "selected"], 0.28, 0.16] },
      },
      {
        id: "custom-glow",
        type: "line",
        source: "custom",
        paint: { "line-color": "#ffffff", "line-width": ["case", ["get", "selected"], 6, 4], "line-opacity": 0.85 },
      },
      {
        id: "custom-line",
        type: "line",
        source: "custom",
        paint: { "line-color": DRAWN_COLOR, "line-width": ["case", ["get", "selected"], 2.6, 1.8], "line-dasharray": [2, 1] },
      },
      {
        id: "draft-fill",
        type: "fill",
        source: "draft",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": DRAWN_COLOR, "fill-opacity": 0.2 },
      },
      {
        id: "draft-line",
        type: "line",
        source: "draft",
        filter: ["!=", ["geometry-type"], "Point"],
        paint: { "line-color": DRAWN_COLOR, "line-width": 2.2 },
      },
      {
        id: "draft-midpoint",
        type: "circle",
        source: "draft",
        filter: ["==", ["get", "kind"], "mid"],
        paint: {
          "circle-radius": 3.5,
          "circle-color": "#ffffff",
          "circle-opacity": 0.85,
          "circle-stroke-color": DRAWN_COLOR,
          "circle-stroke-width": 1,
        },
      },
      {
        id: "draft-vertex",
        type: "circle",
        source: "draft",
        filter: ["==", ["get", "kind"], "vertex"],
        paint: {
          "circle-radius": ["case", ["boolean", ["get", "first"], false], 7, 5],
          "circle-color": ["case", ["boolean", ["get", "first"], false], "#f9a72b", "#ffffff"],
          "circle-stroke-color": DRAWN_COLOR,
          "circle-stroke-width": 2,
        },
      },
      {
        id: "draft-snap",
        type: "circle",
        source: "draft",
        filter: ["==", ["get", "kind"], "snap"],
        paint: {
          "circle-radius": 8,
          "circle-color": "rgba(0, 0, 0, 0)",
          "circle-stroke-color": "#cf4f0c",
          "circle-stroke-width": 2,
        },
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
    <div class="map-tip-row"><span>PVOUT rata-rata</span><strong>${
      properties.pvout == null ? "Tanpa data" : `${formatNumber(properties.pvout)} kWh/kWp`
    }</strong></div>
    <div class="map-tip-row"><span>Bangunan</span><strong>${formatNumber(properties.count)}</strong></div>
    <div class="map-tip-row"><span>Potensi listrik</span><strong>${formatNumber(properties.mwh)} MWh/thn</strong></div>
    <p class="map-tip-hint">Klik untuk memperbesar ke atap</p>
  </div>`;
}

// Hover outline plus a tooltip for one interactive layer, unless blocked(event) says the
// pointer belongs to something else (the drawing tool, or a drawn roof on top).
function bindHover(map, popup, layerId, source, sourceLayer, render, blocked) {
  let hovered = null;
  const clear = () => {
    if (hovered !== null) map.setFeatureState({ source, sourceLayer, id: hovered }, { hover: false });
    hovered = null;
  };

  map.on("mousemove", layerId, (event) => {
    const feature = event.features[0];
    if (blocked(event)) {
      clear();
      popup.remove();
      return;
    }
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
    if (!blocked()) map.getCanvas().style.cursor = "";
    clear();
    popup.remove();
  });
}

// One layer's opacity, greyed out while that layer is switched off.
function OpacitySlider({ id, label, settingKey, disabled = false, settings, set }) {
  const value = settings[settingKey];
  return (
    <div className={`opacity-setting${disabled ? " is-disabled" : ""}`}>
      <div className="opacity-setting-row">
        <label htmlFor={id}>{label}</label>
        <span>{Math.round(value * 100)}%</span>
      </div>
      <input
        id={id}
        className="opacity-slider"
        type="range"
        min="0.1"
        max="1"
        step="0.05"
        value={value}
        disabled={disabled}
        onChange={(event) => set(settingKey, Number(event.target.value))}
        style={{ "--fill": `${((value - 0.1) / 0.9) * 100}%` }}
      />
    </div>
  );
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
          <OpacitySlider id="roof-opacity" label="Opasitas atap" settingKey="roofOpacity" disabled={!settings.roofs} settings={settings} set={set} />
          <label className="settings-toggle">
            <Sun size={16} />
            <span>Overlay energi surya</span>
            <input type="checkbox" role="switch" checked={settings.solar} onChange={(event) => set("solar", event.target.checked)} />
            <i className="switch" aria-hidden="true" />
          </label>
          <OpacitySlider id="solar-opacity" label="Opasitas energi surya" settingKey="solarOpacity" disabled={!settings.solar} settings={settings} set={set} />
        </div>
      )}
    </div>
  );
}

function Legend({ zoom, pvoutRange }) {
  return (
    <div className="map-legend">
      <p className="map-legend-title">
        {zoom >= ROOF_ZOOM ? "Energi surya di atap (PVOUT)" : "Energi surya per tahun (PVOUT)"}
      </p>
      <div className="map-legend-ramp" style={{ background: `linear-gradient(to right, ${PVOUT_RAMP.join(", ")})` }} />
      <div className="map-legend-labels">
        <span>{pvoutRange ? formatNumber(pvoutRange.min) : "Rendah"}</span>
        <span>{pvoutRange ? `${formatNumber(pvoutRange.max)} kWh/kWp·thn` : "Tinggi"}</span>
      </div>
      <div className="map-legend-keys">
        <span>
          <i className="legend-dash" /> Batas Kota & Kab. Bogor
        </span>
      </div>
    </div>
  );
}

// Buttons for the roof drawing tool, beside the Lapisan menu.
function DrawControls({ tool, draft, onStart, onUndo, onCancel, onFinish, onDone }) {
  if (tool === "draw") {
    return (
      <div className="draw-controls">
        <button
          type="button"
          className="map-control-button map-control-icon"
          onClick={onUndo}
          disabled={draft.vertices === 0}
          title="Hapus titik terakhir (Backspace)"
          aria-label="Hapus titik terakhir"
        >
          <Undo2 size={17} />
        </button>
        <button type="button" className="map-control-button" onClick={onCancel} title="Batal (Esc)">
          <X size={17} /> Batal
        </button>
        <button
          type="button"
          className="map-control-button map-control-primary"
          onClick={onFinish}
          disabled={draft.vertices < 3}
          title="Selesai (Enter)"
        >
          <Check size={17} /> Selesai
        </button>
      </div>
    );
  }
  if (tool === "edit") {
    return (
      <div className="draw-controls">
        <button type="button" className="map-control-button map-control-primary" onClick={onDone} title="Selesai (Enter)">
          <Check size={17} /> Selesai mengubah
        </button>
      </div>
    );
  }
  return (
    <div className="draw-controls">
      <button type="button" className="map-control-button" onClick={onStart} title="Gambar bentuk atap sendiri">
        <PenLine size={17} />
        <span className="map-settings-label">Gambar atap</span>
      </button>
    </div>
  );
}

function DrawStatus({ tool, draft, replacesOldest }) {
  const area = draft.areaM2 >= 1 ? ` · ${formatNumber(draft.areaM2)} m²` : "";
  if (tool === "draw") {
    return (
      <span className="map-chip">
        <PenLine size={15} />
        {draft.vertices < 3
          ? "Klik setiap sudut atap. Titik menempel ke sudut atau tepi bangunan."
          : "Klik titik pertama atau Selesai untuk menutup bentuk."}
        {area}
        {replacesOldest && " · Atap gambar terlama akan diganti."}
      </span>
    );
  }
  return (
    <span className="map-chip">
      <PenLine size={15} /> Geser titik sudut. Klik titik kecil untuk menambah, klik kanan untuk menghapus.{area}
    </span>
  );
}

export default function SolarMap({
  pvoutRange,
  selectedGeometry,
  focus,
  onSelect,
  padding,
  tool = "off",
  customRoofs = [],
  selectedCustomId = null,
  drawReplacesOldest = false,
  onToolStart,
  onDrawFinish,
  onDrawCancel,
  onEditChange,
  onEditDone,
  onSelectCustom,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const editorRef = useRef(null);
  const fittedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onSelectCustomRef = useRef(onSelectCustom);
  onSelectCustomRef.current = onSelectCustom;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const customGeometry = customRoofs.find((roof) => roof.id === selectedCustomId)?.geometry || null;
  const customGeometryRef = useRef(customGeometry);
  customGeometryRef.current = customGeometry;
  const [draft, setDraft] = useState({ vertices: 0, areaM2: 0 });
  // The editor calls back into whatever props are current, not the ones it started with.
  const editorCallbacksRef = useRef(null);
  editorCallbacksRef.current = {
    onFinish: onDrawFinish,
    onCancel: onDrawCancel,
    onChange: onEditChange,
    onDone: onEditDone,
    onDraft: setDraft,
  };
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

    editorRef.current = new RoofEditor(map, () => editorCallbacksRef.current);

    // While drawing, clicks belong to the tool; a drawn roof sits on top of the data roofs.
    const overCustom = (event) => map.queryRenderedFeatures(event.point, { layers: ["custom-fill"] }).length > 0;
    const blocked = (event) => toolRef.current !== "off" || (event !== undefined && overCustom(event));
    const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 12, className: "solar-popup" });
    bindHover(map, popup, "buildings-fill", "buildings", "buildings", buildingTooltip, blocked);
    bindHover(map, popup, "overview-fill", "overview", "cells", cellTooltip, blocked);

    map.on("click", "buildings-fill", (event) => {
      if (blocked(event)) return;
      const id = event.features[0]?.properties.id;
      if (id !== undefined) onSelectRef.current(id);
    });
    map.on("click", "overview-fill", (event) => {
      if (blocked(event) || map.getZoom() >= ROOF_ZOOM) return;
      map.flyTo({ center: event.lngLat, zoom: 16.5, speed: 1.6 });
    });
    map.on("click", "custom-fill", (event) => {
      const id = event.features[0]?.properties.id;
      if (toolRef.current === "off" && id) onSelectCustomRef.current?.(id);
    });
    map.on("mousemove", "custom-fill", () => {
      if (toolRef.current === "off") map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "custom-fill", () => {
      if (toolRef.current === "off") map.getCanvas().style.cursor = "";
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
      editorRef.current.stop();
      editorRef.current = null;
      popup.remove();
      map.remove();
      mapRef.current = null;
      fittedRef.current = false;
      setReady(false);
    };
  }, [supported]);

  useEffect(() => {
    if (!ready) return;
    for (const id of ["overview-fill", "buildings-fill"]) {
      mapRef.current.setPaintProperty(id, "fill-color", pvoutColorExpression(pvoutRange));
    }
  }, [ready, pvoutRange]);

  // The overlay and the roofs share one PVOUT scale, so the legend reads the same at every zoom.
  useEffect(() => {
    if (!ready) return undefined;
    const controller = new AbortController();
    Promise.all([
      fetchJson("/api/pvout/grid", { signal: controller.signal }),
      fetchJson("/api/boundaries", { signal: controller.signal }),
    ])
      .then(([grid, boundary]) => mapRef.current?.getSource("solar")?.updateImage(buildSolarOverlay(grid, boundary)))
      .catch(() => {});
    return () => controller.abort();
  }, [ready]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Private windows may block storage; the settings then last for this visit only.
    }
  }, [settings]);

  const { basemap, roofs, solar, roofOpacity, solarOpacity } = settings;

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
    // The cells are buildings too, summed per area at the zooms before the roofs show.
    for (const id of ["overview-fill", "overview-hover", "buildings-fill", "buildings-line", "buildings-hover"]) {
      map.setLayoutProperty(id, "visibility", visibility(roofs));
    }
    map.setLayoutProperty("solar-overlay", "visibility", visibility(solar));
    map.setPaintProperty("buildings-fill", "fill-opacity", roofFade(roofOpacity));
    map.setPaintProperty("buildings-line", "line-opacity", 0.6 * roofOpacity);
    map.setPaintProperty("solar-overlay", "raster-opacity", solarFade(solarOpacity));
    map.setPaintProperty("overview-fill", "fill-opacity", cellFade(roofOpacity));
  }, [ready, roofs, solar, roofOpacity, solarOpacity]);

  useEffect(() => {
    if (!ready) return;
    mapRef.current.getSource("selected").setData(
      selectedGeometry
        ? { type: "Feature", geometry: selectedGeometry, properties: {} }
        : { type: "FeatureCollection", features: [] },
    );
  }, [ready, selectedGeometry]);

  // The editor reads the outline once when reshaping starts and reports every change back,
  // so it restarts only when the tool changes, not on its own edits.
  useEffect(() => {
    if (!ready) return;
    const editor = editorRef.current;
    if (tool === "draw") editor.start("draw");
    else if (tool === "edit" && customGeometryRef.current) editor.start("edit", customGeometryRef.current);
    else editor.stop();
  }, [ready, tool]);

  // The roof being reshaped is shown by the editor instead.
  useEffect(() => {
    if (!ready) return;
    mapRef.current.getSource("custom").setData({
      type: "FeatureCollection",
      features: customRoofs
        .filter((roof) => !(tool === "edit" && roof.id === selectedCustomId))
        .map((roof) => ({
          type: "Feature",
          geometry: roof.geometry,
          properties: { id: roof.id, selected: roof.id === selectedCustomId },
        })),
    });
  }, [ready, customRoofs, selectedCustomId, tool]);

  const startDrawing = () => {
    const map = mapRef.current;
    if (map && map.getZoom() < DRAW_MIN_ZOOM) map.flyTo({ zoom: DRAW_START_ZOOM, speed: 1.6 });
    onToolStart?.();
  };

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
    <div className={`solar-map${tool !== "off" ? " solar-map-drawing" : ""}`}>
      <div ref={containerRef} className="solar-map-canvas" />

      <div className="map-controls-top">
        {onToolStart && (
          <DrawControls
            tool={tool}
            draft={draft}
            onStart={startDrawing}
            onUndo={() => editorRef.current?.undo()}
            onCancel={() => editorRef.current?.cancel()}
            onFinish={() => editorRef.current?.finish()}
            onDone={onEditDone}
          />
        )}
        <MapSettings settings={settings} onChange={setSettings} />
      </div>

      <div className={`map-status${tool !== "off" ? " map-status-drawing" : ""}`} role="status">
        {tool !== "off" ? (
          <DrawStatus tool={tool} draft={draft} replacesOldest={drawReplacesOldest} />
        ) : loading ? (
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
