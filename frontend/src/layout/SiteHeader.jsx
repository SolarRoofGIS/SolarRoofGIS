import { Link, NavLink } from "react-router-dom";
import { House, Info, Map as MapIcon, Sun } from "lucide-react";

const NAV = [
  { to: "/", label: "Beranda", icon: House, end: true },
  { to: "/peta", label: "Peta", icon: MapIcon },
  { to: "/tentang", label: "Tentang", icon: Info },
];

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="SolarRoofGIS, ke beranda">
      <span className="brand-mark" aria-hidden="true">
        <Sun size={20} strokeWidth={2.4} />
      </span>
      <span className="brand-text">
        <span className="brand-name">SolarRoofGIS</span>
        <span className="brand-location">Kota & Kabupaten Bogor</span>
      </span>
    </Link>
  );
}

export default function SiteHeader() {
  return (
    <header className="site-header">
      <Brand />
      <nav className="site-nav" aria-label="Navigasi utama">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} title={label}>
            <Icon size={17} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
