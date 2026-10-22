require("dotenv").config();

const { Pool } = require("pg");

const connectionConfig = {
  connectionTimeoutMillis: 5000,
  max: 10,
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
