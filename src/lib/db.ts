import { createClient, type Client } from '@libsql/client';
import crypto from 'crypto';

export interface Prospect {
  id: string;
  company_name: string;
  website?: string;
  contact_name?: string;
  contact_title?: string;
  contact_email?: string;
  location?: string;
  contract_intel?: string;
  icp_score?: number;
  icp_reasoning?: string;
  outreach_angle?: string;
  status?: string;
  stage?: string;
  notes?: string;
  research_brief?: string;
  research_status?: string;
  industry?: string;
  source_urls?: string;
  employee_count?: string;
  revenue_range?: string;
  company_description?: string;
  confidence?: string;
  signals_json?: string;
  evidence_json?: string;
  score_breakdown?: string;
  contact_profile_url?: string;
  contact_source_url?: string;
  contact_reason?: string;
  recommended_approach?: string;
  unknown_signals_json?: string;
  why_now_json?: string;
  recommended_conversation?: string;
  best_opportunity?: string;
  search_run_id?: string;
  created_at?: string;
}

export interface SearchRun {
  id: string;
  user_email: string;
  query: string;
  intent_json: string;
  result_count: number;
  parent_run_id?: string;
  discovery_session_id?: string;
  request_type?: string;
  status?: string;
  created_at?: string;
}

export interface Contact {
  id: number;
  prospect_id: string;
  name: string;
  email?: string;
  role?: string;
  phone?: string;
  source_url?: string;
  verification_status?: string;
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
}

let client: Client | undefined;
let schemaPromise: Promise<void> | undefined;

export function getTursoClient() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL || 'file:yorbis-local-dev.db';
    const authToken = process.env.TURSO_AUTH_TOKEN;
    client = createClient(authToken ? { url, authToken } : { url });
  }
  return client;
}

