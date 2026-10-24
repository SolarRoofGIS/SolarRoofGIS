# Backend

Express.js API using `pg` to query the local PostGIS database. It reads Google building polygons from `public.bogor_buildings`.

## Run locally

Requires Node.js 20 or newer and PostgreSQL with PostGIS. Copy `.env.example` to `.env`, set `DB_PASSWORD`, then run:

```bash
npm install
npm run dev
```

The server listens on port 5000 by default. `npm start` runs the same server without nodemon.

## Routes

- `GET /api/health` checks the database, PostGIS, and `public.bogor_buildings` table.
- `GET /api/buildings?dataset=google&bbox=west,south,east,north&zoom=16` returns up to 2,500 GeoJSON features. Requests below zoom 15.5 return an empty collection.

Set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` in `.env`. The defaults target this device's `SolarRoofGIS` database on `127.0.0.1:5433`. `DATABASE_URL` is also supported. The `.env` file is ignored by Git.

For separate frontend and backend deployments, set `FRONTEND_ORIGIN` to the frontend's origin. The local development origins `localhost` and `127.0.0.1` are allowed automatically.
