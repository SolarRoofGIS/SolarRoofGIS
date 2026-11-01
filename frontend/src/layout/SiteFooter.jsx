import { Link } from "react-router-dom";
import { ExternalLink, Info, Map as MapIcon } from "lucide-react";
import { Brand } from "./SiteHeader";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div>
          <Brand />
          <p>
            Proyek Kelompok 14, IPB University. Peta perkiraan awal potensi listrik surya atap untuk
            perencanaan, bukan pengganti survei lapangan.
          </p>
        </div>
        <div className="footer-links">
          <Link to="/peta">
            <MapIcon size={15} /> Buka peta
          </Link>
          <Link to="/tentang">
            <Info size={15} /> Metode dan data
          </Link>
          <a href="https://sites.research.google/open-buildings/" target="_blank" rel="noreferrer">
            <ExternalLink size={15} /> Google Open Buildings
          </a>
          <a href="https://globalsolaratlas.info/" target="_blank" rel="noreferrer">
            <ExternalLink size={15} /> Global Solar Atlas
          </a>
        </div>
      </div>
    </footer>
  );
}
