const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const pool = require("./db");

// Heavy, read-only answers (overview tiles, summary statistics) kept in the database, so
// they are computed once rather than on every serverless cold start, every deployment, or
// every CDN region. Rows carry a version made from the code that shapes them: changing that
// code makes new rows, and old versions are removed after a day. After re-importing the
// building data, empty the table: TRUNCATE public.api_cache;
const SOURCES = ["buildingSql.js", "solar.js", "pvout.js", "routes/tiles.js", "routes/stats.js"];
const VERSION = crypto
  .createHash("sha1")
  .update(SOURCES.map((file) => fs.readFileSync(path.join(__dirname, file), "utf8")).join("\n"))
  .digest("hex")
  .slice(0, 12);

let ready = null;
function setup() {
  if (!ready) {
    ready = pool
      .query(
        `CREATE TABLE IF NOT EXISTS public.api_cache (
           version text NOT NULL,
           key text NOT NULL,
           body bytea NOT NULL,
           created_at timestamptz NOT NULL DEFAULT now(),
           PRIMARY KEY (version, key)
         )`,
      )
      .then(() =>
        pool.query("DELETE FROM public.api_cache WHERE version <> $1 AND created_at < now() - interval '1 day'", [
          VERSION,
        ]),
      )
      .catch((error) => {
        ready = null;
        throw error;
      });
  }
  return ready;
}

// The stored Buffer for `key`, or `build()`'s Buffer, stored for next time. A database that
// cannot hold the cache (read-only role, for example) only costs the speed-up.
async function remember(key, build) {
  try {
    await setup();
    const { rows } = await pool.query("SELECT body FROM public.api_cache WHERE version = $1 AND key = $2", [
      VERSION,
      key,
    ]);
    if (rows.length) return rows[0].body;
  } catch (error) {
    console.error(`API cache unavailable: ${error.message}`);
    return build();
  }
  const body = await build();
  await pool
    .query(
      `INSERT INTO public.api_cache (version, key, body) VALUES ($1, $2, $3)
       ON CONFLICT (version, key) DO UPDATE SET body = EXCLUDED.body, created_at = now()`,
      [VERSION, key, body],
    )
    .catch((error) => console.error(`API cache write failed: ${error.message}`));
  return body;
}

module.exports = { remember, VERSION };
