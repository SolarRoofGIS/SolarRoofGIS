import { jsPDF } from "jspdf";
import { approx, approxRupiah, formatNumber, MONTH_NAMES } from "../format";
import { METRES_PER_LAT, metresPerLng, openRing, polygonsOf } from "../map/geometry";
import { pvoutRgb } from "../map/colors";
import {
  ESTIMATE_DISCLAIMER,
  methodSteps,
  NEXT_STEPS,
  panelSize,
  savingNote,
  sunlightLevel,
} from "../sidebar/estimateText";

// The estimate of one roof as an A4 PDF, drawn with jsPDF so the text stays sharp and
// selectable. It follows the site: the same colours, serif headings over a sans body, and the
// same figures and wording as the side panel. Lengths are in millimetres.

const PAGE = { width: 210, height: 297, margin: 18 };
const CONTENT = PAGE.width - PAGE.margin * 2;
const FOOTER_Y = PAGE.height - 12;

// The site's palette (index.css), plus the chart and panel colours used in the side panel.
const COLOR = {
  ink: "#1c2421",
  inkSoft: "#545d59",
  inkFaint: "#858c88",
  forest: "#1f4a3f",
  forestSoft: "#e7eeea",
  mist: "#f2f1ec",
  line: "#dcd9cf",
  page: "#f8f7f3",
  orange: "#e2701b",
  orangeDark: "#a8440d",
  amber: "#a8740d",
  monthBar: "#e9b45a",
  panel: "#1f3b5c",
  panelFrame: "#dbe6f0",
  withoutPv: "#1b8f74",
  noData: "#b9c2bf",
};
const LEVEL_COLOR = { high: COLOR.orangeDark, medium: COLOR.amber, low: COLOR.inkSoft, none: COLOR.inkSoft };
// Standard PDF fonts, so nothing has to be embedded: Times for headings like the site's
// Source Serif, Helvetica for the body like IBM Plex Sans.
const SERIF = "times";
const SANS = "helvetica";
const PT_TO_MM = 0.3528;

function rgb(hex) {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}

function formatDate(date) {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

// Writing helpers that keep the font, size and colour of each call explicit.
function makePen(doc) {
  const style = (font, weight, size, color) => {
    doc.setFont(font, weight);
    doc.setFontSize(size);
    doc.setTextColor(...rgb(color));
  };
  return {
    style,
    // Text wrapped to `width`; returns the y just below it.
    paragraph(
      text,
      x,
      y,
      width,
      { font = SANS, weight = "normal", size = 9, color = COLOR.ink, lineHeight = 1.35 } = {},
    ) {
      style(font, weight, size, color);
      const lines = doc.splitTextToSize(text, width);
      const step = size * PT_TO_MM * lineHeight;
      doc.text(lines, x, y, { baseline: "top", lineHeightFactor: lineHeight });
      return y + lines.length * step;
    },
    line(
      text,
      x,
      y,
      { font = SANS, weight = "normal", size = 9, color = COLOR.ink, align = "left", baseline = "top" } = {},
    ) {
      style(font, weight, size, color);
      doc.text(text, x, y, { align, baseline });
    },
    fill(color) {
      doc.setFillColor(...rgb(color));
    },
    stroke(color, width = 0.2) {
      doc.setDrawColor(...rgb(color));
      doc.setLineWidth(width);
    },
  };
}

// The site's logo: an orange sun over a green roof line, from a 24-unit drawing.
function drawBrandMark(doc, pen, x, y, size) {
  const unit = size / 24;
  pen.fill(COLOR.orange);
  doc.circle(x + 15.5 * unit, y + 7 * unit, 4 * unit, "F");
  pen.stroke(COLOR.forest, 2.6 * unit);
  doc.setLineJoin("round");
  doc.lines(
    [
      [9 * unit, -9 * unit],
      [9 * unit, 9 * unit],
    ],
    x + 2 * unit,
    y + 20 * unit,
  );
}

function drawHeader(doc, pen, createdAt) {
  const top = 12;
  drawBrandMark(doc, pen, PAGE.margin, top, 7);
  pen.line("SolarRoofGIS", PAGE.margin + 9, top + 3.5, { weight: "bold", size: 11.5, baseline: "middle" });
  const nameWidth = doc.getTextWidth("SolarRoofGIS");
  const divider = PAGE.margin + 9 + nameWidth + 3;
  pen.stroke(COLOR.line, 0.25);
  doc.line(divider, top + 1, divider, top + 6);
  pen.line("Kota & Kabupaten Bogor", divider + 3, top + 3.5, { size: 9, color: COLOR.inkSoft, baseline: "middle" });
  pen.line(`Dibuat ${formatDate(createdAt)}`, PAGE.width - PAGE.margin, top + 3.5, {
    size: 8.5,
    color: COLOR.inkSoft,
    align: "right",
    baseline: "middle",
  });
  pen.stroke(COLOR.line, 0.3);
  doc.line(PAGE.margin, top + 10, PAGE.width - PAGE.margin, top + 10);
}

function drawFooters(doc, pen) {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    pen.stroke(COLOR.line, 0.3);
    doc.line(PAGE.margin, FOOTER_Y - 4, PAGE.width - PAGE.margin, FOOTER_Y - 4);
    pen.line(`SolarRoofGIS · ${ESTIMATE_DISCLAIMER}`, PAGE.margin, FOOTER_Y, { size: 7.5, color: COLOR.inkFaint });
    pen.line(`Halaman ${page} dari ${pages}`, PAGE.width - PAGE.margin, FOOTER_Y, {
      size: 7.5,
      color: COLOR.inkFaint,
      align: "right",
    });
  }
}

