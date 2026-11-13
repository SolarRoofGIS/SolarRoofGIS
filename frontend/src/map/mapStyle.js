import { API_BASE_URL } from "../api";
import { pvoutColorExpression } from "./colors";
import { EMPTY_IMAGE } from "./solarOverlay";

// Kota and Kabupaten Bogor, from public.batas_bogor.
export const STUDY_BOUNDS = [
  [106.401214, -6.788518],
  [107.227782, -6.302244],
];
// Roof tiles exist from zoom 15; below that the map shows the PVOUT overlay.
export const ROOF_ZOOM = 15;
// Roofs the viewer drew or reshaped, kept apart from the PVOUT colors of the data.
const DRAWN_COLOR = "#1f4a3f";
// A panel is about a metre wide; further out the layout is a dark smudge.
const PANEL_MIN_ZOOM = 16.5;

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const BUILDINGS_ATTRIBUTION = "Bangunan &copy; Google Open Buildings · PVOUT &copy; Global Solar Atlas";

// Part of every tile URL. Browsers once kept tiles for a day; bumping this makes them fetch
// fresh ones. The server now has browsers revalidate each tile, so re-imports show up anyway.
const TILE_VERSION = 3;

export const DEFAULT_SETTINGS = { basemap: "gray", roofs: true, solar: true, roofOpacity: 0.9, solarOpacity: 0.8 };

// How the colored OpenStreetMap basemap is turned gray.
export const GRAY_BASEMAP = { "raster-saturation": -1, "raster-contrast": -0.12, "raster-brightness-min": 0.08 };

const EMPTY_DATA = { type: "FeatureCollection", features: [] };

// Roofs fade in over the first half zoom level they appear at.
export function roofFade(opacity) {
  return ["interpolate", ["linear"], ["zoom"], ROOF_ZOOM, 0.35 * opacity, ROOF_ZOOM + 0.4, opacity];
}

// The overlay and the cells of buildings above it fade out as the roofs fade in.
export function solarFade(opacity) {
  return ["interpolate", ["linear"], ["zoom"], 14.6, opacity, ROOF_ZOOM + 0.2, 0];
}

export function cellFade(opacity) {
  return ["interpolate", ["linear"], ["zoom"], 14.4, opacity, ROOF_ZOOM, 0];
}

export function mapStyle() {
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
      selected: { type: "geojson", data: EMPTY_DATA },
      // The roof outline the viewer drew, and the outline being drawn or reshaped right now.
      custom: { type: "geojson", data: EMPTY_DATA },
      draft: { type: "geojson", data: EMPTY_DATA },
      // The solar panels laid out on the selected roof.
      panels: { type: "geojson", data: EMPTY_DATA },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#e4ebe8" } },
      {
        id: "basemap-osm",
        type: "raster",
        source: "osm",
        paint: GRAY_BASEMAP,
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
        paint: {
          "line-color": DRAWN_COLOR,
          "line-width": ["case", ["get", "selected"], 2.6, 1.8],
          "line-dasharray": [2, 1],
        },
      },
      {
        id: "panels-fill",
        type: "fill",
        source: "panels",
        minzoom: PANEL_MIN_ZOOM,
        paint: { "fill-color": "#1f3b5c", "fill-opacity": 0.85 },
      },
      {
        id: "panels-line",
        type: "line",
        source: "panels",
        minzoom: PANEL_MIN_ZOOM,
        paint: { "line-color": "#dbe6f0", "line-width": ["interpolate", ["linear"], ["zoom"], 17, 0.4, 20, 1.2] },
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
