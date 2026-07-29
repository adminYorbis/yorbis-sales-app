import Database from 'better-sqlite3';
import path from 'path';

// --- COMPREHENSIVE TYPES & INTERFACES ---
export interface Prospect {
  id: number;
  name: string;
  email: string;
  company?: string;
  website?: string;
  stage?: string;
  outreach_channel?: string;
  date_contacted?: string;
  last_interaction_date?: string;
  next_action?: string;
  follow_up_date?: string;
  notes?: string;
  response_content?: string;
  
  // Research fields
  research_brief?: string;
  research_status?: string;
  research_summary?: string;
  industry?: string;
  pain_points?: string;
  source_urls?: string;
  
  created_at?: string;

  // Dynamic index signature so custom/additional DB properties never fail type checks
  [key: string]: any;
}

export interface Contact {
  id: number;
  prospect_id: number;
  name: string;
  email: string;
  role?: string;
  phone?: string;
  created_at?: string;
  [key: string]: any;
}

export interface OutreachMessage {
  id: number;
  prospect_id: number;
  subject?: string;
  body: string;
  channel?: string;
  status?: string;
  sent_at?: string;
  created_at?: string;
  [key: string]: any;
}

// Connect to local SQLite database file
const dbPath = path.join(process.cwd(), 'sales.db');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency in Next.js
db.pragma('journal_mode = WAL');

let isInitialized = false;

export function initDatabase() {
  if (isInitialized) return;

  // 1. Base prospects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS prospects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      company TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Column migrations with try-catch safety per column
  const existingColumns = db
    .prepare("PRAGMA table_info(prospects)")
    .all() as { name: string }[];

  const columnNames = existingColumns.map((col) => col.name);

  const newColumns = [
    { name: 'website', type: 'TEXT' },
    { name: 'stage', type: "TEXT DEFAULT 'NEW'" },
    { name: 'outreach_channel', type: 'TEXT' },
    { name: 'date_contacted', type: 'TEXT' },
    { name: 'last_interaction_date', type: 'TEXT' },
    { name: 'next_action', type: 'TEXT' },
    { name: 'follow_up_date', type: 'TEXT' },
    { name: 'notes', type: 'TEXT' },
    { name: 'response_content', type: 'TEXT' },
    { name: 'research_brief', type: 'TEXT' },
    { name: 'research_status', type: "TEXT DEFAULT 'PENDING'" },
    { name: 'research_summary', type: 'TEXT' },
    { name: 'industry', type: 'TEXT' },
    { name: 'pain_points', type: 'TEXT' },
    { name: 'source_urls', type: 'TEXT' },
  ];

  for (const col of newColumns) {
    if (!columnNames.includes(col.name)) {
      try {
        db.exec(`ALTER TABLE prospects ADD COLUMN ${col.name} ${col.type};`);
      } catch (err: any) {
        // Safe catch if another build worker added it concurrently
        if (!err.message?.includes('duplicate column name')) {
          throw err;
        }
      }
    }
  }

  // 3. Contacts Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prospect_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
    );
  `);

  // 4. Outreach Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS outreach (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prospect_id INTEGER NOT NULL,
      subject TEXT,
      body TEXT NOT NULL,
      channel TEXT DEFAULT 'email',
      status TEXT DEFAULT 'DRAFT',
      sent_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
    );
  `);

  // 5. Settings Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  isInitialized = true;
}

// Run migrations on module load
initDatabase();

// --- DB SERVICE ABSTRACTION ---
export const dbService = {
  // Prospects
  getAllProspects: (): Prospect[] => {
    initDatabase();
    return db.prepare('SELECT * FROM prospects ORDER BY id DESC').all() as Prospect[];
  },

  getProspectById: (id: number): Prospect | undefined => {
    initDatabase();
    return db.prepare('SELECT * FROM prospects WHERE id = ?').get(id) as Prospect | undefined;
  },

  addProspect: (data: Partial<Prospect>): Prospect => {
    initDatabase();
    const stmt = db.prepare(`
      INSERT INTO prospects (name, email, company, website, notes, stage)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      data.name,
      data.email,
      data.company || null,
      data.website || null,
      data.notes || null,
      data.stage || 'NEW'
    );
    return db.prepare('SELECT * FROM prospects WHERE id = ?').get(info.lastInsertRowid) as Prospect;
  },

  updateProspect: (id: number, updates: Record<string, any>): Prospect | null => {
    initDatabase();
    const keys = Object.keys(updates);
    if (keys.length === 0) return null;

    const setClause = keys.map((key) => `${key} = ?`).join(', ');
    const values = Object.values(updates);

    const stmt = db.prepare(`UPDATE prospects SET ${setClause} WHERE id = ?`);
    stmt.run(...values, id);

    return db.prepare('SELECT * FROM prospects WHERE id = ?').get(id) as Prospect;
  },

  deleteProspect: (id: number) => {
    initDatabase();
    return db.prepare('DELETE FROM prospects WHERE id = ?').run(id);
  },

  clearAllProspects: () => {
    initDatabase();
    return db.prepare('DELETE FROM prospects').run();
  },

  // Contacts
  getContactsForProspect: (prospectId: number): Contact[] => {
    initDatabase();
    return db.prepare('SELECT * FROM contacts WHERE prospect_id = ? ORDER BY id DESC').all(prospectId) as Contact[];
  },

  addContactForProspect: (prospectId: number, data: Partial<Contact>): Contact => {
    initDatabase();
    const stmt = db.prepare(`
      INSERT INTO contacts (prospect_id, name, email, role, phone)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(prospectId, data.name, data.email, data.role || null, data.phone || null);
    return db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid) as Contact;
  },

  // Outreach
  getOutreachForProspect: (prospectId: number): OutreachMessage[] => {
    initDatabase();
    return db.prepare('SELECT * FROM outreach WHERE prospect_id = ? ORDER BY id DESC').all(prospectId) as OutreachMessage[];
  },

  addOutreachMessage: (prospectId: number, data: Partial<OutreachMessage>): OutreachMessage => {
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