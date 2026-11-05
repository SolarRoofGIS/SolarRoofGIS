import { Link, NavLink } from "react-router-dom";

const NAV = [
  { to: "/", label: "Beranda", end: true },
  { to: "/peta", label: "Peta" },
  { to: "/tentang", label: "Tentang" },
];

// A sun over a roof ridge.
function BrandMark() {
  return (
    <svg className="brand-mark" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="15.5" cy="7" r="4" fill="#e2701b" />
      <path d="M2 20 L11 11 L20 20" fill="none" stroke="#1f4a3f" strokeWidth="2.6" strokeLinejoin="round" />
    </svg>
  );
}

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="SolarRoofGIS, ke beranda">
      <BrandMark />
      <span className="brand-name">SolarRoofGIS</span>
      <span className="brand-location">Kota & Kabupaten Bogor</span>
    </Link>
  );
}

export default function SiteHeader() {
  return (
    <header className="site-header">
      <Brand />
      <nav className="site-nav" aria-label="Navigasi utama">
        {NAV.map(({ to, label, end }) => (
          <NavLink key={to} to={to} end={end}>
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
