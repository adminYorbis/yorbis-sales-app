'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';

type Status = 'VERIFIED' | 'INFERRED' | 'UNKNOWN';
type Signal = { label: string; description?: string; status: Status; category?: string; sourceIds?: string[] };
type Evidence = { claim: string; source_name: string; source_url: string; summary: string; source_id?: string; published_date?: string };
type Timing = { label: string; description: string; date?: string; sourceIds: string[] };
type Prospect = {
  id: string; company_name: string; website?: string; location?: string; industry?: string;
  employee_count?: string; revenue_range?: string; company_description?: string; confidence?: string;
  icp_score?: number; icp_reasoning?: string; research_brief?: string; best_opportunity?: string;
  recommended_approach?: string; recommended_conversation?: string; signals_json?: string;
  unknown_signals_json?: string; evidence_json?: string; why_now_json?: string;
  contact_name?: string; contact_title?: string; contact_email?: string; contact_profile_url?: string;
  contact_source_url?: string; contact_reason?: string; search_run_id?: string;
};
type Intent = {
  companyType?: string; industry?: string; geography?: string; employeeMin?: number; employeeMax?: number;
  revenueRange?: string; internationalMarkets?: string[]; requiresImportExport?: boolean;
  supplierSignals?: string[]; paymentSignals?: string[]; excludedIndustries?: string[];
  verifiedEvidenceRequired?: boolean; desiredCount?: number; otherConstraints?: string[];
};
type SearchRun = {
  id: string; query: string; result_count: number; created_at?: string; intent_json?: string;
  discovery_session_id?: string; request_type?: string;
};
type Channel = 'email' | 'linkedin' | 'call_notes';

const examples = ['California importers', 'Property managers', 'SMBs paying international contractors', 'Manufacturers sourcing from India'];
const progressSteps = ['Discovering companies', 'Checking public evidence', 'Ranking opportunities', 'Finding decision-makers'];

function parseArray<T>(value?: string): T[] { try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function parseIntent(value?: string): Intent { try { return JSON.parse(value || '{}') as Intent; } catch { return {}; } }
function host(url: string) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'Source'; } }
function level(score = 0) { return score >= 80 ? 'Strong Opportunity' : score >= 60 ? 'Moderate Opportunity' : 'Needs Review'; }
function relative(value?: string) {
  if (!value) return '';
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
}
function intentRows(intent: Intent) {
  return [
    ['Company type', intent.companyType], ['Industry', intent.industry], ['Location', intent.geography],
    ['Employees', intent.employeeMin || intent.employeeMax ? `${intent.employeeMin ?? 'Not specified'}–${intent.employeeMax ?? 'Not specified'}` : undefined],
    ['Revenue', intent.revenueRange], ['International markets', intent.internationalMarkets?.join(', ')],
    ['Import/export', intent.requiresImportExport === undefined ? undefined : intent.requiresImportExport ? 'Required' : 'Not required'],
    ['Supplier signals', intent.supplierSignals?.join(', ')], ['Payment signals', intent.paymentSignals?.join(', ')],
    ['Excluded industries', intent.excludedIndustries?.join(', ')],
    ['Verified evidence', intent.verifiedEvidenceRequired === undefined ? undefined : intent.verifiedEvidenceRequired ? 'Required' : 'Preferred'],
    ['Companies requested', intent.desiredCount?.toString()],
  ] as Array<[string, string | undefined]>;
}

