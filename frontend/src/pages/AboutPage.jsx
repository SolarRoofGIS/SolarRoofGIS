import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Calculator,
  CloudSun,
  Database,
  ExternalLink,
  GraduationCap,
  House,
  Landmark,
  Layers,
  Map as MapIcon,
  Ruler,
  Server,
  SolarPanel,
  Sun,
  Target,
  TriangleAlert,
  Users,
  Zap,
} from "lucide-react";
import { fetchJson } from "../api";
import { formatNumber } from "../format";
import SiteFooter from "../layout/SiteFooter";
import "./Pages.css";

const AUDIENCES = [
  {
    icon: House,
    title: "Pemilik bangunan",
    text: "Gambaran awal apakah atap rumah atau usaha cukup untuk panel surya, dan seberapa besar hasilnya.",
  },
  {
    icon: Landmark,
    title: "Pemerintah & perencana",
    text: "Melihat kawasan dengan potensi terbesar untuk program PLTS atap di gedung publik dan permukiman.",
  },
  {
    icon: GraduationCap,
    title: "Mahasiswa & peneliti",
    text: "Contoh analisis spasial energi terbarukan berbasis data terbuka yang bisa dikembangkan lebih lanjut.",
  },
];

const DATASETS = [
  {
    icon: Building2,
    name: "Google Open Buildings",
    detail: "2,67 juta poligon bangunan",
    text: "Jejak bangunan hasil deteksi model AI pada citra satelit, lengkap dengan luas dan tingkat keyakinan deteksi.",
    url: "https://sites.research.google/open-buildings/",
  },
  {
    icon: Sun,
    name: "Global Solar Atlas",
    detail: "PVOUT tahunan & bulanan, ±1 km",
    text: "Listrik spesifik (kWh per kWp) dan kemiringan panel optimum dari Solargis untuk World Bank Group.",
    url: "https://globalsolaratlas.info/",
  },
  {
    icon: MapIcon,
    name: "Batas administrasi BIG",
    detail: "Kota & Kabupaten Bogor",
    text: "Batas wilayah dari Badan Informasi Geospasial, untuk membatasi area studi dan merangkum statistik per wilayah.",
  },
];

const LIMITATIONS = [
  "Luas atap adalah luas tapak bangunan dari atas. Kemiringan atap, bahan, dan kekuatan struktur tidak diketahui.",
  "Bayangan dari pohon, gedung tinggi, atau perbukitan tidak dihitung satu per satu, hanya lewat faktor 70%.",
  "PVOUT beresolusi sekitar 1 km, jadi atap yang berdekatan mendapat nilai yang sama.",
  "Sejak Permen ESDM 2/2024, listrik yang dikirim ke jaringan PLN tidak lagi mengurangi tagihan. Nilai rupiah adalah nilai energinya, bukan penghematan.",
  "Tarif listrik dan faktor emisi jaringan dapat berubah dan perlu diperbarui secara berkala.",
];

const STACK = [
  { icon: Layers, label: "React + MapLibre GL" },
  { icon: Server, label: "Express.js" },
  { icon: Database, label: "PostgreSQL + PostGIS" },
  { icon: MapIcon, label: "Vector tiles (MVT)" },
  { icon: CloudSun, label: "GeoTIFF (geotiff.js)" },
];

function MethodSteps({ assumptions }) {
  const a = assumptions;
  const value = (text) => (a ? text : "…");

  return (
    <ol className="method-steps">
      <li>
        <span className="method-icon">
          <Ruler size={18} />
        </span>
        <div>
          <h3>Jarak bebas tepi</h3>
          <p>
            Tapak atap dikecilkan {value(`${formatNumber(a?.setbackM, 1)} m`)} dari setiap tepi dengan buffer
            negatif PostGIS di proyeksi UTM 48S, untuk jalur perawatan dan beban angin.
          </p>
        </div>
      </li>
      <li>
        <span className="method-icon">
          <Building2 size={18} />
        </span>
        <div>
          <h3>Area yang bisa dipakai</h3>
          <p>
            {value(`${formatNumber(a?.packingFactor * 100)}%`)} dari sisa atap dianggap bisa dipasangi panel.
            Sisanya untuk kemiringan, tandon air, bayangan, dan akses.
          </p>
        </div>
      </li>
      <li>
        <span className="method-icon">
          <SolarPanel size={18} />
        </span>
        <div>
          <h3>Jumlah panel</h3>
          <p>
            Area itu dibagi luas satu panel{" "}
            {value(
              `${a?.panel.powerWp} Wp (${formatNumber(a?.panel.widthM, 3)} × ${formatNumber(a?.panel.lengthM, 3)} m ≈ ${formatNumber(a?.panelAreaM2, 2)} m²)`,
            )}{" "}
            dan dibulatkan ke bawah. Atap yang muat kurang dari {value(a?.minPanels)} panel dianggap tidak layak.
          </p>
        </div>
      </li>
      <li>
        <span className="method-icon">
          <Zap size={18} />
        </span>
        <div>
          <h3>Listrik per tahun</h3>
          <p>
            Kapasitas (kWp) dikali PVOUT di lokasi atap. PVOUT sudah memperhitungkan rugi-rugi sistem
            seperti inverter, kabel, debu, dan suhu, jadi tidak ada pengurangan tambahan. Produksi per bulan
            memakai 12 lapisan PVOUT bulanan.
          </p>
          <div className="formula">
            kWh/tahun = jumlah panel × {value(formatNumber(a?.panel.powerWp / 1000, 2))} kWp × PVOUT
          </div>
        </div>
      </li>
    </ol>
  );
}

