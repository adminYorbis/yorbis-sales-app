import type { DiscoveryIntent as CurrentDiscoveryIntent } from '@/lib/discovery-contract';
import type {
  DiscoveryIntent,
  DiscoveryIntentProposal,
} from '@/domain/yie/contracts';
import type { LegacyDiscoveryMode } from '@/domain/yie/enums';
import { mapLegacyModeValue } from '@/domain/yie/enums';
import { DiscoveryIntentProposalSchema } from '@/domain/yie/schemas';
import { createNewIntent } from '@/domain/yie/intent-policies';

function strings(values: Array<string | undefined>) {
  return [...new Set(values.flatMap((value) => value?.trim() ? [value.trim()] : []))];
}

export function currentModeToYie(mode: LegacyDiscoveryMode) {
  return mapLegacyModeValue(mode);
}

export function currentIntentToYieProposal(
  current: CurrentDiscoveryIntent,
  rawRequest: string,
  legacyMode: LegacyDiscoveryMode,
): DiscoveryIntentProposal {
  const mapping = mapLegacyModeValue(legacyMode);
  const companyType = current.companyType?.trim();
  const industry = current.industry?.trim();
  const requiredSignals = strings([
    ...(current.supplierSignals ?? []),
    ...(current.paymentSignals ?? []),
    current.requiresImportExport ? 'Import/export activity' : undefined,
  ]);
  const preferredSignals = strings([
    ...(mapping.preferenceChange ? current.priorityMarkets ?? [] : []),
    ...(current.internationalMarkets ?? []),
  ]);
  return DiscoveryIntentProposalSchema.parse({
    mode: mapping.mode,
    industries: strings([industry, companyType]),
    geographies: strings([current.geography]),
    companySize: current.employeeMin !== undefined || current.employeeMax !== undefined
      ? { minimum: current.employeeMin, maximum: current.employeeMax }
      : null,
    businessModels: [],
    requiredSignals,
    preferredSignals,
    excludedSignals: strings(current.excludedIndustries ?? []),
    buyerRoles: [],
    desiredResultCount: current.desiredCount ?? 25,
  });
}

export function currentNewIntentToYie(
  current: CurrentDiscoveryIntent,
  input: { id: string; rawRequest: string },
): Readonly<DiscoveryIntent> {
  const proposal = currentIntentToYieProposal(current, input.rawRequest, 'new');
  return createNewIntent({
    id: input.id,
    rawRequest: input.rawRequest,
    industries: proposal.industries,
    geographies: proposal.geographies,
    companySize: proposal.companySize,
    businessModels: proposal.businessModels,
    requiredSignals: proposal.requiredSignals,
    preferredSignals: proposal.preferredSignals,
    excludedSignals: proposal.excludedSignals,
    buyerRoles: proposal.buyerRoles,
    desiredResultCount: proposal.desiredResultCount,
  });
}

export function yieIntentToCurrent(intent: DiscoveryIntent): CurrentDiscoveryIntent {
  const importExportRequired = intent.requiredSignals.some((signal) => /import\/export/i.test(signal));
  return {
    industry: intent.industries[0],
    companyType: intent.industries[1],
    geography: intent.geographies[0],
    employeeMin: intent.companySize?.minimum,
    employeeMax: intent.companySize?.maximum,
    internationalMarkets: [],
    requiresImportExport: importExportRequired || undefined,
    supplierSignals: intent.requiredSignals.filter((signal) => /supplier|sourcing/i.test(signal)),
    paymentSignals: intent.requiredSignals.filter((signal) => /payment|pay-in|payout|contractor/i.test(signal)),
    excludedIndustries: intent.excludedSignals,
    desiredCount: intent.desiredResultCount,
    otherConstraints: [],
    priorityMarkets: intent.preferredSignals,
  };
}
