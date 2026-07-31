import type { Client, InStatement } from '@libsql/client';
import type { DiscoveryPlanningRepository } from '@/application/yie/discovery/discovery-planning-repository';
import {
  DiscoveryIntentVersionSchema, DiscoverySessionEventSchema, DiscoverySessionSchema,
  SearchPlanSchema, ShadowComparisonSchema, type DiscoveryIntentVersion, type DiscoverySession,
  type DiscoverySessionEvent, type SearchPlan, type ShadowComparison,
} from '@/domain/yie/planning-schemas';

const json = (value: unknown) => JSON.stringify(value);
const parse = (value: unknown) => JSON.parse(String(value));

export class TursoDiscoveryPlanningRepository implements DiscoveryPlanningRepository {
  constructor(private readonly client: Client) {}

  async createSession(session: DiscoverySession, events: DiscoverySessionEvent[]) {
    const value = DiscoverySessionSchema.parse(session);
    const statements: InStatement[] = [{
      sql: `INSERT INTO yie_discovery_sessions
        (id,external_correlation_id,actor_id,status,lifecycle_mode,created_at,updated_at,completed_at,
         failed_at,failure_code,current_intent_version,selected_solution_profile_id,selected_solution_profile_version,
         selected_icp_id,selected_icp_version,production_discovery_reference,shadow_only,provenance_json,metadata_json)
        VALUES (${Array(19).fill('?').join(',')})`,
      args: [value.id, value.externalCorrelationId, value.actorId, value.status, value.lifecycleMode,
        value.createdAt, value.updatedAt, value.completedAt, value.failedAt, value.failureCode,
        value.currentIntentVersion, value.selectedSolutionProfileId, value.selectedSolutionProfileVersion,
        value.selectedICPId, value.selectedICPVersion, value.productionDiscoveryReference, 1,
        json(value.provenance), json(value.metadata)],
    }, ...events.map((event) => this.eventStatement(event))];
    await this.client.batch(statements, 'write');
  }
  async getSession(id: string) {
    const result = await this.client.execute({ sql: 'SELECT * FROM yie_discovery_sessions WHERE id=?', args: [id] });
    const row = result.rows[0];
    return row ? DiscoverySessionSchema.parse({
      id: row.id, externalCorrelationId: row.external_correlation_id, actorId: row.actor_id,
      status: row.status, lifecycleMode: row.lifecycle_mode, createdAt: row.created_at, updatedAt: row.updated_at,
      completedAt: row.completed_at, failedAt: row.failed_at, failureCode: row.failure_code,
      currentIntentVersion: Number(row.current_intent_version),
      selectedSolutionProfileId: row.selected_solution_profile_id,
      selectedSolutionProfileVersion: Number(row.selected_solution_profile_version),
      selectedICPId: row.selected_icp_id, selectedICPVersion: row.selected_icp_version === null ? null : Number(row.selected_icp_version),
      productionDiscoveryReference: row.production_discovery_reference, shadowOnly: Boolean(row.shadow_only),
      provenance: parse(row.provenance_json), metadata: parse(row.metadata_json),
    }) : null;
  }
  async updateSessionState(input: {
    id: string; expectedStatus?: DiscoverySession['status']; status: DiscoverySession['status'];
    updatedAt: string; currentIntentVersion?: number; completedAt?: string | null;
    failedAt?: string | null; failureCode?: string | null;
  }) {
    const result = await this.client.execute({
      sql: `UPDATE yie_discovery_sessions SET status=?,updated_at=?,
        current_intent_version=COALESCE(?,current_intent_version),completed_at=COALESCE(?,completed_at),
        failed_at=COALESCE(?,failed_at),failure_code=COALESCE(?,failure_code)
        WHERE id=? AND (? IS NULL OR status=?)`,
      args: [input.status, input.updatedAt, input.currentIntentVersion ?? null, input.completedAt ?? null,
        input.failedAt ?? null, input.failureCode ?? null, input.id, input.expectedStatus ?? null, input.expectedStatus ?? null],
    });
    if (Number(result.rowsAffected) !== 1) throw new Error('Discovery Session state transition failed.');
  }
  async updateSessionICP(input: { id: string; icpId: string | null; icpVersion: number | null; updatedAt: string }) {
    const result = await this.client.execute({
      sql: 'UPDATE yie_discovery_sessions SET selected_icp_id=?,selected_icp_version=?,updated_at=? WHERE id=?',
      args: [input.icpId, input.icpVersion, input.updatedAt, input.id],
    });
    if (Number(result.rowsAffected) !== 1) throw new Error('Discovery Session ICP pin update failed.');
  }
  async updateSessionMode(input: { id: string; mode: DiscoverySession['lifecycleMode']; status: DiscoverySession['status']; updatedAt: string }) {
    const result = await this.client.execute({
      sql: 'UPDATE yie_discovery_sessions SET lifecycle_mode=?,status=?,updated_at=?,completed_at=NULL WHERE id=?',
      args: [input.mode, input.status, input.updatedAt, input.id],
    });
    if (Number(result.rowsAffected) !== 1) throw new Error('Discovery Session mode transition failed.');
  }
  async appendEvent(event: DiscoverySessionEvent) { await this.client.execute(this.eventStatement(event)); }
  async listEvents(sessionId: string) {
    const result = await this.client.execute({ sql: 'SELECT * FROM yie_discovery_session_events WHERE session_id=? ORDER BY sequence', args: [sessionId] });
    return result.rows.map((row) => DiscoverySessionEventSchema.parse({
      id: row.id, sessionId: row.session_id, sequence: Number(row.sequence), type: row.event_type,
      occurredAt: row.occurred_at, actorId: row.actor_id, payload: parse(row.payload_json),
    }));
  }
  async insertIntentVersion(intent: DiscoveryIntentVersion) {
    const value = DiscoveryIntentVersionSchema.parse(intent);
    const result = await this.client.batch([{
      sql: `INSERT INTO yie_discovery_intent_versions
        (session_id,version,parent_version,mode,raw_user_input,normalized_intent_json,patch_json,explanation,
         selected_solution_profile_id,selected_solution_profile_version,selected_icp_id,selected_icp_version,
         created_at,created_by,provenance_json,proposal_metadata_json,validation_result_json,warnings_json)
        VALUES (${Array(18).fill('?').join(',')})`,
      args: [value.sessionId, value.version, value.parentVersion, value.mode, value.rawUserInput,
        json(value.normalizedIntent), value.patch ? json(value.patch) : null, value.explanation,
        value.selectedSolutionProfileId, value.selectedSolutionProfileVersion, value.selectedICPId,
        value.selectedICPVersion, value.createdAt, value.createdBy, json(value.provenance),
        value.proposalMetadata ? json(value.proposalMetadata) : null, json(value.validationResult), json(value.warnings)],
    }, {
      sql: 'UPDATE yie_discovery_sessions SET current_intent_version=?,updated_at=? WHERE id=? AND current_intent_version=?',
      args: [value.version, value.createdAt, value.sessionId, value.version - 1],
    }], 'write');
    if (Number(result[1].rowsAffected) !== 1) throw new Error('Intent version must append sequentially.');
  }
  async getIntentVersion(sessionId: string, version: number) {
    const result = await this.client.execute({ sql: 'SELECT * FROM yie_discovery_intent_versions WHERE session_id=? AND version=?', args: [sessionId, version] });
    return result.rows[0] ? this.parseIntent(result.rows[0]) : null;
  }
  async listIntentVersions(sessionId: string) {
    const result = await this.client.execute({ sql: 'SELECT * FROM yie_discovery_intent_versions WHERE session_id=? ORDER BY version', args: [sessionId] });
    return result.rows.map((row) => this.parseIntent(row));
  }
  async insertSearchPlan(plan: SearchPlan) {
    const value = SearchPlanSchema.parse(plan);
    const statements: InStatement[] = [{
      sql: `INSERT INTO yie_search_plans
        (session_id,intent_version,plan_version,solution_profile_id,solution_profile_version,
         icp_id,icp_version,plan_json,fingerprint,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      args: [value.sessionId, value.intentVersion, value.planVersion, value.solutionProfileId,
        value.solutionProfileVersion, value.icpId, value.icpVersion, json(value), value.fingerprint, value.createdAt],
    }, ...value.queries.map((item) => ({
      sql: `INSERT INTO yie_search_plan_queries
        (plan_session_id,plan_version,query_id,query_text,source_category,priority,status,query_json)
        VALUES (?,?,?,?,?,?,?,?)`,
      args: [value.sessionId, value.planVersion, item.id, item.queryText, item.sourceCategory, item.priority, item.status, json(item)],
    }))];
    await this.client.batch(statements, 'write');
  }
  async getSearchPlan(sessionId: string, planVersion?: number) {
    const result = planVersion
      ? await this.client.execute({ sql: 'SELECT plan_json FROM yie_search_plans WHERE session_id=? AND plan_version=?', args: [sessionId, planVersion] })
      : await this.client.execute({ sql: 'SELECT plan_json FROM yie_search_plans WHERE session_id=? ORDER BY plan_version DESC LIMIT 1', args: [sessionId] });
    return result.rows[0] ? SearchPlanSchema.parse(parse(result.rows[0].plan_json)) : null;
  }
  async insertShadowComparison(comparison: ShadowComparison) {
    const value = ShadowComparisonSchema.parse(comparison);
    await this.client.execute({
      sql: 'INSERT INTO yie_shadow_comparisons (id,session_id,production_reference,comparison_json,fingerprint,created_at) VALUES (?,?,?,?,?,?)',
      args: [value.id, value.sessionId, value.productionReference, json(value), value.fingerprint, value.createdAt],
    });
  }
  async listShadowComparisons(sessionId: string) {
    const result = await this.client.execute({ sql: 'SELECT comparison_json FROM yie_shadow_comparisons WHERE session_id=? ORDER BY created_at', args: [sessionId] });
    return result.rows.map((row) => ShadowComparisonSchema.parse(parse(row.comparison_json)));
  }
  private eventStatement(raw: DiscoverySessionEvent): InStatement {
    const event = DiscoverySessionEventSchema.parse(raw);
    return {
      sql: 'INSERT INTO yie_discovery_session_events (id,session_id,sequence,event_type,occurred_at,actor_id,payload_json) VALUES (?,?,?,?,?,?,?)',
      args: [event.id, event.sessionId, event.sequence, event.type, event.occurredAt, event.actorId, json(event.payload)],
    };
  }
  private parseIntent(row: Record<string, unknown>) {
    return DiscoveryIntentVersionSchema.parse({
      sessionId: row.session_id, version: Number(row.version), parentVersion: row.parent_version === null ? null : Number(row.parent_version),
      mode: row.mode, rawUserInput: row.raw_user_input, normalizedIntent: parse(row.normalized_intent_json),
      patch: row.patch_json ? parse(row.patch_json) : null, explanation: row.explanation,
      selectedSolutionProfileId: row.selected_solution_profile_id,
      selectedSolutionProfileVersion: Number(row.selected_solution_profile_version),
      selectedICPId: row.selected_icp_id, selectedICPVersion: row.selected_icp_version === null ? null : Number(row.selected_icp_version),
      createdAt: row.created_at, createdBy: row.created_by, provenance: parse(row.provenance_json),
      proposalMetadata: row.proposal_metadata_json ? parse(row.proposal_metadata_json) : null,
      validationResult: parse(row.validation_result_json), warnings: parse(row.warnings_json),
    });
  }
}
