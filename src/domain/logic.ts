/**
 * Derived project intelligence.
 *
 * Nothing here is stored: health, progress, gate readiness, the next milestone
 * and the next action are all computed from the underlying records, so the
 * dashboard can never disagree with the project workspace.
 */
import { addDays, daysBetween, daysOverdue, day, parse } from './dates'
import { STAGES, stageDef, stageIndex } from './lifecycle'
import type {
  Blocker,
  DatabaseShape,
  Health,
  Milestone,
  Project,
  StageGate,
  StageKey,
  User,
} from './types'

/* ---------------------------------------------------------------- progress */

export interface ProgressBreakdown {
  percent: number
  completedCount: number
  totalCount: number
  completedWeight: number
  totalWeight: number
  inProgressWeight: number
  explanation: string
}

/**
 * Progress is milestone-weight based, never typed in by hand.
 *   completed milestones contribute their full weight,
 *   in-progress milestones contribute weight x their own completion.
 */
export const progressOf = (p: Project): ProgressBreakdown => {
  const ms = p.milestones
  const totalWeight = ms.reduce((s, m) => s + m.weight, 0) || 1
  let completedWeight = 0
  let inProgressWeight = 0
  for (const m of ms) {
    if (m.status === 'completed') completedWeight += m.weight
    else inProgressWeight += (m.weight * Math.min(100, Math.max(0, m.progress))) / 100
  }
  const completedCount = ms.filter((m) => m.status === 'completed').length
  const percent =
    p.stage === 'completed'
      ? 100
      : Math.round(((completedWeight + inProgressWeight) / totalWeight) * 100)
  return {
    percent,
    completedCount,
    totalCount: ms.length,
    completedWeight,
    totalWeight,
    inProgressWeight: Math.round(inProgressWeight * 10) / 10,
    explanation:
      ms.length === 0
        ? 'No milestones planned yet.'
        : `${completedCount} of ${ms.length} milestones completed (${completedWeight} of ${totalWeight} milestone weight), plus ${
            Math.round(inProgressWeight * 10) / 10
          } weight part-completed on milestones in progress.`,
  }
}

/* ------------------------------------------------------------------ health */

export interface HealthAssessment {
  health: Health
  reason: string
  /** What a reader should do about it. */
  action?: string
}

export const openBlockers = (p: Project): Blocker[] => p.blockers.filter((b) => b.status === 'open')

export const overdueMilestones = (p: Project, today: string): Milestone[] =>
  p.milestones.filter((m) => m.status !== 'completed' && daysBetween(m.dueDate, today) > 0)

/**
 * Health is deliberately independent of stage and progress: a project can be
 * "Development · 45% · Blocked". Order of precedence is strongest signal first.
 */