// A section heading like the side panel's: short, bold, with a rule under it.
function sectionTitle(doc, pen, text, y, x = PAGE.margin, width = CONTENT) {
  pen.line(text, x, y, { font: SERIF, weight: "bold", size: 13 });
  pen.stroke(COLOR.line, 0.3);
  doc.line(x, y + 6.5, x + width, y + 6.5);
  return y + 10;
}

function stat(pen, label, value, x, y, { note = null, valueSize = 12.5, width = 40 } = {}) {
  pen.line(label, x, y, { size: 8, color: COLOR.inkSoft });
  pen.line(value, x, y + 4.2, { weight: "bold", size: valueSize });
  if (note) pen.paragraph(note, x, y + 6 + valueSize * PT_TO_MM, width, { size: 7, color: COLOR.inkFaint });
}

// ------------------------------------------------------------------ roof drawing

function insideRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const [iAbove, jAbove] = [yi > y, yj > y];
    if (iAbove !== jAbove && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function tracePath(doc, ring) {
  ring.forEach(([x, y], index) => (index === 0 ? doc.moveTo(x, y) : doc.lineTo(x, y)));
  doc.close();
}

// A scale bar length that draws between about 8 and 30 mm at this scale.
function scaleBarMetres(mmPerMetre) {
  return [1, 2, 5, 10, 20, 50, 100, 200, 500].find((metres) => metres * mmPerMetre >= 8) ?? 1000;
}

// The roof on a light grid like the panel's drawing: filled with its sunlight colour, the
// chosen panels on it, the length of its longer sides, a scale bar and north. `fill` is [r, g, b].
function drawRoof(doc, pen, { geometry, panelRings, fill }, box) {
  pen.fill(COLOR.page);
  pen.stroke(COLOR.line, 0.25);
  doc.roundedRect(box.x, box.y, box.width, box.height, 1.2, 1.2, "FD");
  pen.stroke(COLOR.line, 0.12);
  for (let x = box.x + 5; x < box.x + box.width; x += 5) doc.line(x, box.y, x, box.y + box.height);
  for (let y = box.y + 5; y < box.y + box.height; y += 5) doc.line(box.x, y, box.x + box.width, y);

  const raw = polygonsOf(geometry);
  const latitude = raw[0][0][0][1];
  const perLng = metresPerLng(latitude);
  const toLocal = ([lng, lat]) => [lng * perLng, -lat * METRES_PER_LAT];
  const polygons = raw.map((rings) => rings.map((ring) => openRing(ring).map(toLocal)));
  const corners = polygons.flat(2);
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
  const [spanX, spanY] = [Math.max(...xs) - minX || 1, Math.max(...ys) - minY || 1];
  const pad = { x: 13, top: 8, bottom: 13 };
  const room = { width: box.width - pad.x * 2, height: box.height - pad.top - pad.bottom };
  const scale = Math.min(room.width / spanX, room.height / spanY);
  const origin = [
    box.x + pad.x + (room.width - spanX * scale) / 2,
    box.y + pad.top + (room.height - spanY * scale) / 2,
  ];
  const project = ([x, y]) => [origin[0] + (x - minX) * scale, origin[1] + (y - minY) * scale];
  const screen = polygons.map((rings) => rings.map((ring) => ring.map(project)));

  doc.setFillColor(...fill);
  pen.stroke(COLOR.ink, 0.35);
  doc.setLineJoin("round");
  for (const rings of screen) {
    rings.forEach((ring) => tracePath(doc, ring));
    doc.fillStrokeEvenOdd();
  }

  if (panelRings.length) {
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.88 }));
    pen.fill(COLOR.panel);
    pen.stroke(COLOR.panelFrame, 0.12);
    for (const ring of panelRings) {
      tracePath(
        doc,
        openRing(ring).map((point) => project(toLocal(point))),
      );
      doc.fillStroke();
    }
    doc.restoreGraphicsState();
  }

  // Side lengths outside the outer rings, longest first, skipping any that would overlap.
  const placed = [];
  const candidates = [];
  screen.forEach((rings, p) => {
    const [ring] = rings;
    ring.forEach((a, v) => {
      const b = ring[(v + 1) % ring.length];
      const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
      const length = Math.hypot(dx, dy);
      if (length < 9) return;
      const local = polygons[p][0];
      const metres = Math.hypot(
        local[(v + 1) % ring.length][0] - local[v][0],
        local[(v + 1) % ring.length][1] - local[v][1],
      );
      candidates.push({ a, b, dx, dy, length, metres, ring });
    });
  });
  pen.style(SANS, "normal", 6.5, COLOR.ink);
  for (const side of candidates.sort((first, second) => second.metres - first.metres)) {
    const middle = [(side.a[0] + side.b[0]) / 2, (side.a[1] + side.b[1]) / 2];
    let [nx, ny] = [side.dy / side.length, -side.dx / side.length];
    if (insideRing([middle[0] + nx, middle[1] + ny], side.ring)) [nx, ny] = [-nx, -ny];
    const text = `${formatNumber(side.metres, side.metres < 100 ? 1 : 0)} m`;
    const width = doc.getTextWidth(text);
    const height = 2.6;
    const [x, y] = [middle[0] + nx * 2.4, middle[1] + ny * 2.4];
    const horizontal = Math.abs(nx) > Math.abs(ny);
    let left = x - width / 2;
    if (horizontal) left = nx > 0 ? x : x - width;
    let top = y - height / 2;
    if (!horizontal) top = ny > 0 ? y : y - height;
    const label = { left, top, right: left + width, bottom: top + height };
    const inBox =
      label.left > box.x + 1 &&
      label.right < box.x + box.width - 1 &&
      label.top > box.y + 1 &&
      label.bottom < box.y + box.height - 1;
    const clash = placed.some(
      (other) =>
        label.left < other.right && other.left < label.right && label.top < other.bottom && other.top < label.bottom,
    );
    if (!inBox || clash) continue;
    placed.push(label);
    doc.text(text, label.left, label.top, { baseline: "top" });
  }

  const barMetres = scaleBarMetres(scale);
  const barLength = barMetres * scale;
  const barY = box.y + box.height - 5;
  pen.stroke(COLOR.inkSoft, 0.3);
  doc.lines(
    [
      [0, 1.4],
      [barLength, 0],
      [0, -1.4],
    ],
    box.x + 5,
    barY - 1.4,
  );
  pen.line(`${barMetres} m`, box.x + 7 + barLength, barY, { size: 7, color: COLOR.inkSoft, baseline: "bottom" });

  // North points up, since the drawing uses map orientation.
  const north = [box.x + box.width - 7, box.y + 5];
  pen.fill(COLOR.inkSoft);
  doc.triangle(north[0], north[1], north[0] - 1.6, north[1] + 4, north[0] + 1.6, north[1] + 4, "F");
  pen.line("U", north[0], north[1] + 5, { size: 7, weight: "bold", color: COLOR.inkSoft, align: "center" });
}

