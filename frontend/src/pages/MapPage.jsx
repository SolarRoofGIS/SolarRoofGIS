import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchBuildingDetail, fetchJson, fetchRoofEstimate } from "../api";
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
// The roofs the viewer drew, kept in this browser so they survive a reload. Drawing one
// more than MAX_DRAWN_ROOFS replaces the oldest.
const CUSTOM_ROOFS_KEY = "solarroofgis.custom-roofs";
const MAX_DRAWN_ROOFS = 2;
// Wait this long after the last change to a drawn roof before asking for a new estimate.
const ESTIMATE_DELAY_MS = 250;

function loadCustomRoofs() {
  try {
    const stored = JSON.parse(localStorage.getItem(CUSTOM_ROOFS_KEY));
    return Array.isArray(stored) ? stored.filter((roof) => roof?.id && roof.geometry).slice(-MAX_DRAWN_ROOFS) : [];
  } catch {
    return [];
  }
}

function newRoofId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

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
  // Drawn roofs, oldest first: { id, geometry, basedOn: { id, footprintM2 } | null }. Their
  // estimates by roof id, and whether the roof tool is off, drawing a new outline, or
  // reshaping the selected drawn roof.
  const [customRoofs, setCustomRoofs] = useState(loadCustomRoofs);
  const [selectedCustomId, setSelectedCustomId] = useState(null);
  const [customEstimates, setCustomEstimates] = useState({});
  const [tool, setTool] = useState("off");
  const selectedCustomIdRef = useRef(selectedCustomId);
  selectedCustomIdRef.current = selectedCustomId;
  const customEstimatesRef = useRef(customEstimates);
  customEstimatesRef.current = customEstimates;
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

  useEffect(() => {
    try {
      if (customRoofs.length) localStorage.setItem(CUSTOM_ROOFS_KEY, JSON.stringify(customRoofs));
      else localStorage.removeItem(CUSTOM_ROOFS_KEY);
    } catch {
      // Private windows may block storage; the drawn roofs then last for this visit only.
    }
  }, [customRoofs]);

  // Only the selected drawn roof is estimated. Its previous figures stay on screen while a
  // reshaped outline is recalculated, and switching back to an unchanged roof reuses them.
  const selectedCustom = customRoofs.find((roof) => roof.id === selectedCustomId) || null;
  const selectedCustomGeometry = selectedCustom?.geometry || null;
  useEffect(() => {
    if (!selectedCustomId || !selectedCustomGeometry) return undefined;
    const [id, geometry] = [selectedCustomId, selectedCustomGeometry];
    const cached = customEstimatesRef.current[id];
    if (cached?.status === "ready" && cached.geometry === geometry) return undefined;

    const controller = new AbortController();
    const store = (estimate) => setCustomEstimates((all) => ({ ...all, [id]: estimate }));
    store(cached?.status === "ready" ? { ...cached, refreshing: true } : { status: "loading" });
    const timer = setTimeout(() => {
      fetchRoofEstimate(geometry, { signal: controller.signal })
        .then((detail) => store({ status: "ready", detail, geometry }))
        .catch((error) => {
          if (error.name !== "AbortError") store({ status: "error", message: error.message, geometry });
        });
    }, ESTIMATE_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [selectedCustomId, selectedCustomGeometry]);

  const addCustomRoof = useCallback((roof) => {
    setCustomRoofs((roofs) => [...roofs, roof].slice(-MAX_DRAWN_ROOFS));
    setSelectedId(null);
    setSelectedCustomId(roof.id);
    setPanelCollapsed(false);
  }, []);

  const selectBuilding = useCallback((id) => {
    setSelectedCustomId(null);
    setSelectedId(id);
    setPanelCollapsed(false);
  }, []);
  const clearSelection = useCallback(() => {
    setSelectedId(null);
    setSelectedCustomId(null);
    setTool("off");
  }, []);

  const startDrawing = useCallback(() => {
    setSelectedId(null);
    setSelectedCustomId(null);
    setTool("draw");
    // On phones the sheet would cover the roof being traced.
    if (window.matchMedia(PHONE_LAYOUT).matches) setPanelCollapsed(true);
  }, []);
  const finishDrawing = useCallback(
    (geometry) => {
      addCustomRoof({ id: newRoofId(), geometry, basedOn: null });
      setTool("off");
    },
    [addCustomRoof],
  );
  const cancelDrawing = useCallback(() => setTool("off"), []);
  const selectCustom = useCallback((id) => {
    setSelectedId(null);
    setSelectedCustomId(id);
    setTool("off");
    setPanelCollapsed(false);
  }, []);
  const editCustom = useCallback(() => setTool("edit"), []);
  const changeCustom = useCallback((geometry) => {
    const id = selectedCustomIdRef.current;
    setCustomRoofs((roofs) => roofs.map((roof) => (roof.id === id ? { ...roof, geometry } : roof)));
  }, []);
  const doneEditing = useCallback(() => setTool("off"), []);
  const deleteCustom = useCallback(() => {
    const id = selectedCustomIdRef.current;
    setCustomRoofs((roofs) => roofs.filter((roof) => roof.id !== id));
    setSelectedCustomId(null);
    setTool("off");
  }, []);
  // Starts a drawn roof from a database roof, to correct an outline that does not fit.
  const reshapeBuilding = useCallback(
    (detail) => {
      addCustomRoof({
        id: newRoofId(),
        geometry: detail.building.geometry,
        basedOn: { id: detail.building.id, footprintM2: detail.solar.footprintM2 },
      });
      setTool("edit");
    },
    [addCustomRoof],
  );
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
        selectedGeometry={!selectedCustom && selection.status === "ready" ? selection.detail.building.geometry : null}
        focus={focus}
        onSelect={selectBuilding}
        padding={mapPadding}
        tool={tool}
        customRoofs={customRoofs}
        selectedCustomId={selectedCustom ? selectedCustom.id : null}
        drawReplacesOldest={customRoofs.length >= MAX_DRAWN_ROOFS}
        onToolStart={startDrawing}
        onDrawFinish={finishDrawing}
        onDrawCancel={cancelDrawing}
        onEditChange={changeCustom}
        onEditDone={doneEditing}
        onSelectCustom={selectCustom}
      />
      <Sidebar
        selection={selection}
        custom={
          selectedCustom
            ? {
                roof: selectedCustom,
                estimate: customEstimates[selectedCustom.id] || { status: "loading" },
                editing: tool === "edit",
              }
            : null
        }
        customRoofs={customRoofs}
        collapsed={panelCollapsed}
        onToggleCollapsed={togglePanel}
        onClose={clearSelection}
        onExplore={showExample}
        onDraw={startDrawing}
        onSelectCustom={selectCustom}
        onEditCustom={editCustom}
        onDoneEditing={doneEditing}
        onDeleteCustom={deleteCustom}
        onReshapeBuilding={reshapeBuilding}
      />
    </main>
  );
}
