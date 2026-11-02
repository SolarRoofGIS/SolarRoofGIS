import { ChevronDown, ChevronUp, ExternalLink, LoaderCircle, X } from "lucide-react";
import { formatNumber, formatRupiah, MONTH_NAMES } from "../format";
import { PVOUT_RAMP } from "../map/colors";
import "./Sidebar.css";

function regionName(region) {
  if (region === "Bogor") return "Kabupaten Bogor";
  return region || "Di luar batas wilayah Bogor";
}

function sunlightLevel(rank) {
  if (rank === null) return { label: "Tidak ada data", tone: "none" };
  if (rank >= 2 / 3) return { label: "Tinggi", tone: "high" };
  if (rank >= 1 / 3) return { label: "Sedang", tone: "medium" };
  return { label: "Rendah", tone: "low" };
}

function SectionTitle({ children, aside }) {
  return (
    <div className="section-title">
      <h3>{children}</h3>
      {aside}
    </div>
  );
}

function Intro({ onExplore }) {
  return (
    <div className="sidebar-intro">
      <p>Perkiraan listrik dari panel surya di atap setiap bangunan di Kota dan Kabupaten Bogor.</p>
      <ol className="intro-steps">
        <li>
          Warna menunjukkan energi surya tahunan (PVOUT): kuning lebih rendah, oranye tua lebih tinggi. Dari
          jauh terlihat overlay PVOUT Global Solar Atlas, setelah diperbesar warna tiap atap.
        </li>
        <li>Klik sebuah kawasan untuk memperbesar sampai bentuk atap terlihat.</li>
        <li>Klik sebuah atap untuk melihat panel yang muat, listrik per tahun, dan manfaatnya.</li>
      </ol>
      <button type="button" className="button button-outline intro-cta" onClick={onExplore}>
        Lihat contoh di pusat Kota Bogor
      </button>
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
          label="Luas atap"
          value={`${formatNumber(solar.footprintM2)} m²`}
          note="Luas bangunan dilihat dari atas (citra satelit)."
        />
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
          note={`Panel ${assumptions.panel.powerWp} Wp, ${formatNumber(assumptions.panel.widthM, 2)} × ${formatNumber(assumptions.panel.lengthM, 2)} m. Total ${formatNumber(solar.capacityKwp, 1)} kWp.`}
        />
        <FlowStep
          label="Listrik per tahun"
          value={`${formatNumber(solar.annualKwh)} kWh`}
          note={`${formatNumber(solar.capacityKwp, 1)} kWp × ${formatNumber(solar.pvout)} kWh per kWp di lokasi ini.`}
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
                style={{ background: `linear-gradient(to right, ${PVOUT_RAMP.join(", ")})` }}
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
        Tertinggi di bulan {MONTH_NAMES[best]} ({formatNumber(monthlyKwh[best])} kWh), terendah di
        bulan {MONTH_NAMES[worst]} ({formatNumber(monthlyKwh[worst])} kWh)
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
            Tarif PLN Rp{formatNumber(assumptions.tariffRpPerKwh, 2)}/kWh. Nilai energinya, bukan jaminan hemat
            tagihan.
          </p>
        </div>
        <div>
          <dt>CO₂ dihindari</dt>
          <dd>{formatNumber(solar.annualCo2Kg / 1000, 1)} ton</dd>
          <p>
            Dibanding listrik jaringan Jawa-Bali ({formatNumber(assumptions.gridEmissionKgPerKwh, 2)} kg CO₂/kWh).
          </p>
        </div>
      </dl>
    </section>
  );
}

