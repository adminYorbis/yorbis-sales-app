export interface DecisionMaker {
  name: string;
  email: string;
  role?: string;
  phone?: string;
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
    companyName: string,
    website?: string
  ): Promise<DecisionMaker[]> => {
    return [
      {
        name: `Lead Contact at ${companyName}`,
        email: `contact@${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
        role: 'Decision Maker',
      },
    ];
  },

  generateResearchBrief: async (
    companyName: string,
    website?: string
  ): Promise<string> => {
    return `Research brief for ${companyName}${website ? ` (${website})` : ''}:\n- Target Audience: B2B Enterprise\n- Key Focus: CRM & Automation Integration`;
  },

  searchProspects: async (query: string): Promise<Candidate[]> => {
    return [
      {
        name: `Prospect result for ${query}`,
        email: `info@${query.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
        company: query,
        role: 'Lead Prospect',
      },
    ];
  },
};

export default geminiService;