// ------------------------------------------------------------------ charts

function formatAxisRupiah(value) {
  if (value >= 1e9) return `${formatNumber(value / 1e9, 1)} M`;
  if (value >= 1e6) return `${formatNumber(value / 1e6)} jt`;
  return formatNumber(value);
}

// A round step that gives about four grid lines up to `max`.
function tickStep(max) {
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  return [1, 2, 2.5, 5, 10].find((step) => step * magnitude >= rough) * magnitude;
}

// November–March, the wet season in West Java (zero-based month indexes).
const RAINY_MONTHS = [10, 11, 0, 1, 2];

function drawMonthlyChart(doc, pen, monthlyKwh, box) {
  pen.line("Listrik per bulan", box.x, box.y, { weight: "bold", size: 9.5 });
  const peak = Math.max(...monthlyKwh, 1);
  const best = monthlyKwh.indexOf(Math.max(...monthlyKwh));
  const worst = monthlyKwh.indexOf(Math.min(...monthlyKwh));
  const plot = { top: box.y + 8, height: box.height - 22 };
  const slot = box.width / 12;
  monthlyKwh.forEach((kwh, month) => {
    const height = Math.max((kwh / peak) * plot.height, 0.6);
    const x = box.x + month * slot + slot * 0.18;
    pen.fill(COLOR.mist);
    doc.rect(x, plot.top, slot * 0.64, plot.height, "F");
    pen.fill(month === best ? COLOR.orange : COLOR.monthBar);
    doc.rect(x, plot.top + plot.height - height, slot * 0.64, height, "F");
    pen.line(MONTH_NAMES[month].slice(0, 3), x + slot * 0.32, plot.top + plot.height + 1.4, {
      size: 6.5,
      color: COLOR.inkFaint,
      align: "center",
    });
  });
  const note = `Terbanyak ${MONTH_NAMES[best]} (~${formatNumber(monthlyKwh[best])} kWh), tersedikit ${MONTH_NAMES[worst]} (~${formatNumber(monthlyKwh[worst])} kWh)${RAINY_MONTHS.includes(worst) ? ", musim hujan." : "."}`;
  pen.paragraph(note, box.x, plot.top + plot.height + 6, box.width, { size: 7.5, color: COLOR.inkSoft });
}

