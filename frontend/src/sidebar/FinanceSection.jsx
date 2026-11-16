import { useEffect, useState } from "react";
import { fetchFinanceEstimate } from "../api";
import { formatNumber, formatRupiah } from "../format";
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
      <figcaption>Total pengeluaran listrik selama {last} tahun</figcaption>
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
          aria-label={`Setelah ${last} tahun: tanpa panel surya ${formatRupiah(summary.withoutPvRp)}, dengan panel surya ${formatRupiah(summary.withPvRp)}.`}
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
      <p className="sidebar-muted">
        Garis oranye mulai dari biaya pasang, lalu naik lebih pelan karena tagihan berkurang, atau datar bila tagihan
        tertutup seluruhnya. Saat kedua garis bersilangan, panel surya sudah balik modal.
      </p>
    </figure>
  );
}

function savingNote(finance) {
  if (finance.limitedByBill) {
    return `Panel ini menghasilkan listrik senilai ${formatRupiah(finance.monthlyProductionRp)} per bulan, lebih dari pengeluaran Anda. Kelebihan listrik yang masuk ke jaringan PLN tidak mengurangi tagihan atau token, jadi penghematan paling banyak sebesar pengeluaran Anda.`;
  }
  if (finance.monthlyBillRp === null)
    return "Pengeluaran listrik belum diisi, jadi semua listrik dari panel dianggap terpakai sendiri.";
  return "Ini batas atas, dengan anggapan semua listrik dari panel langsung terpakai di rumah.";
}

function FinanceResults({ finance, assumptions }) {
  const { projectionYears } = assumptions;
  const tooLong = finance.paybackYears !== null && finance.paybackYears > projectionYears;

  return (
    <>
      <p className="sidebar-muted">
        Untuk {formatNumber(finance.panelCount)} panel ({formatNumber(finance.capacityKwp, 1)} kWp
        {finance.panelCount === finance.recommendation.panelCount ? ", sesuai rekomendasi" : ""}), menghasilkan sekitar{" "}
        {formatNumber(finance.annualKwh)} kWh per tahun. Tarif PLN Rp{formatNumber(finance.tariffRpPerKwh, 2)} per kWh.
      </p>
      <dl className="benefit-list">
        <div>
          <dt>Perkiraan biaya pasang</dt>
          <dd>{formatRupiah(finance.investmentRp)}</dd>
          <p>
            Panel dan inverter {formatRupiah(finance.panelsInverterRp)}, rangka, kabel, dan ongkos pasang{" "}
            {formatRupiah(finance.bosInstallationRp)}.
          </p>
        </div>
        <div>
          <dt>Penghematan per bulan</dt>
          <dd>{formatRupiah(finance.monthlySavingRp)}</dd>
          <p>{savingNote(finance)}</p>
        </div>
        <div>
          <dt>Balik modal</dt>
          <dd>{finance.paybackYears === null ? "–" : `${formatNumber(finance.paybackYears, 1)} tahun`}</dd>
          <p>
            {tooLong
              ? `Lebih lama dari masa garansi panel (${projectionYears} tahun), jadi pemasangan ini kurang menguntungkan.${finance.limitedByBill ? " Panelnya terlalu banyak untuk pemakaian Anda, coba kurangi jumlahnya." : ""}`
              : "Waktu sampai penghematan menutup biaya pasang."}
          </p>
        </div>
      </dl>
      {finance.projection && <CostChart projection={finance.projection} />}
    </>
  );
}

// Why this many panels suit the household, from the limit that decided it.
function recommendationReason(finance, power, maxPanels, minPanels) {
  const { recommendation } = finance;
  if (recommendation.belowMinimum) {
    const limit = recommendation.limitedBy === "power" ? `daya ${power.label}` : "pemakaian listrik Anda";
    return `Bahkan ${minPanels} panel, jumlah paling sedikit yang dihitung, sudah melebihi ${limit}, jadi PLTS atap kurang menguntungkan untuk rumah ini.`;
  }
  if (recommendation.limitedBy === "power") {
    return `Rumah dengan daya ${power.label} paling banyak memakai sekitar ${formatNumber(power.va / 1000, 1)} kW listrik pada satu waktu. Panel yang lebih besar dari itu akan menghasilkan listrik berlebih yang terbuang, karena kelebihan yang masuk ke PLN tidak mengurangi tagihan atau token.`;
  }
  if (recommendation.limitedBy === "use") {
    return `Listrik dari panel sebanyak ini tidak melebihi pemakaian Anda, sekitar ${formatNumber(finance.monthlyUseKwh)} kWh per bulan menurut pengeluaran yang diisi. Lebih banyak panel hanya menambah listrik yang terbuang.`;
  }
  return `Pemakaian dan daya listrik Anda cukup untuk semua panel yang muat di atap ini (${formatNumber(maxPanels)} panel).`;
}

