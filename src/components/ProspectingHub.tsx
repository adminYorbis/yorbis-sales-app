'use client';

import { useState, useEffect } from 'react';

interface Prospect {
  id: string;
  company_name: string;
  website: string;
  contact_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  location: string | null;
  contract_intel: string | null;
  icp_score: number;
  icp_reasoning: string | null;
  outreach_angle: string | null;
  status: string;
}

export default function ProspectingHub() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial prospects list
  const fetchProspects = async () => {
    try {
      const res = await fetch('/api/prospects');
      if (res.ok) {
        const data = await res.json();
        setProspects(data.prospects || []);
      }
    } catch (err) {
      console.error('Failed to load prospects', err);
    }
  };

  useEffect(() => {
    fetchProspects();
  }, []);

  // Handle discovery submit
  const handleDiscover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/prospects/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: companyName, website }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to discover prospect');
      }

      // Add newly discovered prospect to state
      setProspects((prev) => [data.prospect, ...prev]);
      setCompanyName('');
      setWebsite('');
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Yorbis Prospecting Hub
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Automated sales intelligence & ICP discovery powered by Gemini.
        </p>
      </div>

      {/* Trigger Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Discover New Target Prospect
        </h2>
        
        <form onSubmit={handleDiscover} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Company Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Stripe, Acme Corp"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Website Domain (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. stripe.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Analyzing & Researching...</span>
              ) : (
                <span>Run Discovery</span>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg">
            {error}
          </div>
        )}
      </div>

      {/* Prospects Feed / Intelligence Table */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          Discovered Prospects ({prospects.length})
        </h2>

        {prospects.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              No prospects discovered yet. Run your first search above!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {prospects.map((p) => (
              <div
                key={p.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {p.company_name}
                    </h3>
                    {p.website && (
                      <a
                        href={`https://${p.website.replace(/^https?:\/\//, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {p.website}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {p.status}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                        p.icp_score >= 80
                          ? 'bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-400'
                          : p.icp_score >= 50
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                          : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400'
                      }`}
                    >
                      ICP Fit: {p.icp_score}/100
                    </span>
                  </div>
                </div>

                {/* Contact & Location */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs border-y border-slate-100 dark:border-slate-800/80 py-3 text-slate-600 dark:text-slate-400">
                  <div>
                    <span className="font-semibold block text-slate-900 dark:text-slate-200">
                      Decision Maker:
                    </span>
                    {p.contact_name ? `${p.contact_name} (${p.contact_title || 'N/A'})` : 'None detected'}
                  </div>
                  <div>
                    <span className="font-semibold block text-slate-900 dark:text-slate-200">
                      Email Contact:
                    </span>
                    {p.contact_email || 'N/A'}
                  </div>
                  <div>
                    <span className="font-semibold block text-slate-900 dark:text-slate-200">
                      Location:
                    </span>
                    {p.location || 'N/A'}
                  </div>
                </div>

                {/* Intelligence Highlights */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {p.contract_intel && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <span className="font-semibold block text-slate-900 dark:text-slate-200 mb-1">
                        Contract Intelligence & Tech Stack
                      </span>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        {p.contract_intel}
                      </p>
                    </div>
                  )}

                  {p.outreach_angle && (
                    <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-lg">
                      <span className="font-semibold block text-blue-950 dark:text-blue-300 mb-1">
                        Automated Outreach Hook
                      </span>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        "{p.outreach_angle}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}