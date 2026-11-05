import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchBuildingDetail, fetchJson } from "../api";
import SolarMap from "../map/SolarMap";
import Sidebar from "../sidebar/Sidebar";
import "./MapPage.css";

// A dense, well-known neighbourhood near Kebun Raya Bogor for the "show me" button.
const EXAMPLE_VIEW = { center: [-6.5973, 106.7905], zoom: 17 };
// Matches the bottom-sheet breakpoint in Sidebar.css, the panel width plus its gap, and
// roughly how much of a phone screen the open bottom sheet covers.
const PHONE_LAYOUT = "(max-width: 720px)";
const PANEL_INSET = 412;
const SHEET_SHARE = 0.5;

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

export default function MapPage() {
  const [pvoutRange, setPvoutRange] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selection, setSelection] = useState({ status: "idle" });
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [focus, setFocus] = useState(null);
  const phone = useMediaQuery(PHONE_LAYOUT);
  // /peta?atap=<id> opens with that roof selected and the map centered on it.
  const [searchParams] = useSearchParams();
  const linkedId = searchParams.get("atap");
  const centeredLinkRef = useRef(null);

  useEffect(() => {
    if (linkedId && /^\d+$/.test(linkedId)) setSelectedId(Number(linkedId));
  }, [linkedId]);

  useEffect(() => {
    if (selection.status !== "ready" || centeredLinkRef.current === linkedId) return;
    const { building } = selection.detail;
    if (String(building.id) !== linkedId) return;
    centeredLinkRef.current = linkedId;
    setFocus({ center: [building.latitude, building.longitude], zoom: 18.5, key: Date.now() });
  }, [selection, linkedId]);

  useEffect(() => {
    const controller = new AbortController();
    fetchJson("/api/pvout", { signal: controller.signal })
      .then((result) => setPvoutRange(result.range))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (selectedId === null) {
      setSelection({ status: "idle" });
      return undefined;
    }

    let active = true;
    setSelection({ status: "loading" });
    fetchBuildingDetail(selectedId)
      .then((detail) => active && setSelection({ status: "ready", detail }))
      .catch((error) => active && setSelection({ status: "error", message: error.message }));
    return () => {
      active = false;
    };
  }, [selectedId]);

  const selectBuilding = useCallback((id) => {
    setSelectedId(id);
    setPanelCollapsed(false);
  }, []);
  const clearSelection = useCallback(() => setSelectedId(null), []);
  const togglePanel = useCallback(() => setPanelCollapsed((collapsed) => !collapsed), []);
  const showExample = useCallback(() => {
    setFocus({ ...EXAMPLE_VIEW, key: Date.now() });
    // On phones the guide sheet covers half the map; tuck it away so the roofs show.
    if (window.matchMedia(PHONE_LAYOUT).matches) setPanelCollapsed(true);
  }, []);

  const panelInset = phone || panelCollapsed ? 0 : PANEL_INSET;
  // The part of the map the panel covers, so the map centers on what is still visible.
  const mapPadding = useMemo(() => {
    if (panelCollapsed) return {};
    return phone ? { bottom: Math.round(window.innerHeight * SHEET_SHARE) } : { left: PANEL_INSET };
  }, [phone, panelCollapsed]);

  return (
    <main className="map-page" style={{ "--panel-inset": `${panelInset}px` }}>
      <SolarMap
        pvoutRange={pvoutRange}
        selectedGeometry={selection.status === "ready" ? selection.detail.building.geometry : null}
        focus={focus}
        onSelect={selectBuilding}
        padding={mapPadding}
      />
      <Sidebar
        selection={selection}
        collapsed={panelCollapsed}
        onToggleCollapsed={togglePanel}
        onClose={clearSelection}
        onExplore={showExample}
      />
    </main>
  );
}
