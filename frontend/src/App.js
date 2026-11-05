import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import SiteHeader from "./layout/SiteHeader";
import AboutPage from "./pages/AboutPage";
import HomePage from "./pages/HomePage";
import MapPage from "./pages/MapPage";
import NotFoundPage from "./pages/NotFoundPage";
import "./App.css";

const TITLES = {
  "/": "SolarRoofGIS · Potensi listrik surya atap Bogor",
  "/peta": "Peta · SolarRoofGIS",
  "/tentang": "Tentang · SolarRoofGIS",
};

export default function App() {
  const { pathname } = useLocation();
  const isMap = pathname === "/peta";

  useEffect(() => {
    document.title = TITLES[pathname] || "SolarRoofGIS";
    if (!isMap) window.scrollTo(0, 0);
  }, [pathname, isMap]);

  return (
    <div className={`app-shell${isMap ? " app-shell-map" : ""}`}>
      <SiteHeader />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/peta" element={<MapPage />} />
        <Route path="/tentang" element={<AboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}
