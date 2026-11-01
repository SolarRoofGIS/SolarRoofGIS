import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Banknote,
  BookOpen,
  Building2,
  CalendarDays,
  Grid3x3,
  Leaf,
  Map as MapIcon,
  MousePointerClick,
  Ruler,
  SolarPanel,
  Sun,
  Zap,
} from "lucide-react";
import { fetchBuildingDetail, fetchJson } from "../api";
import { formatNumber } from "../format";
import SiteFooter from "../layout/SiteFooter";
import "./Pages.css";

// A 220 m² roof near Kebun Raya Bogor, shown as a live example on the home page.
export const EXAMPLE_BUILDING_ID = 487204;

const STEPS = [
  {
    icon: Building2,
    title: "Bentuk atap",
    text: "2,67 juta poligon bangunan dari citra satelit (Google Open Buildings) memberi luas setiap atap.",
  },
  {
    icon: Sun,
    title: "Sinar matahari",
    text: "Global Solar Atlas memberi PVOUT: listrik yang dihasilkan 1 kWp panel per tahun di lokasi itu.",
  },
  {
    icon: SolarPanel,
    title: "Panel yang muat",
    text: "Atap dikurangi jarak tepi dan area terhalang, lalu dihitung berapa panel 550 Wp yang muat.",
  },
  {
    icon: Zap,
    title: "Listrik & manfaat",
    text: "Kapasitas × PVOUT menjadi kWh per tahun dan per bulan, lengkap dengan nilai rupiah dan CO₂.",
  },
];

const FEATURES = [
  {
    icon: Grid3x3,
    title: "Jelajahi per kawasan",
    text: "Lihat kawasan mana yang menyimpan potensi listrik atap terbesar sebelum memperbesar ke atap.",
  },
  {
    icon: MousePointerClick,
    title: "Klik satu atap",
    text: "Setiap bangunan bisa diklik untuk melihat jumlah panel, kapasitas, dan produksi listriknya.",
  },
  {
    icon: CalendarDays,
    title: "Produksi per bulan",
    text: "Grafik bulanan memperlihatkan pengaruh musim hujan terhadap listrik yang dihasilkan.",
  },
  {
    icon: Banknote,
    title: "Nilai dan emisi",
    text: "Perkiraan nilai listrik dengan tarif PLN dan emisi CO₂ yang bisa dihindari setiap tahun.",
  },
];

function formatMillions(value) {
  return `${formatNumber(value / 1e6, 2)} juta`;
}

