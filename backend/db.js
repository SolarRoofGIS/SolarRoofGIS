require("dotenv").config();

const { Pool } = require("pg");

// A serverless function instance handles few requests at once, and Neon's pooler shares the
// connections, so it keeps a small pool; a cold Neon compute may take a few seconds to wake.
const connectionConfig = {
  connectionTimeoutMillis: process.env.VERCEL ? 15000 : 5000,
  max: process.env.VERCEL ? 3 : 10,
};

if (process.env.DATABASE_URL) {
  connectionConfig.connectionString = process.env.DATABASE_URL;
} else {
  connectionConfig.host = process.env.DB_HOST || process.env.PGHOST || "127.0.0.1";
  connectionConfig.port = Number(process.env.DB_PORT || process.env.PGPORT || 5433);
  connectionConfig.database = process.env.DB_NAME || process.env.PGDATABASE || "SolarRoofGIS";
  connectionConfig.user = process.env.DB_USER || process.env.PGUSER || "postgres";
  connectionConfig.password = process.env.DB_PASSWORD || process.env.PGPASSWORD || undefined;
}

const pool = new Pool(connectionConfig);

pool.on("error", (error) => {
  console.error("Unexpected idle PostgreSQL client error:", error);
});

module.exports = pool;
