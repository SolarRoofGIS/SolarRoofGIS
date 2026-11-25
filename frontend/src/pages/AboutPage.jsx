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

// What each figure on the map means, in the order the roof panel shows them.
const READING = [
  {
    title: "Tanda ~",
    text: "Angka bertanda ~ adalah perkiraan dari citra satelit dan data iklim, bukan hasil ukur atau jaminan.",
  },
  {
    title: "Potensi maksimal atap",
    text: "Jumlah panel yang muat di atap, dayanya, dan listrik per bulan bila semuanya dipasang.",
  },
  {
    title: "Saran untuk rumah Anda",
    text: "Jumlah panel yang sesuai daya PLN dan pengeluaran listrik yang Anda isi. Biasanya jauh lebih sedikit dari potensi maksimal, karena listrik yang tidak terpakai terbuang.",
  },
  {
    title: "Biaya pasang",
    text: "Perkiraan harga panel, inverter, rangka, kabel, dan ongkos pasang. Harga penawaran installer bisa berbeda.",
  },
  {
    title: "Hemat per bulan",
    text: "Tagihan atau token yang berkurang. Tidak bisa lebih besar dari pengeluaran listrik Anda.",
  },
  {
    title: "Balik modal",
    text: "Berapa tahun sampai penghematan menutup biaya pasang. Garansi panel umumnya 25 tahun.",
  },
];

const TERMS = [
  { title: "kWh", text: "Satuan energi listrik, sama dengan yang tertera di meteran dan token PLN." },
  {
    title: "Wp dan kWp",
    text: "Daya panel saat matahari terik. 1 kWp = 1.000 Wp, misalnya dua panel 550 Wp = 1,1 kWp.",
  },
  {
    title: "PVOUT",
    text: "Listrik yang dihasilkan 1 kWp panel di suatu lokasi dalam setahun (kWh per kWp). Makin tinggi, makin banyak sinar matahari.",
  },
  {
    title: "VA",
    text: "Daya listrik PLN di rumah, misalnya 1.300 VA. Rumah tidak bisa memakai lebih dari ini sekaligus.",
  },
  { title: "PLTS atap", text: "Pembangkit listrik tenaga surya yang dipasang di atap bangunan." },
];

// Where the estimate can be off, and in which direction.
const TOO_HIGH = [
  "Bayangan pohon, gedung, atau bukit tidak dihitung satu per satu, hanya lewat potongan umum 70% luas atap. Atap yang teduh bisa menghasilkan jauh lebih sedikit.",
  "Hitungan memakai panel yang dipasang terbaik: miring sekitar 9–11° menghadap utara. Pada atap genteng miring sekitar 30°, sisi yang menghadap selatan menghasilkan kira-kira 10–15% lebih sedikit, sisi timur atau barat kira-kira 5–8% lebih sedikit.",
  "Data PVOUT dibuat untuk panel yang berdiri bebas. Panel yang menempel di atap lebih panas, sehingga hasilnya turun sekitar 2–4%.",
  "Penurunan kemampuan panel (sekitar 0,5% per tahun) belum dihitung di proyeksi 25 tahun.",
  "Penghematan menganggap semua listrik dari panel langsung terpakai di rumah.",
];

const TOO_LOW = [
  "Jarak 0,5 m dari pinggir dan faktor 70% membuat jumlah panel cenderung sedikit.",
  "Tarif PLN dianggap tetap selama 25 tahun. Jika tarif naik, penghematan sebenarnya lebih besar.",
];

const OTHER_LIMITS = [
  "Bentuk atap berasal dari deteksi otomatis Google. Sekitar 13% bentuk memiliki keyakinan di bawah 70%, jadi bisa saja bukan bangunan atau bentuknya kurang pas. Gunakan Ubah bentuk atau Gambar atap bila perlu.",
  "Kemiringan, bahan, dan kekuatan atap tidak diketahui. Kondisi atap perlu dicek langsung sebelum memasang.",
  "PVOUT beresolusi sekitar 1 km, jadi atap yang berdekatan mendapat nilai yang sama.",
  "Pemakaian listrik diperkirakan dari pengeluaran dibagi tarif PLN, tanpa pajak penerangan jalan, dan tanpa melihat pola pemakaian siang dan malam.",
  "Tarif PLN, harga panel, dan faktor emisi berubah dari waktu ke waktu dan perlu diperbarui.",
];

const STACK = ["React", "MapLibre GL", "Express.js", "PostgreSQL + PostGIS", "Vector tiles (MVT)", "geotiff.js"];

function panelSize(panel) {
  return `${formatNumber(panel.widthM, 2)} × ${formatNumber(panel.lengthM, 2)} m`;
}

