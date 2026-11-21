// Create React App's webpack config, adjusted through react-app-rewired.
//
// MapLibre GL 6 ships only ESM builds that contain `new URL(variable, import.meta.url)` for an
// optional worker fallback. Webpack cannot resolve that and warns "Critical dependency", which CI
// builds (CI=true) treat as an error. The app sets the worker URL itself (see SolarMap.jsx), so
// that fallback never runs; only this one warning from MapLibre is ignored, all others still fail.
module.exports = function override(config) {
  config.ignoreWarnings = [
    ...(config.ignoreWarnings || []),
    (warning) =>
      /Critical dependency: the request of a dependency is an expression/.test(warning.message || "") &&
      /[\\/]node_modules[\\/]maplibre-gl[\\/]/.test(warning.module?.resource || ""),
  ];
  return config;
};
