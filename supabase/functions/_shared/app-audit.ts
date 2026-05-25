export type AppAuditEntry = {
  area: string
  action: string
  entityType: string
  entityId?: string | null
  actorId?: string | null
  beforeState?: Record<string, unknown> | null
  afterState?: Record<string, unknown> | null
  metadata?: Record<string, unknown>
}

export async function logAppAudit(
  svc: {
    from: (table: string) => {
      insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>
    }
  },
  entry: AppAuditEntry,
) {
  try {
    const { error } = await svc.from('app_audit_log').insert({
      area: entry.area,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      actor_id: entry.actorId ?? null,
      before_state: entry.beforeState ?? {},
      after_state: entry.afterState ?? {},
      metadata: entry.metadata ?? {},
    })

    if (error) {
      console.warn('app_audit_log insert failed:', error)
    }
  } catch (error) {
    console.warn('app_audit_log insert failed:', error instanceof Error ? error.message : String(error))
  }
}