export default function Discover() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [results, setResults] = useState<Prospect[]>([]);
  const [recent, setRecent] = useState<SearchRun[]>([]);
  const [query, setQuery] = useState('');
  const [intent, setIntent] = useState<Intent | null>(null);
  const [requestType, setRequestType] = useState('NEW_DISCOVERY_REQUEST');
  const [runId, setRunId] = useState<string>();
  const [sessionId, setSessionId] = useState<string>();
  const [phase, setPhase] = useState<'idle' | 'interpreting' | 'review' | 'discovering'>('idle');
  const [progress, setProgress] = useState(0);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Prospect | null>(null);
  const [tab, setTab] = useState<'recommended' | 'all' | 'review'>('recommended');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [channel, setChannel] = useState<Channel>('email');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftOpen, setDraftOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function loadWorkspace() {
    const [p, s] = await Promise.all([fetch('/api/prospects', { cache: 'no-store' }), fetch('/api/searches', { cache: 'no-store' })]);
    const pd = await p.json(); const sd = await s.json();
    setProspects(pd.prospects || []); setRecent(sd.searches || []);
  }
  useEffect(() => {
    // This authenticated client workspace is hydrated from Turso-backed API routes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadWorkspace().catch(() => setError('Your discoveries could not be loaded. Refresh to try again.'));
  }, []);
  useEffect(() => {
    if (phase !== 'discovering') return;
    const timer = window.setInterval(() => setProgress((value) => Math.min(value + 1, progressSteps.length - 1)), 1800);
    return () => window.clearInterval(timer);
  }, [phase]);

  async function interpret(event: FormEvent) {
    event.preventDefault();
    if (!query.trim() || phase === 'interpreting' || phase === 'discovering') return;
    setError(''); setMessage(''); setPhase('interpreting');
    try {
      const response = await fetch('/api/prospects/discover', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'interpret', query, previousIntent: sessionId ? intent : undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setIntent(data.intent); setRequestType(data.requestType); setPhase('review');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Yorbis could not interpret that request.'); setPhase('idle'); }
  }
  async function discover() {
    if (!intent || phase === 'discovering') return;
    setPhase('discovering'); setProgress(0); setError('');
    try {
      const response = await fetch('/api/prospects/discover', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'discover', query, intent, requestType, parentRunId: runId,
          discoverySessionId: sessionId,
          excludeDomains: requestType === 'EXPAND_CURRENT_RESULTS' ? prospects.map((item) => item.website).filter(Boolean) : [],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const incoming: Prospect[] = data.prospects || [];
      setResults(requestType === 'EXPAND_CURRENT_RESULTS' ? [...results, ...incoming] : incoming);
      setProspects((existing) => {
        const map = new Map(existing.map((item) => [item.id, item]));
        incoming.forEach((item) => map.set(item.id, item));
        return [...map.values()];
      });
      setRunId(data.searchRunId); setSessionId(data.discoverySessionId); setMessage(data.message);
      setRecent((items) => [{ id: data.searchRunId, query, result_count: data.count, created_at: new Date().toISOString(), intent_json: JSON.stringify(intent), discovery_session_id: data.discoverySessionId }, ...items].slice(0, 8));
      setTab('recommended'); setPhase('idle');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Discovery failed. Your previous results remain available.'); setPhase('review'); }
  }
  async function restore(search: SearchRun) {
    setError('');
    try {
      const response = await fetch(`/api/searches?id=${encodeURIComponent(search.id)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setQuery(data.search.query); setIntent(parseIntent(data.search.intent_json)); setResults(data.prospects || []);
      setRunId(data.search.id); setSessionId(data.search.discovery_session_id || data.search.id);
      setMessage(`Restored ${data.prospects?.length || 0} companies from this discovery. No new research was run.`);
    } catch { setError('That discovery could not be restored. You can run it again from the request above.'); }
  }
  function updateIntent(key: keyof Intent, value: string) {
    setIntent((current) => {
      const next = { ...(current || {}) };
      if (['employeeMin', 'employeeMax', 'desiredCount'].includes(key)) (next as Record<string, unknown>)[key] = value ? Number(value) : undefined;
      else if (['internationalMarkets', 'supplierSignals', 'paymentSignals', 'excludedIndustries'].includes(key)) (next as Record<string, unknown>)[key] = value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];
      else (next as Record<string, unknown>)[key] = value || undefined;
      return next;
    });
  }
  function updateInterpretation(label: string, value: string) {
    if (label === 'Employees') {
      const numbers = value.match(/\d+/g)?.map(Number) || [];
      setIntent((current) => ({ ...(current || {}), employeeMin: numbers[0], employeeMax: numbers[1] }));
      return;
    }
    if (label === 'Import/export') {
      setIntent((current) => ({ ...(current || {}), requiresImportExport: /required|yes|true/i.test(value) ? true : /not required|no|false/i.test(value) ? false : undefined }));
      return;
    }
    if (label === 'Verified evidence') {
      setIntent((current) => ({ ...(current || {}), verifiedEvidenceRequired: /required|yes|true/i.test(value) ? true : /preferred|no|false/i.test(value) ? false : undefined }));
      return;
    }
    const keys: Record<string, keyof Intent> = {
      'Company type':'companyType', 'Industry':'industry', 'Location':'geography', 'Revenue':'revenueRange',
      'International markets':'internationalMarkets', 'Supplier signals':'supplierSignals',
      'Payment signals':'paymentSignals', 'Excluded industries':'excludedIndustries', 'Companies requested':'desiredCount',
    };
    if (keys[label]) updateIntent(keys[label], value);
  }
  async function generate(kind: Channel, prospect: Prospect) {
    setSelected(prospect); setChannel(kind); setDraftOpen(true); setGenerating(true); setDraftSubject(''); setDraftBody('');
    try {
      const response = await fetch(`/api/prospects/${prospect.id}/outreach/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: kind }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setDraftSubject(data.draft.subject || ''); setDraftBody(data.draft.body || '');
    } catch { setError('Yorbis could not generate that draft. Please try again.'); setDraftOpen(false); }
    finally { setGenerating(false); }
  }

  const available = results.length ? results : prospects;
  const shown = useMemo(() => available.filter((item) =>
    tab === 'recommended' ? (item.icp_score || 0) >= 80 && parseArray<Evidence>(item.evidence_json).length > 0
      : tab === 'review' ? (item.icp_score || 0) < 60 : true
  ).sort((a, b) => (b.icp_score || 0) - (a.icp_score || 0)), [available, tab]);
  const strong = available.filter((item) => (item.icp_score || 0) >= 80).length;
  const moderate = available.filter((item) => (item.icp_score || 0) >= 60 && (item.icp_score || 0) < 80).length;
  const review = available.filter((item) => (item.icp_score || 0) < 60).length;

  return <div className={styles.shell}>
    <header className={styles.header}>
      <div className={styles.brand}><span>Y</span><div><strong>YORBIS</strong><small>DISCOVER</small></div></div>
      <nav><span>Home</span><strong>Discover</strong><span>Outreach</span><span>Meetings</span></nav>
      <div className={styles.user}>AK</div>
    </header>
    <main>
      <section className={styles.hero}>
        <p className={styles.kicker}>ASK YORBIS</p>
        <h1>What companies are you looking for today?</h1>
        <p className={styles.subtitle}>Describe the businesses you want to reach. Yorbis will discover, investigate and recommend the strongest opportunities.</p>
        <form className={styles.searchBox} onSubmit={interpret}>
          <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={3} placeholder="Find 25 California distributors with 20–200 employees importing from India or Southeast Asia." aria-label="Ask Yorbis" />
          <div><span>You can refine your latest discovery in plain language.</span><button disabled={!query.trim() || phase === 'interpreting' || phase === 'discovering'}>{phase === 'interpreting' ? 'UNDERSTANDING…' : 'DISCOVER COMPANIES'}</button></div>
        </form>
        <div className={styles.examples}>{examples.map((example) => <button key={example} onClick={() => setQuery(example)}>{example}</button>)}</div>

        {phase === 'review' && intent && <section className={styles.interpretation}>
          <div className={styles.interpretHeader}><div><small>YORBIS UNDERSTOOD YOUR REQUEST AS</small><strong>{requestType.replaceAll('_', ' ').toLowerCase()}</strong></div><button onClick={() => setEditing(!editing)}>{editing ? 'Done Editing' : 'Edit Interpretation'}</button></div>
          <div className={styles.interpretGrid}>{intentRows(intent).map(([label, value]) => <label key={label}><span>✓ {label}</span>{editing ? <input value={value || ''} onChange={(event) => updateInterpretation(label, event.target.value)} /> : <strong>{value || 'Not specified'}</strong>}</label>)}</div>
          <button className={styles.confirm} onClick={discover}>Confirm &amp; Discover</button>
        </section>}
        {phase === 'discovering' && <div className={styles.progressPanel}><strong>Yorbis is investigating public business sources.</strong><ol>{progressSteps.map((step, index) => <li key={step} className={index <= progress ? styles.progressActive : ''}><span>{index < progress ? '✓' : index + 1}</span>{step}</li>)}</ol></div>}
        {message && <div className={styles.response}><strong>{message}</strong><p>I ranked them using international activity, company size, payment relevance, current timing and the strength of public evidence.</p></div>}
        {error && <div className={styles.error}>{error}<button onClick={() => setPhase(intent ? 'review' : 'idle')}>Try again</button></div>}
      </section>

      <section className={styles.workspace}>
        <aside className={styles.recent}><h2>Recent</h2>{recent.length ? recent.map((item) => <button key={item.id} onClick={() => restore(item)}><strong>{item.query}</strong><span>{item.result_count} companies · {relative(item.created_at)}</span></button>) : <p>No discoveries yet.</p>}</aside>
        <section className={styles.results}>
          <div className={styles.summary}><div><p>RECOMMENDED FROM YOUR LATEST DISCOVERIES</p><h2>Today&apos;s Recommendations</h2><span>{available.length} companies discovered · {strong} strong · {moderate} moderate · {review} need review</span></div>
            <div className={styles.tabs}><button className={tab === 'recommended' ? styles.activeTab : ''} onClick={() => setTab('recommended')}>Recommended Today</button><button className={tab === 'all' ? styles.activeTab : ''} onClick={() => setTab('all')}>All Companies</button><button className={tab === 'review' ? styles.activeTab : ''} onClick={() => setTab('review')}>Needs Review</button></div>
          </div>
          {shown.length ? shown.map((company) => {
            const signals = parseArray<Signal>(company.signals_json);
            const evidence = parseArray<Evidence>(company.evidence_json);
            const inferred = signals.filter((signal) => signal.status === 'INFERRED').length;
            return <article className={styles.card} key={company.id}>
              <div className={styles.cardTop}><div><h3>{company.company_name}</h3><p>{company.industry || 'Industry unknown'} · {company.location || 'Location unknown'} · {company.employee_count || 'Company size unknown'}</p></div><div className={styles.score}><strong>{company.icp_score || 0}</strong><span>Opportunity</span></div></div>
              <div className={styles.cardBody}><div><small>WHY WE RECOMMEND THEM</small><p>{company.icp_reasoning || 'This company requires further review before outreach.'}</p></div><div><small>BEST OPPORTUNITY</small><strong>{company.best_opportunity || company.research_brief || 'Discovery conversation'}</strong></div></div>
              <div className={styles.cardMeta}><span>{evidence.length} verified sources</span><span>{inferred} inferred signals</span><span>{company.contact_name ? `${company.contact_name} · ${company.contact_title || 'Decision-maker'}` : 'No verified decision-maker found'}</span></div>
              <div className={styles.cardActions}><button onClick={() => setSelected(company)}>Investigate</button><button onClick={() => generate('email', company)}>Email</button><button onClick={() => generate('linkedin', company)}>LinkedIn</button><button onClick={() => generate('call_notes', company)}>Call Notes</button></div>
            </article>;
          }) : <div className={styles.empty}><h3>No recommendations to show here.</h3><p>Ask Yorbis for a new discovery or view All Companies.</p></div>}
        </section>
      </section>
    </main>

    {selected && !draftOpen && <div className={styles.drawerBackdrop} onMouseDown={() => setSelected(null)}><aside className={styles.drawer} onMouseDown={(event) => event.stopPropagation()}>
      <button className={styles.close} onClick={() => setSelected(null)}>×</button><p className={styles.kicker}>INVESTIGATION</p>
      <header><div><h2>{selected.company_name}</h2><p>{selected.location || 'Unknown'} · {selected.industry || 'Unknown'} · {selected.employee_count || 'Unknown size'}</p></div><div className={styles.drawerScore}>{selected.icp_score || 0}<small>{level(selected.icp_score)}</small></div></header>
      {selected.website && <a className={styles.website} href={selected.website} target="_blank" rel="noreferrer">{host(selected.website)} ↗</a>}
      <section><h3>Executive Summary</h3><p>{selected.company_description} {selected.icp_reasoning || 'Public information remains limited.'}</p></section>
      <section><h3>Why Yorbis</h3><ul>{parseArray<Signal>(selected.signals_json).slice(0, 3).map((signal) => <li key={signal.label}>{signal.label}</li>)}</ul></section>
      <section><h3>What We Found</h3>
        {(['VERIFIED', 'INFERRED'] as Status[]).map((status) => <div className={styles.findingGroup} key={status}><h4>{status === 'VERIFIED' ? 'Verified' : 'Inferred'}</h4>{parseArray<Signal>(selected.signals_json).filter((signal) => signal.status === status).map((signal) => <article key={signal.label}><strong>{signal.label}</strong><p>{signal.description}</p>{status === 'VERIFIED' && signal.sourceIds?.map((id) => {
          const source = parseArray<Evidence>(selected.evidence_json).find((item) => item.source_id === id); return source ? <a key={id} href={source.source_url} target="_blank" rel="noreferrer">Open Source · {source.source_name} ↗</a> : null;
        })}</article>)}</div>)}
        <div className={styles.findingGroup}><h4>Unknown</h4>{parseArray<Signal>(selected.unknown_signals_json).length ? parseArray<Signal>(selected.unknown_signals_json).map((signal) => <article key={signal.label}><strong>{signal.label}</strong><p>{signal.description || 'Not enough reliable public information.'}</p></article>) : <p>Current payment provider, payment volume and internal workflows are not publicly confirmed.</p>}</div>
      </section>
      <section><h3>Why Now?</h3>{parseArray<Timing>(selected.why_now_json).length ? parseArray<Timing>(selected.why_now_json).map((timing) => <article className={styles.timing} key={timing.label}><strong>{timing.label}</strong><small>{timing.date || 'Date not available'}</small><p>{timing.description}</p></article>) : <p>No strong current timing signal found.</p>}</section>
      <section><h3>Best Person to Contact</h3>{selected.contact_name ? <div className={styles.contact}><strong>{selected.contact_name}</strong><p>{selected.contact_title} · {selected.contact_email || 'Email not found'}</p><small>{selected.contact_reason}</small>{selected.contact_profile_url && <a href={selected.contact_profile_url} target="_blank" rel="noreferrer">Public profile ↗</a>}</div> : <p>No verified decision-maker found.</p>}</section>
      <section><h3>Recommended First Conversation</h3><p>{selected.recommended_conversation || selected.recommended_approach || 'Ask how the company manages international collections and vendor payments today.'}</p></section>
      <div className={styles.drawerActions}><button onClick={() => generate('email', selected)}>Email</button><button onClick={() => generate('linkedin', selected)}>LinkedIn</button><button onClick={() => generate('call_notes', selected)}>Call Notes</button></div>
    </aside></div>}

    {draftOpen && selected && <div className={styles.modalBackdrop} onMouseDown={() => setDraftOpen(false)}><section className={styles.modal} onMouseDown={(event) => event.stopPropagation()}>
      <button className={styles.close} onClick={() => setDraftOpen(false)}>×</button><small>{channel.replace('_', ' ').toUpperCase()}</small><h2>{selected.company_name}</h2>
      {generating ? <div className={styles.draftLoading}>Preparing an evidence-based draft…</div> : <>
        {channel === 'email' && <label>SUBJECT<input value={draftSubject} onChange={(event) => setDraftSubject(event.target.value)} /></label>}
        <label>{channel === 'call_notes' ? 'NOTES' : 'MESSAGE'}<textarea rows={13} value={draftBody} onChange={(event) => setDraftBody(event.target.value)} /></label>
        <div className={styles.modalActions}><button onClick={() => generate(channel, selected)}>Regenerate</button><button onClick={() => navigator.clipboard.writeText(channel === 'email' ? `Subject: ${draftSubject}\n\n${draftBody}` : draftBody)}>Copy</button></div>
      </>}
    </section></div>}
  </div>;
}