function Recommendation({ finance, power, maxPanels, minPanels, onUse }) {
  const { recommendation } = finance;
  return (
    <div className={`finance-recommendation${recommendation.belowMinimum ? " is-weak" : ""}`}>
      <span className="finance-recommendation-label">Rekomendasi untuk rumah Anda</span>
      <strong>
        {formatNumber(recommendation.panelCount)} panel · {formatNumber(recommendation.capacityKwp, 1)} kWp
      </strong>
      <p>{recommendationReason(finance, power, maxPanels, minPanels)}</p>
      {onUse && (
        <button type="button" className="text-button" onClick={onUse}>
          Pakai rekomendasi
        </button>
      )}
    </div>
  );
}

// Investment, savings, payback and the recommended system size from the backend, recalculated
// as the inputs change. The panel count is kept by the map page, since the roof drawing and the
// map show it too; left empty it follows the recommendation, which is reported back up.
export default function FinanceSection({ solar, assumptions, panelChoice, onPanelChoiceChange, onRecommendation }) {
  const options = assumptions.finance;
  const [power, setPower] = useState(options.defaultPower);
  const [bill, setBill] = useState(String(options.defaultMonthlyBillRp));
  const [panelType, setPanelType] = useState(options.panelTypes[0].id);
  const [estimate, setEstimate] = useState({ status: "loading" });
  const { pvout, panel } = solar;
  const maxPanels = solar.panelCount;
  const { minPanels } = assumptions;
  const typed = panelChoice !== null && panelChoice !== "";
  const requestedCount = typed ? Math.min(Math.max(Number(panelChoice), minPanels), maxPanels) : null;
  const powerOption = options.powerOptions.find((option) => option.id === power);
  const panelEfficiency = assumptions.panels.find((size) => size.id === panel.id).efficiency;
  const recommended = estimate.status === "ready" ? estimate.finance.recommendation.panelCount : null;
  let panelsShown = recommended === null ? "" : String(recommended);
  if (panelChoice === "") panelsShown = "";
  else if (typed) panelsShown = String(Math.min(Number(panelChoice), maxPanels));

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchFinanceEstimate(
        {
          panelCount: requestedCount,
          maxPanels,
          pvout,
          monthlyBillRp: bill === "" ? null : Number(bill),
          panelType,
          panel: panel.id,
          power,
        },
        { signal: controller.signal },
      )
        .then(({ finance }) => {
          setEstimate({ status: "ready", finance });
          onRecommendation(finance.recommendation.panelCount);
        })
        .catch((error) => {
          if (error.name !== "AbortError") setEstimate({ status: "error", message: error.message });
        });
    }, ESTIMATE_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [requestedCount, maxPanels, pvout, bill, panelType, panel.id, power, onRecommendation]);

  const finance = estimate.status === "ready" ? estimate.finance : null;
  return (
    <section className="sidebar-section">
      <SectionTitle>Simulasi biaya</SectionTitle>
      <p className="sidebar-muted finance-intro">
        Isi daya dan pengeluaran listrik rumah Anda untuk melihat jumlah panel yang disarankan, biaya pasang,
        penghematan, dan kapan balik modal.
      </p>
      <div className="finance-inputs">
        <label>
          <span>Daya listrik PLN di rumah</span>
          <select value={power} onChange={(event) => setPower(event.target.value)}>
            {options.powerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} · Rp{formatNumber(option.tariffRpPerKwh, 2)}/kWh
              </option>
            ))}
          </select>
        </label>
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
        {finance?.billAbovePower && (
          <p className="finance-warning">
            Pengeluaran ini setara {formatNumber(finance.monthlyUseKwh)} kWh per bulan, lebih dari yang bisa dipakai
            dengan daya {powerOption.label}. Cek lagi daya atau pengeluarannya.
          </p>
        )}
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
      </div>
      {finance && (
        <Recommendation
          finance={finance}
          power={powerOption}
          maxPanels={maxPanels}
          minPanels={minPanels}
          onUse={typed && requestedCount !== finance.recommendation.panelCount ? () => onPanelChoiceChange(null) : null}
        />
      )}
      <div className="finance-inputs">
        <label>
          <span>
            Jumlah panel yang ingin dipasang (maksimal {formatNumber(maxPanels)}, kosongkan untuk rekomendasi)
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={minPanels}
            max={maxPanels}
            step="1"
            value={panelsShown}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "");
              onPanelChoiceChange(digits === "" ? "" : String(Math.min(Number(digits), maxPanels)));
            }}
            onBlur={() => {
              if (panelChoice === "") onPanelChoiceChange(null);
              else if (typed) onPanelChoiceChange(String(requestedCount));
            }}
          />
        </label>
      </div>
      {estimate.status === "loading" && <p className="sidebar-muted">Menghitung simulasi…</p>}
      {estimate.status === "error" && (
        <p className="sidebar-error">Simulasi tidak dapat dihitung: {estimate.message}</p>
      )}
      {finance && <FinanceResults finance={finance} assumptions={options} />}
    </section>
  );
}
