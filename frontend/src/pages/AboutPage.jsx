import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ExternalLink } from "lucide-react";
import { fetchJson } from "../api";
import { formatNumber } from "../format";
import SiteFooter from "../layout/SiteFooter";
import "./Pages.css";

const AUDIENCES = [
  {
    title: "Pemilik bangunan",
    text: "Gambaran awal apakah atap rumah atau usaha cukup untuk panel surya, dan seberapa besar hasilnya.",
  },
  {
    title: "Pemerintah dan perencana",
    text: "Melihat kawasan dengan potensi terbesar untuk program PLTS atap di gedung publik dan permukiman.",
  },
  {
    title: "Mahasiswa dan peneliti",
    text: "Contoh analisis spasial energi terbarukan berbasis data terbuka yang bisa dikembangkan lebih lanjut.",
  },
];

const DATASETS = [
  {
    name: "Google Open Buildings v3",
    detail: "2,67 juta poligon bangunan",
    text: "Jejak bangunan hasil deteksi model AI pada citra satelit, dengan luas dan tingkat keyakinan deteksi.",
    url: "https://sites.research.google/open-buildings/",
  },
  {
    name: "Global Solar Atlas",
    detail: "PVOUT tahunan dan bulanan, ±1 km",
    text: "Listrik spesifik (kWh per kWp) dan kemiringan panel optimum dari Solargis untuk World Bank Group.",
    url: "https://globalsolaratlas.info/",
  },
  {
    name: "Batas administrasi BIG",
    detail: "Kota dan Kabupaten Bogor",
    text: "Batas wilayah dari Badan Informasi Geospasial, untuk membatasi area studi dan merangkum statistik.",
  },
];

const LIMITATIONS = [
  "Luas atap adalah luas tapak bangunan dari atas. Kemiringan atap, bahan, dan kekuatan struktur tidak diketahui.",
  "Bayangan dari pohon, gedung tinggi, atau perbukitan tidak dihitung satu per satu, hanya lewat faktor 70%.",
  "PVOUT beresolusi sekitar 1 km, jadi atap yang berdekatan mendapat nilai yang sama.",
  "Sejak Permen ESDM 2/2024, listrik yang dikirim ke jaringan PLN tidak lagi mengurangi tagihan. Nilai rupiah adalah nilai energinya, bukan penghematan.",
  "Tarif listrik dan faktor emisi jaringan dapat berubah dan perlu diperbarui secara berkala.",
];

const STACK = ["React", "MapLibre GL", "Express.js", "PostgreSQL + PostGIS", "Vector tiles (MVT)", "geotiff.js"];

function MethodSteps({ assumptions }) {
  const a = assumptions;
  const value = (text) => (a ? text : "…");

  return (
    <ol className="method-steps">
      <li>
        <h3>Jarak bebas tepi</h3>
        <p>
          Tapak atap dikecilkan {value(`${formatNumber(a?.setbackM, 1)} m`)} dari setiap tepi dengan buffer negatif
          PostGIS di proyeksi UTM 48S, untuk jalur perawatan dan beban angin.
        </p>
      </li>
      <li>
        <h3>Area yang bisa dipakai</h3>
        <p>
          {value(`${formatNumber(a?.packingFactor * 100)}%`)} dari sisa atap dianggap bisa dipasangi panel. Sisanya
          untuk kemiringan, tandon air, bayangan, dan akses.
        </p>
      </li>
      <li>
        <h3>Jumlah panel</h3>
        <p>
          Area itu dibagi luas satu panel{" "}
          {value(
            `${a?.panel.powerWp} Wp (${formatNumber(a?.panel.widthM, 3)} × ${formatNumber(a?.panel.lengthM, 3)} m ≈ ${formatNumber(a?.panelAreaM2, 2)} m²)`,
          )}{" "}
          dan dibulatkan ke bawah. Atap yang muat kurang dari {value(a?.minPanels)} panel dianggap tidak layak.
        </p>
      </li>
      <li>
        <h3>Listrik per tahun</h3>
        <p>
          Kapasitas (kWp) dikali PVOUT di lokasi atap. PVOUT sudah memperhitungkan rugi-rugi sistem seperti
          inverter, kabel, debu, dan suhu, jadi tidak ada pengurangan tambahan. Produksi per bulan memakai 12
          lapisan PVOUT bulanan.
        </p>
        <p className="formula">kWh/tahun = jumlah panel × {value(formatNumber(a?.panel.powerWp / 1000, 2))} kWp × PVOUT</p>
      </li>
    </ol>
  );
}

