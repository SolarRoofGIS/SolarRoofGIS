// Yellow → orange ramp: pale yellow for less sun, deep orange for the most.
export const PVOUT_RAMP = ["#fff1a8", "#fdd248", "#f9a72b", "#ef7a1c", "#cf4f0c"];
export const NO_DATA_COLOR = "#b9c2bf";

function rampExpression(input, stops) {
  return ["interpolate", ["linear"], input, ...stops.flatMap((stop, index) => [stop, PVOUT_RAMP[index]])];
}

// MapLibre fill-color for roofs and overview cells, spread over the PVOUT color range from the API.
export function pvoutColorExpression(range) {
  if (!range) return NO_DATA_COLOR;
  const step = (range.max - range.min) / (PVOUT_RAMP.length - 1);
  const stops = PVOUT_RAMP.map((_, index) => range.min + step * index);
  return ["case", ["has", "pvout"], rampExpression(["get", "pvout"], stops), NO_DATA_COLOR];
}

// The same ramp as pvoutColorExpression(), as [r, g, b] for drawing on a canvas.
export function pvoutRgb(value, range) {
  const channels = (hex) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  const last = PVOUT_RAMP.length - 1;
  const position = Math.min(Math.max((value - range.min) / (range.max - range.min), 0), 1) * last;
  const index = Math.min(Math.floor(position), last - 1);
  const [from, to] = [channels(PVOUT_RAMP[index]), channels(PVOUT_RAMP[index + 1])];
  return from.map((channel, i) => Math.round(channel + (to[i] - channel) * (position - index)));
}

// The same ramp as a CSS color, for a roof drawn outside the map.
export function pvoutCss(value, range) {
  if (value === null || value === undefined || !range) return NO_DATA_COLOR;
  return `rgb(${pvoutRgb(value, range).join(", ")})`;
}
