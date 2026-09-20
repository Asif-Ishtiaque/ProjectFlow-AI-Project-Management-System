/**
 * The single source of truth for project state.
 *
 * Every user action in the prototype ends up here. One action updates stage,
 * health inputs, milestones, blockers, approvals, activity and notifications
 * together, which is why the dashboard and the workspace can never disagree.
 */
import { addDays, daysBetween, day, fmtDate } from '../domain/dates'
import { nextId } from '../domain/ids'
import { DELAY_CATEGORIES, STAGES, delayLabel, nextStage, roleLabel, stageDef, stageIndex } from '../domain/lifecycle'
import { gateReadiness, progressOf, userById } from '../domain/logic'
import { createSeedDatabase } from '../domain/seed'
import { buildGates, buildMilestones, buildTasks, emptyProject } from '../domain/templates'
import type {
  ActivityKind,
  ActivityLog,
  DatabaseShape,
  Milestone,
  Notification,
  Project,
  RoleKey,
  StageKey,
} from '../domain/types'
import type { Action } from './actions'

/* ----------------------------------------------------------------- utils */

const stamp = (db: DatabaseShape) => {
  const now = new Date()
  return `${db.today}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(
    now.getSeconds(),
  ).padStart(2, '0')}`
}

const withProject = (db: DatabaseShape, projectId: string, fn: (p: Project) => Project): DatabaseShape => ({
  ...db,
  projects: db.projects.map((p) => (p.id === projectId ? fn(p) : p)),
})

const log = (
  db: DatabaseShape,
  projectId: string,
  kind: ActivityKind,
  actorId: string,
  message: string,
  detail?: string,
): DatabaseShape => ({
  ...db,
  activity: [
    { id: nextId('act'), projectId, kind, actorId, message, detail, at: stamp(db) },
    ...db.activity,
  ],
})

const notify = (
  db: DatabaseShape,
  n: Omit<Notification, 'id' | 'at' | 'read'>,
): DatabaseShape => ({
  ...db,
  notifications: [{ ...n, id: nextId('nt'), at: stamp(db), read: false }, ...db.notifications],
})

const nameOf = (db: DatabaseShape, id?: string) => userById(db, id)?.name ?? 'Unassigned'

const deptOf = (db: DatabaseShape, id?: string) => db.departments.find((d) => d.id === id)?.name ?? 'the business'

/**
 * Keeps milestone status honest after every mutation: blocked beats overdue,
 * overdue beats in-progress, and a revised date can pull a milestone back out
 * of "delayed" without anyone touching the record by hand.
 */
const normalize = (p: Project, today: string): { project: Project; newlyDelayed: Milestone[] } => {
  const blockedIds = new Set(p.blockers.filter((b) => b.status === 'open' && b.milestoneId).map((b) => b.milestoneId))
  const newlyDelayed: Milestone[] = []
  const milestones = p.milestones.map((m) => {
    if (m.status === 'completed') return m
    if (blockedIds.has(m.id)) return { ...m, status: 'blocked' as const }
    if (daysBetween(m.dueDate, today) > 0) {
      if (m.status !== 'delayed') newlyDelayed.push(m)
      return { ...m, status: 'delayed' as const }
    }
    if (m.status === 'delayed' || m.status === 'blocked')
      return { ...m, status: (m.progress > 0 ? 'in_progress' : 'not_started') as Milestone['status'] }
    return m
  })
  return { project: { ...p, milestones }, newlyDelayed }
}

/** Applies normalize() and emits the activity/notifications the change implies. */
const settle = (db: DatabaseShape, projectId: string): DatabaseShape => {
  const project = db.projects.find((p) => p.id === projectId)
  if (!project) return db
  const { project: next, newlyDelayed } = normalize(project, db.today)
  let out = withProject(db, projectId, () => next)
  for (const m of newlyDelayed) {
    const late = daysBetween(m.dueDate, db.today)
    out = log(out, projectId, 'milestone', m.ownerId, `milestone "${m.name}" became overdue`, `Committed ${fmtDate(m.dueDate)} · ${late} day(s) late`)
    out = notify(out, {
      projectId,
      audienceRoles: ['team_lead', 'management', 'ai_analyst', 'developer'],
      kind: 'overdue',
      title: 'Milestone overdue',
      body: `${m.name} on ${next.name} is overdue by ${late} day(s). A delay reason is required.`,
      href: `#/projects/${projectId}/milestones`,
    })
  }
  return out
}

const completeStageMilestones = (db: DatabaseShape, projectId: string, stage: StageKey, actorId: string): DatabaseShape => {
  const p = db.projects.find((x) => x.id === projectId)
  if (!p) return db
  const affected = p.milestones.filter((m) => m.stage === stage && m.status !== 'completed')
  if (!affected.length) return db
  const closedIds = new Set(affected.map((m) => m.id))
  let out = withProject(db, projectId, (proj) => ({
    ...proj,
    milestones: proj.milestones.map((m) =>
      m.stage === stage && m.status !== 'completed'
        ? { ...m, status: 'completed', progress: 100, completedAt: db.today }
        : m,
    ),
    tasks: proj.tasks.map((t) => (closedIds.has(t.milestoneId) ? { ...t, status: 'done' as const } : t)),
  }))
  for (const m of affected)
    out = log(out, projectId, 'milestone', actorId, `completed milestone "${m.name}"`, 'Closed by stage gate approval')
  return out
}

