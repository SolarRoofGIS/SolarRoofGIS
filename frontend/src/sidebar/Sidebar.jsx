import { Check, ChevronDown, ChevronUp, Download, ExternalLink, LoaderCircle, PenLine, Trash2, X } from "lucide-react";
import { formatNumber, formatRupiah, MONTH_NAMES } from "../format";
import { PVOUT_RAMP, pvoutCss } from "../map/colors";
import RoofOutline from "../map/RoofOutline";
import { geometryAreaM2 } from "../map/roofDrawing";
import FinanceSection from "./FinanceSection";
import SectionTitle from "./SectionTitle";
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
      <p>Perkiraan listrik dari panel surya di atap setiap bangunan di Kota dan Kabupaten Bogor.</p>
      <ol className="intro-steps">
        <li>
          Warna menunjukkan energi surya tahunan (PVOUT): kuning lebih rendah, oranye tua lebih tinggi. Dari jauh
          terlihat overlay PVOUT Global Solar Atlas, setelah diperbesar warna tiap atap.
        </li>
        <li>Klik sebuah kawasan untuk memperbesar sampai bentuk atap terlihat.</li>
        <li>Klik sebuah atap untuk melihat panel yang muat, listrik per tahun, dan manfaatnya.</li>
        <li>
          Bentuk atap tidak pas atau belum ada?{" "}
          <button type="button" className="text-button" onClick={onDraw}>
            Gambar atap sendiri
          </button>{" "}
          dengan mengklik sudut-sudutnya.
        </li>
      </ol>
      <button type="button" className="button button-outline intro-cta" onClick={onExplore}>
        Lihat contoh di pusat Kota Bogor
      </button>
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
        Sumber: Google Open Buildings (bentuk atap), Global Solar Atlas (PVOUT), BIG (batas wilayah).
      </p>
    </div>
  );
}

function FlowStep({ label, value, note, children, final }) {
  return (
    <li className={`flow-step${final ? " flow-step-final" : ""}`}>
      <div className="flow-step-head">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      {children}
      {note && <p className="flow-step-note">{note}</p>}
    </li>
  );
}

function RoofToEnergy({ solar, assumptions }) {
  const panel = panelSize(assumptions, solar.panel.id);
  return (
    <section className="sidebar-section">
      <SectionTitle>Berapa panel yang muat?</SectionTitle>
      <ol className="flow">
        <FlowStep
          label="Bagian atap yang bisa dipasangi"
          value={`${formatNumber(solar.usableM2)} m²`}
          note={`Sekitar ${formatNumber(solar.usableShare * 100)}% dari luas atap. Sisanya dibiarkan kosong: ${formatNumber(assumptions.setbackM, 1)} m di setiap pinggir atap untuk keamanan dan perawatan, juga tempat tandon air, bagian yang terlalu miring, atau yang sering teduh.`}
        >
          <div className="usable-bar" aria-hidden="true">
            <div style={{ width: `${Math.min(solar.usableShare * 100, 100)}%` }} />
          </div>
        </FlowStep>
        <FlowStep
          label="Jumlah panel surya"
          value={`${formatNumber(solar.panelCount)} panel`}
          note={`Panel ukuran ${panel.label.toLowerCase()} (${panel.powerWp} Wp), ${formatNumber(panel.widthM, 2)} × ${formatNumber(panel.lengthM, 2)} m. Bila semua dipasang, daya totalnya ${formatNumber(solar.capacityKwp, 1)} kWp (kilowatt-peak, daya saat matahari terik).${solar.limitedByLayout ? " Jumlahnya dibatasi bentuk atap, karena hanya panel utuh yang bisa disusun berbaris." : ""}`}
          final
        />
      </ol>
    </section>
  );
}

function Sunlight({ solar }) {
  const level = sunlightLevel(solar.pvoutRank);
  const range = solar.pvoutRange;
  const position =
    range && solar.pvout !== null
      ? Math.min(Math.max((solar.pvout - range.min) / (range.max - range.min), 0), 1) * 100
      : null;

  return (
    <section className="sidebar-section">
      <SectionTitle aside={<span className={`level-badge level-${level.tone}`}>{level.label}</span>}>
        Sinar matahari di lokasi ini
      </SectionTitle>
      {solar.pvout === null ? (
        <p className="sidebar-muted">Data sinar matahari tidak tersedia di lokasi ini.</p>
      ) : (
        <>
          <p className="sunlight-value">
            Setiap 1 kWp panel di sini menghasilkan sekitar <strong>{formatNumber(solar.pvout)}</strong> kWh per tahun.
          </p>
          {position !== null && (
            <div className="sunlight-scale">
              <div
                className="sunlight-ramp"
                style={{
                  background: `linear-gradient(to right, ${PVOUT_RAMP.join(", ")})`,
                }}
              />
              <div className="sunlight-marker" style={{ left: `${position}%` }} />
              <div className="sunlight-labels">
                <span>Teredup di Bogor, {formatNumber(range.min)}</span>
                <span>{formatNumber(range.max)}, tercerah</span>
              </div>
            </div>
          )}
          <p className="sidebar-muted">
            {solar.pvoutRank >= 0.5
              ? `Lebih cerah dari ${formatNumber(solar.pvoutRank * 100)}% wilayah Bogor.`
              : `${formatNumber((1 - solar.pvoutRank) * 100)}% wilayah Bogor sedikit lebih cerah dari lokasi ini.`}
            {range &&
              ` Selisihnya kecil: lokasi tercerah di Bogor hanya sekitar ${formatNumber(((range.max - range.min) / range.min) * 100)}% lebih tinggi dari yang teredup, jadi atap di mana pun di Bogor tetap bisa dipasangi panel.`}
            {solar.optimumTilt !== null &&
              ` Hasil terbaik bila panel menghadap utara dengan kemiringan sekitar ${formatNumber(solar.optimumTilt)}°.`}
          </p>
        </>
      )}
    </section>
  );
}

