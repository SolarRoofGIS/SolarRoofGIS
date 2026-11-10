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

function sunlightLevel(rank) {
  if (rank === null) return { label: "Tidak ada data", tone: "none" };
  if (rank >= 2 / 3) return { label: "Tinggi", tone: "high" };
  if (rank >= 1 / 3) return { label: "Sedang", tone: "medium" };
  return { label: "Rendah", tone: "low" };
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
  return (
    <section className="sidebar-section">
      <SectionTitle>Dari atap ke listrik</SectionTitle>
      <ol className="flow">
        <FlowStep
          label="Bisa dipasangi panel"
          value={`${formatNumber(solar.usableM2)} m²`}
          note={`Sekitar ${formatNumber(solar.usableShare * 100)}% atap. Sisanya untuk jarak ${formatNumber(assumptions.setbackM, 1)} m dari tepi, tandon, kemiringan, atau bayangan.`}
        >
          <div className="usable-bar" aria-hidden="true">
            <div style={{ width: `${Math.min(solar.usableShare * 100, 100)}%` }} />
          </div>
        </FlowStep>
        <FlowStep
          label="Jumlah panel surya"
          value={`${formatNumber(solar.panelCount)} panel`}
          note={`Panel ${assumptions.panel.powerWp} Wp, ${formatNumber(assumptions.panel.widthM, 2)} × ${formatNumber(assumptions.panel.lengthM, 2)} m. Total ${formatNumber(solar.capacityKwp, 1)} kWp × ${formatNumber(solar.pvout)} kWh per kWp di lokasi ini.${solar.limitedByLayout ? " Jumlahnya dibatasi bentuk atap, karena panel utuh harus muat tersusun." : ""}`}
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
        Intensitas sinar matahari
      </SectionTitle>
      {solar.pvout === null ? (
        <p className="sidebar-muted">Data sinar matahari tidak tersedia di lokasi ini.</p>
      ) : (
        <>
          <p className="sunlight-value">
            <strong>{formatNumber(solar.pvout)}</strong> kWh per kWp per tahun
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
                <span>{formatNumber(range.min)}</span>
                <span>{formatNumber(range.max)}</span>
              </div>
            </div>
          )}
          <p className="sidebar-muted">
            Lebih tinggi dari {formatNumber(solar.pvoutRank * 100)}% wilayah Bogor.
            {solar.optimumTilt !== null && ` Kemiringan panel terbaik sekitar ${formatNumber(solar.optimumTilt)}°.`}
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
      <SectionTitle>Produksi per bulan</SectionTitle>
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
        Tertinggi di bulan {MONTH_NAMES[best]} ({formatNumber(monthlyKwh[best])} kWh), terendah di bulan{" "}
        {MONTH_NAMES[worst]} ({formatNumber(monthlyKwh[worst])} kWh)
        {RAINY_MONTHS.includes(worst) ? ", saat musim hujan langit lebih sering berawan." : "."}
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
          <dt>Nilai listrik</dt>
          <dd>{formatRupiah(solar.annualValueRp)}</dd>
          <p>
            Tarif PLN Rp{formatNumber(assumptions.tariffRpPerKwh, 2)}/kWh. Nilai energinya, bukan jaminan hemat tagihan.
          </p>
        </div>
        <div>
          <dt>CO₂ dihindari</dt>
          <dd>{formatNumber(solar.annualCo2Kg / 1000, 1)} ton</dd>
          <p>Dibanding listrik jaringan Jawa-Bali ({formatNumber(assumptions.gridEmissionKgPerKwh, 2)} kg CO₂/kWh).</p>
        </div>
      </dl>
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
        <dt>Keyakinan deteksi</dt>
        <dd>
          {formatNumber(building.confidence * 100)}%
          <span className="dd-note">Seberapa yakin model Google bahwa bentuk ini memang bangunan.</span>
        </dd>
      </dl>
      <GoogleMapsLink latitude={building.latitude} longitude={building.longitude} />
    </details>
  );
}

function Method({ assumptions }) {
  return (
    <details className="sidebar-details">
      <summary>
        Cara menghitung
        <ChevronDown size={16} className="details-chevron" />
      </summary>
      <ol className="method-list">
        <li>Luas atap dikurangi jarak bebas {formatNumber(assumptions.setbackM, 1)} m di setiap tepi.</li>
        <li>
          Dari sisa atap, {formatNumber(assumptions.packingFactor * 100)}% dianggap bisa dipasangi panel
          (memperhitungkan kemiringan, tandon, bayangan, dan jalur perawatan).
        </li>
        <li>
          Luas itu dibagi luas satu panel ({formatNumber(assumptions.panelAreaM2, 2)} m², {assumptions.panel.powerWp}{" "}
          Wp) dan dibulatkan ke bawah, lalu dicek apakah panel sebanyak itu benar-benar muat tersusun dalam baris pada
          bentuk atapnya. Atap yang muat kurang dari {assumptions.minPanels} panel dianggap tidak layak.
        </li>
        <li>
          Listrik per tahun = kapasitas (kWp) × PVOUT dari Global Solar Atlas, yang sudah memperhitungkan rugi-rugi
          inverter, kabel, debu, dan suhu.
        </li>
        <li>
          Biaya investasi Rp{formatNumber(assumptions.finance.costRpPerKwp)} per kWp. Penghematan tidak melebihi
          pengeluaran listrik, dan Payback Period = biaya investasi ÷ penghematan per tahun.
        </li>
      </ol>
      <p className="sidebar-muted">
        Angka ini perkiraan awal untuk perencanaan. Kondisi atap sebenarnya perlu dicek di lapangan.
      </p>
    </details>
  );
}

