export function formatNumber(value, digits = 0) {
  return Number(value).toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatRupiah(value) {
  if (value >= 1e9) return `Rp${formatNumber(value / 1e9, 1)} miliar`;
  if (value >= 1e6) return `Rp${formatNumber(value / 1e6, 1)} juta`;
  return `Rp${formatNumber(value)}`;
}

export const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