function StatCard({ icon: Icon, value, label, note }) {
  return (
    <div className="stat-card">
      <span className="stat-icon" aria-hidden="true">
        <Icon size={20} />
      </span>
      <strong className={value ? "" : "skeleton"}>{value || "000"}</strong>
      <span className="stat-label">{label}</span>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
}

function ExampleRoof() {
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let active = true;
    fetchBuildingDetail(EXAMPLE_BUILDING_ID)
      .then((result) => active && setDetail(result))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const solar = detail?.solar;
  // A panel grid that fills about as much of the drawn roof as the estimate does.
  const cells = 40;
  const filled = solar ? Math.round(Math.min(solar.usableShare, 1) * cells) : 0;

  return (
    <Link to={`/peta?atap=${EXAMPLE_BUILDING_ID}`} className="example-card" aria-label="Buka contoh atap di peta">
      <div className="example-head">
        <span className="example-tag">
          <Sun size={13} /> Contoh nyata
        </span>
        <span className="example-place">Dekat Kebun Raya, Kota Bogor</span>
      </div>
      <div className="example-roof" aria-hidden="true">
        {Array.from({ length: cells }, (_, index) => (
          <span key={index} className={index < filled ? "is-panel" : ""} />
        ))}
      </div>
      <div className="example-stats">
        <div>
          <Ruler size={15} />
          <strong>{solar ? `${formatNumber(solar.footprintM2)} m²` : "…"}</strong>
          <span>luas atap</span>
        </div>
        <div>
          <SolarPanel size={15} />
          <strong>{solar ? formatNumber(solar.panelCount) : "…"}</strong>
          <span>panel surya</span>
        </div>
        <div>
          <Zap size={15} />
          <strong>{solar ? `${formatNumber(solar.capacityKwp, 1)} kWp` : "…"}</strong>
          <span>kapasitas</span>
        </div>
      </div>
      <div className="example-result">
        <span>Perkiraan listrik per tahun</span>
        <strong>{solar ? `${formatNumber(solar.annualKwh)} kWh` : "…"}</strong>
      </div>
      <span className="example-open">
        Lihat di peta <ArrowRight size={15} />
      </span>
    </Link>
  );
}

export default function HomePage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchJson("/api/stats", { signal: controller.signal })
      .then(setStats)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const total = stats?.total;

  return (
    <div className="page">
      <section className="home-hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="page-inner home-hero-inner">
          <div className="home-hero-copy">
            <span className="eyebrow">
              <Sun size={14} /> Peta potensi listrik surya atap
            </span>
            <h1>
              Berapa listrik yang bisa dihasilkan <em>atap di Bogor?</em>
            </h1>
            <p>
              SolarRoofGIS memetakan setiap atap bangunan di Kota dan Kabupaten Bogor, lalu memperkirakan
              berapa panel surya yang muat dan berapa listrik yang dihasilkan sepanjang tahun.
            </p>
            <div className="hero-actions">
              <Link to="/peta" className="button button-primary">
                <MapIcon size={18} /> Buka peta
              </Link>
              <Link to="/tentang" className="button button-ghost">
                <BookOpen size={18} /> Metode & data
              </Link>
            </div>
          </div>
          <ExampleRoof />
        </div>
      </section>

      <section className="page-inner stats-section" aria-label="Ringkasan data">
        <div className="stats-grid">
          <StatCard
            icon={Building2}
            value={total && formatMillions(total.buildings)}
            label="bangunan dipetakan"
          />
          <StatCard
            icon={Ruler}
            value={total && `${formatNumber(total.roofAreaM2 / 1e6)} km²`}
            label="total luas atap"
          />
          <StatCard
            icon={SolarPanel}
            value={total && `${formatNumber(total.capacityKwp / 1e6, 1)} GWp`}
            label="kapasitas panel teknis"
            note={total && `${formatNumber((total.suitableBuildings / total.buildings) * 100)}% atap cukup luas`}
          />
          <StatCard
            icon={Zap}
            value={total && `${formatNumber(total.annualGwh / 1000, 1)} TWh`}
            label="listrik per tahun"
            note="Bila semua atap layak dipasangi panel"
          />
        </div>
        {stats && (
          <div className="region-grid">
            {stats.regions.map((region) => (
              <div key={region.name} className="region-card">
                <div className="region-head">
                  <MapIcon size={16} />
                  <h3>{region.name}</h3>
                </div>
                <dl>
                  <div>
                    <dt>Bangunan</dt>
                    <dd>{formatMillions(region.buildings)}</dd>
                  </div>
                  <div>
                    <dt>Luas atap</dt>
                    <dd>{formatNumber(region.roofAreaM2 / 1e6, 1)} km²</dd>
                  </div>
                  <div>
                    <dt>Listrik/tahun</dt>
                    <dd>{formatNumber(region.annualGwh)} GWh</dd>
                  </div>
                  <div>
                    <dt>PVOUT</dt>
                    <dd>
                      {formatNumber(region.pvoutMin)}–{formatNumber(region.pvoutMax)}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        )}
        <p className="stats-footnote">
          Potensi teknis: perkiraan kasar dengan asumsi yang sama seperti di peta (atap dianggap persegi untuk
          jarak tepi). Angka per atap di peta memakai bentuk atap sebenarnya.
        </p>
      </section>

      <section className="page-inner page-section">
        <div className="section-heading">
          <span className="eyebrow eyebrow-dark">
            <Leaf size={14} /> Cara kerja
          </span>
          <h2>Dari bentuk atap sampai kWh</h2>
          <p>Empat langkah yang dijalankan untuk setiap bangunan saat Anda mengkliknya di peta.</p>
        </div>
        <ol className="steps-grid">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="step-card">
              <span className="step-number">{index + 1}</span>
              <span className="step-icon" aria-hidden="true">
                <Icon size={22} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="page-inner page-section">
        <div className="section-heading">
          <span className="eyebrow eyebrow-dark">
            <MapIcon size={14} /> Fitur peta
          </span>
          <h2>Yang bisa Anda lihat</h2>
        </div>
        <div className="feature-grid">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="feature-card">
              <span className="feature-icon" aria-hidden="true">
                <Icon size={20} />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="page-inner page-section">
        <div className="cta-band">
          <div>
            <h2>Mulai dari atap yang Anda kenal</h2>
            <p>Rumah, sekolah, kantor, atau masjid di sekitar Anda. Semuanya ada di peta.</p>
          </div>
          <Link to="/peta" className="button button-primary">
            Jelajahi peta <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