export const healthOf = (p: Project, today: string): HealthAssessment => {
  if (p.stage === 'completed') {
    return { health: 'completed', reason: 'Delivered, approved and formally closed.' }
  }
  const blockers = openBlockers(p)
  if (blockers.length) {
    const b = blockers[0]
    return {
      health: 'blocked',
      reason: `${b.title} — work cannot continue until it is cleared.`,
      action: b.requiredAction,
    }
  }
  const overdue = overdueMilestones(p, today)
  if (overdue.length) {
    const m = overdue[0]
    return {
      health: 'delayed',
      reason: `${m.name} is ${daysOverdue(m.dueDate, today)} day(s) past its committed date.`,
      action: `Owner must record the delay reason and revised date.`,
    }
  }
  const pendingScope = p.scopeChanges.filter((s) => s.decision === 'under_review')
  if (pendingScope.length) {
    return {
      health: 'at_risk',
      reason: `Scope change under review: ${pendingScope[0].title} (+${pendingScope[0].deliveryImpactDays} days if approved).`,
      action: 'Business Owner decision required.',
    }
  }
  const waiting = p.gates.find((g) => g.state === 'ready_for_review')
  if (waiting && daysBetween(day(waiting.submittedAt ?? today), today) >= 2) {
    return {
      health: 'at_risk',
      reason: `${waiting.name} has been waiting for review for ${daysBetween(
        day(waiting.submittedAt ?? today),
        today,
      )} days.`,
      action: 'Approval pending — chase the reviewer.',
    }
  }
  const slip = daysBetween(p.originalDeliveryDate, p.expectedDeliveryDate)
  if (slip > 0) {
    return {
      health: 'at_risk',
      reason: `Delivery has moved ${slip} day(s) from the original commitment.`,
      action: 'Recovered plan in place — watch the next milestone.',
    }
  }
  // Only milestones whose stage the project has actually reached can be "at risk" —
  // a plan drawn up today is not at risk because a future stage has a near date.
  const due = p.milestones.find(
    (m) =>
      m.status !== 'completed' &&
      stageIndex(p.stage) >= stageIndex(m.stage) &&
      daysBetween(today, m.dueDate) <= 2 &&
      m.progress < 60,
  )
  if (due) {
    return {
      health: 'at_risk',
      reason: `${due.name} is due in ${Math.max(0, daysBetween(today, due.dueDate))} day(s) and is ${due.progress}% complete.`,
      action: 'Confirm the owner can still make the date.',
    }
  }
  return { health: 'on_track', reason: 'Every committed milestone is on its planned date.' }
}

/* -------------------------------------------------- next milestone/action */

export const nextMilestone = (p: Project): Milestone | undefined => {
  const open = p.milestones.filter((m) => m.status !== 'completed')
  if (!open.length) return undefined
  const active = open.filter((m) => m.status === 'in_progress' || m.status === 'delayed' || m.status === 'blocked')
  const pool = active.length ? active : open
  return [...pool].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
}

export interface NextAction {
  label: string
  ownerId?: string
  href?: string
  urgency: 'normal' | 'warn' | 'critical'
}

/** The single thing that moves the project forward, and who owns it. */
export const nextActionOf = (p: Project, today: string): NextAction => {
  const base = `#/projects/${p.id}`
  const blocker = openBlockers(p)[0]
  if (blocker)
    return {
      label: blocker.requiredAction,
      ownerId: blocker.responsibleId,
      href: `${base}/blockers`,
      urgency: 'critical',
    }

  const overdue = overdueMilestones(p, today).filter((m) => !m.delay)[0]
  if (overdue)
    return {
      label: `Record why "${overdue.name}" is late`,
      ownerId: overdue.ownerId,
      href: `${base}/milestones`,
      urgency: 'critical',
    }

  const scope = p.scopeChanges.find((s) => s.decision === 'under_review')
  if (scope)
    return {
      label: `Decide scope change: ${scope.title}`,
      ownerId: p.businessOwnerId,
      href: `${base}/changes`,
      urgency: 'warn',
    }

  const gate = currentGate(p)
  if (gate) {
    if (gate.state === 'ready_for_review')
      return {
        label: `Review & approve ${gate.name}`,
        ownerId: approverFor(p, gate),
        href: `${base}/timeline`,
        urgency: 'warn',
      }
    if (gate.state === 'changes_requested')
      return {
        label: `Address review feedback on ${gate.name}`,
        ownerId: p.analystId,
        href: `${base}/timeline`,
        urgency: 'warn',
      }
    const unmet = gate.criteria.find((c) => c.required && !c.done)
    if (unmet)
      return {
        label: `${unmet.label}`,
        ownerId: stageOwner(p, p.stage),
        href: `${base}/timeline`,
        urgency: 'normal',
      }
    return {
      label: `Submit ${gate.name} for review`,
      ownerId: stageOwner(p, p.stage),
      href: `${base}/timeline`,
      urgency: 'normal',
    }
  }

  if (p.stage === 'approval')
    return { label: 'Record business approval to start development', ownerId: p.businessOwnerId, href: `${base}/approvals`, urgency: 'warn' }
  if (p.stage === 'completed') return { label: 'No action required — project closed', urgency: 'normal' }
  return { label: 'Plan the next milestone', ownerId: p.ownerId, href: `${base}/milestones`, urgency: 'normal' }
}

