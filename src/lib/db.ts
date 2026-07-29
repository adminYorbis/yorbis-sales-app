import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

// Connect to local SQLite database file
const dbPath = path.join(process.cwd(), 'yorbis_sales.db');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency in Next.js
db.pragma('journal_mode = WAL');

// --- TYPES & INTERFACES ---
export interface Prospect {
  id: string;
  company_name: string;
  website?: string;
  contact_name?: string;
  contact_title?: string;
  contact_email?: string;
  location?: string;
  contract_intel?: string;
  contract_intelligence?: string;
  icp_score?: number;
  icp_reasoning?: string;
  outreach_angle?: string;
  status?: string;
  stage?: string;
  notes?: string;
  research_brief?: string;
  research_status?: string;
  research_summary?: string;
  industry?: string;
  pain_points?: string;
  source_urls?: string;
  created_at?: string;
  [key: string]: any;
}

export interface Contact {
  id: number;
  prospect_id: string;
  name: string;
  email: string;
  role?: string;
  phone?: string;
  created_at?: string;
  [key: string]: any;
}

export interface OutreachMessage {
  id: number;
  prospect_id: string;
  subject?: string;
  body: string;
  channel?: string;
  status?: string;
  sent_at?: string;
  created_at?: string;
  [key: string]: any;
}

let isInitialized = false;

export function initDatabase() {
  if (isInitialized) return;

  // 1. Create base prospects table (TEXT id)
  db.exec(`
    CREATE TABLE IF NOT EXISTS prospects (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      website TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Perform safe column migrations
  const existingColumns = db
    .prepare("PRAGMA table_info(prospects)")
    .all() as { name: string }[];
  const columnNames = existingColumns.map((col) => col.name);

  const columnsToMigrate = [
    { name: 'contact_name', type: 'TEXT' },
    { name: 'contact_title', type: 'TEXT' },
    { name: 'contact_email', type: 'TEXT' },
    { name: 'location', type: 'TEXT' },
    { name: 'contract_intel', type: 'TEXT' },
    { name: 'contract_intelligence', type: 'TEXT' },
    { name: 'icp_score', type: 'INTEGER DEFAULT 0' },
    { name: 'icp_reasoning', type: 'TEXT' },
    { name: 'outreach_angle', type: 'TEXT' },
    { name: 'status', type: "TEXT DEFAULT 'NEW'" },
    { name: 'stage', type: "TEXT DEFAULT 'NEW'" },
    { name: 'notes', type: 'TEXT' },
    { name: 'research_brief', type: 'TEXT' },
    { name: 'research_status', type: "TEXT DEFAULT 'PENDING'" },
    { name: 'research_summary', type: 'TEXT' },
    { name: 'industry', type: 'TEXT' },
    { name: 'pain_points', type: 'TEXT' },
    { name: 'source_urls', type: 'TEXT' }
  ];

  for (const col of columnsToMigrate) {
    if (!columnNames.includes(col.name)) {
      try {
        db.exec(`ALTER TABLE prospects ADD COLUMN ${col.name} ${col.type};`);
      } catch (err: any) {
        if (!err.message?.includes('duplicate column name')) {
          throw err;
        }
      }
    }
  }

  // 3. Create contacts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prospect_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
    );
  `);

  // 4. Create outreach table
  db.exec(`
    CREATE TABLE IF NOT EXISTS outreach (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prospect_id TEXT NOT NULL,
      subject TEXT,
      body TEXT NOT NULL,
      channel TEXT DEFAULT 'email',
      status TEXT DEFAULT 'DRAFT',
      sent_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
    );
  `);

  // 5. Create settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  isInitialized = true;
}

// Initialize database immediately on module load
initDatabase();

// --- EXPLICIT QUERY HELPERS ---

export function getProspectsByStage(stage: string): Prospect[] {
  initDatabase();
  // Support matching both 'stage' and 'status' columns
  const stmt = db.prepare(`
    SELECT * FROM prospects 
    WHERE stage = ? OR status = ?
    ORDER BY created_at DESC
  `);
  return stmt.all(stage, stage) as Prospect[];
}

export function getAllProspects(): Prospect[] {
  initDatabase();
  const stmt = db.prepare(`
    SELECT * FROM prospects 
    ORDER BY created_at DESC
  `);
  return stmt.all() as Prospect[];
}