const SERIES = [
  { key: "withoutPvRp", label: "Tanpa panel surya", color: COLOR.withoutPv },
  { key: "withPvRp", label: "Dengan panel surya", color: COLOR.orange },
];

// Cumulative spending over the projection, with and without panels.
function drawCostChart(doc, pen, projection, box) {
  const last = projection[projection.length - 1].year;
  pen.line(`Total pengeluaran listrik ${last} tahun`, box.x, box.y, { weight: "bold", size: 9.5 });
  let legendX = box.x;
  for (const { label, color } of SERIES) {
    pen.fill(color);
    doc.rect(legendX, box.y + 5.6, 2.4, 2.4, "F");
    pen.line(label, legendX + 3.6, box.y + 5.2, { size: 7, color: COLOR.inkSoft });
    legendX += 6 + doc.getTextWidth(label);
  }

  const peak = Math.max(...projection.flatMap((point) => SERIES.map(({ key }) => point[key])), 1);
  const step = tickStep(peak);
  const top = Math.ceil(peak / step) * step;
  const plot = { left: box.x + 11, right: box.x + box.width, top: box.y + 12, bottom: box.y + box.height - 14 };
  const x = (year) => plot.left + (year / last) * (plot.right - plot.left);
  const y = (value) => plot.top + (1 - value / top) * (plot.bottom - plot.top);

  for (let tick = 0; tick <= top + 1e-6; tick += step) {
    pen.stroke(COLOR.line, 0.15);
    doc.line(plot.left, y(tick), plot.right, y(tick));
    pen.line(formatAxisRupiah(tick), plot.left - 1.5, y(tick), {
      size: 6.5,
      color: COLOR.inkFaint,
      align: "right",
      baseline: "middle",
    });
  }
  for (const year of [0, 5, 10, 15, 20, 25].filter((value) => value <= last)) {
    pen.line(year === 0 ? "Tahun 0" : String(year), x(year), plot.bottom + 1.4, {
      size: 6.5,
      color: COLOR.inkFaint,
      align: year === 0 ? "left" : "center",
    });
  }
  doc.setLineJoin("round");
  doc.setLineCap("round");
  for (const { key, color } of SERIES) {
    pen.stroke(color, 0.55);
    const points = projection.map((point) => [x(point.year), y(point[key])]);
    doc.lines(
      points.slice(1).map(([px, py], index) => [px - points[index][0], py - points[index][1]]),
      points[0][0],
      points[0][1],
    );
  }
  const end = projection[projection.length - 1];
  pen.paragraph(
    `Setelah ${last} tahun: tanpa panel ${approxRupiah(end.withoutPvRp)}, dengan panel ${approxRupiah(end.withPvRp)}. Saat kedua garis bersilangan, panel surya sudah balik modal.`,
    box.x,
    plot.bottom + 6,
    box.width,
    { size: 7.5, color: COLOR.inkSoft },
  );
}

