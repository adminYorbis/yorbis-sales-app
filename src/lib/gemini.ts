export interface DecisionMaker {
  name: string;
  email: string;
  role?: string;
  phone?: string;
  sourceUrl?: string;
}

// Export Candidate as an alias to DecisionMaker or its own interface
export interface Candidate {
  name: string;
  email: string;
  company?: string;
  role?: string;
  phone?: string;
  website?: string;
  title?: string;
  snippet?: string;
}

export const geminiService = {
  findDecisionMakers: async (
    _companyName: string,
    _website?: string
  ): Promise<DecisionMaker[]> => {
    void _companyName;
    void _website;
    // Legacy compatibility only. Prospect discovery now returns grounded,
    // source-linked contacts. Never manufacture a person or guess an email.
    return [];
  },

  generateResearchBrief: async (
    companyName: string,
    website?: string
  ): Promise<string> => {
    return `No additional verified research is available for ${companyName}${
      website ? ` (${website})` : ''
    }. Run a new grounded prospect search to collect source-linked evidence.`;
  },

  searchProspects: async (_query: string): Promise<Candidate[]> => {
    void _query;
    // Superseded by POST /api/prospects/discover, which uses grounded search.
    return [];
  },
};

export default geminiService;
