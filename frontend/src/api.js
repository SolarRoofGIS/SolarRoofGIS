export const API_BASE_URL = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

export async function fetchJson(path, options) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.detail || result.error || `API mengembalikan status ${response.status}`);
  }
  return result;
}

// Building details only change if the assumptions on the server change, so one fetch per session is enough.
const detailCache = {};

export function fetchBuildingDetail(id) {
  if (!detailCache[id]) {
    detailCache[id] = fetchJson(`/api/buildings/${id}`).catch((error) => {
      delete detailCache[id];
      throw error;
    });
  }
  return detailCache[id];
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
export function fetchRoofEstimate(geometry, options) {
  return postJson("/api/roofs/estimate", { geometry }, options);
}
