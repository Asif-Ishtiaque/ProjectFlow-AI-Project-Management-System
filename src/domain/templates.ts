import { addDays } from './dates'
import { STAGES } from './lifecycle'
import { nextId } from './ids'
import type { Milestone, Project, StageGate, StageKey, Task } from './types'

/**
 * A new AI project is not an empty shell: intake applies the standard AI
 * delivery plan so that the delivery date is immediately backed by milestones.
 */
type OwnerSlot = 'analyst' | 'developer' | 'business_owner' | 'owner'

export interface People {
  analyst?: string
  developer?: string
  businessOwner?: string
  owner: string
}

const resolveOwner = (slot: OwnerSlot, people: People) =>
  slot === 'analyst'
    ? (people.analyst ?? people.owner)
    : slot === 'developer'
      ? (people.developer ?? people.owner)
      : slot === 'business_owner'
        ? (people.businessOwner ?? people.owner)
        : people.owner

export const MILESTONE_TEMPLATE: {
  name: string
  description: string
  stage: StageKey
  offsetFromDelivery: number
  weight: number
  owner: OwnerSlot
  deliverables: string[]
  /** Tasks are the day-to-day work inside a milestone; the milestone carries the commitment. */
  tasks: { title: string; owner: OwnerSlot; priority: Task['priority']; dueOffset: number }[]
}[] = [
  {
    name: 'Complete Discovery',
    description: 'Document the business problem, map the current process, identify users and agree the expected outcome.',
    stage: 'discovery',
    offsetFromDelivery: -20,
    weight: 1,
    owner: 'analyst',
    deliverables: ['Discovery report', 'Current process map'],
    tasks: [
      { title: 'Interview HR operations on the current query load', owner: 'analyst', priority: 'high', dueOffset: -3 },
      { title: 'Map the as-is policy question process', owner: 'analyst', priority: 'medium', dueOffset: -2 },
      { title: 'Agree the success measure with the HR Director', owner: 'analyst', priority: 'high', dueOffset: 0 },
    ],
  },
  {
    name: 'Requirements & Solution Design',
    description: 'Functional requirements, to-be workflow and the technical approach for the solution.',
    stage: 'design',
    offsetFromDelivery: -16,
    weight: 1,
    owner: 'analyst',
    deliverables: ['Requirements document', 'Solution design note'],
    tasks: [
      { title: 'Write the functional requirements pack', owner: 'analyst', priority: 'high', dueOffset: -2 },
      { title: 'Confirm approved policy content sources', owner: 'analyst', priority: 'medium', dueOffset: -1 },
    ],
  },
  {
    name: 'UI/UX Design',
    description: 'Interface and conversation design reviewed with the business owner.',
    stage: 'design',
    offsetFromDelivery: -13,
    weight: 1,
    owner: 'owner',
    deliverables: ['UI/UX design file'],
    tasks: [
      { title: 'Draft the assistant conversation flow', owner: 'owner', priority: 'medium', dueOffset: -2 },
      { title: 'Review the design with the business owner', owner: 'owner', priority: 'high', dueOffset: 0 },
    ],
  },
  {
    name: 'API Integration',
    description: 'Connect the assistant to the source systems that hold the approved content.',
    stage: 'development',
    offsetFromDelivery: -10,
    weight: 2,
    owner: 'developer',
    deliverables: ['Integration service', 'Connection test log'],
    tasks: [
      { title: 'Request production API endpoint and credentials', owner: 'developer', priority: 'high', dueOffset: -6 },
      { title: 'Build the policy retrieval service', owner: 'developer', priority: 'high', dueOffset: -2 },
      { title: 'Connection and error-handling tests', owner: 'developer', priority: 'medium', dueOffset: 0 },
    ],
  },
  {
    name: 'Core Application Build',
    description: 'Build the end-user experience and the retrieval and answering flow.',
    stage: 'development',
    offsetFromDelivery: -6,
    weight: 2,
    owner: 'developer',
    deliverables: ['Application build'],
    tasks: [
      { title: 'Build the employee-facing interface', owner: 'developer', priority: 'high', dueOffset: -3 },
      { title: 'Ground answers in the approved source with citations', owner: 'developer', priority: 'high', dueOffset: -1 },
    ],
  },
  {
    name: 'Internal Testing',
    description: 'AI team verifies accuracy, response quality and failure handling before business testing.',
    stage: 'internal_testing',
    offsetFromDelivery: -4,
    weight: 1,
    owner: 'developer',
    deliverables: ['Test results'],
    tasks: [
      { title: 'Run the accuracy test set', owner: 'developer', priority: 'high', dueOffset: -1 },
      { title: 'Log and triage defects', owner: 'developer', priority: 'medium', dueOffset: 0 },
    ],
  },
  {
    name: 'Business UAT',
    description: 'Business users test against the outcome they asked for and record feedback.',
    stage: 'uat',
    offsetFromDelivery: -1,
    weight: 1,
    owner: 'business_owner',
    deliverables: ['UAT sign-off'],
    tasks: [
      { title: 'Run UAT scenarios with the HR team', owner: 'business_owner', priority: 'high', dueOffset: -1 },
      { title: 'Record UAT feedback and corrections', owner: 'business_owner', priority: 'medium', dueOffset: 0 },
    ],
  },
  {
    name: 'Production Deployment',
    description: 'Release to production users with a version reference and deployment notes.',
    stage: 'deployment',
    offsetFromDelivery: 0,
    weight: 1,
    owner: 'developer',
    deliverables: ['Release note'],
    tasks: [
      { title: 'Production release and smoke check', owner: 'developer', priority: 'high', dueOffset: 0 },
    ],
  },
]