// November–March, the wet season in West Java (zero-based month indexes).
const RAINY_MONTHS = [10, 11, 0, 1, 2];

function MonthlyChart({ monthlyKwh }) {
  const peak = Math.max(...monthlyKwh, 1);
  const best = monthlyKwh.indexOf(Math.max(...monthlyKwh));
  const worst = monthlyKwh.indexOf(Math.min(...monthlyKwh));

  return (
    <section className="sidebar-section">
      <SectionTitle>Listrik per bulan</SectionTitle>
      <div className="month-chart" role="img" aria-label="Grafik produksi listrik per bulan">
        {monthlyKwh.map((kwh, month) => (
          <div
            key={MONTH_NAMES[month]}
            className={`month-bar${month === best ? " month-bar-best" : ""}`}
            title={`${MONTH_NAMES[month]}: ${formatNumber(kwh)} kWh`}
          >
            <div className="month-bar-track">
              <div className="month-bar-fill" style={{ height: `${Math.max((kwh / peak) * 100, 2)}%` }} />
            </div>
            <span>{MONTH_NAMES[month].slice(0, 3)}</span>
          </div>
        ))}
      </div>
      <p className="sidebar-muted">
        Paling banyak di bulan {MONTH_NAMES[best]} ({formatNumber(monthlyKwh[best])} kWh), paling sedikit di bulan{" "}
        {MONTH_NAMES[worst]} ({formatNumber(monthlyKwh[worst])} kWh)
        {RAINY_MONTHS.includes(worst) ? " karena langit lebih sering berawan saat musim hujan." : "."}
      </p>
    </section>
  );
}

function Benefits({ solar, assumptions }) {
  return (
    <section className="sidebar-section">
      <SectionTitle>Manfaat per tahun</SectionTitle>
      <dl className="benefit-list">
        <div>
          <dt>Nilai listriknya</dt>
          <dd>{formatRupiah(solar.annualValueRp)}</dd>
          <p>
            Seandainya listrik sebanyak ini dibeli dari PLN (Rp{formatNumber(assumptions.tariffRpPerKwh, 2)} per kWh).
            Penghematan tagihan yang sebenarnya bergantung pada pemakaian Anda, hitung di Simulasi biaya di bawah.
          </p>
        </div>
        <div>
          <dt>Emisi CO₂ berkurang</dt>
          <dd>{formatNumber(solar.annualCo2Kg / 1000, 1)} ton</dd>
          <p>
            Listrik PLN di Jawa-Bali sebagian besar dari pembangkit batu bara, sekitar{" "}
            {formatNumber(assumptions.gridEmissionKgPerKwh, 2)} kg CO₂ per kWh.
          </p>
        </div>
      </dl>
    </section>
  );
}