// Why a roof gets no estimate: no solar data here, a shape panels do not fit, or too little area.
function unsuitableReason(solar, { minPanels }) {
  if (solar.pvout === null) {
    return {
      title: "Data sinar matahari tidak ada",
      text: "Lokasi ini di luar cakupan data PVOUT, jadi listriknya tidak bisa diperkirakan.",
    };
  }
  if (solar.limitedByLayout) {
    return {
      title: "Atap terlalu sempit",
      text: `Setelah dikurangi jarak dari tepi, bentuk atap ini hanya muat ${formatNumber(solar.layoutPanels)} panel utuh, kurang dari ${minPanels} panel.`,
    };
  }
  return {
    title: "Atap terlalu kecil",
    text: `Setelah dikurangi jarak dari tepi, hanya ${formatNumber(solar.usableM2, 1)} m² yang bisa dipakai. Itu tidak cukup untuk ${minPanels} panel surya.`,
  };
}

// The roof's shape with the length of every side, then the estimate per year, month and day.
function Hero({ solar, assumptions, geometry }) {
  const reason = solar.suitable ? null : unsuitableReason(solar, assumptions);
  return (
    <div className={`hero${solar.suitable ? "" : " hero-unsuitable"}`}>
      <figure className="hero-shape">
        <RoofOutline
          geometry={geometry}
          color={pvoutCss(solar.pvout, solar.pvoutRange)}
          sideLengths
          areaM2={solar.footprintM2}
          label={`Bentuk atap seluas ${formatNumber(solar.footprintM2)} m² dengan panjang setiap sisi dalam meter`}
        />
      </figure>
      <span className="hero-label">Perkiraan</span>
      {solar.suitable ? (
        <>
          <span className="hero-value">
            {formatNumber(solar.annualKwh)} <small>kWh per tahun</small>
          </span>
          <span className="hero-rate">
            <strong>{formatNumber(solar.annualKwh / 12)}</strong> kWh per bulan
          </span>
          <span className="hero-rate">
            <strong>{formatNumber(solar.annualKwh / 365, 1)}</strong> kWh per hari
          </span>
          <span className="hero-sub">
            {formatNumber(solar.panelCount)} panel · {formatNumber(solar.capacityKwp, 1)} kWp
          </span>
        </>
      ) : (
        <>
          <span className="hero-value">{reason.title}</span>
          <p className="hero-sub">{reason.text}</p>
        </>
      )}
    </div>
  );
}

// Everything below the headline figure, the same for a database roof and a drawn one.
function EstimateSections({ solar, assumptions }) {
  return (
    <>
      {solar.suitable && <RoofToEnergy solar={solar} assumptions={assumptions} />}
      <Sunlight solar={solar} />
      {solar.suitable && <MonthlyChart monthlyKwh={solar.monthlyKwh} />}
      {solar.suitable && <Benefits solar={solar} assumptions={assumptions} />}
      {solar.suitable && <FinanceSection solar={solar} assumptions={assumptions} />}
    </>
  );
}

function BuildingInfo({ detail, onReshape }) {
  const { building, solar, assumptions } = detail;

  return (
    <>
      <Hero solar={solar} assumptions={assumptions} geometry={building.geometry} />
      <p className="reshape-hint">
        Bentuk dari citra satelit tidak pas?{" "}
        <button type="button" className="text-button" onClick={() => onReshape(detail)}>
          Ubah bentuknya
        </button>
      </p>
      <EstimateSections solar={solar} assumptions={assumptions} />
      <div className="sidebar-details-group">
        <BuildingDetails building={building} />
        <Method assumptions={assumptions} />
      </div>
    </>
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

function CustomRoofInfo({ custom, customRoofs, onEdit, onDoneEditing, onDelete, onSelectCustom }) {
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
          <LoaderCircle size={16} className="spin" /> Menghitung potensi surya…
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
          <Hero solar={detail.solar} assumptions={detail.assumptions} geometry={customRoof.geometry} />
          <EstimateSections solar={detail.solar} assumptions={detail.assumptions} />
          <div className="sidebar-details-group">
            <CustomDetails customRoof={customRoof} detail={detail} />
            <Method assumptions={detail.assumptions} />
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
                  <LoaderCircle size={16} className="spin" /> Menghitung potensi surya…
                </div>
              )}
              {selection.status === "error" && (
                <p className="sidebar-error">Data atap tidak dapat dimuat: {selection.message}</p>
              )}
              {selection.status === "ready" && <BuildingInfo detail={selection.detail} onReshape={onReshapeBuilding} />}
            </>
          )}
        </div>
      )}
    </aside>
  );
}