export default function AboutPage() {
  const [method, setMethod] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchJson("/api/method", { signal: controller.signal })
      .then(setMethod)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const a = method?.assumptions;

  return (
    <div className="page">
      <section className="page-hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="page-inner">
          <span className="eyebrow">
            <Target size={14} /> Tentang proyek
          </span>
          <h1>Tentang SolarRoofGIS</h1>
          <p>
            Sistem informasi geografis untuk memperkirakan potensi pembangkit listrik tenaga surya (PLTS) atap
            di setiap bangunan di Kota dan Kabupaten Bogor, dibuat oleh Kelompok 14, IPB University.
          </p>
        </div>
      </section>

      <section className="page-inner page-section">
        <div className="section-heading">
          <span className="eyebrow eyebrow-dark">
            <Users size={14} /> Tujuan
          </span>
          <h2>Untuk siapa peta ini?</h2>
          <p>
            Indonesia menargetkan bauran energi terbarukan yang jauh lebih besar, dan atap bangunan adalah lahan
            PLTS yang sudah tersedia. Peta ini membantu melihat seberapa besar potensinya.
          </p>
        </div>
        <div className="audience-grid">
          {AUDIENCES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="feature-card feature-card-stacked">
              <span className="feature-icon" aria-hidden="true">
                <Icon size={20} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="page-inner page-section">
        <div className="section-heading">
          <span className="eyebrow eyebrow-dark">
            <Database size={14} /> Data
          </span>
          <h2>Sumber data</h2>
        </div>
        <div className="dataset-grid">
          {DATASETS.map(({ icon: Icon, name, detail, text, url }) => (
            <div key={name} className="dataset-card">
              <span className="dataset-icon" aria-hidden="true">
                <Icon size={22} />
              </span>
              <h3>{name}</h3>
              <span className="dataset-detail">{detail}</span>
              <p>{text}</p>
              {url && (
                <a href={url} target="_blank" rel="noreferrer">
                  Kunjungi sumber <ExternalLink size={13} />
                </a>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="page-inner page-section">
        <div className="section-heading">
          <span className="eyebrow eyebrow-dark">
            <Calculator size={14} /> Metode
          </span>
          <h2>Cara menghitung potensi satu atap</h2>
          <p>Seluruh atap tidak mungkin dipasangi panel, jadi perhitungan berjalan bertahap.</p>
        </div>
        <div className="method-layout">
          <MethodSteps assumptions={a} />
          <aside className="assumption-card">
            <h3>Asumsi yang dipakai</h3>
            <dl>
              <div>
                <dt>Jarak bebas tepi</dt>
                <dd>{a ? `${formatNumber(a.setbackM, 1)} m` : "…"}</dd>
              </div>
              <div>
                <dt>Faktor area terpakai</dt>
                <dd>{a ? `${formatNumber(a.packingFactor * 100)}%` : "…"}</dd>
              </div>
              <div>
                <dt>Panel</dt>
                <dd>{a ? `${a.panel.powerWp} Wp · ${formatNumber(a.panelAreaM2, 2)} m²` : "…"}</dd>
              </div>
              <div>
                <dt>Minimal panel</dt>
                <dd>{a ? a.minPanels : "…"}</dd>
              </div>
              <div>
                <dt>Tarif listrik PLN</dt>
                <dd>{a ? `Rp${formatNumber(a.tariffRpPerKwh, 2)}/kWh` : "…"}</dd>
              </div>
              <div>
                <dt>Faktor emisi Jawa-Bali</dt>
                <dd>{a ? `${formatNumber(a.gridEmissionKgPerKwh, 2)} kg CO₂/kWh` : "…"}</dd>
              </div>
              {method?.pvoutRange && (
                <div>
                  <dt>Rentang PVOUT di peta</dt>
                  <dd>
                    {formatNumber(method.pvoutRange.min)}–{formatNumber(method.pvoutRange.max)} kWh/kWp
                  </dd>
                </div>
              )}
            </dl>
          </aside>
        </div>
      </section>

      <section className="page-inner page-section">
        <div className="section-heading">
          <span className="eyebrow eyebrow-dark">
            <TriangleAlert size={14} /> Keterbatasan
          </span>
          <h2>Yang perlu diingat</h2>
          <p>Angka di peta adalah perkiraan awal untuk perencanaan, bukan pengganti survei lapangan.</p>
        </div>
        <ul className="limit-list">
          {LIMITATIONS.map((text) => (
            <li key={text}>
              <TriangleAlert size={16} />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="page-inner page-section">
        <div className="section-heading">
          <span className="eyebrow eyebrow-dark">
            <Server size={14} /> Teknologi
          </span>
          <h2>Dibangun dengan</h2>
        </div>
        <div className="stack-list">
          {STACK.map(({ icon: Icon, label }) => (
            <span key={label} className="stack-chip">
              <Icon size={16} /> {label}
            </span>
          ))}
        </div>
      </section>

      <section className="page-inner page-section">
        <div className="cta-band">
          <div>
            <h2>Siap melihat atap di sekitar Anda?</h2>
            <p>Buka peta, perbesar ke lingkungan Anda, lalu klik sebuah atap.</p>
          </div>
          <Link to="/peta" className="button button-primary">
            Buka peta <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