function BuildingDetails({ building, solar }) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${building.latitude},${building.longitude}`;

  return (
    <details className="sidebar-details">
      <summary>
        Detail bangunan
        <ChevronDown size={16} className="details-chevron" />
      </summary>
      <dl>
        <dt>Wilayah</dt>
        <dd>{regionName(building.region)}</dd>
        <dt>Luas atap</dt>
        <dd>{formatNumber(solar.footprintM2, 1)} m²</dd>
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
      <a className="details-link" href={mapsUrl} target="_blank" rel="noreferrer">
        Buka lokasi di Google Maps <ExternalLink size={13} />
      </a>
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
          Luas itu dibagi luas satu panel ({formatNumber(assumptions.panelAreaM2, 2)} m²,{" "}
          {assumptions.panel.powerWp} Wp) dan dibulatkan ke bawah. Atap yang muat kurang dari{" "}
          {assumptions.minPanels} panel dianggap tidak layak.
        </li>
        <li>
          Listrik per tahun = kapasitas (kWp) × PVOUT dari Global Solar Atlas, yang sudah memperhitungkan
          rugi-rugi inverter, kabel, debu, dan suhu.
        </li>
      </ol>
      <p className="sidebar-muted">
        Angka ini perkiraan awal untuk perencanaan. Kondisi atap sebenarnya perlu dicek di lapangan.
      </p>
    </details>
  );
}

function BuildingInfo({ detail }) {
  const { building, solar, assumptions } = detail;

  return (
    <>
      {solar.suitable ? (
        <div className="hero">
          <span className="hero-label">Perkiraan listrik per tahun</span>
          <span className="hero-value">
            {formatNumber(solar.annualKwh)} <small>kWh</small>
          </span>
          <span className="hero-sub">
            {formatNumber(solar.panelCount)} panel · {formatNumber(solar.capacityKwp, 1)} kWp ·{" "}
            {formatNumber(solar.footprintM2)} m² atap
          </span>
          <span className="hero-sub">
            Sekitar {formatNumber(solar.annualKwh / 12)} kWh per bulan, {formatNumber(solar.annualKwh / 365, 1)} kWh
            per hari.
          </span>
        </div>
      ) : (
        <div className="hero hero-unsuitable">
          <span className="hero-label">Perkiraan listrik per tahun</span>
          <span className="hero-value">Atap terlalu kecil</span>
          <p className="hero-sub">
            Setelah dikurangi jarak dari tepi, hanya {formatNumber(solar.usableM2, 1)} m² yang bisa dipakai.
            Itu tidak cukup untuk {assumptions.minPanels} panel surya.
          </p>
        </div>
      )}

      {solar.suitable && <RoofToEnergy solar={solar} assumptions={assumptions} />}
      <Sunlight solar={solar} />
      {solar.suitable && <MonthlyChart monthlyKwh={solar.monthlyKwh} />}
      {solar.suitable && <Benefits solar={solar} assumptions={assumptions} />}
      <div className="sidebar-details-group">
        <BuildingDetails building={building} solar={solar} />
        <Method assumptions={assumptions} />
      </div>
    </>
  );
}

export default function Sidebar({ selection, collapsed, onToggleCollapsed, onClose, onExplore }) {
  const selected = selection.status !== "idle";
  const kicker = selected && selection.status === "ready" ? regionName(selection.detail.building.region) : null;
  const title = selected ? "Atap terpilih" : "Potensi listrik surya atap";

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
            <button type="button" className="icon-button" onClick={onClose} aria-label="Tutup atap terpilih" title="Tutup">
              <X size={18} />
            </button>
          )}
        </div>
      </div>
      {!collapsed && (
        <div className="sidebar-body">
          {!selected && <Intro onExplore={onExplore} />}
          {selection.status === "loading" && (
            <div className="sidebar-loading">
              <LoaderCircle size={16} className="spin" /> Menghitung potensi surya…
            </div>
          )}
          {selection.status === "error" && (
            <p className="sidebar-error">Data atap tidak dapat dimuat: {selection.message}</p>
          )}
          {selection.status === "ready" && <BuildingInfo detail={selection.detail} />}
        </div>
      )}
    </aside>
  );
}
