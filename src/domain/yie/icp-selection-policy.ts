import type { ICPAggregate } from './icp-schemas';
import type { PlanningIntent } from './planning-schemas';

export type ICPSelection = {
  selectedICPId: string | null;
  selectedICPVersion: number | null;
  method: 'EXPLICIT_ID' | 'RECOGNIZED_NAME' | 'DETERMINISTIC_MATCH' | 'AI_PROPOSAL' | 'AD_HOC';
  confidence: number;
  competingCandidates: Array<{ id: string; version: number; name: string; score: number }>;
  explanation: string;
  warnings: string[];
};
function tokens(value: string) {
  return new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((item) => item.length > 2));
}
function overlap(left: Set<string>, right: Set<string>) {
  return [...left].filter((value) => right.has(value)).length;
}
export function selectICP(input: {
  rawUserInput: string;
  intent: PlanningIntent;
  activeICPs: ICPAggregate[];
  explicitICPId?: string | null;
  aiProposedICPId?: string | null;
}): ICPSelection {
  if (input.explicitICPId) {
    const exact = input.activeICPs.find((item) => item.definition.id === input.explicitICPId);
    if (!exact) throw new Error(`Explicit ICP ${input.explicitICPId} is not active.`);
    return {
      selectedICPId: exact.definition.id, selectedICPVersion: exact.version.version,
      method: 'EXPLICIT_ID', confidence: 1, competingCandidates: [],
      explanation: 'The explicitly selected active ICP takes precedence.', warnings: [],
    };
  }
  const normalizedQuery = input.rawUserInput.trim().toLowerCase();
  const named = input.activeICPs.find((item) => normalizedQuery.includes(item.version.name.toLowerCase()));
  if (named) return {
    selectedICPId: named.definition.id, selectedICPVersion: named.version.version,
    method: 'RECOGNIZED_NAME', confidence: 0.99, competingCandidates: [],
    explanation: `The request explicitly names ${named.version.name}.`, warnings: [],
  };
  const queryTokens = tokens([
    input.rawUserInput, ...input.intent.targetIndustries, ...input.intent.targetBusinessModels,
    ...input.intent.targetGeographies,
  ].join(' '));
  const ranked = input.activeICPs.map((icp) => {
    const score = overlap(queryTokens, tokens([
      icp.version.name, icp.version.description, icp.version.targetProblem,
      ...icp.version.industryDefinitions, ...icp.version.businessModelDefinitions,
    ].join(' ')));
    return { id: icp.definition.id, version: icp.version.version, name: icp.version.name, score };
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const [first, second] = ranked;
  if (!first || first.score < 2 || (second && first.score === second.score)) {
    if (input.aiProposedICPId) {
      const proposed = input.activeICPs.find((item) => item.definition.id === input.aiProposedICPId);
      if (proposed) return {
        selectedICPId: proposed.definition.id, selectedICPVersion: proposed.version.version,
        method: 'AI_PROPOSAL', confidence: 0.5, competingCandidates: ranked.slice(0, 3),
        explanation: 'AI proposed an active ICP after deterministic selection remained ambiguous.',
        warnings: ['AI-selected ICP requires manual review because deterministic support was insufficient.'],
      };
    }
    return {
    selectedICPId: null, selectedICPVersion: null, method: 'AD_HOC', confidence: first?.score ? 0.4 : 0.1,
    competingCandidates: ranked.slice(0, 3),
    explanation: 'No active ICP has sufficiently distinct deterministic support.',
    warnings: ['ICP selection is ambiguous; using a structured ad hoc intent for manual review.'],
    };
  }
  return {
    selectedICPId: first.id, selectedICPVersion: first.version, method: 'DETERMINISTIC_MATCH',
    confidence: Math.min(0.95, 0.55 + first.score * 0.08), competingCandidates: ranked.slice(1, 4),
    explanation: `${first.name} has the strongest deterministic industry/business-model match.`,
    warnings: [],
  };
}
