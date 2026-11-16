const express = require("express");
const { FINANCE, estimateFinance, powerById } = require("../finance");
const { panelById } = require("../solar");

const router = express.Router();
// Far above any real input: 10 ha of roof, the highest possible PVOUT, a very large bill.
const MAX_PANELS = 40000;
const MAX_PVOUT = 3000;
const MAX_MONTHLY_BILL_RP = 1e12;

const validCount = (value) => Number.isInteger(value) && value >= 1 && value <= MAX_PANELS;

// `panelCount` may be left out for the recommended number; `maxPanels` is what the roof holds.
function inputError({ panelCount, maxPanels, pvout, monthlyBillRp, panelType, panel, power }) {
  if (panelCount !== undefined && panelCount !== null && !validCount(panelCount)) return "Jumlah panel tidak valid.";
  if (maxPanels !== undefined && !validCount(maxPanels)) return "Jumlah panel maksimal tidak valid.";
  if (!Number.isFinite(pvout) || pvout <= 0 || pvout > MAX_PVOUT) return "Nilai PVOUT tidak valid.";
  if (
    monthlyBillRp !== undefined &&
    monthlyBillRp !== null &&
    (!Number.isFinite(monthlyBillRp) || monthlyBillRp < 0 || monthlyBillRp > MAX_MONTHLY_BILL_RP)
  ) {
    return "Tagihan listrik tidak valid.";
  }
  if (panelType !== undefined && !FINANCE.panelTypes.some((type) => type.id === panelType)) {
    return "Jenis panel tidak dikenal.";
  }
  if (!panelById(panel)) return "Ukuran panel tidak dikenal.";
  if (!powerById(power ?? undefined)) return "Daya listrik tidak dikenal.";
  return null;
}

// The financial simulation and recommended system size, recalculated as the viewer changes the inputs.
router.post("/estimate", (request, response) => {
  const input = request.body ?? {};
  const error = inputError(input);
  if (error) return response.status(400).json({ error });
  return response.json({
    finance: estimateFinance({ ...input, panel: panelById(input.panel), power: powerById(input.power ?? undefined) }),
  });
});

module.exports = router;
