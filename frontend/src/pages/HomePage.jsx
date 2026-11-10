import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { fetchBuildingDetail, fetchJson } from "../api";
import { formatNumber } from "../format";
import SiteFooter from "../layout/SiteFooter";
import { pvoutCss } from "../map/colors";
import RoofOutline from "../map/RoofOutline";
import "./Pages.css";

// A 690 m² roof just north of Kebun Raya Bogor, shown as a live example on the home page.
const EXAMPLE_BUILDING_ID = 2332211;

const STEPS = [
  {
    title: "Bentuk atap",
    text: "2,67 juta poligon bangunan dari citra satelit (Google Open Buildings) memberi luas setiap atap.",
  },
  {
    title: "Sinar matahari",
    text: "Global Solar Atlas memberi PVOUT: listrik yang dihasilkan 1 kWp panel per tahun di lokasi itu.",
  },
  {
    title: "Panel yang muat",
    text: "Atap dikurangi jarak tepi dan area terhalang, lalu dihitung berapa panel 550 Wp yang muat.",
  },
  {
    title: "Listrik dan manfaat",
    text: "Kapasitas × PVOUT menjadi kWh per tahun dan per bulan, dengan nilai rupiah dan CO₂ yang dihindari.",
  },
];

function formatMillions(value) {
  return `${formatNumber(value / 1e6, 2)} juta`;
}

function ExampleRoof() {
  const [detail, setDetail] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetchBuildingDetail(EXAMPLE_BUILDING_ID)
      .then((result) => active && setDetail(result))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  const solar = detail?.solar;
  const placeholder = failed ? "–" : "…";
  const rows = [
    ["Luas atap", solar && `${formatNumber(solar.footprintM2)} m²`],
    ["Bisa dipasangi panel", solar && `${formatNumber(solar.usableM2)} m²`],
    ["Panel 550 Wp", solar && formatNumber(solar.panelCount)],
    ["Kapasitas", solar && `${formatNumber(solar.capacityKwp, 1)} kWp`],
    ["PVOUT di lokasi", solar && `${formatNumber(solar.pvout)} kWh/kWp`],
  ];

  return (
    <figure className="example">
      <div className="example-drawing">
        {detail && (
          <RoofOutline
            geometry={detail.building.geometry}
            color={pvoutCss(solar.pvout, solar.pvoutRange)}
            scaleBar
            label="Bentuk atap contoh"
          />
        )}
      </div>
      <table className="example-table">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{value || placeholder}</td>
            </tr>
          ))}
          <tr className="example-total">
            <th scope="row">Listrik per tahun</th>
            <td>{solar ? `${formatNumber(solar.annualKwh)} kWh` : placeholder}</td>
          </tr>
        </tbody>
      </table>
      <figcaption>
        Contoh: satu bangunan di utara Kebun Raya, Kota Bogor.{" "}
        <Link to={`/peta?atap=${EXAMPLE_BUILDING_ID}`} className="text-link">
          Lihat di peta
        </Link>
      </figcaption>
    </figure>
  );
}

export default function HomePage() {
  const [stats, setStats] = useState(null);
  const [statsFailed, setStatsFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchJson("/api/stats", { signal: controller.signal })
      .then(setStats)
      .catch((error) => {
        if (error.name !== "AbortError") setStatsFailed(true);
      });
    return () => controller.abort();
  }, []);

  const total = stats?.total;
  const figures = [
    ["Bangunan dipetakan", total && formatMillions(total.buildings)],
    ["Total luas atap", total && `${formatNumber(total.roofAreaM2 / 1e6)} km²`],
    ["Kapasitas panel teknis", total && `${formatNumber(total.capacityKwp / 1e6, 1)} GWp`],
    ["Listrik per tahun", total && `${formatNumber(total.annualGwh / 1000, 1)} TWh`],
  ];

  return (
    <div className="page">
      <section className="page-inner home-intro">
        <div className="home-intro-text">
          <p className="overline">Kota dan Kabupaten Bogor</p>
          <h1>Berapa listrik yang bisa dihasilkan atap di Bogor?</h1>
          <p className="lead">
            SolarRoofGIS memetakan setiap atap bangunan di Kota dan Kabupaten Bogor, lalu memperkirakan berapa panel
            surya yang muat dan berapa listrik yang dihasilkan sepanjang tahun.
          </p>
          <div className="actions">
            <Link to="/peta" className="button button-primary">
              Buka peta <ArrowRight size={17} />
            </Link>
            <Link to="/tentang" className="text-link">
              Metode dan data
            </Link>
          </div>
        </div>
        <ExampleRoof />
      </section>

      <section className="page-inner page-section" aria-labelledby="ringkasan">
        <h2 id="ringkasan">Potensi teknis seluruh wilayah</h2>
        <dl className="figures">
          {figures.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className={value || statsFailed ? "" : "skeleton"}>{value || (statsFailed ? "–" : "000")}</dd>
            </div>
          ))}
        </dl>
        {statsFailed && (
          <p className="footnote">Statistik belum tersedia. Pastikan data bangunan sudah diimpor ke database.</p>
        )}
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Wilayah</th>
                <th scope="col">Bangunan</th>
                <th scope="col">Luas atap</th>
                <th scope="col">Atap cukup luas</th>
                <th scope="col">Listrik per tahun</th>
                <th scope="col">PVOUT (kWh/kWp)</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.regions || []).map((region) => (
                <tr key={region.name}>
                  <th scope="row">{region.name}</th>
                  <td>{formatMillions(region.buildings)}</td>
                  <td>{formatNumber(region.roofAreaM2 / 1e6, 1)} km²</td>
                  <td>{formatNumber((region.suitableBuildings / region.buildings) * 100)}%</td>
                  <td>{formatNumber(region.annualGwh)} GWh</td>
                  <td>
                    {formatNumber(region.pvoutMin)}–{formatNumber(region.pvoutMax)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="footnote">
          Bila semua atap yang cukup luas dipasangi panel. Perkiraan kasar dengan asumsi yang sama seperti di peta (atap
          dianggap persegi untuk jarak tepi); angka per atap di peta memakai bentuk atap sebenarnya.
        </p>
      </section>

      <section className="page-inner page-section" aria-labelledby="cara-kerja">
        <h2 id="cara-kerja">Cara kerja</h2>
        <p className="section-lead">
          Empat langkah yang dijalankan untuk setiap bangunan saat Anda mengkliknya di peta.
        </p>
        <ol className="steps">
          {STEPS.map(({ title, text }) => (
            <li key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <SiteFooter />
    </div>
  );
}
