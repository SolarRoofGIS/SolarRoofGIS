import { Link } from "react-router-dom";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p>
          SolarRoofGIS, proyek Kelompok 14, IPB University. Perkiraan awal potensi listrik surya atap untuk
          perencanaan, bukan pengganti survei lapangan.
        </p>
        <nav className="footer-links" aria-label="Tautan kaki halaman">
          <Link to="/peta">Peta</Link>
          <Link to="/tentang">Metode dan data</Link>
          <a href="https://sites.research.google/open-buildings/" target="_blank" rel="noreferrer">
            Google Open Buildings
          </a>
          <a href="https://globalsolaratlas.info/" target="_blank" rel="noreferrer">
            Global Solar Atlas
          </a>
        </nav>
      </div>
    </footer>
  );
}
