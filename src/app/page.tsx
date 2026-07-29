'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';

type Prospect = {
  id: string;
  company_name: string;
  website?: string;
  contact_name?: string;
  contact_title?: string;
  contact_email?: string;
  location?: string;
  industry?: string;
  icp_score?: number;
  icp_reasoning?: string;
  outreach_angle?: string;
  contract_intel?: string;
  research_brief?: string;
  source_urls?: string;
  stage?: string;
};

const examples = [
  'Find US distributors importing consumer goods from India',
  'Find California property managers with 20–200 employees',
  'Find SMBs paying international contractors every month',
];

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function sourcesFor(prospect: Prospect) {
  if (!prospect.source_urls) return [];
  try {
    const parsed = JSON.parse(prospect.source_urls);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return prospect.source_urls.split(/[\n,]/).map((value) => value.trim()).filter(Boolean);
  }
}

function sourceHost(source: string) {
  try {
    return new URL(source).hostname.replace('www.', '');
  } catch {
    return source;
  }
}

export default function ProspectSearch() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selected, setSelected] = useState<Prospect | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'priority' | 'new'>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [outreachOpen, setOutreachOpen] = useState(false);

  async function loadProspects(selectFirst = false) {
    const response = await fetch('/api/prospects', { cache: 'no-store' });
    const data = await response.json();
    const next = (data.prospects || []) as Prospect[];
    setProspects(next);
    if (selectFirst && next.length) setSelected(next[0]);
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch('/api/prospects', { cache: 'no-store' });
        const data = await response.json();
        if (!active) return;
        const next = (data.prospects || []) as Prospect[];
        setProspects(next);
        if (next.length) setSelected(next[0]);
        const saved = window.localStorage.getItem('yorbis-recent-searches');
        if (saved) setRecentSearches(JSON.parse(saved));
      } catch {
        if (active) setError('Prospects could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function search(event: FormEvent) {
    event.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery || searching) return;
    setSearching(true);
    setError('');
    try {
      const response = await fetch('/api/prospects/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: cleanQuery }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Search failed');
      const recent = [cleanQuery, ...recentSearches.filter((item) => item !== cleanQuery)].slice(0, 4);
      setRecentSearches(recent);
      window.localStorage.setItem('yorbis-recent-searches', JSON.stringify(recent));
      await loadProspects(true);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Search failed. Try again.');
    } finally {
      setSearching(false);
    }
  }

  const ranked = useMemo(() => {
    return [...prospects]
      .filter((prospect) => filter === 'priority' ? (prospect.icp_score || 0) >= 80 : filter === 'new' ? (prospect.stage || 'NEW') === 'NEW' : true)
      .sort((a, b) => (b.icp_score || 0) - (a.icp_score || 0));
  }, [prospects, filter]);

  const selectedSources = selected ? sourcesFor(selected) : [];

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.mark}>Y</div>
          <div>
            <strong>Yorbis</strong>
            <span>Prospect intelligence</span>
          </div>
        </div>
        <nav aria-label="Primary navigation">
          <button className={styles.navActive}>Prospects</button>
          <button>Outreach</button>
          <button>Meetings</button>
        </nav>
        <button className={styles.avatar} aria-label="Open account menu">AK</button>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.eyebrow}><span /> Prospect search</div>
          <h1>Who should Yorbis talk to next?</h1>
          <p>Describe your ideal customer. Yorbis will find, research, and rank companies using evidence from the web.</p>
          <form className={styles.search} onSubmit={search}>
            <span className={styles.searchIcon}>⌕</span>
            <textarea
              rows={2}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find 25 US distributors that source products internationally and may pay suppliers in India…"
              aria-label="Describe the prospects you want to find"
            />
            <div className={styles.searchFooter}>
              <span>Use a market, location, company size, or payment signal</span>
              <button type="submit" disabled={!query.trim() || searching}>
                {searching ? <><i className={styles.spinner} /> Researching</> : <>Find prospects <b>→</b></>}
              </button>
            </div>
          </form>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.examples}>
            <span>Try:</span>
            {examples.map((example) => <button key={example} onClick={() => setQuery(example)}>{example}</button>)}
          </div>
        </section>

        <section className={styles.workspace}>
          <aside className={styles.searchRail}>
            <h2>Searches</h2>
            <button className={styles.savedActive}><span>✦</span> Best prospects</button>
            <button><span>◷</span> Recently added <em>{prospects.filter((p) => (p.stage || 'NEW') === 'NEW').length}</em></button>
            <div className={styles.divider} />
            <h3>Recent</h3>
            {recentSearches.length ? recentSearches.map((item) => (
              <button key={item} onClick={() => setQuery(item)} className={styles.recentItem}>{item}</button>
            )) : <p className={styles.muted}>Your searches will appear here.</p>}
          </aside>

          <section className={styles.results}>
            <div className={styles.resultsHeader}>
              <div>
                <h2>Ranked prospects</h2>
                <p>{ranked.length} companies · strongest fit first</p>
              </div>
              <div className={styles.filters}>
                {(['all', 'priority', 'new'] as const).map((item) => (
                  <button key={item} className={filter === item ? styles.filterActive : ''} onClick={() => setFilter(item)}>
                    {item === 'all' ? 'All' : item === 'priority' ? 'Priority 80+' : 'New'}
                  </button>
                ))}
              </div>
            </div>

            {loading ? <div className={styles.empty}>Loading prospects…</div> : ranked.length === 0 ? (
              <div className={styles.empty}>
                <div>⌕</div>
                <h3>No matching prospects yet</h3>
                <p>Run a natural-language search above to build your first ranked list.</p>
              </div>
            ) : ranked.map((prospect, index) => (
              <button
                key={prospect.id}
                className={`${styles.prospectCard} ${selected?.id === prospect.id ? styles.selectedCard : ''}`}
                onClick={() => setSelected(prospect)}
              >
                <span className={styles.rank}>{index + 1}</span>
                <span className={styles.companyLogo}>{initials(prospect.company_name)}</span>
                <span className={styles.companySummary}>
                  <strong>{prospect.company_name}</strong>
                  <small>{[prospect.industry, prospect.location].filter(Boolean).join(' · ') || 'Company details being verified'}</small>
                  <span>{prospect.icp_reasoning || prospect.contract_intel || 'Research summary not yet available.'}</span>
                </span>
                <span className={styles.scoreBlock}>
                  <strong>{prospect.icp_score || 0}</strong>
                  <small>FIT SCORE</small>
                </span>
                <span className={styles.chevron}>›</span>
              </button>
            ))}
          </section>

          <aside className={styles.detail}>
            {!selected ? <div className={styles.detailEmpty}>Select a company to see its evidence and next action.</div> : (
              <>
                <div className={styles.detailTop}>
                  <span className={styles.companyLogoLarge}>{initials(selected.company_name)}</span>
                  <div>
                    <h2>{selected.company_name}</h2>
                    <p>{selected.location || 'Location not verified'}</p>
                  </div>
                  <span className={styles.fitPill}>{selected.icp_score || 0} fit</span>
                </div>
                {selected.website && <a className={styles.website} href={selected.website.startsWith('http') ? selected.website : `https://${selected.website}`} target="_blank" rel="noreferrer">{selected.website} ↗</a>}

                <div className={styles.detailSection}>
                  <div className={styles.sectionLabel}>Why this company fits</div>
                  <p>{selected.icp_reasoning || 'No verified fit explanation is available yet.'}</p>
                </div>

                <div className={styles.detailSection}>
                  <div className={styles.sectionLabel}>Evidence & signals</div>
                  <ul className={styles.signals}>
                    {(selected.contract_intel || selected.research_brief || 'Research evidence has not been captured yet.')
                      .split(/\n|•|;/).map((signal) => signal.replace(/^[-–]\s*/, '').trim()).filter(Boolean).slice(0, 4)
                      .map((signal) => <li key={signal}><span>✓</span>{signal}</li>)}
                  </ul>
                </div>

                <div className={styles.detailSection}>
                  <div className={styles.sectionLabel}>Best contact</div>
                  {selected.contact_name ? (
                    <div className={styles.contact}>
                      <span>{initials(selected.contact_name)}</span>
                      <div><strong>{selected.contact_name}</strong><small>{selected.contact_title || 'Decision maker'}{selected.contact_email ? ` · ${selected.contact_email}` : ' · Email not verified'}</small></div>
                    </div>
                  ) : <div className={styles.unknownContact}><span>?</span><div><strong>Decision maker not verified</strong><small>Yorbis will never invent contact details.</small></div></div>}
                </div>

                <div className={styles.detailSection}>
                  <div className={styles.sectionLabel}>Sources</div>
                  {selectedSources.length ? selectedSources.slice(0, 4).map((source, index) => (
                    <a className={styles.source} key={source} href={source} target="_blank" rel="noreferrer"><span>{index + 1}</span>{sourceHost(source)}<b>↗</b></a>
                  )) : <p className={styles.muted}>No source URLs were stored for this prospect.</p>}
                </div>

                <button className={styles.outreachButton} onClick={() => setOutreachOpen(true)}>Generate outreach <span>→</span></button>
              </>
            )}
          </aside>
        </section>
      </main>

      {outreachOpen && selected && (
        <div className={styles.modalBackdrop} onMouseDown={() => setOutreachOpen(false)}>
          <div className={styles.modal} onMouseDown={(event) => event.stopPropagation()}>
            <button className={styles.close} onClick={() => setOutreachOpen(false)}>×</button>
            <span className={styles.modalEyebrow}>Outreach draft</span>
            <h2>Start a conversation with {selected.company_name}</h2>
            <label>Subject<input readOnly value="A quick question about your payment workflow" /></label>
            <label>Message<textarea readOnly rows={9} value={selected.outreach_angle || `Hi ${selected.contact_name?.split(' ')[0] || 'there'},\n\nI was looking at ${selected.company_name} and thought Yorbis may be relevant to how your team handles customer collections and vendor payments.\n\nWe help growing businesses get paid, pay vendors, and move money globally from one platform—with no monthly fee to get started.\n\nWould you be open to a quick 15-minute conversation?\n\nBest,\nAnant`} /></label>
            <div className={styles.modalActions}><button className={styles.secondaryButton} onClick={() => navigator.clipboard.writeText(selected.outreach_angle || '')}>Copy draft</button><button className={styles.primaryButton}>Approve draft</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