function DocSection({ id, title, children }) {
  return (
    <section className="page-inner doc-section" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <div className="doc-body">{children}</div>
    </section>
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
  const assumptions = [
    ["Jarak bebas tepi", a && `${formatNumber(a.setbackM, 1)} m`],
    ["Faktor area terpakai", a && `${formatNumber(a.packingFactor * 100)}%`],
    ["Panel", a && `${a.panel.powerWp} Wp, ${formatNumber(a.panelAreaM2, 2)} m²`],
    ["Minimal panel per atap", a && a.minPanels],
    ["Tarif listrik PLN", a && `Rp${formatNumber(a.tariffRpPerKwh, 2)}/kWh`],
    ["Faktor emisi Jawa-Bali", a && `${formatNumber(a.gridEmissionKgPerKwh, 2)} kg CO₂/kWh`],
    [
      "Rentang PVOUT di peta",
      method?.pvoutRange &&
        `${formatNumber(method.pvoutRange.min)}–${formatNumber(method.pvoutRange.max)} kWh/kWp`,
    ],
  ];

  return (
    <div className="page">
      <header className="page-inner doc-header">
        <p className="overline">Tentang proyek</p>
        <h1>Tentang SolarRoofGIS</h1>
        <p className="lead">
          Sistem informasi geografis untuk memperkirakan potensi pembangkit listrik tenaga surya (PLTS) atap di
          setiap bangunan di Kota dan Kabupaten Bogor, dibuat oleh Kelompok 14, IPB University.
        </p>
      </header>

      <DocSection id="tujuan" title="Tujuan">
        <p>
          Indonesia menargetkan bauran energi terbarukan yang jauh lebih besar, dan atap bangunan adalah lahan PLTS
          yang sudah tersedia. Peta ini membantu melihat seberapa besar potensinya, terutama bagi:
        </p>
        <dl className="term-list">
          {AUDIENCES.map(({ title, text }) => (
            <div key={title}>
              <dt>{title}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </DocSection>

      <DocSection id="data" title="Sumber data">
        <dl className="term-list">
          {DATASETS.map(({ name, detail, text, url }) => (
            <div key={name}>
              <dt>
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer" className="text-link">
                    {name} <ExternalLink size={13} />
                  </a>
                ) : (
                  name
                )}
                <span className="term-detail">{detail}</span>
              </dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </DocSection>

      <DocSection id="metode" title="Metode">
        <p>Seluruh atap tidak mungkin dipasangi panel, jadi potensi satu atap dihitung bertahap.</p>
        <MethodSteps assumptions={a} />
        <table className="data-table assumption-table">
          <caption>Asumsi yang dipakai</caption>
          <tbody>
            {assumptions.map(([label, value]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{value ?? "…"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DocSection>

      <DocSection id="keterbatasan" title="Keterbatasan">
        <p>Angka di peta adalah perkiraan awal untuk perencanaan, bukan pengganti survei lapangan.</p>
        <ul className="plain-list">
          {LIMITATIONS.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </DocSection>

      <DocSection id="teknologi" title="Teknologi">
        <p>{STACK.join(" · ")}</p>
        <p>
          <Link to="/peta" className="text-link">
            Buka peta <ArrowRight size={15} />
          </Link>
        </p>
      </DocSection>

      <SiteFooter />
    </div>
  );
}