export const buildMilestones = (projectId: string, deliveryDate: string, people: People): Milestone[] =>
  MILESTONE_TEMPLATE.map((t) => {
    const due = addDays(deliveryDate, t.offsetFromDelivery)
    const ownerId = resolveOwner(t.owner, people)
    return {
      id: nextId('ms'),
      projectId,
      name: t.name,
      description: t.description,
      ownerId,
      stage: t.stage,
      baselineDue: due,
      dueDate: due,
      status: 'not_started',
      progress: 0,
      weight: t.weight,
      deliverables: t.deliverables,
    }
  })

export const buildGates = (projectId: string): StageGate[] =>
  STAGES.filter((s) => s.gate).map((s) => ({
    id: nextId('gate'),
    projectId,
    stage: s.key,
    name: s.gate!.name,
    state: 'not_started',
    approverRole: s.gate!.approverRole,
    criteria: s.gate!.criteria.map((c) => ({
      id: `${nextId('crit')}`,
      label: c.label,
      hint: c.hint,
      required: c.required,
      done: false,
    })),
  }))

export const emptyProject = (): Pick<
  Project,
  'stageHistory' | 'blockers' | 'scopeChanges' | 'files' | 'approvals' | 'tasks' | 'uatFeedback' | 'stabilizationIssues'
> => ({
  stageHistory: [],
  blockers: [],
  scopeChanges: [],
  files: [],
  approvals: [],
  tasks: [],
  uatFeedback: [],
  stabilizationIssues: [],
})

/** Tasks for a freshly created project, matched to the milestones just generated. */
export const buildTasks = (milestones: Milestone[], people: People): Task[] =>
  milestones.flatMap((m) => {
    const template = MILESTONE_TEMPLATE.find((t) => t.name === m.name)
    if (!template) return []
    return template.tasks.map((t) => ({
      id: nextId('tsk'),
      milestoneId: m.id,
      title: t.title,
      assigneeId: resolveOwner(t.owner, people),
      dueDate: addDays(m.dueDate, t.dueOffset),
      status: 'todo' as const,
      priority: t.priority,
    }))
  })
