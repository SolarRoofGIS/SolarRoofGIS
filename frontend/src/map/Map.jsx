import { MapContainer, TileLayer } from "react-leaflet";

const BOGOR_CENTER = [-6.545, 106.8145];

export default function Map() {
  return (
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
    </MapContainer>
  );
}
