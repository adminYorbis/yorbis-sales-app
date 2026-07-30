import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

try {
  console.log("1. Testing connection...");
  const ping = await db.execute("SELECT 1 AS ok");
  console.log("SELECT 1:", ping.rows);

  console.log("\n2. Reading current tables...");
  const tables = await db.execute(`
    SELECT name
    FROM sqlite_schema
    WHERE type = 'table'
    ORDER BY name
  `);
  console.log("Tables:", tables.rows);

  console.log("\n3. Testing schema write...");
  await db.execute(`
    CREATE TABLE IF NOT EXISTS "__yorbis_connection_test" (
      id INTEGER PRIMARY KEY,
      created_at TEXT
    )
  `);
  console.log("CREATE TABLE: SUCCESS");

  console.log("\n4. Cleaning up test table...");
  await db.execute(`DROP TABLE "__yorbis_connection_test"`);
  console.log("DROP TABLE: SUCCESS");

  console.log("\n✅ Turso URL + token have full read/write/schema access.");
} catch (error) {
  console.error("\n❌ TURSO TEST FAILED");
  console.error(error);
  process.exit(1);
}