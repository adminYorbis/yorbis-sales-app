'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';

type Status = 'VERIFIED' | 'INFERRED' | 'UNKNOWN';
type Signal = { label: string; status: Status; category?: string };
type Evidence = { claim: string; source_name: string; source_url: string; summary: string };
type Prospect = {
  id: string; company_name: string; website?: string; location?: string; industry?: string;
  employee_count?: string; revenue_range?: string; company_description?: string; confidence?: string;
  icp_score?: number; icp_reasoning?: string; research_brief?: string; recommended_approach?: string;
  signals_json?: string; evidence_json?: string; score_breakdown?: string; source_urls?: string;
  contact_name?: string; contact_title?: string; contact_email?: string; contact_profile_url?: string;
  contact_source_url?: string; contact_reason?: string; outreach_angle?: string; search_run_id?: string;
};
type Intent = {
  companyType?: string; geography?: string; employeeMin?: number; employeeMax?: number;
  internationalMarkets?: string[]; desiredCount?: number; otherConstraints?: string[];
};
type SearchRun = { id: string; query: string; result_count: number };

const examples = [
  'US importers paying suppliers in India',
  'California distributors sourcing internationally',
  'SMBs paying international contractors',
  'Companies likely needing global vendor payouts',
];
const progressSteps = ['Finding companies', 'Verifying fit', 'Ranking prospects', 'Identifying contacts'];

function parseArray<T>(value?: string): T[] {
  if (!value) return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}
function parseObject<T>(value?: string): T | null {
  if (!value) return null;
  try { return JSON.parse(value) as T; } catch { return null; }
}
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(); }
function classification(score = 0) { return score >= 80 ? 'STRONG MATCH' : score >= 60 ? 'MODERATE MATCH' : 'NEEDS REVIEW'; }
function sourceHost(url: string) { try { return new URL(url).hostname.replace('www.', ''); } catch { return 'Source'; } }

