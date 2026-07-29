import Database from 'better-sqlite3';
import path from 'path';

// Load the local SQLite database file
const dbPath = path.resolve(process.cwd(), 'yorbis_sales.db');
const db = new Database(dbPath);

console.log(`🚀 Running database migration on: ${dbPath}`);

// 1. Create prospects table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS prospects (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    website TEXT,
    contact_name TEXT,
    contact_title TEXT,
    contact_email TEXT,
    location TEXT,
    contract_intel TEXT,
    icp_score INTEGER,
    icp_reasoning TEXT,
    outreach_angle TEXT,
    status TEXT DEFAULT 'NEW',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 2. Add new columns if table already exists
const columns = ['contract_intel', 'outreach_angle'];

for (const col of columns) {
  try {
    db.exec(`ALTER TABLE prospects ADD COLUMN ${col} TEXT;`);
    console.log(`✅ Added column: ${col}`);
  } catch (e) {
    console.log(`ℹ️ Column '${col}' already present or skipped.`);
  }
}

console.log("🎉 Local SQLite database schema updated successfully!");