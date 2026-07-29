'use client';

import { useState, useEffect } from 'react';

interface Prospect {
  id: number;
  company_name: string;
  email: string;
  icp_score: number;
  icp_reasoning: string;
  outreach_angle: string;
  stage: string;
  created_at: string;
}

export default function CEOExecutiveDashboard() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchPrompt, setSearchPrompt] = useState('');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [filterStage, setFilterStage] = useState('ALL');

  const fetchProspects = async () => {
    try {
      const res = await fetch('/api/prospects');
      const data = await res.json();
      setProspects(data.prospects || []);
    } catch (err) {
      console.error(err);
      setProspects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProspects();
  }, []);

  const handleStageChange = async (id: number, newStage: string) => {
    setProspects(prev => prev.map(p => p.id === id ? { ...p, stage: newStage } : p));
    await fetch('/api/prospects/update-stage', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, stage: newStage }),
    });
  };

  const handleDiscover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPrompt) return;
    setIsDiscovering(true);
    try {
      await fetch('/api/prospects/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchPrompt }),
      });
      setSearchPrompt('');
      await fetchProspects();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDiscovering(false);
    }
  };

  // Metrics calculation
  const totalLeads = prospects.length;
  const highIcpLeads = prospects.filter(p => p.icp_score >= 80).length;
  const qualifiedLeads = prospects.filter(p => p.stage === 'QUALIFIED').length;

  const filteredProspects = prospects.filter(p => 
    filterStage === 'ALL' ? true : p.stage === filterStage
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-sans">
      {/* Top Header */}
      <div className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Yorbis Sales Command</h1>
          <p className="text-xs text-zinc-400">Autonomous Prospect Intelligence & Pipeline Automation</p>
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          ● System Operational
        </span>
      </div>

      {/* Executive Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <p className="text-xs font-medium text-zinc-400">Total Prospects Discovered</p>
          <p className="text-3xl font-bold mt-1 text-white">{totalLeads}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <p className="text-xs font-medium text-zinc-400">High ICP Fits (Score ≥ 80)</p>
          <p className="text-3xl font-bold mt-1 text-emerald-400">{highIcpLeads}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <p className="text-xs font-medium text-zinc-400">Active Pipeline Qualified</p>
          <p className="text-3xl font-bold mt-1 text-blue-400">{qualifiedLeads}</p>
        </div>
      </div>

      {/* AI Grounding Lead Discovery Bar */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl mb-8">
        <h2 className="text-sm font-semibold text-zinc-200 mb-2">Run Gemini Autonomous Lead Discovery</h2>
        <form onSubmit={handleDiscover} className="flex gap-3">
          <input
            type="text"
            value={searchPrompt}
            onChange={(e) => setSearchPrompt(e.target.value)}
            placeholder="Target ICP (e.g., Series-A B2B SaaS companies in California needing AI CRM)..."
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={isDiscovering}
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition disabled:opacity-50 flex items-center gap-2"
          >
            {isDiscovering ? 'Scanning Web with Gemini...' : 'Search & Discover'}
          </button>
        </form>
      </div>

      {/* Pipeline Controls & Data Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-zinc-200">Prospect Intelligence Table</h3>
          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 rounded-md px-3 py-1.5 focus:outline-none"
          >
            <option value="ALL">All Stages</option>
            <option value="NEW">New</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="CONTACTED">Contacted</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>

        {loading ? (
          <div className="p-8 text-center text-zinc-500 text-sm">Loading intelligence pipeline...</div>
        ) : filteredProspects.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-sm">No prospects found. Use the search bar above to generate fresh leads.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-950 text-xs uppercase text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-3">Company / Email</th>
                  <th className="px-6 py-3">ICP Score</th>
                  <th className="px-6 py-3">Stage</th>
                  <th className="px-6 py-3">Outreach Angle</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredProspects.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-800/50 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{p.company_name}</div>
                      <div className="text-xs text-zinc-400">{p.email || 'No Email Discovered'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${
                        p.icp_score >= 80 ? 'bg-emerald-500/10 text-emerald-400' :
                        p.icp_score >= 50 ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        {p.icp_score} / 100
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={p.stage || 'NEW'}
                        onChange={(e) => handleStageChange(p.id, e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded px-2 py-1 focus:outline-none"
                      >
                        <option value="NEW">NEW</option>
                        <option value="QUALIFIED">QUALIFIED</option>
                        <option value="CONTACTED">CONTACTED</option>
                        <option value="ARCHIVED">ARCHIVED</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate text-xs text-zinc-400">
                      {p.outreach_angle || p.icp_reasoning || 'No angle generated.'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedProspect(p)}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium underline"
                      >
                        View Brief
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-Over Detail Drawer */}
      {selectedProspect && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-end z-50">
          <div className="bg-zinc-900 border-l border-zinc-800 w-full max-w-md h-full p-6 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-white">{selectedProspect.company_name}</h2>
                <button 
                  onClick={() => setSelectedProspect(null)}
                  className="text-zinc-400 hover:text-white text-xl font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6 text-sm">
                <div>
                  <p className="text-xs font-medium text-zinc-400 uppercase">Contact Email</p>
                  <p className="text-zinc-200 mt-1 font-mono">{selectedProspect.email || 'N/A'}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-zinc-400 uppercase mb-1">ICP Fit Reasoning</p>
                  <p className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-zinc-300 leading-relaxed text-xs">
                    {selectedProspect.icp_reasoning || 'No specific reasoning captured.'}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-zinc-400 uppercase mb-1">Recommended Outreach Angle</p>
                  <p className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-emerald-400/90 leading-relaxed text-xs">
                    {selectedProspect.outreach_angle || 'No outreach angle generated.'}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedProspect(null)}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-2 rounded-lg text-sm mt-6"
            >
              Close Brief
            </button>
          </div>
        </div>
      )}
    </div>
  );
}