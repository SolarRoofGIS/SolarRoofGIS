import { Link } from "react-router-dom";
import "./Pages.css";

export default function NotFoundPage() {
  return (
    <main className="page page-inner not-found">
      <p className="overline">404</p>
      <h1>Halaman tidak ditemukan</h1>
      <p className="lead">Alamat yang Anda buka tidak ada di SolarRoofGIS.</p>
      <div className="actions">
        <Link to="/peta" className="button button-primary">
          Buka peta
        </Link>
        <Link to="/" className="text-link">
          Kembali ke beranda
        </Link>
      </div>
    </main>
  );
}
