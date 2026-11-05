
import React, { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import * as turf from "@turf/turf";

import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";

// Batas koordinat Bogor Raya
const BOGOR_BOUNDS = [
  [-6.800, 106.600],
  [-6.400, 107.100]
];

// Mengatur batas wilayah dan zoom peta
function MapConfigurator() {
  const map = useMap();

  useEffect(() => {
    map.setMinZoom(11);
    map.setMaxZoom(22);
    map.setMaxBounds(BOGOR_BOUNDS);
    map.options.maxBoundsViscosity = 1.0;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => clearTimeout(timer);
  }, [map]);

  return null;
}

// Mengarahkan peta ke lokasi pencarian
function FlyToLocation({ position }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(position, 16, { duration: 1.5 });
    }
  }, [position, map]);

  return null;
}

// Mengatur fitur gambar, edit, dan hapus polygon
function GeomanController({ activeTool, onPolygonDrawn }) {
  const map = useMap();

  // Mengatur mode Geoman
  useEffect(() => {
    map.pm.disableDraw();
    map.pm.disableGlobalEditMode();
    map.pm.disableGlobalRemovalMode();

    if (activeTool === "draw") {
      map.pm.enableDraw("Polygon", {
        snappable: true,
        snapDistance: 20,
        pathOptions: {
          color: "#3b82f6",
          weight: 3
        }
      });
    } else if (activeTool === "edit") {
      map.pm.enableGlobalEditMode();
    } else if (activeTool === "delete") {
      map.pm.enableGlobalRemovalMode();
    }

    return () => {
      map.pm.disableDraw();
      map.pm.disableGlobalEditMode();
      map.pm.disableGlobalRemovalMode();
    };
  }, [activeTool, map]);

  // Mengirim luas dan GeoJSON polygon ke App.js
  useEffect(() => {
    if (!onPolygonDrawn) return;

    const updatePolygonData = (layer) => {
      const polygonGeoJSON = layer.toGeoJSON();
      const luasArea = turf.area(polygonGeoJSON);

      onPolygonDrawn({
        luasArea,
        polygonGeoJSON
      });
    };

    const handleCreate = (e) => {
      updatePolygonData(e.layer);

      // Memperbarui data ketika polygon selesai diedit
      e.layer.on("pm:update", handleUpdate);
    };

    const handleUpdate = (e) => {
      updatePolygonData(e.layer);
    };

    const handleRemove = () => {
      onPolygonDrawn(null);
    };

    map.on("pm:create", handleCreate);
    map.on("pm:remove", handleRemove);

    return () => {
      map.off("pm:create", handleCreate);
      map.off("pm:remove", handleRemove);
    };
  }, [map, onPolygonDrawn]);

  return null;
}

// Pilihan basemap
const BASEMAP_URLS = {
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; OpenStreetMap contributors',
    maxNativeZoom: 19,
    maxZoom: 22
  },
  satelite: {
    url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    attribution: '&copy; Google',
    maxNativeZoom: 20,
    maxZoom: 22
  }
};

export default function MapView({
  activeBasemap,
  searchPosition,
  activeTool,
  onPolygonDrawn
}) {
  const selectedBasemap =
    BASEMAP_URLS[activeBasemap] || BASEMAP_URLS.osm;

  return (
    <MapContainer
      center={[-6.545, 106.8145]}
      zoom={13}
      scrollWheelZoom={true}
      style={{ width: "100%", height: "100%" }}
    >
      <MapConfigurator />

      <FlyToLocation position={searchPosition} />

      <GeomanController
        activeTool={activeTool}
        onPolygonDrawn={onPolygonDrawn}
      />

      <TileLayer
        key={activeBasemap}
        attribution={selectedBasemap.attribution}
        url={selectedBasemap.url}
        maxNativeZoom={selectedBasemap.maxNativeZoom}
        maxZoom={selectedBasemap.maxZoom}
      />
    </MapContainer>
  );
}
