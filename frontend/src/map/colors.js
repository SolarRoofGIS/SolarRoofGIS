// Yellow → orange ramp: pale yellow for less sun (or potential), deep orange for the most.
export const PVOUT_RAMP = ["#fff1a8", "#fdd248", "#f9a72b", "#ef7a1c", "#cf4f0c"];
export const NO_DATA_COLOR = "#b9c2bf";

// Overview cells, in MWh per hectare per year. Picked from the 10th–98th percentile of
// ~110 m cells over Bogor (4, 36, 168, 422, 974), so dense kampung and suburbs differ.
export const DENSITY_STOPS = [0, 50, 200, 450, 800];

function rampExpression(input, stops) {
  return ["interpolate", ["linear"], input, ...stops.flatMap((stop, index) => [stop, PVOUT_RAMP[index]])];
}

// MapLibre fill-color for roofs, spread over the PVOUT color range from the API.
export function pvoutColorExpression(range) {
  if (!range) return NO_DATA_COLOR;
  const step = (range.max - range.min) / (PVOUT_RAMP.length - 1);
  const stops = PVOUT_RAMP.map((_, index) => range.min + step * index);
  return ["case", ["has", "pvout"], rampExpression(["get", "pvout"], stops), NO_DATA_COLOR];
}

export function densityColorExpression() {
  return rampExpression(["get", "density"], DENSITY_STOPS);
}