function drawSunlightScale(doc, pen, solar, x, y, width) {
  const range = solar.pvoutRange;
  const steps = 60;
  for (let i = 0; i < steps; i += 1) {
    const value = range.min + ((range.max - range.min) * (i + 0.5)) / steps;
    doc.setFillColor(...pvoutRgb(value, range));
    doc.rect(x + (width * i) / steps, y, width / steps + 0.05, 3.2, "F");
  }
  const position = Math.min(Math.max((solar.pvout - range.min) / (range.max - range.min), 0), 1);
  const markerX = x + position * width;
  pen.fill(COLOR.ink);
  doc.triangle(markerX, y - 0.2, markerX - 1.4, y - 2.6, markerX + 1.4, y - 2.6, "F");
  pen.stroke(COLOR.ink, 0.4);
  doc.line(markerX, y - 0.2, markerX, y + 3.4);
  pen.line("Teredup di Bogor", x, y + 4.6, { size: 7, color: COLOR.inkFaint });
  pen.line("Tercerah", x + width, y + 4.6, { size: 7, color: COLOR.inkFaint, align: "right" });
  return y + 9;
}

// ------------------------------------------------------------------ pages

function numberedList(doc, pen, items, x, y, width) {
  let cursor = y;
  items.forEach((item, index) => {
    pen.paragraph(`${index + 1}.`, x, cursor, 5, { size: 9, color: COLOR.inkSoft });
    cursor = pen.paragraph(item, x + 5, cursor, width - 5, { size: 9 }) + 1.8;
  });
  return cursor;
}

function detailRows(doc, pen, rows, x, y, width) {
  let cursor = y;
  for (const [label, value] of rows) {
    pen.line(label, x, cursor, { size: 9, color: COLOR.inkSoft });
    pen.line(value, x + width, cursor, { size: 9, weight: "bold", align: "right" });
    cursor += 5.2;
    pen.stroke(COLOR.line, 0.15);
    doc.line(x, cursor - 1.4, x + width, cursor - 1.4);
  }
  return cursor + 1;
}