const enterStage = (db: DatabaseShape, projectId: string, stage: StageKey, actorId: string): DatabaseShape => {
  let out = withProject(db, projectId, (p) => ({
    ...p,
    stage,
    stageHistory: [
      ...p.stageHistory.map((h) => (h.exitedAt ? h : { ...h, exitedAt: db.today })),
      { id: nextId('sh'), stage, enteredAt: db.today, approvedBy: actorId },
    ],
    gates: p.gates.map((g) => (g.stage === stage && g.state === 'not_started' ? { ...g, state: 'in_progress' } : g)),
  }))
  out = log(out, projectId, 'stage', actorId, `moved the project to ${stageDef(stage).label}`)
  const p = out.projects.find((x) => x.id === projectId)!
  out = notify(out, {
    projectId,
    audienceRoles: ['management', 'team_lead', 'ai_analyst', 'developer', 'business_owner'],
    kind: 'status',
    title: `${p.name} → ${stageDef(stage).label}`,
    body: `The project entered ${stageDef(stage).label}. ${stageDef(stage).purpose}`,
    href: `#/projects/${projectId}/timeline`,
  })
  return settle(out, projectId)
}

const shiftDelivery = (db: DatabaseShape, projectId: string, days: number): DatabaseShape =>
  days === 0
    ? db
    : withProject(db, projectId, (p) => ({
        ...p,
        expectedDeliveryDate: addDays(p.expectedDeliveryDate, days),
      }))

/* --------------------------------------------------------------- reducer */

export const initialDatabase = (): DatabaseShape => createSeedDatabase()

