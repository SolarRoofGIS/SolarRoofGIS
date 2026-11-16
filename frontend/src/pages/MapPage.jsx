import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchBuildingDetail, fetchJson, fetchRoofEstimate } from "../api";
import { chosenPanelCount, panelRings } from "../map/geometry";
import SolarMap from "../map/SolarMap";
import Sidebar from "../sidebar/Sidebar";
import "./MapPage.css";

// A dense, well-known neighbourhood near Kebun Raya Bogor for the "show me" button.
const EXAMPLE_VIEW = { center: [106.7905, -6.5973], zoom: 17 };
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
// The panel size the estimate starts with, the same default as the server's.
const DEFAULT_PANEL_ID = "550";

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
  // The panel size every estimate uses, and how many panels the viewer wants on the selected
  // roof: null for as many as fit, otherwise what they typed.
  const [panelId, setPanelId] = useState(DEFAULT_PANEL_ID);
  const [panelChoice, setPanelChoice] = useState(null);
  // The recommended number for the selected roof, reported by the financial simulation.
  const [recommendedPanels, setRecommendedPanels] = useState(null);
  const resetPanelChoice = () => {
    setPanelChoice(null);
    setRecommendedPanels(null);
  };
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
    setFocus({ center: [building.longitude, building.latitude], zoom: 18.5, key: Date.now() });
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

    // A new panel size keeps the current roof on screen while it is recalculated.
    let active = true;
    setSelection((current) =>
      current.status === "ready" && current.detail.building.id === selectedId
        ? { ...current, refreshing: true }
        : { status: "loading" },
    );
    fetchBuildingDetail(selectedId, panelId)
      .then((detail) => active && setSelection({ status: "ready", detail }))
      .catch((error) => active && setSelection({ status: "error", message: error.message }));
    return () => {
      active = false;
    };
  }, [selectedId, panelId]);

  useEffect(() => {
    try {
      if (customRoofs.length) localStorage.setItem(CUSTOM_ROOFS_KEY, JSON.stringify(customRoofs));
      else localStorage.removeItem(CUSTOM_ROOFS_KEY);
    } catch {
      // Private windows may block storage; the drawn roofs then last for this visit only.
    }
  }, [customRoofs]);

  // Only the selected drawn roof is estimated. Its previous figures stay on screen while a
  // reshaped outline or a new panel size is recalculated, and switching back to an unchanged
  // roof reuses them.
  const selectedCustom = customRoofs.find((roof) => roof.id === selectedCustomId) || null;
  const selectedCustomGeometry = selectedCustom?.geometry || null;
  useEffect(() => {
    if (!selectedCustomId || !selectedCustomGeometry) return undefined;
    const [id, geometry] = [selectedCustomId, selectedCustomGeometry];
    const cached = customEstimatesRef.current[id];
    if (cached?.status === "ready" && cached.geometry === geometry && cached.panelId === panelId) return undefined;

    const controller = new AbortController();
    const store = (estimate) => setCustomEstimates((all) => ({ ...all, [id]: estimate }));
    store(cached?.status === "ready" ? { ...cached, refreshing: true } : { status: "loading" });
    const timer = setTimeout(() => {
      fetchRoofEstimate(geometry, panelId, { signal: controller.signal })
        .then((detail) => store({ status: "ready", detail, geometry, panelId }))
        .catch((error) => {
          if (error.name !== "AbortError") store({ status: "error", message: error.message, geometry, panelId });
        });
    }, ESTIMATE_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [selectedCustomId, selectedCustomGeometry, panelId]);

  // The panels to draw on the selected roof, on the map and in the panel: as many as the viewer chose.
  const customEstimate = selectedCustom ? customEstimates[selectedCustom.id] : null;
  let activeDetail = null;
  if (customEstimate?.status === "ready") activeDetail = customEstimate.detail;
  else if (!selectedCustom && selection.status === "ready") activeDetail = selection.detail;
  const shownPanels = activeDetail
    ? chosenPanelCount(
        panelChoice,
        activeDetail.solar.panelCount,
        activeDetail.assumptions.minPanels,
        recommendedPanels,
      )
    : 0;
  const panelRingList = useMemo(
    () =>
      activeDetail ? panelRings(activeDetail.solar.layout.panels.slice(0, shownPanels), activeDetail.solar.panel) : [],
    [activeDetail, shownPanels],
  );

  const addCustomRoof = (roof) => {
    resetPanelChoice();
    setCustomRoofs((roofs) => [...roofs, roof].slice(-MAX_DRAWN_ROOFS));
    setSelectedId(null);
    setSelectedCustomId(roof.id);
    setPanelCollapsed(false);
  };
  const selectBuilding = (id) => {
    if (id !== selectedId) resetPanelChoice();
    setSelectedCustomId(null);
    setSelectedId(id);
    setPanelCollapsed(false);
  };
  const selectCustom = (id) => {
    if (id !== selectedCustomId) resetPanelChoice();
    setSelectedId(null);
    setSelectedCustomId(id);
    setTool("off");
    setPanelCollapsed(false);
  };
  const clearSelection = () => {
    resetPanelChoice();
    setSelectedId(null);
    setSelectedCustomId(null);
    setTool("off");
  };

  const stopTool = () => setTool("off");
  const startDrawing = () => {
    setSelectedId(null);
    setSelectedCustomId(null);
    setTool("draw");
    // On phones the sheet would cover the roof being traced.
    if (phone) setPanelCollapsed(true);
  };
  const finishDrawing = (geometry) => {
    addCustomRoof({ id: newRoofId(), geometry, basedOn: null });
    setTool("off");
  };
  const changeCustom = (geometry) => {
    setCustomRoofs((roofs) => roofs.map((roof) => (roof.id === selectedCustomId ? { ...roof, geometry } : roof)));
  };
  const deleteCustom = () => {
    setCustomRoofs((roofs) => roofs.filter((roof) => roof.id !== selectedCustomId));
    setSelectedCustomId(null);
    setTool("off");
  };
  // Starts a drawn roof from a database roof, to correct an outline that does not fit.
  const reshapeBuilding = (detail) => {
    addCustomRoof({
      id: newRoofId(),
      geometry: detail.building.geometry,
      basedOn: { id: detail.building.id, footprintM2: detail.solar.footprintM2 },
    });
    setTool("edit");
  };

  const showExample = () => {
    setFocus({ ...EXAMPLE_VIEW, key: Date.now() });
    // On phones the guide sheet covers half the map; tuck it away so the roofs show.
    if (phone) setPanelCollapsed(true);
  };

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
        selectedCustomId={selectedCustom?.id ?? null}
        drawReplacesOldest={customRoofs.length >= MAX_DRAWN_ROOFS}
        onToolStart={startDrawing}
        onDrawFinish={finishDrawing}
        onDrawCancel={stopTool}
        onEditChange={changeCustom}
        onEditDone={stopTool}
        onSelectCustom={selectCustom}
        panels={panelRingList}
      />
      <Sidebar
        selection={selection}
        custom={
          selectedCustom
            ? {
                roof: selectedCustom,
                estimate: customEstimate || { status: "loading" },
                editing: tool === "edit",
              }
            : null
        }
        customRoofs={customRoofs}
        collapsed={panelCollapsed}
        onToggleCollapsed={() => setPanelCollapsed((collapsed) => !collapsed)}
        onClose={clearSelection}
        onExplore={showExample}
        onDraw={startDrawing}
        onSelectCustom={selectCustom}
        onEditCustom={() => setTool("edit")}
        onDoneEditing={stopTool}
        onDeleteCustom={deleteCustom}
        onReshapeBuilding={reshapeBuilding}
        panelPlan={{
          rings: panelRingList,
          onPanelIdChange: setPanelId,
          choice: panelChoice,
          onChoiceChange: setPanelChoice,
          onRecommendation: setRecommendedPanels,
        }}
      />
    </main>
  );
}
