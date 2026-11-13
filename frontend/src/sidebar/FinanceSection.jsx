import { useEffect, useState } from "react";
import { fetchFinanceEstimate } from "../api";
import { formatNumber, formatRupiah } from "../format";
import { chosenPanelCount } from "../map/geometry";
import SectionTitle from "./SectionTitle";

const ESTIMATE_DELAY_MS = 250;
const MAX_BILL_DIGITS = 12;
const CHART = {
  width: 330,
  height: 170,
  left: 44,
  right: 8,
  top: 10,
  bottom: 22,
};
const SERIES = [
  { key: "withoutPvRp", label: "Tanpa PLTS", color: "#1b8f74" },
  { key: "withPvRp", label: "Dengan PLTS", color: "#e2701b" },
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
      <figcaption>Biaya kumulatif {last} tahun</figcaption>
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
          aria-label={`Setelah ${last} tahun: tanpa PLTS ${formatRupiah(summary.withoutPvRp)}, dengan PLTS ${formatRupiah(summary.withPvRp)}.`}
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
                {label}: {formatRupiah(hovered[key])}
              </span>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}

function savingNote(finance) {
  if (finance.limitedByBill) {
    return `Produksi senilai ${formatRupiah(finance.monthlyProductionRp)} per bulan, tetapi penghematan tidak bisa melebihi pengeluaran listrik Anda karena listrik yang dikirim ke PLN tidak mengurangi tagihan atau token.`;
  }
  if (finance.monthlyBillRp === null)
    return "Pengeluaran listrik belum diisi, jadi seluruh produksi dianggap terpakai sendiri.";
  return "Batas atas: seluruh produksi dianggap terpakai sendiri.";
}

function FinanceResults({ finance, assumptions }) {
  const { projectionYears } = assumptions;
  const tooLong = finance.paybackYears !== null && finance.paybackYears > projectionYears;

  return (
    <>
      <p className="sidebar-muted">
        Untuk {formatNumber(finance.panelCount)} panel, {formatNumber(finance.capacityKwp, 1)} kWp,{" "}
        {formatNumber(finance.annualKwh)} kWh per tahun.
      </p>
      <dl className="benefit-list">
        <div>
          <dt>Biaya investasi</dt>
          <dd>{formatRupiah(finance.investmentRp)}</dd>
          <p>
            Panel dan inverter {formatRupiah(finance.panelsInverterRp)}, BOS dan instalasi{" "}
            {formatRupiah(finance.bosInstallationRp)}.
          </p>
        </div>
        <div>
          <dt>Penghematan per bulan</dt>
          <dd>{formatRupiah(finance.monthlySavingRp)}</dd>
          <p>{savingNote(finance)}</p>
        </div>
        <div>
          <dt>Payback Period</dt>
          <dd>{finance.paybackYears === null ? "–" : `${formatNumber(finance.paybackYears, 1)} tahun`}</dd>
          <p>
            {tooLong
              ? `Lebih lama dari garansi panel ${projectionYears} tahun.${finance.limitedByBill ? " Jumlah panel ini jauh melebihi kebutuhan listrik Anda, coba kurangi." : ""}`
              : "Biaya investasi dibagi penghematan per tahun."}
          </p>
        </div>
      </dl>
      {finance.projection && <CostChart projection={finance.projection} />}
    </>
  );
}

// Investment, savings and payback from the backend, recalculated as the inputs change. The
// panel count is kept by the map page, since the roof drawing and the map show it too.
export default function FinanceSection({ solar, assumptions, panelChoice, onPanelChoiceChange }) {
  const options = assumptions.finance;
  const [bill, setBill] = useState(String(options.defaultMonthlyBillRp));
  const [panelType, setPanelType] = useState(options.panelTypes[0].id);
  const [estimate, setEstimate] = useState({ status: "loading" });
  const { pvout, panel } = solar;
  const maxPanels = solar.panelCount;
  const panelCount = chosenPanelCount(panelChoice, maxPanels, assumptions.minPanels);
  const panelEfficiency = assumptions.panels.find((size) => size.id === panel.id).efficiency;
  let panelsShown = String(maxPanels);
  if (panelChoice === "") panelsShown = "";
  else if (panelChoice !== null) panelsShown = String(Math.min(Number(panelChoice), maxPanels));

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchFinanceEstimate(
        {
          panelCount,
          pvout,
          monthlyBillRp: bill === "" ? null : Number(bill),
          panelType,
          panel: panel.id,
        },
        { signal: controller.signal },
      )
        .then(({ finance }) => setEstimate({ status: "ready", finance }))
        .catch((error) => {
          if (error.name !== "AbortError") setEstimate({ status: "error", message: error.message });
        });
    }, ESTIMATE_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [panelCount, pvout, bill, panelType, panel.id]);

  return (
    <section className="sidebar-section">
      <SectionTitle>Simulasi finansial</SectionTitle>
      <div className="finance-inputs">
        <label>
          <span>Pengeluaran listrik per bulan (tagihan atau token)</span>
          <div className="finance-money">
            <span aria-hidden="true">Rp</span>
            <input
              type="text"
              inputMode="numeric"
              value={bill === "" ? "" : formatNumber(Number(bill))}
              onChange={(event) =>
                setBill(event.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, MAX_BILL_DIGITS))
              }
            />
          </div>
        </label>
        <label>
          <span>Jenis panel</span>
          <select value={panelType} onChange={(event) => setPanelType(event.target.value)}>
            {options.panelTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label} (efisiensi {formatNumber((type.efficiency ?? panelEfficiency) * 100, 1)}%)
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Jumlah panel (maksimal {formatNumber(maxPanels)})</span>
          <input
            type="number"
            inputMode="numeric"
            min={assumptions.minPanels}
            max={maxPanels}
            step="1"
            value={panelsShown}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "");
              onPanelChoiceChange(digits === "" ? "" : String(Math.min(Number(digits), maxPanels)));
            }}
            onBlur={() => {
              if (panelChoice === "") onPanelChoiceChange(null);
              else if (panelChoice !== null) onPanelChoiceChange(String(panelCount));
            }}
          />
        </label>
      </div>
      {estimate.status === "loading" && <p className="sidebar-muted">Menghitung simulasi…</p>}
      {estimate.status === "error" && (
        <p className="sidebar-error">Simulasi tidak dapat dihitung: {estimate.message}</p>
      )}
      {estimate.status === "ready" && <FinanceResults finance={estimate.finance} assumptions={options} />}
    </section>
  );
}
