import { useEffect, useState } from "react";
import { fetchFinanceEstimate } from "../api";
import { approx, approxRupiah, formatNumber } from "../format";
import EstimateDetails from "./EstimateDetails";
import SectionTitle from "./SectionTitle";

const ESTIMATE_DELAY_MS = 250;
const MAX_BILL_DIGITS = 12;
// One short line under each figure, only where the number needs it.
function savingNote(finance) {
  if (finance.limitedByBill) return "Maksimal sebesar pengeluaran Anda";
  if (finance.monthlyBillRp === null) return "Isi pengeluaran untuk hasil lebih tepat";
  return null;
}

function Stat({ label, value, note }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

// Why this many panels suit the household, in one line. When even the minimum is too much
// for the connection, a smaller panel size may still fit, so that is suggested first.
function recommendationReason(finance, power, assumptions, panelType) {
  const { recommendation } = finance;
  if (recommendation.belowMinimum) {
    const panelKw = (panel) => (panelType === "poly" ? panel.areaM2 * 0.15 : panel.powerWp / 1000);
    const current = finance.capacityKwp / finance.panelCount;
    const fits = assumptions.panels.filter(
      (panel) => panelKw(panel) < current - 1e-9 && assumptions.minPanels * panelKw(panel) * 1000 <= power.va,
    );
    if (recommendation.limitedBy === "power" && fits.length) {
      return `${assumptions.minPanels} panel ini melebihi daya ${power.label}. Pilih panel ${fits.map((panel) => panel.label).join(" atau ")}.`;
    }
    return `Daya ${power.label} terlalu kecil, PLTS atap kurang menguntungkan.`;
  }
  if (recommendation.limitedBy === "power") return `Dibatasi daya ${power.label}: lebih dari ini, listriknya terbuang.`;
  if (recommendation.limitedBy === "use")
    return `Sesuai pemakaian Anda (~${formatNumber(finance.monthlyUseKwh)} kWh/bulan): lebih dari ini, listriknya terbuang.`;
  return "Semua panel yang muat di atap ini.";
}

function Summary({ finance, power, projectionYears, assumptions, panelType, onUseRecommendation }) {
  const { recommendation } = finance;
  const isRecommended = finance.panelCount === recommendation.panelCount;
  const tooLong = finance.paybackYears !== null && finance.paybackYears > projectionYears;
  return (
    <div className={`finance-summary${recommendation.belowMinimum ? " is-weak" : ""}`}>
      <div className="finance-summary-head">
        <span>{isRecommended ? "Saran untuk rumah Anda" : "Pilihan Anda"}</span>
        <strong>
          {formatNumber(finance.panelCount)} panel · {formatNumber(finance.capacityKwp, 1)} kWp
        </strong>
        {isRecommended ? (
          <p>{recommendationReason(finance, power, assumptions, panelType)}</p>
        ) : (
          <p>
            Saran: {formatNumber(recommendation.panelCount)} panel.{" "}
            <button type="button" className="text-button" onClick={onUseRecommendation}>
              Pakai saran
            </button>
          </p>
        )}
      </div>
      <div className="stat-grid">
        <Stat label="Biaya pasang" value={approxRupiah(finance.investmentRp)} />
        <Stat label="Hemat per bulan" value={approxRupiah(finance.monthlySavingRp)} note={savingNote(finance)} />
        <Stat
          label="Balik modal"
          value={finance.paybackYears === null ? "–" : approx(`${formatNumber(finance.paybackYears, 1)} tahun`)}
          note={tooLong ? `Lebih lama dari garansi ${projectionYears} tahun` : null}
        />
        <Stat label="Listrik per bulan" value={approx(`${formatNumber(finance.annualKwh / 12)} kWh`)} />
      </div>
    </div>
  );
}

// The household inputs and what they lead to: recommended size, cost, savings and payback from
// the backend, recalculated as the inputs change. The panel count is kept by the map page, since
// the roof drawing and the map show it too; left empty it follows the recommendation, which is
// reported back up.
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
    <>
      <section className="sidebar-section">
        <SectionTitle>Untuk rumah Anda</SectionTitle>
        <div className="finance-inputs finance-inputs-pair">
          <label>
            <span>Daya listrik PLN</span>
            <select value={power} onChange={(event) => setPower(event.target.value)}>
              {options.powerOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Bayar listrik per bulan</span>
            <div className="finance-money">
              <span aria-hidden="true">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                aria-label="Pengeluaran listrik per bulan, tagihan atau token"
                value={bill === "" ? "" : formatNumber(Number(bill))}
                onChange={(event) =>
                  setBill(event.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, MAX_BILL_DIGITS))
                }
              />
            </div>
          </label>
        </div>
        {finance?.billAbovePower && (
          <p className="finance-warning">
            Rp{formatNumber(Number(bill))} terlalu besar untuk daya {powerOption.label}. Cek lagi.
          </p>
        )}
        {estimate.status === "loading" && <p className="sidebar-muted">Menghitung…</p>}
        {estimate.status === "error" && (
          <p className="sidebar-error">Simulasi tidak dapat dihitung: {estimate.message}</p>
        )}
        {finance && (
          <Summary
            finance={finance}
            power={powerOption}
            projectionYears={options.projectionYears}
            assumptions={assumptions}
            panelType={panelType}
            onUseRecommendation={() => onPanelChoiceChange(null)}
          />
        )}
        <div className="finance-inputs finance-inputs-pair">
          <label>
            <span>Jumlah panel (maks. {formatNumber(maxPanels)})</span>
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
          <label>
            <span>Jenis panel</span>
            <select value={panelType} onChange={(event) => setPanelType(event.target.value)}>
              {options.panelTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label} ({formatNumber((type.efficiency ?? panelEfficiency) * 100)}%)
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      {finance && <EstimateDetails solar={solar} finance={finance} assumptions={assumptions} />}
    </>
  );
}
