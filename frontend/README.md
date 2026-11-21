# Frontend

Create React App with MapLibre GL JS, React Router, and Lucide icons. The Express/PostGIS API is in `../backend`.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm start
```

Open `http://localhost:3000`. Set `REACT_APP_API_URL` if the API is not at `http://localhost:5000`.

The scripts run through `react-app-rewired`, which applies `config-overrides.js` to Create React App's webpack config. It only ignores one warning MapLibre's ESM build always raises, so `CI=true npm run build` (as on Vercel or Netlify) still fails on any other warning.
