# Backend

Express.js API that reads `public.bogor_buildings` and `public.batas_bogor` from PostGIS and the Global Solar Atlas rasters in `data_bogor/photovoltaic/`. The routes and the estimate method are described in the [root README](../README.md).

## Run locally

Requires Node.js 20 or newer and PostgreSQL with PostGIS. Copy `.env.example` to `.env`, set `DB_PASSWORD`, then run:

```bash
npm install
npm run dev
```

The server listens on port 5000 by default. `npm start` runs the same server without nodemon.

Set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` in `.env`; `DATABASE_URL` is also supported. CORS is open to every origin. Both database tables are optional for trying the roof drawing tool: see [SETUP.md](../SETUP.md).