export const stageOwner = (p: Project, stage: StageKey): string | undefined => {
  switch (stage) {
    case 'idea':
    case 'discovery':
    case 'design':
      return p.analystId ?? p.ownerId
    case 'approval':
    case 'uat':
    case 'stabilization':
      return p.businessOwnerId ?? p.ownerId
    case 'development':
    case 'internal_testing':
    case 'deployment':
      return p.developerId ?? p.ownerId
    default:
      return p.ownerId
  }
}

export const approverFor = (p: Project, gate: StageGate): string | undefined => {
  if (gate.approverRole === 'business_owner') return p.businessOwnerId
  return p.ownerId
}

/* ------------------------------------------------------------ stage gates */

export const currentGate = (p: Project): StageGate | undefined =>
  p.gates.find((g) => g.stage === p.stage && g.state !== 'approved')

export const gateFor = (p: Project, stage: StageKey): StageGate | undefined =>
  p.gates.find((g) => g.stage === stage)

export interface GateReadiness {
  ready: boolean
  met: number
  total: number
  blockingReason?: string
}

export const gateReadiness = (gate?: StageGate): GateReadiness => {
  if (!gate) return { ready: false, met: 0, total: 0, blockingReason: 'This stage has no exit criteria.' }
  const required = gate.criteria.filter((c) => c.required)
  const met = required.filter((c) => c.done).length
  const missing = required.filter((c) => !c.done)
  return {
    ready: missing.length === 0,
    met,
    total: required.length,
    blockingReason: missing.length ? missing.map((m) => m.label).join(' · ') : undefined,
  }
}

/* ------------------------------------------------------- delivery forecast */

export interface DeliveryBreakdown {
  original: string
  current: string
  totalSlip: number
  executionSlip: number
  scopeSlip: number
  lines: { label: string; days: number; kind: 'execution' | 'scope' }[]
}

/**
 * Management's key question is not only "is it late" but "late because we are
 * slow, or late because the business changed its mind". Those are kept apart.
 */
export const deliveryBreakdown = (p: Project): DeliveryBreakdown => {
  const lines: DeliveryBreakdown['lines'] = []
  for (const b of p.blockers) {
    if (b.impactDays > 0) lines.push({ label: b.title, days: b.impactDays, kind: 'execution' })
  }
  for (const m of p.milestones) {
    if (m.delay && m.delay.impactDays > 0 && !m.delay.blockerId)
      lines.push({ label: `${m.name} — ${m.delay.note || 'delay recorded'}`, days: m.delay.impactDays, kind: 'execution' })
  }
  for (const s of p.scopeChanges) {
    if (s.decision === 'approved' && s.deliveryImpactDays > 0)
      lines.push({ label: s.title, days: s.deliveryImpactDays, kind: 'scope' })
  }
  const executionSlip = lines.filter((l) => l.kind === 'execution').reduce((a, b) => a + b.days, 0)
  const scopeSlip = lines.filter((l) => l.kind === 'scope').reduce((a, b) => a + b.days, 0)
  return {
    original: p.originalDeliveryDate,
    current: p.expectedDeliveryDate,
    totalSlip: daysBetween(p.originalDeliveryDate, p.expectedDeliveryDate),
    executionSlip,
    scopeSlip,
    lines,
  }
}

/* -------------------------------------------------------- portfolio views */

export interface ProjectView {
  project: Project
  health: HealthAssessment
  progress: ProgressBreakdown
  next: Milestone | undefined
  action: NextAction
  gate?: StageGate
  readiness: GateReadiness
  openBlockers: Blocker[]
  overdue: Milestone[]
}

export const viewOf = (p: Project, today: string): ProjectView => {
  const gate = currentGate(p)
  return {
    project: p,
    health: healthOf(p, today),
    progress: progressOf(p),
    next: nextMilestone(p),
    action: nextActionOf(p, today),
    gate,
    readiness: gateReadiness(gate),
    openBlockers: openBlockers(p),
    overdue: overdueMilestones(p, today),
  }
}

