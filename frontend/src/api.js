// In development the API runs separately on port 5000; a production build is served together
// with the API from the same origin (see vercel.json). REACT_APP_API_URL overrides both.
const DEFAULT_API_URL = process.env.NODE_ENV === "production" ? window.location.origin : "http://localhost:5000";
export const API_BASE_URL = (process.env.REACT_APP_API_URL || DEFAULT_API_URL).replace(/\/$/, "");

export async function fetchJson(path, options) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.detail || result.error || `API mengembalikan status ${response.status}`);
  }
  return result;
}

// Building details only change if the assumptions on the server change, so one fetch per
// building and panel size per session is enough.
const detailCache = {};

// Without a panel size the server uses its default one.
export function fetchBuildingDetail(id, panelId) {
  const key = `${id}:${panelId ?? ""}`;
  const query = panelId ? `?panel=${encodeURIComponent(panelId)}` : "";
  if (!detailCache[key]) {
    detailCache[key] = fetchJson(`/api/buildings/${id}${query}`).catch((error) => {
      delete detailCache[key];
      throw error;
    });
  }
  return detailCache[key];
}

function postJson(path, body, options) {
  return fetchJson(path, {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Investment, savings and payback for a number of panels and the viewer's inputs.
export function fetchFinanceEstimate(input, options) {
  return postJson("/api/finance/estimate", input, options);
}

// The same estimate as a building's, for a roof outline drawn on the map (GeoJSON geometry).
export function fetchRoofEstimate(geometry, panelId, options) {
  return postJson("/api/roofs/estimate", { geometry, panel: panelId }, options);
}
