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
import { MonitorX } from "lucide-react";
import { fetchJson } from "../api";
import { formatNumber } from "../format";
import { pvoutColorExpression } from "./colors";
import { BrowseStatus, DrawControls, DrawStatus, Legend, MapSettings } from "./MapControls";
import {
  DEFAULT_SETTINGS,
  GRAY_BASEMAP,
  ROOF_ZOOM,
  STUDY_BOUNDS,
  cellFade,
  mapStyle,
  roofFade,
  solarFade,
} from "./mapStyle";
import { RoofEditor } from "./roofDrawing";
import { buildSolarOverlay } from "./solarOverlay";
import "./SolarMap.css";

// MapLibre 6 ships its worker as a separate module. Bundling it through webpack/Babel breaks
// it, so `npm start` and `npm run build` copy it untouched into public/ (see package.json).
setWorkerUrl(`${process.env.PUBLIC_URL}/maplibre-gl-worker.mjs?v=${getVersion()}`);

// Below this a roof is a few pixels wide; "Gambar atap" first zooms in to DRAW_START_ZOOM.
const DRAW_MIN_ZOOM = 16;
const DRAW_START_ZOOM = 17.5;
// Layer settings the viewer can change, remembered in this browser.
const SETTINGS_KEY = "solarroofgis.map-settings";

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) };
  } catch {
    return DEFAULT_SETTINGS;
  }
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
        Peta memakai WebGL2 agar jutaan atap bisa digambar dengan lancar oleh kartu grafis. Buka di Chrome, Edge,
        Firefox, atau Safari versi terbaru, dan pastikan akselerasi perangkat keras (hardware acceleration) aktif di
        pengaturan browser.
      </p>
    </div>
  );
}

function formatPvout(value) {
  return value == null ? "Tidak ada data" : `${formatNumber(value)} kWh/kWp`;
}

function buildingTooltip(properties) {
  return `<div class="map-tip">
    <div class="map-tip-row"><span>Sinar matahari</span><strong>${formatPvout(properties.pvout)}</strong></div>
    <div class="map-tip-row"><span>Luas atap</span><strong>${formatNumber(properties.area)} m²</strong></div>
    <p class="map-tip-hint">Klik untuk melihat potensi listrik</p>
  </div>`;
}

function cellTooltip(properties) {
  return `<div class="map-tip">
    <div class="map-tip-row"><span>PVOUT rata-rata</span><strong>${formatPvout(properties.pvout)}</strong></div>
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

export default function SolarMap({
  pvoutRange,
  selectedGeometry,
  focus,
  onSelect,
  padding,
  tool,
  customRoofs,
  selectedCustomId,
  drawReplacesOldest,
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
      if (toolRef.current === "off" && id) onSelectCustomRef.current(id);
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
    for (const [property, value] of Object.entries(GRAY_BASEMAP)) {
      map.setPaintProperty("basemap-osm", property, basemap === "gray" ? value : 0);
    }
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
    mapRef.current
      .getSource("selected")
      .setData(
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
    onToolStart();
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
      mapRef.current.flyTo({ center: focus.center, zoom: focus.zoom, speed: 1.4 });
    }
  }, [ready, focus]);

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
        <DrawControls
          tool={tool}
          draft={draft}
          onStart={startDrawing}
          onUndo={() => editorRef.current?.undo()}
          onCancel={() => editorRef.current?.cancel()}
          onFinish={() => editorRef.current?.finish()}
          onDone={onEditDone}
        />
        <MapSettings settings={settings} onChange={setSettings} />
      </div>

      <div className={`map-status${tool !== "off" ? " map-status-drawing" : ""}`} role="status">
        {tool !== "off" ? (
          <DrawStatus tool={tool} draft={draft} replacesOldest={drawReplacesOldest} />
        ) : (
          <BrowseStatus loading={loading} showRoofs={zoom >= ROOF_ZOOM} roofsVisible={roofs} />
        )}
      </div>

      <Legend zoom={zoom} pvoutRange={pvoutRange} />
    </div>
  );
}