export const viewsOf = (db: DatabaseShape): ProjectView[] =>
  db.projects.map((p) => viewOf(p, db.today))

/** Exceptions first: this is what the management dashboard leads with. */
const ATTENTION_RANK: Record<Health, number> = {
  blocked: 0,
  delayed: 1,
  at_risk: 2,
  on_track: 3,
  completed: 4,
}

export const attentionQueue = (db: DatabaseShape): ProjectView[] =>
  viewsOf(db)
    .filter((v) => ['blocked', 'delayed', 'at_risk'].includes(v.health.health))
    .sort(
      (a, b) =>
        ATTENTION_RANK[a.health.health] - ATTENTION_RANK[b.health.health] ||
        a.project.expectedDeliveryDate.localeCompare(b.project.expectedDeliveryDate),
    )

export interface MilestoneRow {
  milestone: Milestone
  project: Project
  overdueDays: number
}

export const milestoneRadar = (db: DatabaseShape, horizonDays = 10): MilestoneRow[] => {
  const rows: MilestoneRow[] = []
  for (const p of db.projects) {
    if (p.stage === 'completed') continue
    for (const m of p.milestones) {
      if (m.status === 'completed') continue
      const diff = daysBetween(db.today, m.dueDate)
      if (diff <= horizonDays) rows.push({ milestone: m, project: p, overdueDays: Math.max(0, -diff) })
    }
  }
  return rows.sort((a, b) => a.milestone.dueDate.localeCompare(b.milestone.dueDate))
}

export interface WorkloadRow {
  user: User
  active: number
  overdue: number
  blocked: number
  projects: string[]
}

export const workload = (db: DatabaseShape, roles: User['role'][]): WorkloadRow[] => {
  const rows: WorkloadRow[] = []
  for (const u of db.users.filter((x) => roles.includes(x.role))) {
    let active = 0
    let overdue = 0
    let blocked = 0
    const projects: string[] = []
    for (const p of db.projects) {
      if (p.stage === 'completed') continue
      const mine = p.milestones.filter((m) => m.ownerId === u.id && m.status !== 'completed')
      const owns = p.analystId === u.id || p.developerId === u.id || p.ownerId === u.id
      // Someone can be holding a project up without owning any of its milestones —
      // that is exactly the person management needs to see.
      const holding = p.blockers.filter(
        (b) => b.status === 'open' && (b.responsibleId === u.id || b.assignedActionTo === u.id),
      )
      if (!mine.length && !owns && !holding.length) continue
      projects.push(p.name)
      active += mine.length
      overdue += mine.filter((m) => daysBetween(m.dueDate, db.today) > 0).length
      blocked += holding.length
    }
    rows.push({ user: u, active, overdue, blocked, projects })
  }
  // Late work first, then whoever is holding a blocker — that is who management chases.
  return rows.sort((a, b) => b.overdue - a.overdue || b.blocked - a.blocked || b.active - a.active)
}

/* -------------------------------------------------------------- summaries */

export interface PortfolioSummary {
  totalActive: number
  byStage: { stage: StageKey; label: string; count: number }[]
  byHealth: Record<Health, number>
  dueThisMonth: number
  completed: number
}

export const portfolioSummary = (db: DatabaseShape): PortfolioSummary => {
  const views = viewsOf(db)
  const byHealth: Record<Health, number> = {
    on_track: 0,
    at_risk: 0,
    delayed: 0,
    blocked: 0,
    completed: 0,
  }
  for (const v of views) byHealth[v.health.health] += 1
  const month = db.today.slice(0, 7)
  return {
    totalActive: views.filter((v) => v.project.stage !== 'completed').length,
    byStage: STAGES.filter((s) => s.key !== 'completed').map((s) => ({
      stage: s.key,
      label: s.short,
      count: views.filter((v) => v.project.stage === s.key).length,
    })),
    byHealth,
    dueThisMonth: views.filter(
      (v) => v.project.stage !== 'completed' && v.project.expectedDeliveryDate.slice(0, 7) === month,
    ).length,
    completed: views.filter((v) => v.project.stage === 'completed').length,
  }
}