export function reducer(db: DatabaseShape, action: Action): DatabaseShape {
  switch (action.type) {
    case '__commit':
      // The API layer returns the already-reduced state; the store commits it.
      return action.db

    case 'reset':
      return initialDatabase()

    case 'advance_clock': {
      const next = { ...db, today: addDays(db.today, action.days) }
      return db.projects.reduce((acc, p) => settle(acc, p.id), next)
    }

    /* ------------------------------------------------------------ intake */
    case 'create_project': {
      const i = action.input
      const id = nextId('p')
      const code = `AI-2026-0${20 + db.projects.length}`
      const people = {
        analyst: i.analystId,
        developer: i.developerId,
        businessOwner: i.businessOwnerId,
        owner: i.ownerId,
      }
      const milestones = buildMilestones(id, i.expectedDeliveryDate, people)
      const tasks = buildTasks(milestones, people)
      const gates = buildGates(id).map((g) =>
        g.stage === 'idea'
          ? {
              ...g,
              state: 'in_progress' as const,
              criteria: g.criteria.map((c) => ({
                ...c,
                done:
                  c.label === 'Project owner assigned'
                    ? Boolean(i.ownerId)
                    : c.label === 'AI Analyst assigned'
                      ? Boolean(i.analystId)
                      : Boolean(i.businessProblem.trim()),
                completedAt: db.today,
                completedBy: action.actorId,
              })),
            }
          : g,
      )
      const project: Project = {
        ...emptyProject(),
        id,
        code,
        name: i.name,
        businessUnitId: i.businessUnitId,
        departmentId: i.departmentId,
        businessProblem: i.businessProblem,
        expectedOutcome: i.expectedOutcome,
        ownerId: i.ownerId,
        analystId: i.analystId,
        developerId: i.developerId,
        businessOwnerId: i.businessOwnerId,
        contributorIds: i.contributorIds,
        stage: 'idea',
        priority: i.priority,
        originalDeliveryDate: i.expectedDeliveryDate,
        expectedDeliveryDate: i.expectedDeliveryDate,
        createdAt: db.today,
        stageHistory: [{ id: nextId('sh'), stage: 'idea', enteredAt: db.today }],
        gates,
        milestones,
        tasks,
      }
      let out: DatabaseShape = { ...db, projects: [project, ...db.projects] }
      out = log(out, id, 'project', action.actorId, `created the project "${i.name}"`, `${code} · Expected delivery ${fmtDate(i.expectedDeliveryDate)}`)
      out = log(out, id, 'milestone', action.actorId, `applied the standard AI delivery plan`, `${milestones.length} milestones and ${tasks.length} tasks created from the delivery date`)
      if (i.analystId) {
        out = log(out, id, 'assignment', action.actorId, `assigned ${nameOf(db, i.analystId)} as AI Analyst`)
        out = notify(out, {
          projectId: id,
          audienceRoles: ['ai_analyst'],
          kind: 'assignment',
          title: 'New project assigned',
          body: `You have been assigned as AI Analyst for ${i.name}.`,
          href: `#/projects/${id}`,
        })
      }
      out = notify(out, {
        projectId: id,
        audienceRoles: ['management', 'team_lead'],
        kind: 'status',
        title: 'New AI project created',
        body: `${i.name} was raised by ${deptOf(db, i.departmentId)}. Expected delivery ${fmtDate(i.expectedDeliveryDate)}.`,
        href: `#/projects/${id}`,
      })
      return settle(out, id)
    }

    case 'assign_people': {
      const p = db.projects.find((x) => x.id === action.projectId)
      if (!p) return db
      let out = withProject(db, action.projectId, (proj) => ({
        ...proj,
        analystId: action.analystId ?? proj.analystId,
        developerId: action.developerId ?? proj.developerId,
        businessOwnerId: action.businessOwnerId ?? proj.businessOwnerId,
        gates: proj.gates.map((g) =>
          g.stage === 'idea'
            ? {
                ...g,
                criteria: g.criteria.map((c) =>
                  c.label === 'AI Analyst assigned' && (action.analystId ?? proj.analystId) ? { ...c, done: true } : c,
                ),
              }
            : g,
        ),
        milestones: proj.milestones.map((m) => {
          if (action.analystId && m.ownerId === proj.analystId) return { ...m, ownerId: action.analystId }
          if (action.developerId && m.ownerId === proj.developerId) return { ...m, ownerId: action.developerId }
          return m
        }),
      }))
      if (action.analystId && action.analystId !== p.analystId) {
        out = log(out, action.projectId, 'assignment', action.actorId, `assigned ${nameOf(db, action.analystId)} as AI Analyst`)
        out = notify(out, {
          projectId: action.projectId,
          audienceRoles: ['ai_analyst'],
          kind: 'assignment',
          title: 'New project assigned',
          body: `You have been assigned as AI Analyst for ${p.name}.`,
          href: `#/projects/${action.projectId}`,
        })
      }
      if (action.developerId && action.developerId !== p.developerId)
        out = log(out, action.projectId, 'assignment', action.actorId, `assigned ${nameOf(db, action.developerId)} as Developer`)
      if (action.businessOwnerId && action.businessOwnerId !== p.businessOwnerId)
        out = log(out, action.projectId, 'assignment', action.actorId, `assigned ${nameOf(db, action.businessOwnerId)} as Business Owner`)
      return settle(out, action.projectId)
    }

    /* ------------------------------------------------------- stage gates */
    case 'toggle_criterion': {
      const p = db.projects.find((x) => x.id === action.projectId)
      const gate = p?.gates.find((g) => g.id === action.gateId)
      const crit = gate?.criteria.find((c) => c.id === action.criterionId)
      if (!p || !gate || !crit) return db
      let out = withProject(db, action.projectId, (proj) => ({
        ...proj,
        gates: proj.gates.map((g) =>
          g.id !== action.gateId
            ? g
            : {
                ...g,
                state: g.state === 'not_started' ? 'in_progress' : g.state === 'changes_requested' ? 'in_progress' : g.state,
                criteria: g.criteria.map((c) =>
                  c.id !== action.criterionId
                    ? c
                    : {
                        ...c,
                        done: action.done,
                        evidence: action.done ? action.evidence || c.evidence : undefined,
                        completedBy: action.done ? action.actorId : undefined,
                        completedAt: action.done ? db.today : undefined,
                      },
                ),
              },
        ),
      }))
      out = log(
        out,
        action.projectId,
        'stage',
        action.actorId,
        `${action.done ? 'marked' : 'un-marked'} exit criterion "${crit.label}"`,
        action.done && action.evidence ? `Evidence: ${action.evidence}` : `${gate.name}`,
      )
      return settle(out, action.projectId)
    }

    case 'submit_gate': {
      const p = db.projects.find((x) => x.id === action.projectId)
      const gate = p?.gates.find((g) => g.id === action.gateId)
      if (!p || !gate) return db
      if (!gateReadiness(gate).ready) return db
      let out = withProject(db, action.projectId, (proj) => ({
        ...proj,
        gates: proj.gates.map((g) =>
          g.id === action.gateId ? { ...g, state: 'ready_for_review', submittedBy: action.actorId, submittedAt: db.today } : g,
        ),
        approvals: [
          ...proj.approvals,
          {
            id: nextId('ap'),
            projectId: proj.id,
            kind: `${gate.stage}_gate` as never,
            title: gate.name,
            decision: 'pending' as const,
            requiredRole: gate.approverRole,
          },
        ],
      }))
      out = log(out, action.projectId, 'approval', action.actorId, `submitted ${gate.name} for review`, `Awaiting ${roleLabel(gate.approverRole)}`)
      out = notify(out, {
        projectId: action.projectId,
        audienceRoles: [gate.approverRole],
        kind: 'approval_request',
        title: `${gate.name} — approval requested`,
        body: `${p.name} is ready for review. All ${gate.criteria.filter((c) => c.required).length} exit criteria are evidenced.`,
        href: `#/projects/${action.projectId}/timeline`,
      })
      return settle(out, action.projectId)
    }

    case 'decide_gate': {
      const p = db.projects.find((x) => x.id === action.projectId)
      const gate = p?.gates.find((g) => g.id === action.gateId)
      if (!p || !gate) return db

      if (action.decision === 'changes_requested') {
        let out = withProject(db, action.projectId, (proj) => ({
          ...proj,
          gates: proj.gates.map((g) =>
            g.id === action.gateId
              ? { ...g, state: 'changes_requested', decidedAt: db.today, approverId: action.actorId, decisionNote: action.note }
              : g,
          ),
          approvals: proj.approvals.map((a) =>
            a.title === gate.name && a.decision === 'pending'
              ? { ...a, decision: 'changes_requested' as const, decidedById: action.actorId, decidedAt: db.today, note: action.note }
              : a,
          ),
        }))
        out = log(out, action.projectId, 'approval', action.actorId, `requested changes on ${gate.name}`, action.note)
        out = notify(out, {
          projectId: action.projectId,
          audienceRoles: ['ai_analyst', 'team_lead', 'developer'],
          kind: 'approval_result',
          title: `Changes requested — ${gate.name}`,
          body: action.note || 'The reviewer asked for changes before this stage can close.',
          href: `#/projects/${action.projectId}/timeline`,
        })
        return settle(out, action.projectId)
      }

      let out = withProject(db, action.projectId, (proj) => ({
        ...proj,
        gates: proj.gates.map((g) =>
          g.id === action.gateId
            ? { ...g, state: 'approved', decidedAt: db.today, approverId: action.actorId, decisionNote: action.note }
            : g,
        ),
        approvals: proj.approvals.map((a) =>
          a.title === gate.name && a.decision === 'pending'
            ? { ...a, decision: 'approved' as const, decidedById: action.actorId, decidedAt: db.today, note: action.note }
            : a,
        ),
      }))
      out = log(out, action.projectId, 'approval', action.actorId, `approved ${gate.name}`, action.note || undefined)
      out = completeStageMilestones(out, action.projectId, gate.stage, action.actorId)

      const target = nextStage(gate.stage)
      if (!target) return settle(out, action.projectId)

      if (gate.stage === 'stabilization') {
        // Closure is a deliberate, separate confirmation — see 'close_project'.
        return settle(out, action.projectId)
      }
      out = enterStage(out, action.projectId, target, action.actorId)
      return settle(out, action.projectId)
    }

    /* --------------------------------------------------------- execution */
    case 'start_stage_work': {
      const p = db.projects.find((x) => x.id === action.projectId)
      if (!p) return db
      const stage = p.stage
      let out = db

      if (stage === 'development') {
        // The developer picks up the two development milestones and logs the
        // work already done, which is what moves overall progress.
        const dev = p.milestones.filter((m) => m.stage === 'development' && m.status !== 'completed')
        const logged: Record<string, number> = {}
        dev.forEach((m, i) => (logged[m.id] = i === 0 ? 60 : 15))
        out = withProject(out, action.projectId, (proj) => {
          const done = new Set<string>()
          for (const m of dev) {
            const mine = proj.tasks.filter((t) => t.milestoneId === m.id)
            mine.slice(0, Math.round((mine.length * logged[m.id]) / 100)).forEach((t) => done.add(t.id))
          }
          return {
            ...proj,
            milestones: proj.milestones.map((m) =>
              logged[m.id] !== undefined ? { ...m, status: 'in_progress', progress: logged[m.id] } : m,
            ),
            tasks: proj.tasks.map((t) => (done.has(t.id) ? { ...t, status: 'done' as const } : t)),
          }
        })
        for (const m of dev)
          out = log(out, action.projectId, 'milestone', m.ownerId, `started "${m.name}" and logged ${logged[m.id]}% progress`, m.deliverables.join(', ') || undefined)
      } else {
        const active = p.milestones.filter((m) => m.stage === stage && m.status === 'not_started')
        out = withProject(out, action.projectId, (proj) => ({
          ...proj,
          milestones: proj.milestones.map((m) =>
            m.stage === stage && m.status === 'not_started' ? { ...m, status: 'in_progress', progress: 10 } : m,
          ),
        }))
        for (const m of active) out = log(out, action.projectId, 'milestone', m.ownerId, `started "${m.name}"`)
      }
      return settle(out, action.projectId)
    }

    case 'log_milestone_progress': {
      const p = db.projects.find((x) => x.id === action.projectId)
      const m = p?.milestones.find((x) => x.id === action.milestoneId)
      if (!p || !m) return db
      let out = withProject(db, action.projectId, (proj) => ({
        ...proj,
        milestones: proj.milestones.map((x) =>
          x.id === action.milestoneId
            ? { ...x, progress: action.progress, status: x.status === 'not_started' ? 'in_progress' : x.status }
            : x,
        ),
      }))
      out = log(out, action.projectId, 'milestone', action.actorId, `logged ${action.progress}% on "${m.name}"`, action.note)
      return settle(out, action.projectId)
    }

    case 'complete_milestone': {
      const p = db.projects.find((x) => x.id === action.projectId)
      const m = p?.milestones.find((x) => x.id === action.milestoneId)
      if (!p || !m) return db
      let out = withProject(db, action.projectId, (proj) => ({
        ...proj,
        milestones: proj.milestones.map((x) =>
          x.id === action.milestoneId ? { ...x, status: 'completed', progress: 100, completedAt: db.today } : x,
        ),
        tasks: proj.tasks.map((t) => (t.milestoneId === action.milestoneId ? { ...t, status: 'done' as const } : t)),
      }))
      const variance = daysBetween(m.baselineDue, db.today)
      out = log(
        out,
        action.projectId,
        'milestone',
        action.actorId,
        `completed milestone "${m.name}"`,
        variance > 0 ? `${variance} day(s) after the baseline date` : 'On or ahead of the baseline date',
      )
      return settle(out, action.projectId)
    }

    case 'add_task': {
      const p = db.projects.find((x) => x.id === action.projectId)
      const m = p?.milestones.find((x) => x.id === action.milestoneId)
      if (!p || !m) return db
      let out = withProject(db, action.projectId, (proj) => ({
        ...proj,
        tasks: [
          ...proj.tasks,
          {
            id: nextId('tsk'),
            milestoneId: action.milestoneId,
            title: action.title,
            assigneeId: action.assigneeId,
            dueDate: action.dueDate,
            status: 'todo' as const,
            priority: action.priority,
          },
        ],
      }))
      out = log(out, action.projectId, 'milestone', action.actorId, `added task "${action.title}"`, m.name)
      return out
    }

    case 'set_task_status': {
      const p = db.projects.find((x) => x.id === action.projectId)
      const t = p?.tasks.find((x) => x.id === action.taskId)
      if (!p || !t) return db
      let out = withProject(db, action.projectId, (proj) => ({
        ...proj,
        tasks: proj.tasks.map((x) => (x.id === action.taskId ? { ...x, status: action.status } : x)),
      }))
      if (action.status === 'done') out = log(out, action.projectId, 'milestone', action.actorId, `completed task "${t.title}"`)
      return out
    }

    /* ------------------------------------------------- delays & blockers */
    case 'record_delay': {
      const p = db.projects.find((x) => x.id === action.projectId)
      const m = p?.milestones.find((x) => x.id === action.input.milestoneId)
      if (!p || !m) return db
      const revised = addDays(m.dueDate, action.input.impactDays)
      let out = withProject(db, action.projectId, (proj) => ({
        ...proj,
        milestones: proj.milestones.map((x) =>
          x.id !== m.id
            ? x
            : {
                ...x,
                dueDate: revised,
                delay: {
                  id: nextId('dly'),
                  milestoneId: x.id,
                  category: action.input.category,
                  note: action.input.note,
                  impactDays: action.input.impactDays,
                  recordedBy: action.actorId,
                  recordedAt: db.today,
                  responsibleId: action.input.responsibleId,
                },
              },
        ),
      }))
      out = shiftDelivery(out, action.projectId, action.input.impactDays)
      const proj = out.projects.find((x) => x.id === action.projectId)!
      out = log(
        out,
        action.projectId,
        'delay',
        action.actorId,
        `recorded a delay on "${m.name}"`,
        `${delayLabel(action.input.category)} · +${action.input.impactDays} day(s) · revised to ${fmtDate(revised)} · responsible ${nameOf(db, action.input.responsibleId)}`,
      )
      out = notify(out, {
        projectId: action.projectId,
        audienceRoles: ['management', 'team_lead'],
        kind: 'overdue',
        title: `Delay recorded — ${proj.name}`,
        body: `${m.name}: ${delayLabel(action.input.category)}. Delivery now ${fmtDate(proj.expectedDeliveryDate)}.`,
        href: `#/projects/${action.projectId}/milestones`,
      })
      return settle(out, action.projectId)
    }

    case 'create_blocker': {
      const p = db.projects.find((x) => x.id === action.projectId)
      if (!p) return db
      const i = action.input
      const blockerId = nextId('blk')
      const milestone = p.milestones.find((m) => m.id === i.milestoneId)
      let out = withProject(db, action.projectId, (proj) => ({
        ...proj,
        blockers: [
          ...proj.blockers,
          {
            id: blockerId,
            projectId: proj.id,
            milestoneId: i.milestoneId,
            title: i.title,
            category: i.category,
            description: i.description,
            responsibleId: i.responsibleId,
            identifiedAt: db.today,
            impactDays: i.impactDays,
            impactSummary: milestone
              ? `${milestone.name} +${i.impactDays} day(s)`
              : `Delivery +${i.impactDays} day(s)`,
            requiredAction: i.requiredAction,
            status: 'open' as const,
          },
        ],
        milestones: proj.milestones.map((m) =>
          m.id === i.fromDelayOnMilestone && m.delay ? { ...m, delay: { ...m.delay, blockerId } } : m,
        ),
      }))
      if (i.bookImpact) out = shiftDelivery(out, action.projectId, i.impactDays)
      out = log(
        out,
        action.projectId,
        'blocker',
        action.actorId,
        `recorded blocker "${i.title}"`,
        `${delayLabel(i.category)} · responsible ${nameOf(db, i.responsibleId)} · +${i.impactDays} day(s)`,
      )
      out = notify(out, {
        projectId: action.projectId,
        audienceRoles: ['management', 'team_lead', 'developer', 'business_owner'],
        kind: 'blocker',
        title: `Blocker affecting ${p.name}`,
        body: `${i.title} — ${i.requiredAction}. Owner: ${nameOf(db, i.responsibleId)}.`,
        href: `#/projects/${action.projectId}/blockers`,
      })
      return settle(out, action.projectId)
    }

    case 'assign_blocker_action': {
      const p = db.projects.find((x) => x.id === action.projectId)
      const b = p?.blockers.find((x) => x.id === action.blockerId)
      if (!p || !b) return db
      let out = withProject(db, action.projectId, (proj) => ({
        ...proj,
        blockers: proj.blockers.map((x) => (x.id === action.blockerId ? { ...x, assignedActionTo: action.userId } : x)),
      }))
      out = log(out, action.projectId, 'blocker', action.actorId, `assigned the required action on "${b.title}" to ${nameOf(db, action.userId)}`, b.requiredAction)
      out = notify(out, {
        projectId: action.projectId,
        audienceRoles: [userById(db, action.userId)?.role ?? 'developer'],
        kind: 'blocker',
        title: 'Action assigned to you',
        body: `${b.requiredAction} — required to clear "${b.title}" on ${p.name}.`,
        href: `#/projects/${action.projectId}/blockers`,
      })
      return settle(out, action.projectId)
    }

    case 'resolve_blocker': {
      const p = db.projects.find((x) => x.id === action.projectId)
      const b = p?.blockers.find((x) => x.id === action.blockerId)
      if (!p || !b) return db
      let out = withProject(db, action.projectId, (proj) => ({
        ...proj,
        blockers: proj.blockers.map((x) =>
          x.id === action.blockerId ? { ...x, status: 'resolved' as const, resolvedAt: db.today, resolutionNote: action.note } : x,
        ),
      }))
      out = log(out, action.projectId, 'blocker', action.actorId, `resolved "${b.title}"`, action.note)
      out = notify(out, {
        projectId: action.projectId,
        audienceRoles: ['management', 'team_lead', 'developer', 'ai_analyst'],
        kind: 'blocker',
        title: `Blocker cleared — ${p.name}`,
        body: `${b.title} is resolved. Work can continue on ${p.milestones.find((m) => m.id === b.milestoneId)?.name ?? 'the project'}.`,
        href: `#/projects/${action.projectId}/blockers`,
      })
      return settle(out, action.projectId)
    }

    /* ----------------------------------------------------- scope changes */
    case 'create_scope_change': {
      const p = db.projects.find((x) => x.id === action.projectId)
      if (!p) return db
      const i = action.input
      const proposed = addDays(p.expectedDeliveryDate, i.deliveryImpactDays)
      let out = withProject(db, action.projectId, (proj) => ({
        ...proj,
        scopeChanges: [
          ...proj.scopeChanges,
          {
            id: nextId('sc'),
            projectId: proj.id,
            title: i.title,
            description: i.description,
            requestedById: i.requestedById,
            reason: i.reason,
            scopeImpact: i.scopeImpact,
            deliveryImpactDays: i.deliveryImpactDays,
            proposedDeliveryDate: proposed,
            decision: 'under_review' as const,
            createdAt: db.today,
          },
        ],
      }))
      out = log(out, action.projectId, 'scope', action.actorId, `raised scope change "${i.title}"`, `Requested by ${nameOf(db, i.requestedById)} · +${i.deliveryImpactDays} day(s) if approved`)
      out = notify(out, {
        projectId: action.projectId,
        audienceRoles: ['business_owner', 'team_lead', 'management'],
        kind: 'scope',
        title: 'Scope change awaiting decision',
        body: `${i.title} on ${p.name}. Delivery would move to ${fmtDate(proposed)}.`,
        href: `#/projects/${action.projectId}/changes`,
      })
      return settle(out, action.projectId)
    }

    case 'decide_scope_change': {
      const p = db.projects.find((x) => x.id === action.projectId)
      const sc = p?.scopeChanges.find((x) => x.id === action.scopeChangeId)
      if (!p || !sc) return db
      let out = withProject(db, action.projectId, (proj) => ({
        ...proj,
        scopeChanges: proj.scopeChanges.map((x) =>
          x.id !== action.scopeChangeId
            ? x
            : { ...x, decision: action.decision, reviewerId: action.actorId, decisionNote: action.note, decidedAt: db.today },
        ),
      }))
      if (action.decision === 'approved') {
        out = shiftDelivery(out, action.projectId, sc.deliveryImpactDays)
        out = withProject(out, action.projectId, (proj) => ({
          ...proj,
          milestones: proj.milestones.map((m) =>
            m.status === 'completed' ? m : { ...m, dueDate: addDays(m.dueDate, sc.deliveryImpactDays) },
          ),
        }))
      }
      const after = out.projects.find((x) => x.id === action.projectId)!
      out = log(
        out,
        action.projectId,
        'scope',
        action.actorId,
        `${action.decision === 'approved' ? 'approved' : 'rejected'} scope change "${sc.title}"`,
        action.decision === 'approved'
          ? `Delivery moved to ${fmtDate(after.expectedDeliveryDate)} (+${sc.deliveryImpactDays} days, scope)`
          : action.note,
      )
      out = notify(out, {
        projectId: action.projectId,
        audienceRoles: ['management', 'team_lead', 'ai_analyst', 'developer'],
        kind: 'scope',
        title: `Scope change ${action.decision}`,
        body:
          action.decision === 'approved'
            ? `${sc.title} approved. Delivery is now ${fmtDate(after.expectedDeliveryDate)} — this slip is scope, not execution.`
            : `${sc.title} was rejected. ${action.note}`,
        href: `#/projects/${action.projectId}/changes`,
      })
      return settle(out, action.projectId)
    }

    /* ------------------------------------------- files, UAT, deployment */
    case 'add_file': {
      let out = withProject(db, action.projectId, (proj) => ({
        ...proj,
        files: [
          {
            id: nextId('f'),
            projectId: proj.id,
            name: action.name,
            kind: action.kind,
            stage: proj.stage,
            uploadedById: action.actorId,
            uploadedAt: db.today,
            size: `${(Math.random() * 3 + 0.2).toFixed(1)} MB`,
          },
          ...proj.files,
        ],
      }))
      out = log(out, action.projectId, 'file', action.actorId, `added deliverable "${action.name}"`)
      return out
    }

    case 'add_uat_feedback': {
      const p = db.projects.find((x) => x.id === action.projectId)
      if (!p) return db
      let out = withProject(db, action.projectId, (proj) => ({
        ...proj,
        uatFeedback: [
          ...proj.uatFeedback,
          {
            id: nextId('uf'),
            projectId: proj.id,
            note: action.note,
            raisedById: action.actorId,
            raisedAt: db.today,
            severity: action.severity,
            status: 'open' as const,
          },
        ],
        gates: proj.gates.map((g) =>
          g.stage === 'uat'
            ? {
                ...g,
                state: g.state === 'not_started' ? ('in_progress' as const) : g.state,
                criteria: g.criteria.map((c) =>
                  c.label === 'Feedback recorded'
                    ? { ...c, done: true, evidence: `${proj.uatFeedback.length + 1} item(s) recorded by business testers`, completedBy: action.actorId, completedAt: db.today }
                    : c,
                ),
              }
            : g,
        ),
      }))
      out = log(out, action.projectId, 'approval', action.actorId, 'recorded UAT feedback', `${action.severity} · ${action.note}`)
      if (action.severity === 'critical')
        out = notify(out, {
          projectId: action.projectId,
          audienceRoles: ['team_lead', 'developer', 'ai_analyst'],
          kind: 'status',
          title: `Critical UAT issue on ${p.name}`,
          body: action.note,
          href: `#/projects/${action.projectId}/uat`,
        })
      return settle(out, action.projectId)
    }

    case 'resolve_uat_feedback': {
      const p = db.projects.find((x) => x.id === action.projectId)
      const item = p?.uatFeedback.find((f) => f.id === action.feedbackId)
      if (!p || !item) return db
      const remainingCritical = p.uatFeedback.filter(
        (f) => f.id !== action.feedbackId && f.status === 'open' && f.severity === 'critical',
      ).length
      let out = withProject(db, action.projectId, (proj) => ({
        ...proj,
        uatFeedback: proj.uatFeedback.map((f) =>
          f.id === action.feedbackId
            ? { ...f, status: 'resolved' as const, resolutionNote: action.note, resolvedAt: db.today }
            : f,
        ),
        // The "critical issues resolved" criterion is evidence, not a claim: it
        // ticks itself the moment the last critical finding is cleared.
        gates: proj.gates.map((g) =>
          g.stage === 'uat' && item.severity === 'critical' && remainingCritical === 0
            ? {
                ...g,
                criteria: g.criteria.map((c) =>
                  c.label === 'Critical issues resolved'
                    ? { ...c, done: true, evidence: 'All critical UAT findings cleared', completedBy: action.actorId, completedAt: db.today }
                    : c,
                ),
              }
            : g,
        ),
      }))
      out = log(out, action.projectId, 'approval', action.actorId, `resolved UAT feedback "${item.note.slice(0, 48)}…"`, action.note)
      return settle(out, action.projectId)
    }

    case 'mark_deployed': {
      const p = db.projects.find((x) => x.id === action.projectId)
      if (!p) return db
      let out = withProject(db, action.projectId, (proj) => ({
        ...proj,
        deployedAt: db.today,
        deploymentRef: action.reference,
        gates: proj.gates.map((g) =>
          g.stage === 'deployment'
            ? {
                ...g,
                state: 'in_progress' as const,
                criteria: g.criteria.map((c) => ({
                  ...c,
                  done: true,
                  evidence:
                    c.label.startsWith('Deployment notes') ? action.notes : c.label.startsWith('Solution deployed') ? action.reference : c.evidence ?? 'Recorded at UAT approval',
                  completedAt: db.today,
                  completedBy: action.actorId,
                })),
              }
            : g,
        ),
        milestones: proj.milestones.map((m) =>
          m.stage === 'deployment' && m.status !== 'completed'
            ? { ...m, status: 'completed' as const, progress: 100, completedAt: db.today }
            : m,
        ),
        files: [
          {
            id: nextId('f'),
            projectId: proj.id,
            name: `${action.reference} — release note`,
            kind: 'release' as const,
            stage: 'deployment' as StageKey,
            uploadedById: action.actorId,
            uploadedAt: db.today,
            size: '0.3 MB',
          },
          ...proj.files,
        ],
      }))
      out = log(out, action.projectId, 'stage', action.actorId, 'marked the solution as deployed to production', `${action.reference} · ${action.notes}`)
      out = notify(out, {
        projectId: action.projectId,
        audienceRoles: ['management', 'business_owner', 'team_lead'],
        kind: 'status',
        title: `${p.name} deployed`,
        body: `Released to production as ${action.reference}.`,
        href: `#/projects/${action.projectId}/timeline`,
      })
      return settle(out, action.projectId)
    }

    /* ------------------------------------------ stabilization & closure */
    case 'add_stabilization_issue': {
      let out = withProject(db, action.projectId, (proj) => ({
        ...proj,
        stabilizationIssues: [
          ...proj.stabilizationIssues,
          {
            id: nextId('si'),
            projectId: proj.id,
            title: action.title,
            severity: action.severity,
            status: 'open' as const,
            reportedById: action.actorId,
            reportedAt: db.today,
          },
        ],
      }))
      out = log(out, action.projectId, 'project', action.actorId, `logged a production issue "${action.title}"`, action.severity)
      return out
    }

    case 'resolve_stabilization_issue': {
      const p = db.projects.find((x) => x.id === action.projectId)
      const issue = p?.stabilizationIssues.find((i) => i.id === action.issueId)
      if (!p || !issue) return db
      let out = withProject(db, action.projectId, (proj) => ({
        ...proj,
        stabilizationIssues: proj.stabilizationIssues.map((i) =>
          i.id === action.issueId ? { ...i, status: 'resolved' as const } : i,
        ),
      }))
      out = log(out, action.projectId, 'project', action.actorId, `resolved production issue "${issue.title}"`)
      return out
    }

    case 'close_project': {
      const p = db.projects.find((x) => x.id === action.projectId)
      if (!p) return db
      let out = withProject(db, action.projectId, (proj) => ({
        ...proj,
        stage: 'completed' as StageKey,
        completedAt: db.today,
        outcomeSummary: action.outcomeSummary,
        milestones: proj.milestones.map((m) =>
          m.status === 'completed' ? m : { ...m, status: 'completed' as const, progress: 100, completedAt: db.today },
        ),
        stageHistory: [
          ...proj.stageHistory.map((h) => (h.exitedAt ? h : { ...h, exitedAt: db.today })),
          { id: nextId('sh'), stage: 'completed' as StageKey, enteredAt: db.today, approvedBy: action.actorId },
        ],
        approvals: [
          ...proj.approvals,
          {
            id: nextId('ap'),
            projectId: proj.id,
            kind: 'closure' as const,
            title: 'Project closure',
            decision: 'approved' as const,
            decidedById: action.actorId,
            decidedAt: db.today,
            note: action.outcomeSummary,
            requiredRole: 'business_owner' as RoleKey,
          },
        ],
      }))
      out = log(out, action.projectId, 'project', action.actorId, 'closed the project', `Delivered ${fmtDate(db.today)} · ${action.outcomeSummary}`)
      out = notify(out, {
        projectId: action.projectId,
        audienceRoles: ['management', 'team_lead', 'business_owner', 'ai_analyst', 'developer'],
        kind: 'status',
        title: `${p.name} completed`,
        body: `The project was delivered and formally closed on ${fmtDate(db.today)}.`,
        href: `#/projects/${action.projectId}`,
      })
      return settle(out, action.projectId)
    }

    /* --------------------------------------------------- notifications */
    case 'read_notification':
      return { ...db, notifications: db.notifications.map((n) => (n.id === action.id ? { ...n, read: true } : n)) }

    case 'read_all_notifications':
      return { ...db, notifications: db.notifications.map((n) => ({ ...n, read: true })) }

    default:
      return db
  }
}