function firstPage(doc, pen, report) {
  const { place, solar, assumptions, finance, household, summary } = report;
  let y = 30;
  pen.line("Laporan potensi PLTS atap", PAGE.margin, y, { font: SERIF, weight: "bold", size: 21 });
  y += 10;
  pen.line(`${place.region} · ${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`, PAGE.margin, y, {
    size: 10,
    color: COLOR.inkSoft,
  });
  y += 5.2;
  pen.line(place.source, PAGE.margin, y, { size: 8.5, color: COLOR.inkFaint });
  y += 9;

  // The roof and what all of it could produce.
  const roofBox = { x: PAGE.margin, y, width: 88, height: 66 };
  const fill = solar.pvout === null || !solar.pvoutRange ? rgb(COLOR.noData) : pvoutRgb(solar.pvout, solar.pvoutRange);
  drawRoof(doc, pen, { geometry: place.geometry, panelRings: report.panelRings, fill }, roofBox);
  pen.paragraph(
    `${formatNumber(report.panelRings.length)} panel yang dipilih digambar di atap.`,
    roofBox.x,
    roofBox.y + roofBox.height + 1.8,
    roofBox.width,
    { size: 7, color: COLOR.inkFaint },
  );

  const right = PAGE.margin + roofBox.width + 8;
  const rightWidth = PAGE.width - PAGE.margin - right;
  const level = sunlightLevel(solar.pvoutRank);
  const panel = panelSize(assumptions, solar.panel.id);
  pen.line("Potensi maksimal atap", right, y + 1, { size: 9, color: COLOR.inkSoft });
  pen.line(`Sinar matahari ${level.label.toLowerCase()}`, PAGE.width - PAGE.margin, y + 1, {
    size: 9,
    weight: "bold",
    color: LEVEL_COLOR[level.tone],
    align: "right",
  });
  const column = rightWidth / 2;
  const stats = [
    ["Luas atap", `${formatNumber(solar.footprintM2)} m²`],
    ["Bisa dipasangi", `${formatNumber(solar.usableM2)} m²`],
    ["Muat", `${formatNumber(solar.panelCount)} panel`],
    ["Daya", `${formatNumber(solar.capacityKwp, 1)} kWp`],
    ["Listrik per bulan", approx(`${formatNumber(solar.annualKwh / 12)} kWh`)],
    ["Ukuran panel", `${panel.label}, ${panel.powerWp} Wp`],
  ];
  stats.forEach(([label, value], index) => {
    stat(pen, label, value, right + (index % 2) * column, y + 9 + Math.floor(index / 2) * 15);
  });
  pen.paragraph(
    `1 kWp panel di sini menghasilkan ~${formatNumber(solar.pvout)} kWh per tahun.${solar.optimumTilt !== null ? ` Terbaik menghadap utara, miring ${formatNumber(solar.optimumTilt)}°.` : ""}`,
    right,
    y + 55,
    rightWidth,
    { size: 8, color: COLOR.inkSoft },
  );
  y += roofBox.height + 12;

  // The household inputs and the system that suits them.
  y = sectionTitle(doc, pen, "Untuk rumah Anda", y);
  const inputs = [
    ["Daya listrik PLN", household.power],
    [
      "Bayar listrik per bulan",
      household.monthlyBillRp === null ? "Belum diisi" : `Rp${formatNumber(household.monthlyBillRp)}`,
    ],
    ["Jenis panel", household.panelType],
    ["Tarif PLN", `Rp${formatNumber(finance.tariffRpPerKwh, 2)}/kWh`],
  ];
  inputs.forEach(([label, value], index) => {
    const x = PAGE.margin + (index * CONTENT) / 4;
    pen.line(label, x, y, { size: 8, color: COLOR.inkSoft });
    pen.line(value, x, y + 4, { size: 9.5, weight: "bold" });
  });
  y += 13;

  // The summary box grows with a reason that wraps and with notes under the figures.
  const tooLong = finance.paybackYears !== null && finance.paybackYears > assumptions.finance.projectionYears;
  const results = [
    ["Biaya pasang", approxRupiah(finance.investmentRp), null],
    ["Hemat per bulan", approxRupiah(finance.monthlySavingRp), savingNote(finance)],
    [
      "Balik modal",
      finance.paybackYears === null ? "–" : approx(`${formatNumber(finance.paybackYears, 1)} tahun`),
      tooLong ? `Lebih lama dari garansi ${assumptions.finance.projectionYears} tahun` : null,
    ],
    ["Listrik per bulan", approx(`${formatNumber(finance.annualKwh / 12)} kWh`), null],
  ];
  const inner = PAGE.margin + 6;
  const innerWidth = CONTENT - 12;
  pen.style(SANS, "normal", 8.5, COLOR.inkSoft);
  const reasonLines = doc.splitTextToSize(summary.reason, innerWidth).length;
  const boxTop = y;
  const statsTop = boxTop + 17 + reasonLines * 8.5 * PT_TO_MM * 1.35 + 3;
  const boxHeight = statsTop - boxTop + (results.some(([, , note]) => note) ? 20 : 14);
  const weak = finance.recommendation.belowMinimum;
  pen.fill(weak ? COLOR.mist : COLOR.forestSoft);
  doc.roundedRect(PAGE.margin, boxTop, CONTENT, boxHeight, 1.5, 1.5, "F");
  pen.fill(weak ? COLOR.inkFaint : COLOR.forest);
  doc.rect(PAGE.margin, boxTop, 1, boxHeight, "F");
  pen.line(summary.label, inner, boxTop + 5, { size: 8.5, color: COLOR.inkSoft });
  pen.line(
    `${formatNumber(finance.panelCount)} panel · ${formatNumber(finance.capacityKwp, 1)} kWp`,
    inner,
    boxTop + 9.5,
    { weight: "bold", size: 15 },
  );
  pen.paragraph(summary.reason, inner, boxTop + 17, innerWidth, { size: 8.5, color: COLOR.inkSoft });
  const resultWidth = innerWidth / 4;
  results.forEach(([label, value, note], index) => {
    stat(pen, label, value, inner + index * resultWidth, statsTop, { note, width: resultWidth - 4 });
  });
  y = boxTop + boxHeight + 9;

  // Production by month and the payback chart, side by side.
  const share = solar.annualKwh > 0 ? finance.annualKwh / solar.annualKwh : 0;
  const monthlyKwh = solar.monthlyKwh.map((kwh) => Math.round(kwh * share));
  const half = (CONTENT - 10) / 2;
  const chartHeight = FOOTER_Y - 8 - y;
  drawMonthlyChart(doc, pen, monthlyKwh, { x: PAGE.margin, y, width: half, height: chartHeight });
  if (finance.projection) {
    drawCostChart(doc, pen, finance.projection, { x: PAGE.margin + half + 10, y, width: half, height: chartHeight });
  } else {
    pen.line("Total pengeluaran listrik", PAGE.margin + half + 10, y, { weight: "bold", size: 9.5 });
    pen.paragraph(
      "Isi pengeluaran listrik per bulan di SolarRoofGIS untuk melihat grafik balik modal.",
      PAGE.margin + half + 10,
      y + 8,
      half,
      { size: 8.5, color: COLOR.inkSoft },
    );
  }
}

