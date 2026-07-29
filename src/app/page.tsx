'use client';

import React, { useState, useEffect } from 'react';

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
  prospect_id: number;
  name: string;
  email: string;
  role?: string;
  phone?: string;
  created_at?: string;
  [key: string]: any;
}

export default function Dashboard() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState('ALL');
  const [expandedProspectId, setExpandedProspectId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    website: '',
    notes: '',
    stage: 'NEW',
  });

  // Fetch Prospects
  const fetchProspects = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/prospects');
      if (!res.ok) throw new Error('Failed to fetch prospects');
      const data = await res.json();
      setProspects(Array.isArray(data) ? data : data.prospects || []);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProspects();
  }, []);

  const handleCreateProspect = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch('/api/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to create prospect');

      setFormData({ name: '', email: '', company: '', website: '', notes: '', stage: 'NEW' });
      setIsModalOpen(false);
      await fetchProspects();
    } catch (err: any) {
      setError(err.message || 'Failed to create prospect');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateResearch = async (id: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/prospects/${id}/research`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to generate research');
      await fetchProspects();
    } catch (err: any) {
      setError(err.message || 'Research generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStageChange = async (id: number, newStage: string) => {
    try {
      const res = await fetch('/api/prospects/update-stage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, stage: newStage }),
      });
      if (!res.ok) throw new Error('Failed to update stage');
      
      const data = await res.json();
      if (data.success) {
        setProspects((prev) =>
          prev.map((p) => (p.id === id ? { ...p, stage: newStage } : p))
        );
      } else {
        setError(data.error || 'Failed to update stage');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update stage');
    }
  };

  const filteredProspects = prospects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.company && p.company.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStage = selectedStage === 'ALL' || p.stage === selectedStage;

    return matchesSearch && matchesStage;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Yorbis CRM</h1>
          <p className="text-slate-400 text-sm mt-1">Prospect Management & Automated Intelligence</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-lg transition"
        >
          + Add Prospect
        </button>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="Search by name, email, or company..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-100 px-4 py-2 rounded-lg flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <select
          value={selectedStage}
          onChange={(e) => setSelectedStage(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-100 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">All Stages</option>
          <option value="NEW">New</option>
          <option value="CONTACTED">Contacted</option>
          <option value="QUALIFIED">Qualified</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {/* Prospects Table */}
      <div className="bg-slate-800/50 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
              <th className="py-3 px-4">Name & Email</th>
              <th className="py-3 px-4">Company</th>
              <th className="py-3 px-4">Stage</th>
              <th className="py-3 px-4">Research Brief</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-sm">
            {loading && prospects.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-500">
                  Loading prospects...
                </td>
              </tr>
            ) : filteredProspects.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-500">
                  No prospects found.
                </td>
              </tr>
            ) : (
              filteredProspects.map((p) => {
                const isExpanded = expandedProspectId === p.id;
                const sourceUrls = p.source_urls
                  ? p.source_urls.split(',').map((s: string) => s.trim()).filter(Boolean)
                  : [];

                return (
                  <React.Fragment key={p.id}>
                    <tr className="hover:bg-slate-800/40 transition cursor-pointer">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{p.name}</div>
                        <div className="text-xs text-slate-400">{p.email}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{p.company || 'N/A'}</td>
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={p.stage || 'NEW'}
                          onChange={(e) => handleStageChange(p.id, e.target.value)}
                          className="bg-slate-900 border border-slate-700 text-slate-200 px-2 py-1 text-xs font-semibold rounded focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        >
                          <option value="NEW">New</option>
                          <option value="CONTACTED">Contacted</option>
                          <option value="QUALIFIED">Qualified</option>
                          <option value="CLOSED">Closed</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {p.research_status === 'COMPLETED' ? (
                          <span className="text-green-400 text-xs">Brief Ready</span>
                        ) : (
                          <span className="text-yellow-500 text-xs">Pending</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleGenerateResearch(p.id)}
                          className="bg-indigo-600 hover:bg-indigo-500 text-xs text-white px-3 py-1.5 rounded transition"
                        >
                          Research
                        </button>
                        <button
                          onClick={() => setExpandedProspectId(isExpanded ? null : p.id)}
                          className="bg-slate-700 hover:bg-slate-600 text-xs text-white px-3 py-1.5 rounded transition"
                        >
                          {isExpanded ? 'Collapse' : 'Details'}
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-slate-800/20">
                        <td colSpan={5} className="p-4 border-t border-b border-slate-800">
                          <div className="space-y-4 text-sm text-slate-300">
                            <div>
                              <h4 className="font-semibold text-slate-200">Notes & Context:</h4>
                              <p className="text-slate-400 mt-1">{p.notes || 'No notes available.'}</p>
                            </div>

                            {p.research_brief && (
                              <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-800">
                                <h4 className="font-semibold text-indigo-400 mb-2">Research Brief:</h4>
                                <pre className="whitespace-pre-wrap font-sans text-xs text-slate-300">
                                  {p.research_brief}
                                </pre>
                              </div>
                            )}

                            {sourceUrls.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-slate-200 mb-1">Sources:</h4>
                                <ul className="list-disc list-inside text-xs text-blue-400">
                                  {sourceUrls.map((url: string, idx: number) => (
                                    <li key={idx}>
                                      <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                        {url}
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Prospect Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Add New Prospect</h2>
            <form onSubmit={handleCreateProspect} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Company</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Website</label>
                <input
                  type="text"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
                >
                  {loading ? 'Saving...' : 'Save Prospect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}