/* ------------------------------------------------------------------ misc */

export const userById = (db: DatabaseShape, id?: string): User | undefined =>
  db.users.find((u) => u.id === id)

export const userName = (db: DatabaseShape, id?: string) => userById(db, id)?.name ?? 'Unassigned'

export const deptName = (db: DatabaseShape, id?: string) =>
  db.departments.find((d) => d.id === id)?.name ?? '—'

export const buName = (db: DatabaseShape, id?: string) =>
  db.businessUnits.find((b) => b.id === id)?.name ?? '—'

export const projectedDelivery = (p: Project, extraDays: number) =>
  addDays(p.expectedDeliveryDate, extraDays)

/** Only the role named on the gate may decide it — governance, not convenience. */
export const canApprove = (role: string, gate: StageGate) => role === gate.approverRole

/* --------------------------------------------------- portfolio analytics */

export interface DeliveryRow {
  project: Project
  original: string
  current: string
  slipDays: number
  executionDays: number
  scopeDays: number
  health: Health
  progress: number
}

/** One row per active project: what was promised, what is now expected, and why. */
export const deliveryOutlook = (db: DatabaseShape): DeliveryRow[] =>
  db.projects
    .filter((p) => p.stage !== 'completed')
    .map((p) => {
      const d = deliveryBreakdown(p)
      return {
        project: p,
        original: p.originalDeliveryDate,
        current: p.expectedDeliveryDate,
        slipDays: d.totalSlip,
        executionDays: d.executionSlip,
        scopeDays: d.scopeSlip,
        health: healthOf(p, db.today).health,
        progress: progressOf(p).percent,
      }
    })
    .sort((a, b) => a.current.localeCompare(b.current))

export interface WeekLoad {
  weekStart: string
  label: string
  due: number
  overdue: number
}

/** Milestone commitments per week — where the crunch is, and what is already late. */
export const milestoneLoad = (db: DatabaseShape, weeks = 6): WeekLoad[] => {
  const start = addDays(db.today, -7)
  const buckets: WeekLoad[] = Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDays(start, i * 7)
    return { weekStart, label: i === 1 ? 'This week' : fmtShortLabel(weekStart), due: 0, overdue: 0 }
  })
  for (const p of db.projects) {
    if (p.stage === 'completed') continue
    for (const m of p.milestones) {
      if (m.status === 'completed') continue
      const offset = Math.floor(daysBetween(start, m.dueDate) / 7)
      if (offset < 0 || offset >= weeks) continue
      if (daysBetween(m.dueDate, db.today) > 0) buckets[offset].overdue += 1
      else buckets[offset].due += 1
    }
  }
  return buckets
}

const fmtShortLabel = (iso: string) => {
  const d = parse(iso)
  return `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`
}

export interface AttributionLine {
  projectId: string
  projectName: string
  label: string
  days: number
  kind: 'execution' | 'scope'
}

/** Across the portfolio: how many delivery days went to execution vs approved scope. */
export const portfolioAttribution = (db: DatabaseShape) => {
  const lines: AttributionLine[] = []
  for (const p of db.projects) {
    if (p.stage === 'completed') continue
    for (const l of deliveryBreakdown(p).lines)
      lines.push({ projectId: p.id, projectName: p.name, label: l.label, days: l.days, kind: l.kind })
  }
  const execution = lines.filter((l) => l.kind === 'execution').reduce((a, b) => a + b.days, 0)
  const scope = lines.filter((l) => l.kind === 'scope').reduce((a, b) => a + b.days, 0)
  return { execution, scope, total: execution + scope, lines: lines.sort((a, b) => b.days - a.days) }
}
