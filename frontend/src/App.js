import Map from "./map/Map";
import "./App.css";

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">☀</div>
        <div>
          <p className="brand-name">SolarRoofGIS</p>
          <p className="brand-location">Kota Bogor · Kabupaten Bogor</p>
        </div>
        <div className="header-tag">Rooftop solar mapping</div>
      </header>
      <main className="map-frame">
        <Map />
        <div className="map-title">
          <h1>Bogor study area</h1>
          <p>OpenStreetMap basemap</p>
        </div>
      </main>
      <footer className="app-footer">
        Google building footprints are loaded from PostGIS when you zoom in.
      </footer>
    </div>
  );
}
