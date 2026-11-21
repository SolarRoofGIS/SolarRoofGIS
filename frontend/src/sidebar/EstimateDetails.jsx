import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { approx, approxRupiah, formatNumber, MONTH_NAMES } from "../format";
import { PVOUT_RAMP } from "../map/colors";

// The charts and breakdowns behind the summary, folded away until the viewer asks for them.
// Production figures follow the chosen number of panels, so they match the summary above.

const CHART = {
  width: 330,
  height: 170,
  left: 44,
  right: 8,
  top: 10,
  bottom: 22,
};
const SERIES = [
  { key: "withoutPvRp", label: "Tanpa panel surya", color: "#1b8f74" },
  { key: "withPvRp", label: "Dengan panel surya", color: "#e2701b" },
];

function formatAxisRupiah(value) {
  if (value >= 1e9) return `${formatNumber(value / 1e9, 1)} M`;
  if (value >= 1e6) return `${formatNumber(value / 1e6)} jt`;
  return formatNumber(value);
}

// A round step that gives about four grid lines up to `max`.
function tickStep(max) {
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const nice = [1, 2, 2.5, 5, 10].find((step) => step * magnitude >= rough);
  return nice * magnitude;
}

// Cumulative spending over the projection, with and without panels.
function CostChart({ projection }) {
  const [hovered, setHovered] = useState(null);
  const last = projection[projection.length - 1].year;
  const peak = Math.max(...projection.flatMap((point) => SERIES.map(({ key }) => point[key])), 1);
  const step = tickStep(peak);
  const top = Math.ceil(peak / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step);
  const plot = {
    width: CHART.width - CHART.left - CHART.right,
    height: CHART.height - CHART.top - CHART.bottom,
  };
  const x = (year) => CHART.left + (year / last) * plot.width;
  const y = (value) => CHART.top + (1 - value / top) * plot.height;

  const onPointerMove = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = ((event.clientX - box.left) / box.width) * CHART.width;
    const year = Math.round(((ratio - CHART.left) / plot.width) * last);
    setHovered(projection[Math.min(Math.max(year, 0), last)]);
  };
  const summary = projection[projection.length - 1];

  return (
    <figure className="cost-chart">
      <figcaption>Total pengeluaran listrik {last} tahun</figcaption>
      <ul className="cost-chart-legend">
        {SERIES.map(({ label, color }) => (
          <li key={label}>
            <span style={{ background: color }} aria-hidden="true" /> {label}
          </li>
        ))}
      </ul>
      <div className="cost-chart-plot">
        <svg
          viewBox={`0 0 ${CHART.width} ${CHART.height}`}
          role="img"
          aria-label={`Setelah ${last} tahun: tanpa panel surya ${approxRupiah(summary.withoutPvRp)}, dengan panel surya ${approxRupiah(summary.withPvRp)}.`}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHovered(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                className="cost-chart-grid"
                x1={CHART.left}
                x2={CHART.width - CHART.right}
                y1={y(tick)}
                y2={y(tick)}
              />
              <text
                className="cost-chart-tick"
                x={CHART.left - 6}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="central"
              >
                {formatAxisRupiah(tick)}
              </text>
            </g>
          ))}
          {[0, 5, 10, 15, 20, 25]
            .filter((year) => year <= last)
            .map((year) => (
              <text key={year} className="cost-chart-tick" x={x(year)} y={CHART.height - 6} textAnchor="middle">
                {year === 0 ? "Tahun 0" : year}
              </text>
            ))}
          {SERIES.map(({ key, color }) => (
            <polyline
              key={key}
              points={projection.map((point) => `${x(point.year).toFixed(1)},${y(point[key]).toFixed(1)}`).join(" ")}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {hovered && (
            <>
              <line
                className="cost-chart-cursor"
                x1={x(hovered.year)}
                x2={x(hovered.year)}
                y1={CHART.top}
                y2={CHART.top + plot.height}
              />
              {SERIES.map(({ key, color }) => (
                <circle
                  key={key}
                  cx={x(hovered.year)}
                  cy={y(hovered[key])}
                  r="4"
                  fill={color}
                  stroke="var(--surface)"
                  strokeWidth="2"
                />
              ))}
            </>
          )}
        </svg>
        {hovered && (
          <div
            className="cost-chart-tooltip"
            style={
              hovered.year > last / 2
                ? { right: `${(1 - x(hovered.year) / CHART.width) * 100 + 3}%` }
                : { left: `${(x(hovered.year) / CHART.width) * 100 + 3}%` }
            }
          >
            <strong>Tahun {hovered.year}</strong>
            {SERIES.map(({ key, label }) => (
              <span key={key}>
                {label}: {approxRupiah(hovered[key])}
              </span>
            ))}
          </div>
        )}
      </div>
      <p className="sidebar-muted">Saat kedua garis bersilangan, panel surya sudah balik modal.</p>
    </figure>
  );
}

// November–March, the wet season in West Java (zero-based month indexes).
const RAINY_MONTHS = [10, 11, 0, 1, 2];

function MonthlyChart({ monthlyKwh }) {
  const peak = Math.max(...monthlyKwh, 1);
  const best = monthlyKwh.indexOf(Math.max(...monthlyKwh));
  const worst = monthlyKwh.indexOf(Math.min(...monthlyKwh));

  return (
    <figure className="detail-block">
      <figcaption>Listrik per bulan</figcaption>
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
        Terbanyak {MONTH_NAMES[best]} (~{formatNumber(monthlyKwh[best])} kWh), tersedikit {MONTH_NAMES[worst]} (~
        {formatNumber(monthlyKwh[worst])} kWh){RAINY_MONTHS.includes(worst) ? ", musim hujan." : "."}
      </p>
    </figure>
  );
}

function SunlightScale({ solar }) {
  const range = solar.pvoutRange;
  if (solar.pvout === null || !range) return null;
  const position = Math.min(Math.max((solar.pvout - range.min) / (range.max - range.min), 0), 1) * 100;
  return (
    <figure className="detail-block">
      <figcaption>Sinar matahari di lokasi ini</figcaption>
      <div className="sunlight-scale">
        <div className="sunlight-ramp" style={{ background: `linear-gradient(to right, ${PVOUT_RAMP.join(", ")})` }} />
        <div className="sunlight-marker" style={{ left: `${position}%` }} />
        <div className="sunlight-labels">
          <span>Teredup di Bogor</span>
          <span>Tercerah</span>
        </div>
      </div>
      <p className="sidebar-muted">
        1 kWp panel di sini menghasilkan ~{formatNumber(solar.pvout)} kWh per tahun. Selisih tercerah dan teredup di
        Bogor hanya {formatNumber(((range.max - range.min) / range.min) * 100)}%.
        {solar.optimumTilt !== null && ` Terbaik menghadap utara, miring ${formatNumber(solar.optimumTilt)}°.`}
      </p>
    </figure>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function EstimateDetails({ solar, finance, assumptions }) {
  // The roof's monthly production scaled to the chosen system.
  const share = solar.annualKwh > 0 ? finance.annualKwh / solar.annualKwh : 0;
  const monthlyKwh = solar.monthlyKwh.map((kwh) => Math.round(kwh * share));
  return (
    <details className="sidebar-details">
      <summary>
        Grafik dan rincian
        <ChevronDown size={16} className="details-chevron" />
      </summary>
      <MonthlyChart monthlyKwh={monthlyKwh} />
      {finance.projection && (
        <div className="detail-block">
          <CostChart projection={finance.projection} />
        </div>
      )}
      <dl className="detail-rows">
        <DetailRow label="Panel dan inverter" value={approxRupiah(finance.panelsInverterRp)} />
        <DetailRow label="Rangka, kabel, ongkos pasang" value={approxRupiah(finance.bosInstallationRp)} />
        <DetailRow label="Tarif PLN Anda" value={`Rp${formatNumber(finance.tariffRpPerKwh, 2)}/kWh`} />
        <DetailRow
          label="Bagian atap yang bisa dipasangi"
          value={`${formatNumber(solar.usableM2)} m² (${formatNumber(solar.usableShare * 100)}%)`}
        />
        <DetailRow
          label="Emisi CO₂ berkurang"
          value={approx(`${formatNumber((finance.annualKwh * assumptions.gridEmissionKgPerKwh) / 1000, 1)} ton/tahun`)}
        />
      </dl>
      <SunlightScale solar={solar} />
    </details>
  );
}