function MethodSteps({ assumptions }) {
  const a = assumptions;
  const value = (text) => (a ? text : "…");
  const defaultPanel = a?.panels.find((panel) => panel.id === a.defaultPanel);

  return (
    <ol className="method-steps">
      <li>
        <h3>Bagian atap yang bisa dipakai</h3>
        <p>
          Luas atap diukur dari bentuknya pada citra satelit (PostGIS, proyeksi UTM 48S). Atap dikecilkan{" "}
          {value(`${formatNumber(a?.setbackM, 1)} m`)} dari setiap pinggir untuk jalan perawatan dan beban angin, lalu{" "}
          {value(`${formatNumber(a?.packingFactor * 100)}%`)} dari sisanya dianggap bisa dipasangi panel. Sisanya untuk
          bagian miring, tandon air, bayangan, dan akses.
        </p>
      </li>
      <li>
        <h3>Jumlah panel</h3>
        <p>
          Luas itu dibagi luas satu panel dan dibulatkan ke bawah, lalu dicek apakah panel sebanyak itu benar-benar muat
          disusun berbaris pada bentuk atapnya. Atap yang muat kurang dari {value(a?.minPanels)} panel dianggap belum
          layak. Ukuran panel bisa dipilih:{" "}
          {value(a?.panels.map((panel) => `${panel.label} ${panel.powerWp} Wp (${panelSize(panel)})`).join(", "))}.
          Warna peta dan ringkasan wilayah memakai panel {value(`${defaultPanel?.powerWp} Wp`)}.
        </p>
      </li>
      <li>
        <h3>Listrik per tahun dan per bulan</h3>
        <p>
          Daya panel (kWp) dikali PVOUT di lokasi atap. PVOUT dari Global Solar Atlas dihitung untuk panel yang berdiri
          bebas, miring optimum (di Bogor sekitar 9–11° menghadap utara), tanpa bayangan, dan sudah termasuk rugi-rugi
          inverter, kabel, debu, dan suhu. Produksi per bulan memakai 12 lapisan PVOUT bulanan.
        </p>
        <p className="formula">kWh per tahun = jumlah panel × kWp per panel × PVOUT</p>
      </li>
      <li>
        <h3>Saran jumlah panel</h3>
        <p>
          Diambil yang paling sedikit dari tiga batas: panel yang muat di atap; panel yang listriknya tidak melebihi
          pemakaian rumah (pengeluaran ÷ tarif PLN); dan panel yang dayanya tidak melebihi daya PLN rumah, karena rumah
          tidak bisa memakai lebih dari itu sekaligus. Sejak Permen ESDM 2/2024, listrik yang masuk ke jaringan PLN
          tidak mengurangi tagihan, jadi panel berlebih hanya membuang listrik. Aturan itu tidak lagi membatasi
          kapasitas sebesar daya PLN, tetapi pemasangan perlu kuota dari PLN.
        </p>
      </li>
      <li>
        <h3>Biaya, penghematan, dan balik modal</h3>
        <p>
          Biaya pasang dihitung {value(`Rp${formatNumber(a?.finance.costRpPerKwp)}`)} per kWp (85% panel dan inverter,
          15% rangka, kabel, dan pemasangan). Penghematan = listrik dari panel × tarif PLN untuk daya rumah, paling
          banyak sebesar pengeluaran listrik dan sebesar listrik dari panel seukuran daya PLN rumah, karena sisanya
          terbuang.
        </p>
        <p className="formula">balik modal (tahun) = biaya pasang ÷ penghematan per tahun</p>
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
    ["Ukuran panel", a && a.panels.map((panel) => `${panel.powerWp} Wp`).join(", ")],
    ["Minimal panel per atap", a && a.minPanels],
    ["Tarif listrik PLN (nilai listrik)", a && `Rp${formatNumber(a.tariffRpPerKwh, 2)}/kWh`],
    [
      "Tarif PLN di simulasi biaya",
      a &&
        `Rp${formatNumber(Math.min(...a.finance.powerOptions.map((o) => o.tariffRpPerKwh)), 0)}–${formatNumber(Math.max(...a.finance.powerOptions.map((o) => o.tariffRpPerKwh)), 2)}/kWh, sesuai daya`,
    ],
    ["Biaya pasang PLTS atap", a && `Rp${formatNumber(a.finance.costRpPerKwp)}/kWp`],
    ["Faktor emisi Jawa-Bali", a && `${formatNumber(a.gridEmissionKgPerKwh, 2)} kg CO₂/kWh`],
    [
      "Rentang PVOUT di peta",
      method?.pvoutRange && `${formatNumber(method.pvoutRange.min)}–${formatNumber(method.pvoutRange.max)} kWh/kWp`,
    ],
  ];

  return (
    <div className="page">
      <header className="page-inner doc-header">
        <p className="overline">Tentang proyek</p>
        <h1>Tentang SolarRoofGIS</h1>
        <p className="lead">
          Sistem informasi geografis untuk memperkirakan potensi pembangkit listrik tenaga surya (PLTS) atap di setiap
          bangunan di Kota dan Kabupaten Bogor, dibuat oleh Kelompok 14, IPB University.
        </p>
      </header>

      <DocSection id="membaca" title="Cara membaca hasil">
        <p>Klik sebuah atap di peta, atau gambar atap sendiri. Panel di samping peta menunjukkan:</p>
        <dl className="term-list">
          {READING.map(({ title, text }) => (
            <div key={title}>
              <dt>{title}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </DocSection>

      <DocSection id="istilah" title="Istilah">
        <dl className="term-list">
          {TERMS.map(({ title, text }) => (
            <div key={title}>
              <dt>{title}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </DocSection>

      <DocSection id="metode" title="Cara menghitung">
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

      <DocSection id="akurasi" title="Seberapa akurat?">
        <p>
          Angka ini perkiraan awal untuk perencanaan, bukan pengganti survei lapangan. Untuk atap tanpa bayangan,
          listriknya kira-kira 5–15% lebih tinggi dari kenyataan; untuk atap yang teduh bisa jauh lebih tinggi.
        </p>
        <h3 className="doc-subhead">Yang bisa membuat angka terlalu tinggi</h3>
        <ul className="plain-list">
          {TOO_HIGH.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
        <h3 className="doc-subhead">Yang bisa membuat angka terlalu rendah</h3>
        <ul className="plain-list">
          {TOO_LOW.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
        <h3 className="doc-subhead">Keterbatasan lain</h3>
        <ul className="plain-list">
          {OTHER_LIMITS.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
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

      <DocSection id="tujuan" title="Untuk siapa">
        <dl className="term-list">
          {AUDIENCES.map(({ title, text }) => (
            <div key={title}>
              <dt>{title}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
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