export function updateProspectStage(id: string | number, stage: string) {
  initDatabase();
  // Keep both 'stage' and 'status' columns in sync
  return db.prepare('UPDATE prospects SET stage = ?, status = ? WHERE id = ?').run(stage, stage, id);
}

// --- DB SERVICE ABSTRACTION ---
export const dbService = {
  getAllProspects: (): Prospect[] => {
    return getAllProspects();
  },

  getProspectById: (id: string | number): Prospect | undefined => {
    initDatabase();
    return db.prepare('SELECT * FROM prospects WHERE id = ?').get(id) as Prospect | undefined;
  },

  addProspect: (data: Partial<Prospect>): Prospect => {
    initDatabase();
    const id = data.id || crypto.randomUUID();
    
    // Support mapping frontend fields to either db column
    const companyName = data.company_name || data.company || 'Unknown Company';
    const contactName = data.contact_name || data.name || null;
    const contactEmail = data.contact_email || data.email || null;
    const stage = data.stage || data.status || 'NEW';

    const stmt = db.prepare(`
      INSERT INTO prospects (
        id, company_name, website, contact_name, contact_title,
        contact_email, location, contract_intel, contract_intelligence,
        icp_score, icp_reasoning, outreach_angle, status, stage, notes
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
    `);

    stmt.run(
      id,
      companyName,
      data.website || null,
      contactName,
      data.contact_title || null,
      contactEmail,
      data.location || null,
      data.contract_intel || data.contract_intelligence || null,
      data.contract_intelligence || data.contract_intel || null,
      data.icp_score || 0,
      data.icp_reasoning || null,
      data.outreach_angle || null,
      stage,
      stage,
      data.notes || null
    );

    return db.prepare('SELECT * FROM prospects WHERE id = ?').get(id) as Prospect;
  },

  updateProspect: (id: string | number, updates: Record<string, any>): Prospect | null => {
    initDatabase();
    
    // Normalize updates to sync stage and status if either is updated
    const normalizedUpdates = { ...updates };
    if ('stage' in normalizedUpdates) {
      normalizedUpdates.status = normalizedUpdates.stage;
    } else if ('status' in normalizedUpdates) {
      normalizedUpdates.stage = normalizedUpdates.status;
    }
    
    const keys = Object.keys(normalizedUpdates);
    if (keys.length === 0) return null;

    const setClause = keys.map((key) => `${key} = ?`).join(', ');
    const values = Object.values(normalizedUpdates);

    const stmt = db.prepare(`UPDATE prospects SET ${setClause} WHERE id = ?`);
    stmt.run(...values, id);

    return db.prepare('SELECT * FROM prospects WHERE id = ?').get(id) as Prospect;
  },

  deleteProspect: (id: string | number) => {
    initDatabase();
    return db.prepare('DELETE FROM prospects WHERE id = ?').run(id);
  },

  clearAllProspects: () => {
    initDatabase();
    return db.prepare('DELETE FROM prospects').run();
  },

  // Contacts
  getContactsForProspect: (prospectId: string | number): Contact[] => {
    initDatabase();
    return db.prepare('SELECT * FROM contacts WHERE prospect_id = ? ORDER BY id DESC').all(prospectId) as Contact[];
  },

  addContactForProspect: (prospectId: string | number, data: Partial<Contact>): Contact => {
    initDatabase();
    const stmt = db.prepare(`
      INSERT INTO contacts (prospect_id, name, email, role, phone)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(prospectId, data.name, data.email, data.role || null, data.phone || null);
    return db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid) as Contact;
  },

  // Outreach
  getOutreachForProspect: (prospectId: string | number): OutreachMessage[] => {
    initDatabase();
    return db.prepare('SELECT * FROM outreach WHERE prospect_id = ? ORDER BY id DESC').all(prospectId) as OutreachMessage[];
  },

  addOutreachMessage: (prospectId: string | number, data: Partial<OutreachMessage>): OutreachMessage => {
    initDatabase();
    const stmt = db.prepare(`
      INSERT INTO outreach (prospect_id, subject, body, channel, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      prospectId,
      data.subject || null,
      data.body,
      data.channel || 'email',
      data.status || 'DRAFT'
    );
    return db.prepare('SELECT * FROM outreach WHERE id = ?').get(result.lastInsertRowid) as OutreachMessage;
  }
};

export default db;