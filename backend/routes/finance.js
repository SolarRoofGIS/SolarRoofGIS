const express = require("express");
const { FINANCE, estimateFinance } = require("../finance");

const router = express.Router();
// Far above any real input: 10 ha of roof, the highest possible PVOUT, a very large bill.
const MAX_PANELS = 40000;
const MAX_PVOUT = 3000;
const MAX_MONTHLY_BILL_RP = 1e12;

function inputError({ panelCount, pvout, monthlyBillRp, panelType }) {
  if (!Number.isInteger(panelCount) || panelCount < 1 || panelCount > MAX_PANELS) {
    return "Jumlah panel tidak valid.";
  }
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
  return null;
}

// The financial simulation for a number of panels, recalculated as the viewer changes the inputs.
router.post("/estimate", (request, response) => {
  const input = request.body ?? {};
  const error = inputError(input);
  if (error) return response.status(400).json({ error });
  return response.json({ finance: estimateFinance(input) });
});

module.exports = router;