function secondPage(doc, pen, report) {
  const { place, solar, assumptions, finance } = report;
  const half = (CONTENT - 12) / 2;
  const rightX = PAGE.margin + half + 12;
  let y = 30;

  let left = sectionTitle(doc, pen, "Rincian", y, PAGE.margin, half);
  left = detailRows(
    doc,
    pen,
    [
      ["Panel dan inverter", approxRupiah(finance.panelsInverterRp)],
      ["Rangka, kabel, ongkos pasang", approxRupiah(finance.bosInstallationRp)],
      ["Total biaya pasang", approxRupiah(finance.investmentRp)],
      ["Nilai listrik per bulan", approxRupiah(finance.monthlyProductionRp)],
      ...(finance.monthlyUseKwh === null
        ? []
        : [["Pemakaian Anda", `~${formatNumber(finance.monthlyUseKwh)} kWh/bulan`]]),
      ["Listrik per tahun", approx(`${formatNumber(finance.annualKwh)} kWh`)],
      [
        "Bagian atap yang bisa dipasangi",
        `${formatNumber(solar.usableM2)} m² (${formatNumber(solar.usableShare * 100)}%)`,
      ],
      [
        "Emisi CO2 berkurang",
        approx(`${formatNumber((finance.annualKwh * assumptions.gridEmissionKgPerKwh) / 1000, 1)} ton/tahun`),
      ],
    ],
    PAGE.margin,
    left,
    half,
  );

  let right = sectionTitle(doc, pen, "Sinar matahari di lokasi ini", y, rightX, half);
  if (solar.pvout !== null && solar.pvoutRange) {
    right = drawSunlightScale(doc, pen, solar, rightX, right + 3, half);
    const { min, max } = solar.pvoutRange;
    right = pen.paragraph(
      `${formatNumber(solar.pvout)} kWh per kWp per tahun. Selisih tercerah dan teredup di Bogor hanya ${formatNumber(((max - min) / min) * 100)}%, jadi semua wilayah Bogor cukup cerah untuk panel surya.`,
      rightX,
      right + 1,
      half,
      { size: 8.5, color: COLOR.inkSoft },
    );
  }
  right += 6;
  right = sectionTitle(doc, pen, "Lokasi", right, rightX, half);
  right = pen.paragraph(place.source, rightX, right, half, { size: 9 });
  pen.style(SANS, "normal", 9, COLOR.forest);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
  doc.textWithLink("Buka lokasi di Google Maps", rightX, right + 1.5, { url: mapsUrl, baseline: "top" });
  right += 6.5;
  if (place.link) {
    doc.textWithLink("Buka atap ini di SolarRoofGIS", rightX, right, { url: place.link, baseline: "top" });
    right += 5;
  }

  y = Math.max(left, right) + 6;
  y = sectionTitle(doc, pen, "Cara menghitung", y);
  y = numberedList(doc, pen, methodSteps(solar, assumptions), PAGE.margin, y, CONTENT) + 4;
  y = sectionTitle(doc, pen, "Langkah selanjutnya", y);
  y = numberedList(doc, pen, NEXT_STEPS, PAGE.margin, y, CONTENT) + 4;

  pen.fill(COLOR.mist);
  const note = `${ESTIMATE_DISCLAIMER} Angka bertanda ~ adalah perkiraan. Data bangunan: Google Open Buildings; sinar matahari: Global Solar Atlas; tarif: PLN. Hasil sebenarnya bergantung pada survei atap, bayangan, dan penawaran installer.`;
  const lines = doc.splitTextToSize(note, CONTENT - 10);
  const height = lines.length * 8.5 * PT_TO_MM * 1.35 + 7;
  doc.roundedRect(PAGE.margin, y, CONTENT, height, 1.5, 1.5, "F");
  pen.paragraph(note, PAGE.margin + 5, y + 3.5, CONTENT - 10, { size: 8.5, color: COLOR.inkSoft });
}

// Builds the report. `report` holds the place (region, coordinates, source line, geometry,
// optional link), the panel rings drawn on the map, and the solar estimate, assumptions,
// financial simulation, household inputs and summary wording shown in the side panel.
export function buildRoofReport(report) {
  const createdAt = report.createdAt ?? new Date();
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const pen = makePen(doc);
  doc.setProperties({
    title: `Laporan potensi PLTS atap, ${report.place.region}`,
    subject: "Perkiraan listrik surya, biaya, dan balik modal dari SolarRoofGIS",
    creator: "SolarRoofGIS",
  });
  doc.setLanguage("id");

  drawHeader(doc, pen, createdAt);
  firstPage(doc, pen, report);
  doc.addPage();
  drawHeader(doc, pen, createdAt);
  secondPage(doc, pen, report);
  drawFooters(doc, pen);
  return doc;
}

export function downloadRoofReport(report) {
  buildRoofReport(report).save(report.fileName);
}
