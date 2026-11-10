import { useEffect, useRef, useState } from "react";
import {
  Building2,
  Check,
  EyeOff,
  Layers,
  LoaderCircle,
  Map as MapIcon,
  Mountain,
  PenLine,
  Satellite,
  Sun,
  Undo2,
  X,
  ZoomIn,
} from "lucide-react";
import { formatNumber } from "../format";
import { PVOUT_RAMP } from "./colors";
import { ROOF_ZOOM } from "./mapStyle";

const BASEMAPS = [
  { id: "gray", label: "Abu-abu", icon: MapIcon },
  { id: "osm", label: "Berwarna", icon: Mountain },
  { id: "satellite", label: "Satelit", icon: Satellite },
];

// One layer's opacity, greyed out while that layer is switched off.
function OpacitySlider({ id, label, settingKey, disabled = false, settings, set }) {
  const value = settings[settingKey];
  return (
    <div className={`opacity-setting${disabled ? " is-disabled" : ""}`}>
      <div className="opacity-setting-row">
        <label htmlFor={id}>{label}</label>
        <span>{Math.round(value * 100)}%</span>
      </div>
      <input
        id={id}
        className="opacity-slider"
        type="range"
        min="0.1"
        max="1"
        step="0.05"
        value={value}
        disabled={disabled}
        onChange={(event) => set(settingKey, Number(event.target.value))}
        style={{ "--fill": `${((value - 0.1) / 0.9) * 100}%` }}
      />
    </div>
  );
}

export function MapSettings({ settings, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const set = (key, value) => onChange({ ...settings, [key]: value });

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  return (
    <div className="map-settings" ref={rootRef}>
      <button
        type="button"
        className="map-control-button"
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-expanded={open}
        title="Pengaturan peta"
      >
        <Layers size={18} />
        <span className="map-settings-label">Lapisan</span>
      </button>
      {open && (
        <div className="settings-panel">
          <p className="settings-heading">Peta dasar</p>
          <div className="basemap-options" role="radiogroup" aria-label="Peta dasar">
            {BASEMAPS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={id === settings.basemap}
                className={`basemap-option${id === settings.basemap ? " is-active" : ""}`}
                onClick={() => set("basemap", id)}
              >
                <span className={`basemap-thumb basemap-thumb-${id}`}>
                  <Icon size={16} />
                </span>
                {label}
              </button>
            ))}
          </div>

          <p className="settings-heading">Lapisan data</p>
          <label className="settings-toggle">
            <Building2 size={16} />
            <span>Poligon atap</span>
            <input
              type="checkbox"
              role="switch"
              checked={settings.roofs}
              onChange={(event) => set("roofs", event.target.checked)}
            />
            <i className="switch" aria-hidden="true" />
          </label>
          <OpacitySlider
            id="roof-opacity"
            label="Opasitas atap"
            settingKey="roofOpacity"
            disabled={!settings.roofs}
            settings={settings}
            set={set}
          />
          <label className="settings-toggle">
            <Sun size={16} />
            <span>Overlay energi surya</span>
            <input
              type="checkbox"
              role="switch"
              checked={settings.solar}
              onChange={(event) => set("solar", event.target.checked)}
            />
            <i className="switch" aria-hidden="true" />
          </label>
          <OpacitySlider
            id="solar-opacity"
            label="Opasitas energi surya"
            settingKey="solarOpacity"
            disabled={!settings.solar}
            settings={settings}
            set={set}
          />
        </div>
      )}
    </div>
  );
}

export function Legend({ zoom, pvoutRange }) {
  return (
    <div className="map-legend">
      <p className="map-legend-title">
        {zoom >= ROOF_ZOOM ? "Energi surya di atap (PVOUT)" : "Energi surya per tahun (PVOUT)"}
      </p>
      <div className="map-legend-ramp" style={{ background: `linear-gradient(to right, ${PVOUT_RAMP.join(", ")})` }} />
      <div className="map-legend-labels">
        <span>{pvoutRange ? formatNumber(pvoutRange.min) : "Rendah"}</span>
        <span>{pvoutRange ? `${formatNumber(pvoutRange.max)} kWh/kWp·thn` : "Tinggi"}</span>
      </div>
      <div className="map-legend-keys">
        <span>
          <i className="legend-dash" /> Batas Kota & Kab. Bogor
        </span>
      </div>
    </div>
  );
}

// Buttons for the roof drawing tool, beside the Lapisan menu.
export function DrawControls({ tool, draft, onStart, onUndo, onCancel, onFinish, onDone }) {
  if (tool === "draw") {
    return (
      <div className="draw-controls">
        <button
          type="button"
          className="map-control-button map-control-icon"
          onClick={onUndo}
          disabled={draft.vertices === 0}
          title="Hapus titik terakhir (Backspace)"
          aria-label="Hapus titik terakhir"
        >
          <Undo2 size={17} />
        </button>
        <button type="button" className="map-control-button" onClick={onCancel} title="Batal (Esc)">
          <X size={17} /> Batal
        </button>
        <button
          type="button"
          className="map-control-button map-control-primary"
          onClick={onFinish}
          disabled={draft.vertices < 3}
          title="Selesai (Enter)"
        >
          <Check size={17} /> Selesai
        </button>
      </div>
    );
  }
  if (tool === "edit") {
    return (
      <div className="draw-controls">
        <button
          type="button"
          className="map-control-button map-control-primary"
          onClick={onDone}
          title="Selesai (Enter)"
        >
          <Check size={17} /> Selesai mengubah
        </button>
      </div>
    );
  }
  return (
    <div className="draw-controls">
      <button type="button" className="map-control-button" onClick={onStart} title="Gambar bentuk atap sendiri">
        <PenLine size={17} />
        <span className="map-settings-label">Gambar atap</span>
      </button>
    </div>
  );
}

export function DrawStatus({ tool, draft, replacesOldest }) {
  const area = draft.areaM2 >= 1 ? ` · ${formatNumber(draft.areaM2)} m²` : "";
  if (tool === "draw") {
    return (
      <span className="map-chip">
        <PenLine size={15} />
        {draft.vertices < 3
          ? "Klik setiap sudut atap. Titik menempel ke sudut atau tepi bangunan."
          : "Klik titik pertama atau Selesai untuk menutup bentuk."}
        {area}
        {replacesOldest && " · Atap gambar terlama akan diganti."}
      </span>
    );
  }
  return (
    <span className="map-chip">
      <PenLine size={15} /> Geser titik sudut. Klik titik kecil untuk menambah, klik kanan untuk menghapus.{area}
    </span>
  );
}

// What the map shows when no drawing tool is active.
export function BrowseStatus({ loading, showRoofs, roofsVisible }) {
  if (loading) {
    return (
      <span className="map-chip">
        <LoaderCircle size={15} className="spin" /> Memuat data…
      </span>
    );
  }
  if (showRoofs && !roofsVisible) {
    return (
      <span className="map-chip">
        <EyeOff size={15} /> Poligon atap disembunyikan
      </span>
    );
  }
  if (showRoofs) {
    return (
      <span className="map-chip">
        <Building2 size={15} /> Klik atap untuk melihat potensinya
      </span>
    );
  }
  return (
    <span className="map-chip">
      <ZoomIn size={15} /> Perbesar atau klik kawasan untuk melihat atap
    </span>
  );
}
