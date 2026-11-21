import { Check, ChevronDown, ChevronUp, Download, ExternalLink, LoaderCircle, PenLine, Trash2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { approx, formatNumber } from "../format";
import { pvoutCss } from "../map/colors";
import RoofOutline from "../map/RoofOutline";
import { geometryAreaM2 } from "../map/roofDrawing";
import FinanceSection from "./FinanceSection";
import "./Sidebar.css";

function regionName(region, checked = true) {
  if (!checked) return "Wilayah belum diketahui";
  if (region === "Bogor") return "Kabupaten Bogor";
  return region || "Di luar batas wilayah Bogor";
}

// How sunny the location is compared with the rest of Bogor. Every part of Bogor gets enough
// sun for panels, so the labels compare instead of judging.
function sunlightLevel(rank) {
  if (rank === null) return { label: "Tidak ada data", tone: "none" };
  if (rank >= 2 / 3) return { label: "Lebih cerah", tone: "high" };
  if (rank >= 1 / 3) return { label: "Sedang", tone: "medium" };
  return { label: "Lebih redup", tone: "low" };
}

function panelSize(assumptions, id) {
  return assumptions.panels.find((size) => size.id === id);
}

function Intro({ onExplore, onDraw, customRoofs, onSelectCustom }) {
  return (
    <div className="sidebar-intro">
      <p>Klik atap di peta untuk melihat listrik dan penghematan dari panel surya.</p>
      <div className="intro-actions">
        <button type="button" className="button button-outline" onClick={onExplore}>
          Lihat contoh
        </button>
        <button type="button" className="button button-outline" onClick={onDraw}>
          <PenLine size={15} /> Gambar atap
        </button>
      </div>
      {customRoofs.length > 0 && (
        <button
          type="button"
          className="text-button intro-custom"
          onClick={() => onSelectCustom(customRoofs[customRoofs.length - 1].id)}
        >
          {customRoofs.length > 1
            ? `Buka lagi ${customRoofs.length} atap yang Anda gambar`
            : "Buka lagi atap yang Anda gambar"}
        </button>
      )}
      <p className="sidebar-source">
        Angka bertanda ~ adalah perkiraan.{" "}
        <Link to="/tentang" className="text-button">
          Cara menghitung dan sumber data
        </Link>
      </p>
    </div>
  );
}

// What to do before installing; the estimate is only a first look from satellite imagery.
function NextSteps() {
  return (
    <details className="sidebar-details">
      <summary>
        Langkah selanjutnya
        <ChevronDown size={16} className="details-chevron" />
      </summary>
      <ol className="next-steps">
        <li>Cek bahan dan kekuatan atap, serta bayangan pohon atau bangunan.</li>
        <li>Minta survei dan penawaran dari beberapa installer PLTS atap.</li>
        <li>Ajukan permohonan PLTS atap ke PLN sebelum memasang.</li>
      </ol>
    </details>
  );
}

function GoogleMapsLink({ latitude, longitude }) {
  return (
    <a
      className="details-link"
      href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
      target="_blank"
      rel="noreferrer"
    >
      Buka lokasi di Google Maps <ExternalLink size={13} />
    </a>
  );
}

function BuildingDetails({ building }) {
  return (
    <details className="sidebar-details">
      <summary>
        Detail bangunan
        <ChevronDown size={16} className="details-chevron" />
      </summary>
      <dl>
        <dt>Wilayah</dt>
        <dd>{regionName(building.region)}</dd>
        <dt>Koordinat</dt>
        <dd>
          {building.latitude.toFixed(5)}, {building.longitude.toFixed(5)}
        </dd>
        <dt>Keyakinan bahwa ini bangunan</dt>
        <dd>
          {formatNumber(building.confidence * 100)}%
          <span className="dd-note">Menurut model Google yang mengenali bangunan dari citra satelit.</span>
        </dd>
      </dl>
      <GoogleMapsLink latitude={building.latitude} longitude={building.longitude} />
    </details>
  );
}

function Method({ solar, assumptions }) {
  const panel = panelSize(assumptions, solar.panel.id);
  return (
    <details className="sidebar-details">
      <summary>
        Cara menghitung
        <ChevronDown size={16} className="details-chevron" />
      </summary>
      <ol className="method-list">
        <li>
          Luas atap dari citra satelit, dikurangi {formatNumber(assumptions.setbackM, 1)} m di setiap pinggir. Dari
          sisanya, {formatNumber(assumptions.packingFactor * 100)}% dianggap bisa dipasangi (sisanya untuk bagian
          miring, tandon, dan bayangan).
        </li>
        <li>
          Panel {panel.powerWp} Wp ({formatNumber(panel.areaM2, 2)} m²) dihitung yang benar-benar muat disusun berbaris.
          Atap yang muat kurang dari {assumptions.minPanels} panel dianggap belum layak.
        </li>
        <li>
          Listrik = kWp × sinar matahari lokasi (Global Solar Atlas, sudah termasuk rugi inverter, kabel, debu, dan
          panas).
        </li>
        <li>
          Saran jumlah panel = paling sedikit dari: yang muat di atap, yang tidak melebihi pemakaian Anda (pengeluaran ÷
          tarif PLN), dan yang tidak melebihi daya PLN. Kelebihan listrik yang masuk ke PLN tidak mengurangi tagihan
          (Permen ESDM 2/2024).
        </li>
        <li>
          Biaya pasang Rp{formatNumber(assumptions.finance.costRpPerKwp)} per kWp. Balik modal = biaya ÷ hemat per
          tahun.
        </li>
      </ol>
      <p className="sidebar-muted">Perkiraan awal dari citra satelit, bukan hasil survei.</p>
    </details>
  );
}

// Why a roof gets no estimate: no solar data here, a shape panels do not fit, or too little area.
// A roof that fails with a larger panel may pass with a smaller one, so that is suggested.
function unsuitableReason(solar, assumptions) {
  const { minPanels, setbackM } = assumptions;
  if (solar.pvout === null) {
    return {
      title: "Data sinar matahari tidak tersedia",
      text: "Lokasi ini di luar cakupan data sinar matahari yang dipakai, jadi listriknya belum bisa diperkirakan.",
    };
  }
  // Only when the usable area could hold enough of a smaller panel.
  const current = panelSize(assumptions, solar.panel.id);
  const smaller = assumptions.panels.some(
    (panel) => panel.areaM2 < current.areaM2 && solar.usableM2 >= minPanels * panel.areaM2,
  )
    ? " Coba pilih ukuran panel yang lebih kecil."
    : "";
  const margin = `Setelah menyisakan ${formatNumber(setbackM, 1)} m di setiap pinggir atap`;
  if (solar.limitedByLayout) {
    return {
      title: "Atap terlalu sempit",
      text: `${margin}, bentuk atap ini hanya muat ${formatNumber(solar.layoutPanels)} panel utuh, padahal perlu minimal ${minPanels} panel.${smaller}`,
    };
  }
  return {
    title: "Atap terlalu kecil",
    text: `${margin}, bagian yang bisa dipakai hanya ${formatNumber(solar.usableM2, 1)} m², belum cukup untuk ${minPanels} panel surya.${smaller}`,
  };
}

// The panel sizes to choose from; the whole estimate is recalculated for the chosen one.
function PanelSizePicker({ assumptions, panelId, onChange }) {
  return (
    <fieldset className="panel-size">
      <legend>Ukuran panel</legend>
      <div className="panel-size-options">
        {assumptions.panels.map((panel) => (
          <label
            key={panel.id}
            className={panel.id === panelId ? "is-active" : undefined}
            title={`${panel.powerWp} Wp, ${formatNumber(panel.widthM, 2)} × ${formatNumber(panel.lengthM, 2)} m`}
          >
            <input
              type="radio"
              name="panel-size"
              value={panel.id}
              checked={panel.id === panelId}
              onChange={() => onChange(panel.id)}
            />
            <strong>{panel.label}</strong>
            <span>{panel.powerWp} Wp</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function RoofStat({ label, value }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

// The roof's shape with its sides and panels, the panel size, and what the whole roof could
// produce; what suits the household follows in FinanceSection.
function Hero({ solar, assumptions, geometry, panelPlan }) {
  const reason = solar.suitable ? null : unsuitableReason(solar, assumptions);
  const level = sunlightLevel(solar.pvoutRank);
  return (
    <div className={`hero${solar.suitable ? "" : " hero-unsuitable"}`}>
      <figure className="hero-shape">
        <RoofOutline
          geometry={geometry}
          color={pvoutCss(solar.pvout, solar.pvoutRange)}
          sideLengths
          areaM2={solar.footprintM2}
          panels={panelPlan.rings}
          label={`Bentuk atap seluas ${formatNumber(solar.footprintM2)} m² dengan panjang setiap sisi dalam meter${panelPlan.rings.length ? ` dan ${formatNumber(panelPlan.rings.length)} panel surya` : ""}`}
        />
      </figure>
      <PanelSizePicker assumptions={assumptions} panelId={solar.panel.id} onChange={panelPlan.onPanelIdChange} />
      {solar.suitable ? (
        <>
          <div className="hero-head">
            <span className="hero-label">Potensi maksimal atap</span>
            <span className={`level-badge level-${level.tone}`} title="Sinar matahari dibanding wilayah Bogor lain">
              Sinar matahari {level.label.toLowerCase()}
            </span>
          </div>
          <div className="stat-row">
            <RoofStat label="Muat" value={`${formatNumber(solar.panelCount)} panel`} />
            <RoofStat label="Daya" value={`${formatNumber(solar.capacityKwp, 1)} kWp`} />
            <RoofStat label="Listrik per bulan" value={approx(`${formatNumber(solar.annualKwh / 12)} kWh`)} />
          </div>
        </>
      ) : (
        <>
          <span className="hero-label">Atap ini belum cocok untuk panel surya</span>
          <span className="hero-value">{reason.title}</span>
          <p className="hero-sub">{reason.text}</p>
        </>
      )}
    </div>
  );
}

// Everything below the headline figure, the same for a database roof and a drawn one.
function EstimateSections({ solar, assumptions, panelPlan }) {
  if (!solar.suitable) return null;
  return (
    <FinanceSection
      solar={solar}
      assumptions={assumptions}
      panelChoice={panelPlan.choice}
      onPanelChoiceChange={panelPlan.onChoiceChange}
      onRecommendation={panelPlan.onRecommendation}
    />
  );
}

function BuildingInfo({ detail, refreshing, onReshape, panelPlan }) {
  const { building, solar, assumptions } = detail;

  return (
    <div className={refreshing ? "is-refreshing" : undefined}>
      <Hero solar={solar} assumptions={assumptions} geometry={building.geometry} panelPlan={panelPlan} />
      <p className="reshape-hint">
        Bentuk tidak pas?{" "}
        <button type="button" className="text-button" onClick={() => onReshape(detail)}>
          Ubah bentuknya
        </button>
      </p>
      <EstimateSections solar={solar} assumptions={assumptions} panelPlan={panelPlan} />
      <div className="sidebar-details-group">
        {solar.suitable && <NextSteps />}
        <BuildingDetails building={building} />
        <Method solar={solar} assumptions={assumptions} />
      </div>
    </div>
  );
}

// A drawn roof with its estimate as a GeoJSON file, for QGIS or a report.
function downloadGeoJSON(customRoof, detail) {
  const { roof, solar } = detail;
  const feature = {
    type: "Feature",
    geometry: customRoof.geometry,
    properties: {
      sumber: customRoof.basedOn
        ? `Diubah dari bangunan Google Open Buildings #${customRoof.basedOn.id}`
        : "Digambar di SolarRoofGIS",
      wilayah: regionName(roof.region, roof.regionChecked),
      luas_atap_m2: solar.footprintM2,
      luas_bisa_dipasangi_m2: solar.usableM2,
      panel_wp: solar.panel.powerWp,
      ukuran_panel_m: [solar.panel.widthM, solar.panel.lengthM],
      jumlah_panel: solar.panelCount,
      kapasitas_kwp: solar.capacityKwp,
      pvout_kwh_per_kwp: solar.pvout,
      listrik_kwh_per_tahun: solar.annualKwh,
      listrik_kwh_per_bulan: solar.monthlyKwh,
      nilai_listrik_rp_per_tahun: solar.annualValueRp,
      co2_dihindari_kg_per_tahun: solar.annualCo2Kg,
      dibuat: new Date().toISOString(),
    },
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(feature, null, 2)], {
      type: "application/geo+json",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `atap-solarroofgis-${Math.round(solar.footprintM2)}m2.geojson`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CustomDetails({ customRoof, detail }) {
  const { roof } = detail;
  const { basedOn } = customRoof;

  return (
    <details className="sidebar-details">
      <summary>
        Detail atap
        <ChevronDown size={16} className="details-chevron" />
      </summary>
      <dl>
        <dt>Wilayah</dt>
        <dd>{regionName(roof.region, roof.regionChecked)}</dd>
        {basedOn && (
          <>
            <dt>Bentuk asal</dt>
            <dd>
              {formatNumber(basedOn.footprintM2, 1)} m²
              <span className="dd-note">Bangunan Google Open Buildings #{basedOn.id}.</span>
            </dd>
          </>
        )}
        <dt>Titik sudut</dt>
        <dd>{formatNumber(roof.vertices)}</dd>
        <dt>Koordinat</dt>
        <dd>
          {roof.latitude.toFixed(5)}, {roof.longitude.toFixed(5)}
        </dd>
      </dl>
      <GoogleMapsLink latitude={roof.latitude} longitude={roof.longitude} />
    </details>
  );
}

function CustomRoofInfo({ custom, customRoofs, onEdit, onDoneEditing, onDelete, onSelectCustom, panelPlan }) {
  const { roof: customRoof, estimate, editing } = custom;
  const detail = estimate.status === "ready" ? estimate.detail : null;
  const others = customRoofs.filter((roof) => roof.id !== customRoof.id);

  return (
    <>
      <div className="roof-actions">
        {editing ? (
          <button type="button" className="button button-primary button-compact" onClick={onDoneEditing}>
            <Check size={15} /> Selesai
          </button>
        ) : (
          <button type="button" className="button button-outline button-compact" onClick={onEdit}>
            <PenLine size={15} /> Ubah bentuk
          </button>
        )}
        <button
          type="button"
          className="button button-outline button-compact"
          onClick={() => downloadGeoJSON(customRoof, detail)}
          disabled={!detail}
          title="Unduh bentuk atap dan perkiraannya sebagai GeoJSON"
        >
          <Download size={15} /> GeoJSON
        </button>
        <button
          type="button"
          className="icon-button roof-delete"
          onClick={onDelete}
          aria-label="Hapus atap yang digambar"
          title="Hapus atap yang digambar"
        >
          <Trash2 size={17} />
        </button>
      </div>

      {others.map((roof) => (
        <p key={roof.id} className="other-roof">
          Atap lain yang Anda gambar, {formatNumber(geometryAreaM2(roof.geometry))} m².{" "}
          <button type="button" className="text-button" onClick={() => onSelectCustom(roof.id)}>
            Buka
          </button>
        </p>
      ))}

      {estimate.status === "loading" && (
        <div className="sidebar-loading">
          <LoaderCircle size={16} className="spin" /> Menghitung listrik dari atap ini…
        </div>
      )}
      {estimate.status === "error" && (
        <p className="sidebar-error">Perkiraan tidak dapat dihitung: {estimate.message}</p>
      )}
      {detail && (
        <div className={estimate.refreshing ? "is-refreshing" : undefined}>
          {detail.roof.repaired && (
            <p className="custom-note">
              Garis atap saling berpotongan, jadi luasnya dihitung dari bentuk yang sudah dirapikan.
            </p>
          )}
          <Hero
            solar={detail.solar}
            assumptions={detail.assumptions}
            geometry={customRoof.geometry}
            panelPlan={panelPlan}
          />
          <EstimateSections solar={detail.solar} assumptions={detail.assumptions} panelPlan={panelPlan} />
          <div className="sidebar-details-group">
            {detail.solar.suitable && <NextSteps />}
            <CustomDetails customRoof={customRoof} detail={detail} />
            <Method solar={detail.solar} assumptions={detail.assumptions} />
          </div>
        </div>
      )}
    </>
  );
}

export default function Sidebar({
  selection,
  custom,
  customRoofs,
  collapsed,
  onToggleCollapsed,
  onClose,
  onExplore,
  onDraw,
  onSelectCustom,
  onEditCustom,
  onDoneEditing,
  onDeleteCustom,
  onReshapeBuilding,
  panelPlan,
}) {
  const selected = Boolean(custom) || selection.status !== "idle";
  let title = "Potensi listrik surya atap";
  let kicker = null;
  if (custom) {
    title = "Atap yang Anda gambar";
    if (custom.estimate.status === "ready")
      kicker = regionName(custom.estimate.detail.roof.region, custom.estimate.detail.roof.regionChecked);
  } else if (selected) {
    title = "Atap terpilih";
    if (selection.status === "ready") kicker = regionName(selection.detail.building.region);
  }

  return (
    <aside className={`sidebar${collapsed ? " sidebar-collapsed" : ""}`} aria-label="Informasi atap">
      <div className="sidebar-head">
        <div className="sidebar-head-text">
          <h2>{title}</h2>
          {kicker && <p className="sidebar-kicker">{kicker}</p>}
        </div>
        <div className="sidebar-actions">
          <button
            type="button"
            className="icon-button"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Buka panel" : "Ciutkan panel"}
            title={collapsed ? "Buka panel" : "Ciutkan panel"}
          >
            {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
          {selected && (
            <button
              type="button"
              className="icon-button"
              onClick={onClose}
              aria-label="Tutup atap terpilih"
              title="Tutup"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>
      {!collapsed && (
        <div className="sidebar-body">
          {custom ? (
            <CustomRoofInfo
              custom={custom}
              customRoofs={customRoofs}
              onEdit={onEditCustom}
              onDoneEditing={onDoneEditing}
              onDelete={onDeleteCustom}
              onSelectCustom={onSelectCustom}
              panelPlan={panelPlan}
            />
          ) : (
            <>
              {!selected && (
                <Intro
                  onExplore={onExplore}
                  onDraw={onDraw}
                  customRoofs={customRoofs}
                  onSelectCustom={onSelectCustom}
                />
              )}
              {selection.status === "loading" && (
                <div className="sidebar-loading">
                  <LoaderCircle size={16} className="spin" /> Menghitung listrik dari atap ini…
                </div>
              )}
              {selection.status === "error" && (
                <p className="sidebar-error">Data atap tidak dapat dimuat: {selection.message}</p>
              )}
              {selection.status === "ready" && (
                <BuildingInfo
                  detail={selection.detail}
                  refreshing={selection.refreshing}
                  onReshape={onReshapeBuilding}
                  panelPlan={panelPlan}
                />
              )}
            </>
          )}
        </div>
      )}
    </aside>
  );
}
