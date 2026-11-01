import { Link } from "react-router-dom";
import { House, Map as MapIcon, SearchX } from "lucide-react";
import "./Pages.css";

export default function NotFoundPage() {
  return (
    <main className="page not-found">
      <span className="not-found-icon" aria-hidden="true">
        <SearchX size={30} />
      </span>
      <h1>Halaman tidak ditemukan</h1>
      <p>Alamat yang Anda buka tidak ada di SolarRoofGIS.</p>
      <div className="hero-actions">
        <Link to="/" className="button button-outline">
          <House size={18} /> Beranda
        </Link>
        <Link to="/peta" className="button button-primary">
          <MapIcon size={18} /> Buka peta
        </Link>
      </div>
    </main>
  );
}
