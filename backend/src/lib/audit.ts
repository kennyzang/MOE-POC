import prisma from './prisma'

export interface AuditWriteInput {
  actorUserId: string
  action: string                  // e.g. LICENSE_ISSUED, LICENSE_RENEWED, INSPECTION_RECORDED
  entityType?: string             // e.g. SchoolLicense, SchoolInspection, ComplianceCircular
  entityId?: string
  details?: Record<string, unknown> | string | null
}

/**
 * Write an immutable AuditEvent row.
 *
 * Used to satisfy ITT requirements such as EMS 2.2.11 ("Maintain immutable
 * audit logs of profile changes") and SMS-PrivEd compliance audit trails.
 *
 * Wrapper is fire-and-forget for ergonomics — failures are logged but do not
 * abort the surrounding mutation. Callers that require strict atomicity
 * should use `prisma.auditEvent.create()` directly inside their transaction.
 */
export async function writeAudit(input: AuditWriteInput): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        details:
          input.details == null
            ? null
            : typeof input.details === 'string'
              ? input.details
              : JSON.stringify(input.details),
      },
    })
  } catch (err) {
    console.error('[audit] failed to write event', input.action, err)
  }
}