export default function ProspectSearch() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [currentResults, setCurrentResults] = useState<Prospect[]>([]);
  const [selected, setSelected] = useState<Prospect | null>(null);
  const [query, setQuery] = useState('');
  const [intent, setIntent] = useState<Intent | null>(null);
  const [recent, setRecent] = useState<SearchRun[]>([]);
  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'best' | 'all' | 'review'>('best');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  async function loadInitial() {
    const [prospectResponse, searchResponse] = await Promise.all([fetch('/api/prospects', { cache: 'no-store' }), fetch('/api/searches', { cache: 'no-store' })]);
    const prospectData = await prospectResponse.json();
    const searchData = await searchResponse.json();
    setProspects(prospectData.prospects || []);
    setRecent(searchData.searches || []);
  }

  useEffect(() => {
    let active = true;
    // The initial client fetch hydrates this authenticated, database-backed workspace.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInitial().catch(() => active && setError('Your prospect workspace could not be loaded.')).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!searching) return;
    const timer = window.setInterval(() => setProgress((value) => Math.min(value + 1, progressSteps.length - 1)), 1800);
    return () => window.clearInterval(timer);
  }, [searching]);

  async function runSearch(event: FormEvent) {
    event.preventDefault();
    if (!query.trim() || searching) return;
    setSearching(true); setProgress(0); setError(''); setIntent(null);
    try {
      const response = await fetch('/api/prospects/discover', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: query.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Search failed.');
      setIntent(data.intent || {});
      setCurrentResults(data.prospects || []);
      setProspects((existing) => {
        const byId = new Map(existing.map((item) => [item.id, item]));
        for (const item of data.prospects || []) byId.set(item.id, item);
        return [...byId.values()];
      });
      setRecent((items) => [{ id: data.searchRunId, query: query.trim(), result_count: data.count }, ...items].slice(0, 6));
      setTab('best');
      if (data.prospects?.[0]) { setSelected(data.prospects[0]); setDrawerOpen(true); }
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Search failed.');
    } finally { setSearching(false); }
  }

  const baseResults = currentResults.length ? currentResults : prospects;
  const results = useMemo(() => [...baseResults]
    .filter((item) => tab === 'best' ? (item.icp_score || 0) >= 80 : tab === 'review' ? (item.icp_score || 0) < 60 : true)
    .sort((a, b) => (b.icp_score || 0) - (a.icp_score || 0)), [baseResults, tab]);
  const strong = baseResults.filter((item) => (item.icp_score || 0) >= 80).length;
  const moderate = baseResults.filter((item) => (item.icp_score || 0) >= 60 && (item.icp_score || 0) < 80).length;
  const review = baseResults.filter((item) => (item.icp_score || 0) < 60).length;

  function openProspect(prospect: Prospect) { setSelected(prospect); setDrawerOpen(true); }
  function openOutreach(prospect: Prospect) {
    setSelected(prospect);
    const draft = parseObject<{ subject: string; body: string }>(prospect.outreach_angle);
    setSubject(draft?.subject || 'A quick question about international payments');
    setBody(draft?.body || `Hi ${prospect.contact_name?.split(' ')[0] || 'there'},\n\nI noticed ${prospect.company_name} has international operations that may make vendor payments complex.\n\nI'm with Yorbis. We help growing businesses collect payments and pay vendors globally from one platform.\n\nCurious how you're handling this today?\n\nBest,\nAnant`);
    setOutreachOpen(true);
  }
  async function regenerate() {
    if (!selected) return;
    setRegenerating(true);
    try {
      const response = await fetch(`/api/prospects/${selected.id}/outreach/generate`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSubject(data.draft.subject); setBody(data.draft.body);
    } catch { setError('The outreach draft could not be regenerated.'); }
    finally { setRegenerating(false); }
  }

  return <div className={styles.shell}>
    <header className={styles.header}>
      <div className={styles.brand}><span>Y</span><div><strong>YORBIS</strong><small>PROSPECTS</small></div></div>
      <div className={styles.user}>AK</div>
    </header>

    <main>
      <section className={styles.hero}>
        <p className={styles.kicker}>PROSPECT SEARCH</p>
        <h1>Find your next customers.</h1>
        <p className={styles.subtitle}>Describe the businesses you want to reach. Yorbis will research, verify and rank the best matches.</p>
        <form className={styles.searchBox} onSubmit={runSearch}>
          <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={3}
            placeholder="Find 25 California distributors importing from India or Southeast Asia..."
            aria-label="Natural-language prospect search" />
          <div><span>Include industry, geography, size, or international activity</span><button disabled={!query.trim() || searching}>{searching ? 'SEARCHING…' : 'SEARCH PROSPECTS'}</button></div>
        </form>
        <div className={styles.examples}>{examples.map((example) => <button key={example} onClick={() => setQuery(example)}>{example}</button>)}</div>

        {searching && <div className={styles.progressPanel}>
          <div><small>SEARCHING FOR</small><strong>{query}</strong></div>
          <ol>{progressSteps.map((step, index) => <li key={step} className={index <= progress ? styles.progressActive : ''}><span>{index < progress ? '✓' : index + 1}</span>{step}</li>)}</ol>
        </div>}
        {intent && !searching && <div className={styles.intent}>
          <small>SEARCHING FOR</small>
          {[intent.companyType, intent.geography, intent.employeeMin || intent.employeeMax ? `${intent.employeeMin || 0}–${intent.employeeMax || 'any'} employees` : '', ...(intent.internationalMarkets || []), intent.desiredCount ? `${intent.desiredCount} companies` : ''].filter(Boolean).map((item) => <span key={String(item)}>{item}</span>)}
        </div>}
        {error && <div className={styles.error}>{error}</div>}
      </section>

      <section className={styles.content}>
        <aside className={styles.recent}>
          <h2>RECENT SEARCHES</h2>
          {recent.length ? recent.map((item) => <button key={item.id} onClick={() => setQuery(item.query)}><strong>{item.query}</strong><span>{item.result_count} results</span></button>) : <p>No searches yet.</p>}
        </aside>
        <section className={styles.results}>
          <div className={styles.summary}>
            <div><h2>{baseResults.length} prospects found</h2><p>{strong} strong matches · {moderate} moderate · {review} need review</p></div>
            <div className={styles.tabs}>
              <button className={tab === 'best' ? styles.activeTab : ''} onClick={() => setTab('best')}>BEST MATCHES</button>
              <button className={tab === 'all' ? styles.activeTab : ''} onClick={() => setTab('all')}>ALL RESULTS</button>
              <button className={tab === 'review' ? styles.activeTab : ''} onClick={() => setTab('review')}>NEEDS REVIEW</button>
            </div>
          </div>
          {loading ? <div className={styles.skeletons}>{[1,2,3].map((item) => <i key={item} />)}</div> : results.length ? results.map((prospect) => {
            const signals = parseArray<Signal>(prospect.signals_json).slice(0, 4);
            const evidence = parseArray<Evidence>(prospect.evidence_json);
            return <article className={styles.card} key={prospect.id}>
              <div className={styles.cardTop}>
                <div className={styles.logo}>{initials(prospect.company_name)}</div>
                <div className={styles.title}><h3>{prospect.company_name}</h3><p>{prospect.location || 'Unknown'} · {prospect.industry || 'Unknown'} · {prospect.employee_count || 'Unknown size'}</p></div>
                <div className={styles.score}><strong>{prospect.icp_score || 0}</strong><span>{classification(prospect.icp_score)}</span></div>
              </div>
              <div className={styles.match}><small>WHY IT MATCHES</small><p>{prospect.icp_reasoning || 'Evidence is still limited; review before outreach.'}</p></div>
              <div className={styles.signalRow}>{signals.length ? signals.map((signal) => <span key={signal.label} data-status={signal.status}>{signal.label}</span>) : <span data-status="UNKNOWN">Signals unknown</span>}</div>
              <div className={styles.cardBottom}>
                <div><small>BEST YORBIS ANGLE</small><strong>{prospect.research_brief || 'Discovery conversation'}</strong></div>
                <div><small>{evidence.length} VERIFIED SOURCES</small><strong>{prospect.contact_name ? `${prospect.contact_name} · ${prospect.contact_title || 'Decision maker'}` : 'Contact not found'}</strong></div>
                <button onClick={() => openProspect(prospect)}>VIEW PROSPECT</button>
                <button className={styles.primary} onClick={() => openOutreach(prospect)}>CREATE OUTREACH</button>
              </div>
            </article>;
          }) : <div className={styles.empty}><h3>Start with a precise search.</h3><p>Your evidence-backed prospect list will appear here.</p></div>}
        </section>
      </section>
    </main>

    {drawerOpen && selected && <div className={styles.drawerBackdrop} onMouseDown={() => setDrawerOpen(false)}>
      <aside className={styles.drawer} onMouseDown={(event) => event.stopPropagation()}>
        <button className={styles.close} onClick={() => setDrawerOpen(false)}>×</button>
        <header><div className={styles.logoLarge}>{initials(selected.company_name)}</div><div><h2>{selected.company_name}</h2><p>{selected.location || 'Unknown'} · {selected.industry || 'Unknown'} · {selected.employee_count || 'Unknown size'}</p></div><div className={styles.drawerScore}>{selected.icp_score || 0}<small>{selected.confidence || 'LOW'} CONFIDENCE</small></div></header>
        {selected.website && <a className={styles.website} href={selected.website.startsWith('http') ? selected.website : `https://${selected.website}`} target="_blank" rel="noreferrer">{sourceHost(selected.website)} ↗</a>}
        <section><h3>WHY YORBIS</h3><p>{selected.icp_reasoning || 'There is not enough public evidence to make a strong recommendation.'}</p></section>
        <section><h3>BUYING / PAYMENT SIGNALS</h3><div className={styles.drawerSignals}>{parseArray<Signal>(selected.signals_json).map((signal) => <div key={signal.label}><span data-status={signal.status}>{signal.status}</span><p>{signal.label}</p></div>)}</div></section>
        <section><h3>EVIDENCE</h3><div className={styles.evidence}>{parseArray<Evidence>(selected.evidence_json).map((item) => <article key={`${item.claim}-${item.source_url}`}><strong>{item.claim}</strong><small>{item.source_name || sourceHost(item.source_url)}</small><p>{item.summary}</p><a href={item.source_url} target="_blank" rel="noreferrer">OPEN SOURCE ↗</a></article>)}</div></section>
        <section><h3>WHO TO CONTACT</h3>{selected.contact_name ? <div className={styles.contact}><div><strong>{selected.contact_name}</strong><p>{selected.contact_title || 'Role verified'} · {selected.contact_email || 'EMAIL NOT FOUND'}</p>{selected.contact_reason && <small>WHY THIS PERSON · {selected.contact_reason}</small>}</div>{selected.contact_profile_url && <a href={selected.contact_profile_url} target="_blank" rel="noreferrer">PROFILE ↗</a>}</div> : <p className={styles.unknown}>No publicly verified decision maker was found. EMAIL NOT FOUND.</p>}</section>
        <section><h3>RECOMMENDED APPROACH</h3><p>{selected.recommended_approach || 'Ask how the company manages customer collections and vendor payments today.'}</p></section>
        <button className={styles.drawerAction} onClick={() => openOutreach(selected)}>GENERATE OUTREACH</button>
      </aside>
    </div>}

    {outreachOpen && selected && <div className={styles.modalBackdrop} onMouseDown={() => setOutreachOpen(false)}>
      <section className={styles.modal} onMouseDown={(event) => event.stopPropagation()}>
        <button className={styles.close} onClick={() => setOutreachOpen(false)}>×</button>
        <small>OUTREACH DRAFT</small><h2>{selected.company_name}</h2>
        <label>SUBJECT<input value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
        <label>MESSAGE<textarea rows={11} value={body} onChange={(event) => setBody(event.target.value)} /></label>
        <div className={styles.modalActions}><button onClick={regenerate} disabled={regenerating}>{regenerating ? 'REGENERATING…' : 'REGENERATE'}</button><button onClick={() => navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`)}>COPY</button></div>
      </section>
    </div>}
  </div>;
}