// What to do before installing; the estimate is only a first look from satellite imagery.
function NextSteps() {
  return (
    <section className="sidebar-section">
      <SectionTitle>Langkah selanjutnya</SectionTitle>
      <ol className="next-steps">
        <li>Cek kondisi atap: bahan, kekuatan rangka, dan bayangan dari pohon atau bangunan di sekitarnya.</li>
        <li>Minta survei dan penawaran harga dari beberapa penyedia (installer) PLTS atap.</li>
        <li>Jika panel akan tersambung ke jaringan PLN, ajukan permohonan PLTS atap ke PLN lebih dulu.</li>
      </ol>
    </section>
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
          Luas atap diukur dari bentuknya pada citra satelit, lalu dikurangi {formatNumber(assumptions.setbackM, 1)} m
          di setiap pinggir.
        </li>
        <li>
          Dari sisa atap, {formatNumber(assumptions.packingFactor * 100)}% dianggap bisa dipasangi panel. Sisanya untuk
          bagian yang miring, tandon air, bayangan, dan jalan untuk perawatan.
        </li>
        <li>
          Luas itu dibagi luas satu panel ({formatNumber(panel.areaM2, 2)} m² untuk panel {panel.powerWp} Wp), lalu
          dicek apakah panel sebanyak itu benar-benar muat disusun berbaris. Atap yang muat kurang dari{" "}
          {assumptions.minPanels} panel dianggap belum layak.
        </li>
        <li>
          Listrik per tahun = daya panel (kWp) × sinar matahari di lokasi (kWh per kWp per tahun, dari Global Solar
          Atlas). Angka ini sudah memperhitungkan daya yang hilang di inverter dan kabel, karena debu, dan karena panas.
        </li>
        <li>
          Rekomendasi jumlah panel adalah yang paling sedikit dari tiga batas: panel yang muat di atap, panel yang
          listriknya tidak melebihi pemakaian Anda (pengeluaran ÷ tarif PLN untuk daya Anda), dan panel yang dayanya
          tidak melebihi daya listrik PLN di rumah. Aturan PLTS atap (Permen ESDM 2/2024) tidak lagi membatasi kapasitas
          sebesar daya PLN, tetapi pemasangan perlu kuota dari PLN.
        </li>
        <li>
          Biaya pasang dihitung Rp{formatNumber(assumptions.finance.costRpPerKwp)} per kWp. Penghematan dihitung dengan
          tarif PLN untuk daya Anda dan tidak bisa melebihi pengeluaran listrik Anda. Balik modal = biaya pasang ÷
          penghematan per tahun.
        </li>
      </ol>
      <p className="sidebar-muted">
        Semua angka di sini perkiraan awal dari citra satelit, bukan hasil survei. Kondisi atap sebenarnya perlu dicek
        langsung.
      </p>
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
          <label key={panel.id} className={panel.id === panelId ? "is-active" : undefined}>
            <input
              type="radio"
              name="panel-size"
              value={panel.id}
              checked={panel.id === panelId}
              onChange={() => onChange(panel.id)}
            />
            <strong>{panel.label}</strong>
            <span>{panel.powerWp} Wp</span>
            <span>
              {formatNumber(panel.widthM, 2)} × {formatNumber(panel.lengthM, 2)} m
            </span>
          </label>
        ))}
      </div>
      <p className="panel-size-hint">
        Wp (watt-peak) adalah daya satu panel saat matahari terik. Panel kecil lebih mudah muat di atap sempit.
      </p>
    </fieldset>
  );
}

// The roof's shape with the length of every side and the panels on it, then the estimate per
// month, the unit a household bill uses, with the year and day below it.
function Hero({ solar, assumptions, geometry, panelPlan }) {
  const reason = solar.suitable ? null : unsuitableReason(solar, assumptions);
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
          <span className="hero-label">Perkiraan listrik dari atap ini</span>
          <span className="hero-value">
            {formatNumber(solar.annualKwh / 12)} <small>kWh per bulan</small>
          </span>
          <span className="hero-rate">
            <strong>{formatNumber(solar.annualKwh)}</strong> kWh per tahun, atau{" "}
            <strong>{formatNumber(solar.annualKwh / 365, 1)}</strong> kWh per hari
          </span>
          <span className="hero-sub">
            Dari {formatNumber(solar.panelCount)} panel surya dengan daya total {formatNumber(solar.capacityKwp, 1)}{" "}
            kWp.
          </span>
          <span className="hero-note">Satuan kWh sama dengan yang tertera di meteran dan token listrik PLN.</span>
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
  return (
    <>
      {solar.suitable && <RoofToEnergy solar={solar} assumptions={assumptions} />}
      <Sunlight solar={solar} />
      {solar.suitable && <MonthlyChart monthlyKwh={solar.monthlyKwh} />}
      {solar.suitable && <Benefits solar={solar} assumptions={assumptions} />}
      {solar.suitable && (
        <FinanceSection
          solar={solar}
          assumptions={assumptions}
          panelChoice={panelPlan.choice}
          onPanelChoiceChange={panelPlan.onChoiceChange}
          onRecommendation={panelPlan.onRecommendation}
        />
      )}
      {solar.suitable && <NextSteps />}
    </>
  );
}

function BuildingInfo({ detail, refreshing, onReshape, panelPlan }) {
  const { building, solar, assumptions } = detail;

  return (
    <div className={refreshing ? "is-refreshing" : undefined}>
      <Hero solar={solar} assumptions={assumptions} geometry={building.geometry} panelPlan={panelPlan} />
      <p className="reshape-hint">
        Bentuk atap kurang pas dengan foto satelit?{" "}
        <button type="button" className="text-button" onClick={() => onReshape(detail)}>
          Ubah bentuknya
        </button>
      </p>
      <EstimateSections solar={solar} assumptions={assumptions} panelPlan={panelPlan} />
      <div className="sidebar-details-group">
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
