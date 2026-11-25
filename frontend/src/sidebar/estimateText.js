import { formatNumber } from "../format";

// Wording shared by the side panel and the PDF report, so both say the same thing.

export function regionName(region, checked = true) {
  if (!checked) return "Wilayah belum diketahui";
  if (region === "Bogor") return "Kabupaten Bogor";
  return region || "Di luar batas wilayah Bogor";
}

// How sunny the location is compared with the rest of Bogor. Every part of Bogor gets enough
// sun for panels, so the labels compare instead of judging.
export function sunlightLevel(rank) {
  if (rank === null) return { label: "Tidak ada data", tone: "none" };
  if (rank >= 2 / 3) return { label: "Lebih cerah", tone: "high" };
  if (rank >= 1 / 3) return { label: "Sedang", tone: "medium" };
  return { label: "Lebih redup", tone: "low" };
}

export function panelSize(assumptions, id) {
  return assumptions.panels.find((size) => size.id === id);
}

// What to do before installing; the estimate is only a first look from satellite imagery.
export const NEXT_STEPS = [
  "Cek bahan dan kekuatan atap, serta bayangan pohon atau bangunan.",
  "Minta survei dan penawaran dari beberapa installer PLTS atap.",
  "Ajukan permohonan PLTS atap ke PLN sebelum memasang.",
];

export const ESTIMATE_DISCLAIMER = "Perkiraan awal dari citra satelit, bukan hasil survei.";

export function methodSteps(solar, assumptions) {
  const panel = panelSize(assumptions, solar.panel.id);
  return [
    `Luas atap dari citra satelit, dikurangi ${formatNumber(assumptions.setbackM, 1)} m di setiap pinggir. Dari sisanya, ${formatNumber(assumptions.packingFactor * 100)}% dianggap bisa dipasangi (sisanya untuk bagian miring, tandon, dan bayangan).`,
    `Panel ${panel.powerWp} Wp (${formatNumber(panel.areaM2, 2)} m²) dihitung yang benar-benar muat disusun berbaris. Atap yang muat kurang dari ${assumptions.minPanels} panel dianggap belum layak.`,
    "Listrik = kWp × sinar matahari lokasi (Global Solar Atlas, sudah termasuk rugi inverter, kabel, debu, dan panas).",
    "Saran jumlah panel = paling sedikit dari: yang muat di atap, yang tidak melebihi pemakaian Anda (pengeluaran ÷ tarif PLN), dan yang tidak melebihi daya PLN. Kelebihan listrik yang masuk ke PLN tidak mengurangi tagihan (Permen ESDM 2/2024).",
    `Biaya pasang Rp${formatNumber(assumptions.finance.costRpPerKwp)} per kWp. Balik modal = biaya ÷ hemat per tahun.`,
  ];
}

// One short line under a saving figure, only where the number needs it.
export function savingNote(finance) {
  if (finance.limitedByBill) return "Maksimal sebesar pengeluaran Anda";
  if (finance.monthlyBillRp === null) return "Isi pengeluaran untuk hasil lebih tepat";
  return null;
}

// Why this many panels suit the household, in one line. When even the minimum is too much
// for the connection, a smaller panel size may still fit, so that is suggested first.
export function recommendationReason(finance, power, assumptions, panelType) {
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
