// State transition maps for stateful entities.
// UPPERCASE status values (PENDING, HOD_APPROVED, ...) are preserved as-is from DB.
// Lowercase status values (draft, submitted, ...) are also preserved as-is.
// An empty array means the status is terminal — no further transitions are allowed.

type TransitionMap = Record<string, readonly string[]>

type TransitionResult =
  | { ok: true }
  | { ok: false; reason: string }

export function validateTransition(
  map: TransitionMap,
  fromStatus: string,
  toStatus: string,
): TransitionResult {
  const allowed = map[fromStatus]
  if (allowed === undefined) {
    return { ok: false, reason: `Unknown source status '${fromStatus}'` }
  }
  if (!allowed.includes(toStatus)) {
    const allowedList = allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'
    return {
      ok: false,
      reason: `Cannot transition from '${fromStatus}' to '${toStatus}'. Allowed: [${allowedList}]`,
    }
  }
  return { ok: true }
}

export function getValidNextStatuses(map: TransitionMap, fromStatus: string): readonly string[] {
  return map[fromStatus] ?? []
}

// ─── Transition maps ────────────────────────────────────────────────────────

// Resolves the two slightly-divergent inline tables that existed in admissions.ts.
// 'accepted' is kept as an admin-override terminal alongside 'offer_accepted'
// (the admin PATCH handlers use 'accepted'; the parent portal uses 'offer_accepted').
export const ADMISSION_TRANSITIONS: TransitionMap = {
  draft:                ['submitted', 'under_review', 'accepted', 'rejected'],
  pending:              ['submitted', 'under_review', 'accepted', 'rejected'],
  submitted:            ['under_review', 'accepted', 'rejected'],
  under_review:         ['documents_required', 'offer_issued', 'waitlisted', 'accepted', 'rejected'],
  documents_required:   ['under_review', 'rejected'],
  offer_issued:         ['offer_accepted', 'rejected'],
  offer_accepted:       [],
  accepted:             ['offer_accepted'],
  rejected:             [],
  waitlisted:           [],
}

export const LEAVE_TRANSITIONS: TransitionMap = {
  PENDING:             ['HOD_APPROVED', 'REJECTED', 'CANCELLED'],
  HOD_APPROVED:        ['PRINCIPAL_APPROVED', 'REJECTED', 'CANCELLED'],
  PRINCIPAL_APPROVED:  ['CANCELLED'],
  REJECTED:            [],
  CANCELLED:           [],
}

export const RETIREMENT_TRANSITIONS: TransitionMap = {
  SUBMITTED:    ['UNDER_REVIEW'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED:     [],
  REJECTED:     [],
}

export const COUNSELOR_CASE_TRANSITIONS: TransitionMap = {
  OPEN:        ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'CLOSED'],
  RESOLVED:    ['CLOSED'],
  CLOSED:      [],
}

export const EXAM_TRANSITIONS: TransitionMap = {
  upcoming:  ['ongoing', 'cancelled'],
  ongoing:   ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export const EXAM_CANDIDATE_TRANSITIONS: TransitionMap = {
  registered: ['present', 'absent'],
  present:    [],
  absent:     [],
}

export const SELF_SERVICE_TRANSITIONS: TransitionMap = {
  submitted:    ['under_review', 'rejected'],
  under_review: ['approved', 'rejected'],
  approved:     [],
  rejected:     [],
}

export const APPROVAL_TRANSITIONS: TransitionMap = {
  PENDING:         ['LEVEL1_APPROVED', 'REJECTED'],
  LEVEL1_APPROVED: ['LEVEL2_APPROVED', 'FULLY_APPROVED', 'REJECTED'],
  LEVEL2_APPROVED: ['FULLY_APPROVED', 'REJECTED'],
  FULLY_APPROVED:  [],
  REJECTED:        [],
}