export function ensureSchema() {
  if (!schemaPromise) {
    const db = getTursoClient();
    schemaPromise = db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS prospects (
        id TEXT PRIMARY KEY,
        company_name TEXT NOT NULL,
        domain TEXT UNIQUE,
        website TEXT,
        contact_name TEXT,
        contact_title TEXT,
        contact_email TEXT,
        location TEXT,
        industry TEXT,
        contract_intel TEXT,
        icp_score INTEGER DEFAULT 0,
        icp_reasoning TEXT,
        outreach_angle TEXT,
        source_urls TEXT,
        research_brief TEXT,
        research_status TEXT DEFAULT 'PENDING',
        status TEXT DEFAULT 'NEW',
        stage TEXT DEFAULT 'NEW',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prospect_id TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        role TEXT,
        phone TEXT,
        source_url TEXT,
        verification_status TEXT DEFAULT 'UNVERIFIED',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS outreach (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prospect_id TEXT NOT NULL,
        subject TEXT,
        body TEXT NOT NULL,
        channel TEXT DEFAULT 'email',
        status TEXT DEFAULT 'DRAFT',
        sent_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS saved_searches (
        id TEXT PRIMARY KEY,
        user_email TEXT NOT NULL,
        query TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS search_runs (
        id TEXT PRIMARY KEY,
        user_email TEXT NOT NULL,
        query TEXT NOT NULL,
        intent_json TEXT NOT NULL,
        result_count INTEGER DEFAULT 0,
        parent_run_id TEXT,
        discovery_session_id TEXT,
        request_type TEXT DEFAULT 'NEW_DISCOVERY_REQUEST',
        status TEXT DEFAULT 'COMPLETED',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS search_runs_user_created_idx
        ON search_runs(user_email, created_at DESC);
      CREATE TABLE IF NOT EXISTS search_run_results (
        run_id TEXT NOT NULL,
        prospect_id TEXT NOT NULL,
        rank INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (run_id, prospect_id),
        FOREIGN KEY (run_id) REFERENCES search_runs(id) ON DELETE CASCADE,
        FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS "user" (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        emailVerified INTEGER,
        image TEXT
      );
      CREATE TABLE IF NOT EXISTS "account" (
        userId TEXT NOT NULL,
        type TEXT NOT NULL,
        provider TEXT NOT NULL,
        providerAccountId TEXT NOT NULL,
        refresh_token TEXT,
        access_token TEXT,
        expires_at INTEGER,
        token_type TEXT,
        scope TEXT,
        id_token TEXT,
        session_state TEXT,
        PRIMARY KEY (provider, providerAccountId),
        FOREIGN KEY (userId) REFERENCES "user"(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS "session" (
        sessionToken TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        expires INTEGER NOT NULL,
        FOREIGN KEY (userId) REFERENCES "user"(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS "verificationToken" (
        identifier TEXT NOT NULL,
        token TEXT NOT NULL,
        expires INTEGER NOT NULL,
        PRIMARY KEY (identifier, token)
      );
      CREATE TABLE IF NOT EXISTS "authenticator" (
        credentialID TEXT NOT NULL UNIQUE,
        userId TEXT NOT NULL,
        providerAccountId TEXT NOT NULL,
        credentialPublicKey TEXT NOT NULL,
        counter INTEGER NOT NULL,
        credentialDeviceType TEXT NOT NULL,
        credentialBackedUp INTEGER NOT NULL,
        transports TEXT,
        PRIMARY KEY (userId, credentialID),
        FOREIGN KEY (userId) REFERENCES "user"(id) ON DELETE CASCADE
      );
    `).then(async () => {
      const existing = await db.execute('PRAGMA table_info("prospects")');
      const names = new Set(existing.rows.map((column) => String(column.name)));
      const additions = [
        ['domain', 'TEXT'], ['website', 'TEXT'], ['contact_name', 'TEXT'],
        ['contact_title', 'TEXT'], ['contact_email', 'TEXT'], ['location', 'TEXT'],
        ['industry', 'TEXT'], ['contract_intel', 'TEXT'], ['icp_score', 'INTEGER DEFAULT 0'],
        ['icp_reasoning', 'TEXT'], ['outreach_angle', 'TEXT'], ['source_urls', 'TEXT'],
        ['research_brief', 'TEXT'], ['research_status', "TEXT DEFAULT 'PENDING'"],
        ['status', "TEXT DEFAULT 'NEW'"], ['stage', "TEXT DEFAULT 'NEW'"],
        ['notes', 'TEXT'], ['created_at', 'TEXT'], ['updated_at', 'TEXT'],
        ['employee_count', 'TEXT'], ['revenue_range', 'TEXT'], ['company_description', 'TEXT'],
        ['confidence', 'TEXT'], ['signals_json', 'TEXT'], ['evidence_json', 'TEXT'],
        ['score_breakdown', 'TEXT'], ['contact_profile_url', 'TEXT'], ['contact_source_url', 'TEXT'],
        ['contact_reason', 'TEXT'], ['recommended_approach', 'TEXT'], ['search_run_id', 'TEXT'],
        ['unknown_signals_json', 'TEXT'], ['why_now_json', 'TEXT'],
        ['recommended_conversation', 'TEXT'], ['best_opportunity', 'TEXT'],
      ] as const;
      for (const [name, type] of additions) {
        if (!names.has(name)) {
          try {
            await db.execute(`ALTER TABLE prospects ADD COLUMN ${name} ${type}`);
          } catch (error) {
            if (!/duplicate column/i.test(error instanceof Error ? error.message : String(error))) throw error;
          }
        }
      }
      await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS prospects_domain_unique_idx ON prospects(domain)');
      const searchColumns = await db.execute('PRAGMA table_info("search_runs")');
      const searchNames = new Set(searchColumns.rows.map((column) => String(column.name)));
      const searchAdditions = [
        ['parent_run_id', 'TEXT'], ['discovery_session_id', 'TEXT'],
        ['request_type', "TEXT DEFAULT 'NEW_DISCOVERY_REQUEST'"], ['status', "TEXT DEFAULT 'COMPLETED'"],
      ] as const;
      for (const [name, type] of searchAdditions) {
        if (!searchNames.has(name)) {
          try {
            await db.execute(`ALTER TABLE search_runs ADD COLUMN ${name} ${type}`);
          } catch (error) {
            if (!/duplicate column/i.test(error instanceof Error ? error.message : String(error))) throw error;
          }
        }
      }
      await db.execute(`
        INSERT OR IGNORE INTO search_run_results (run_id, prospect_id, rank)
        SELECT search_run_id, id, 0 FROM prospects WHERE search_run_id IS NOT NULL
      `);
    }).catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}

function normalizeDomain(website?: string) {
  if (!website) return null;
  try {
    return new URL(website.startsWith('http') ? website : `https://${website}`).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function row<T>(value: unknown) {
  return value as T;
}

export const dbService = {
  async ensureDiscoveryReady() {
    await ensureSchema();
    const result = await getTursoClient().execute('PRAGMA table_info("prospects")');
    const columns = new Set(result.rows.map((column) => String(column.name)));
    const required = [
      'id', 'company_name', 'domain', 'website', 'industry', 'icp_score',
      'signals_json', 'evidence_json', 'search_run_id', 'updated_at',
    ];
    const missing = required.filter((column) => !columns.has(column));
    if (missing.length) throw new Error(`Prospect schema missing required columns: ${missing.join(', ')}`);
    const indexes = await getTursoClient().execute('PRAGMA index_list("prospects")');
    const hasUniqueDomain = indexes.rows.some((index) =>
      String(index.name) === 'prospects_domain_unique_idx' && Number(index.unique) === 1
    );
    if (!hasUniqueDomain) throw new Error('Prospect schema missing unique domain index');
    return true;
  },

  async getAllProspects(): Promise<Prospect[]> {
    await ensureSchema();
    const result = await getTursoClient().execute('SELECT * FROM prospects ORDER BY created_at DESC');
    return result.rows.map((item) => row<Prospect>(item));
  },

  async getProspectById(id: string): Promise<Prospect | undefined> {
    await ensureSchema();
    const result = await getTursoClient().execute({ sql: 'SELECT * FROM prospects WHERE id = ?', args: [id] });
    return result.rows[0] ? row<Prospect>(result.rows[0]) : undefined;
  },

  async addProspect(data: Partial<Prospect>): Promise<Prospect> {
    await ensureSchema();
    const id = data.id || crypto.randomUUID();
    const domain = normalizeDomain(data.website);
    const now = new Date().toISOString();
    const args = [
      id, data.company_name || 'Unknown Company', domain, data.website || null,
      data.contact_name || null, data.contact_title || null, data.contact_email || null,
      data.location || null, data.industry || null, data.contract_intel || null,
      data.icp_score || 0, data.icp_reasoning || null, data.outreach_angle || null,
      data.source_urls || null, data.research_brief || null,
      data.stage || data.status || 'NEW', data.stage || data.status || 'NEW',
      data.employee_count || null, data.revenue_range || null, data.company_description || null,
      data.confidence || null, data.signals_json || null, data.evidence_json || null,
      data.score_breakdown || null, data.contact_profile_url || null, data.contact_source_url || null,
      data.contact_reason || null, data.recommended_approach || null, data.search_run_id || null,
      data.unknown_signals_json || null, data.why_now_json || null,
      data.recommended_conversation || null, data.best_opportunity || null,
      data.created_at || now, now,
    ];
    await getTursoClient().execute({
      sql: `INSERT INTO prospects (
        id, company_name, domain, website, contact_name, contact_title, contact_email,
        location, industry, contract_intel, icp_score, icp_reasoning, outreach_angle,
        source_urls, research_brief, status, stage, employee_count, revenue_range,
        company_description, confidence, signals_json, evidence_json, score_breakdown,
        contact_profile_url, contact_source_url, contact_reason, recommended_approach, search_run_id,
        unknown_signals_json, why_now_json, recommended_conversation, best_opportunity,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(domain) DO UPDATE SET
        company_name=excluded.company_name, website=excluded.website, location=excluded.location,
        industry=excluded.industry, contract_intel=excluded.contract_intel,
        icp_score=excluded.icp_score, icp_reasoning=excluded.icp_reasoning,
        outreach_angle=excluded.outreach_angle, source_urls=excluded.source_urls,
        employee_count=excluded.employee_count, revenue_range=excluded.revenue_range,
        company_description=excluded.company_description, confidence=excluded.confidence,
        signals_json=excluded.signals_json, evidence_json=excluded.evidence_json,
        score_breakdown=excluded.score_breakdown, contact_profile_url=excluded.contact_profile_url,
        contact_source_url=excluded.contact_source_url, contact_reason=excluded.contact_reason,
        recommended_approach=excluded.recommended_approach, search_run_id=excluded.search_run_id,
        unknown_signals_json=excluded.unknown_signals_json, why_now_json=excluded.why_now_json,
        recommended_conversation=excluded.recommended_conversation, best_opportunity=excluded.best_opportunity,
        updated_at=excluded.updated_at`,
      args,
    });
    if (domain) {
      const result = await getTursoClient().execute({ sql: 'SELECT * FROM prospects WHERE domain = ?', args: [domain] });
      return row<Prospect>(result.rows[0]);
    }
    return (await this.getProspectById(id)) as Prospect;
  },

  async updateProspect(id: string, updates: Partial<Prospect>): Promise<Prospect | null> {
    await ensureSchema();
    const allowed = ['stage', 'status', 'notes', 'contact_name', 'contact_title', 'contact_email', 'outreach_angle', 'research_brief', 'research_status'] as const;
    const entries = allowed.filter((key) => updates[key] !== undefined).map((key) => [key, updates[key]] as const);
    if (updates.stage !== undefined && updates.status === undefined) entries.push(['status', updates.stage]);
    if (updates.status !== undefined && updates.stage === undefined) entries.push(['stage', updates.status]);
    if (!entries.length) return null;
    await getTursoClient().execute({
      sql: `UPDATE prospects SET ${entries.map(([key]) => `${key} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [...entries.map(([, value]) => value ?? null), id],
    });
    return (await this.getProspectById(id)) || null;
  },

  async deleteProspect(id: string) {
    await ensureSchema();
    return getTursoClient().execute({ sql: 'DELETE FROM prospects WHERE id = ?', args: [id] });
  },

  async clearAllProspects() {
    await ensureSchema();
    return getTursoClient().execute('DELETE FROM prospects');
  },

  async getContactsForProspect(prospectId: string): Promise<Contact[]> {
    await ensureSchema();
    const result = await getTursoClient().execute({ sql: 'SELECT * FROM contacts WHERE prospect_id = ? ORDER BY id DESC', args: [prospectId] });
    return result.rows.map((item) => row<Contact>(item));
  },

  async addContactForProspect(prospectId: string, data: Partial<Contact>): Promise<Contact> {
    await ensureSchema();
    const result = await getTursoClient().execute({
      sql: 'INSERT INTO contacts (prospect_id, name, email, role, phone, source_url, verification_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [prospectId, data.name || 'Unknown', data.email || null, data.role || null, data.phone || null, data.source_url || null, data.verification_status || 'UNVERIFIED'],
    });
    const saved = await getTursoClient().execute({ sql: 'SELECT * FROM contacts WHERE id = ?', args: [Number(result.lastInsertRowid)] });
    return row<Contact>(saved.rows[0]);
  },

  async getOutreachForProspect(prospectId: string): Promise<OutreachMessage[]> {
    await ensureSchema();
    const result = await getTursoClient().execute({ sql: 'SELECT * FROM outreach WHERE prospect_id = ? ORDER BY id DESC', args: [prospectId] });
    return result.rows.map((item) => row<OutreachMessage>(item));
  },

  async addOutreachMessage(prospectId: string, data: Partial<OutreachMessage>): Promise<OutreachMessage> {
    await ensureSchema();
    const result = await getTursoClient().execute({
      sql: 'INSERT INTO outreach (prospect_id, subject, body, channel, status) VALUES (?, ?, ?, ?, ?)',
      args: [prospectId, data.subject || null, data.body || '', data.channel || 'email', data.status || 'DRAFT'],
    });
    const saved = await getTursoClient().execute({ sql: 'SELECT * FROM outreach WHERE id = ?', args: [Number(result.lastInsertRowid)] });
    return row<OutreachMessage>(saved.rows[0]);
  },

  async addSearchRun(data: Omit<SearchRun, 'created_at'>): Promise<SearchRun> {
    await ensureSchema();
    await getTursoClient().execute({
      sql: `INSERT INTO search_runs
        (id, user_email, query, intent_json, result_count, parent_run_id, discovery_session_id, request_type, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [data.id, data.user_email, data.query, data.intent_json, data.result_count,
        data.parent_run_id || null, data.discovery_session_id || data.id,
        data.request_type || 'NEW_DISCOVERY_REQUEST', data.status || 'COMPLETED'],
    });
    const result = await getTursoClient().execute({ sql: 'SELECT * FROM search_runs WHERE id = ?', args: [data.id] });
    return row<SearchRun>(result.rows[0]);
  },

  async getRecentSearches(userEmail: string): Promise<SearchRun[]> {
    await ensureSchema();
    const result = await getTursoClient().execute({
      sql: 'SELECT * FROM search_runs WHERE user_email = ? ORDER BY created_at DESC LIMIT 6',
      args: [userEmail],
    });
    return result.rows.map((item) => row<SearchRun>(item));
  },

  async linkProspectToSearchRun(runId: string, prospectId: string, rank: number) {
    await ensureSchema();
    await getTursoClient().execute({
      sql: 'INSERT OR IGNORE INTO search_run_results (run_id, prospect_id, rank) VALUES (?, ?, ?)',
      args: [runId, prospectId, rank],
    });
  },

  async getSearchRun(userEmail: string, id: string): Promise<{ search: SearchRun; prospects: Prospect[] } | null> {
    await ensureSchema();
    const searchResult = await getTursoClient().execute({
      sql: 'SELECT * FROM search_runs WHERE id = ? AND user_email = ?',
      args: [id, userEmail],
    });
    if (!searchResult.rows[0]) return null;
    const prospectResult = await getTursoClient().execute({
      sql: `SELECT prospects.* FROM prospects
        INNER JOIN search_run_results ON search_run_results.prospect_id = prospects.id
        WHERE search_run_results.run_id = ?
        ORDER BY search_run_results.rank ASC, prospects.icp_score DESC`,
      args: [id],
    });
    return {
      search: row<SearchRun>(searchResult.rows[0]),
      prospects: prospectResult.rows.map((item) => row<Prospect>(item)),
    };
  },
};

export default getTursoClient;
