import { useCallback, useEffect, useState } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";

const BOGOR_CENTER = [-6.545, 106.8145];
const MIN_BUILDING_ZOOM = 15.5;
const API_BASE_URL = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

function BuildingLayer({ onStatusChange }) {
  const map = useMap();
  const [layer, setLayer] = useState(null);

  useEffect(() => {
    let controller;
    let requestId = 0;

    const loadBuildings = async () => {
      requestId += 1;
      const currentRequestId = requestId;
      controller?.abort();

      if (map.getZoom() < MIN_BUILDING_ZOOM) {
        setLayer(null);
        onStatusChange("Zoom in to level 16 or closer to load buildings.");
        return;
      }

      const bounds = map.getBounds();
      const bbox = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ].join(",");
      const query = new URLSearchParams({
        dataset: "google",
        bbox,
        zoom: String(map.getZoom()),
      });

      controller = new AbortController();
      onStatusChange("Loading buildings from PostGIS…");

      try {
        const response = await fetch(`${API_BASE_URL}/api/buildings?${query}`, {
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.detail || result.error || `API returned ${response.status}`);
        }
        if (currentRequestId !== requestId) return;

        setLayer({ key: currentRequestId, data: result });
        const count = result.count.toLocaleString();
        onStatusChange(
          `${count} buildings shown${result.truncated ? " (showing the 2,500 feature limit)" : ""}.`,
        );
      } catch (error) {
        if (error.name === "AbortError" || currentRequestId !== requestId) return;
        setLayer(null);
        onStatusChange(`Could not load buildings: ${error.message}`);
      }
    };

    loadBuildings();
    map.on("moveend", loadBuildings);
    return () => {
      requestId += 1;
      controller?.abort();
      map.off("moveend", loadBuildings);
    };
  }, [map, onStatusChange]);

  if (!layer || layer.data.features.length === 0) return null;

  return (
    <GeoJSON
      key={layer.key}
      data={layer.data}
      style={{
        color: "#166b55",
        weight: 1,
        fillColor: "#54b995",
        fillOpacity: 0.45,
      }}
    />
  );
}

export default function Map() {
  const [buildingStatus, setBuildingStatus] = useState(
    "Zoom in to level 16 or closer to load buildings.",
  );
  const updateBuildingStatus = useCallback((status) => setBuildingStatus(status), []);

  return (
    <>
      <MapContainer
        center={BOGOR_CENTER}
        zoom={10}
        minZoom={3}
        maxZoom={19}
        scrollWheelZoom
        className="map-canvas"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <BuildingLayer onStatusChange={updateBuildingStatus} />
      </MapContainer>
      <div className="building-status" role="status">{buildingStatus}</div>
    </>
  );
}
