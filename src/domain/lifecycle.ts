import type { DelayCategory, GateState, Health, Priority, RoleKey, StageKey } from './types'

/* ------------------------------------------------------------ the pipeline */

export interface StageDef {
  key: StageKey
  index: number
  label: string
  short: string
  purpose: string
  /** The gate that must be approved before leaving this stage (null = no gate). */
  gate?: {
    name: string
    approverRole: RoleKey
    criteria: { id: string; label: string; hint?: string; required: boolean }[]
  }
}

export const STAGES: StageDef[] = [
  {
    key: 'idea',
    index: 0,
    label: 'Idea / Request',
    short: 'Idea',
    purpose: 'A business need has been raised and an owner and AI Analyst are being assigned.',
    gate: {
      name: 'Intake Gate',
      approverRole: 'team_lead',
      criteria: [
        { id: 'c-owner', label: 'Project owner assigned', required: true },
        { id: 'c-analyst', label: 'AI Analyst assigned', hint: 'Someone must own discovery.', required: true },
        { id: 'c-problem', label: 'Business problem captured', required: true },
      ],
    },
  },
  {
    key: 'discovery',
    index: 1,
    label: 'Discovery',
    short: 'Discovery',
    purpose: 'Understand the real business problem, the current process and who is affected.',
    gate: {
      name: 'Discovery Completion Gate',
      approverRole: 'team_lead',
      criteria: [
        { id: 'c-problem-doc', label: 'Business problem documented', hint: 'Written problem statement agreed with the business.', required: true },
        { id: 'c-process', label: 'Current process understood', hint: 'As-is process mapped with the department.', required: true },
        { id: 'c-users', label: 'Users identified', hint: 'Who will use the solution, and how often.', required: true },
        { id: 'c-outcome', label: 'Expected outcome defined', hint: 'What measurable change the business expects.', required: true },
      ],
    },
  },
  {
    key: 'design',
    index: 2,
    label: 'Requirements & Design',
    short: 'Design',
    purpose: 'Turn the understood problem into agreed requirements, workflow and a technical approach.',
    gate: {
      name: 'Design Completion Gate',
      approverRole: 'business_owner',
      criteria: [
        { id: 'c-req', label: 'Requirements completed', hint: 'Functional requirements signed off by the business.', required: true },
        { id: 'c-workflow', label: 'Workflow approved', hint: 'The to-be process the business agreed to.', required: true },
        { id: 'c-uiux', label: 'UI/UX or solution design completed', required: true },
        { id: 'c-tech', label: 'Technical approach defined', hint: 'Architecture, model choice, integrations.', required: true },
      ],
    },
  },
  {
    key: 'approval',
    index: 3,
    label: 'Approval',
    short: 'Approval',
    purpose: 'The business formally commits to the scope, the delivery date and the resources to build it.',
    gate: {
      name: 'Business Commitment Gate',
      approverRole: 'business_owner',
      criteria: [
        { id: 'c-scope', label: 'Scope and requirements accepted by the business', required: true },
        { id: 'c-date', label: 'Delivery date accepted', hint: 'The date management will be held to.', required: true },
        { id: 'c-resource', label: 'Developer and effort confirmed', required: true },
      ],
    },
  },
  {
    key: 'development',
    index: 4,
    label: 'Development',
    short: 'Development',
    purpose: 'Build the solution against the approved design.',
    gate: {
      name: 'Development Completion Gate',
      approverRole: 'team_lead',
      criteria: [
        { id: 'c-func', label: 'Required functionality developed', hint: 'Every approved requirement is implemented.', required: true },
        { id: 'c-internal', label: 'Internal testing completed', required: true },
        { id: 'c-bugs', label: 'Major known bugs resolved', hint: 'No open high-severity defects.', required: true },
      ],
    },
  },
  {
    key: 'internal_testing',
    index: 5,
    label: 'Internal Testing',
    short: 'Testing',
    purpose: 'The AI team verifies the build before it reaches business users.',
    gate: {
      name: 'Test Readiness Gate',
      approverRole: 'team_lead',
      criteria: [
        { id: 'c-testplan', label: 'Test scenarios executed', required: true },
        { id: 'c-testresults', label: 'Test results recorded', required: true },
        { id: 'c-uatenv', label: 'UAT environment and data ready', required: true },
      ],
    },
  },
  {
    key: 'uat',
    index: 6,
    label: 'Business Testing / UAT',
    short: 'UAT',
    purpose: 'The business tests the solution against the outcome it asked for.',
    gate: {
      name: 'UAT Completion Gate',
      approverRole: 'business_owner',
      criteria: [
        { id: 'c-uat-done', label: 'Business testing completed', required: true },
        { id: 'c-feedback', label: 'Feedback recorded', required: true },
        { id: 'c-critical', label: 'Critical issues resolved', required: true },
        { id: 'c-approval', label: 'Business approval received', hint: 'Recorded by the Business Owner on approval.', required: true },
      ],
    },
  },
  {
    key: 'deployment',
    index: 7,
    label: 'Deployment',
    short: 'Deployment',
    purpose: 'Release the approved solution to production users.',
    gate: {
      name: 'Deployment Gate',
      approverRole: 'team_lead',
      criteria: [
        { id: 'c-dep-approval', label: 'Business approval recorded', required: true },
        { id: 'c-dep-notes', label: 'Deployment notes and version reference added', required: true },
        { id: 'c-dep-done', label: 'Solution deployed to production', required: true },
      ],
    },
  },
  {
    key: 'stabilization',
    index: 8,
    label: 'Stabilization',
    short: 'Stabilization',
    purpose: 'Watch production, clear early issues and confirm the outcome is being delivered.',
    gate: {
      name: 'Closure Gate',
      approverRole: 'business_owner',
      criteria: [
        { id: 'c-stab-issues', label: 'No outstanding critical production issues', required: true },
        { id: 'c-stab-outcome', label: 'Outcome confirmed with the business', required: true },
        { id: 'c-stab-docs', label: 'Final documentation handed over', required: true },
      ],
    },
  },
  {
    key: 'completed',
    index: 9,
    label: 'Completed',
    short: 'Completed',
    purpose: 'Delivered, accepted and closed.',
  },
]

export const stageDef = (key: StageKey): StageDef =>
  STAGES.find((s) => s.key === key) ?? STAGES[0]

export const stageIndex = (key: StageKey): number => stageDef(key).index

export const nextStage = (key: StageKey): StageKey | null => {
  const i = stageIndex(key)
  return i >= STAGES.length - 1 ? null : STAGES[i + 1].key
}

/* ------------------------------------------------------------- vocabulary */

export const DELAY_CATEGORIES: { value: DelayCategory; label: string }[] = [
  { value: 'requirements_not_finalized', label: 'Requirements not finalized' },
  { value: 'resource_unavailable', label: 'Resource unavailable' },
  { value: 'waiting_for_business_feedback', label: 'Waiting for business feedback' },
  { value: 'scope_change', label: 'Scope change' },
  { value: 'data_unavailable', label: 'Data unavailable' },
  { value: 'testing_issue', label: 'Testing issue' },
  { value: 'development_issue', label: 'Development issue' },
  { value: 'approval_pending', label: 'Approval pending' },
  { value: 'integration_dependency', label: 'Integration dependency' },
  { value: 'other', label: 'Other' },
]

export const delayLabel = (c: DelayCategory) =>
  DELAY_CATEGORIES.find((d) => d.value === c)?.label ?? 'Other'

export const ROLES: { key: RoleKey; label: string; blurb: string }[] = [
  { key: 'management', label: 'Management', blurb: 'Portfolio status, delays, delivery dates and decisions needing attention.' },
  { key: 'team_lead', label: 'AI Team Lead', blurb: 'All projects, assignment, priorities, deadlines, escalation and health.' },
  { key: 'ai_analyst', label: 'AI Analyst', blurb: 'Discovery, requirements, progress tracking, stakeholders and blockers.' },
  { key: 'developer', label: 'Developer', blurb: 'Assigned work, development updates, blockers and deliverables.' },
  { key: 'business_owner', label: 'Business Owner', blurb: 'Requirement and design review, feedback, UAT and final approval.' },
]

export const roleLabel = (r: RoleKey) => ROLES.find((x) => x.key === r)?.label ?? r

export const HEALTH_META: Record<Health, { label: string; tone: string; icon: string }> = {
  on_track: { label: 'On Track', tone: 'ok', icon: '●' },
  at_risk: { label: 'At Risk', tone: 'warn', icon: '▲' },
  delayed: { label: 'Delayed', tone: 'late', icon: '◆' },
  blocked: { label: 'Blocked', tone: 'bad', icon: '■' },
  completed: { label: 'Completed', tone: 'done', icon: '✓' },
}

export const GATE_META: Record<GateState, { label: string; tone: string }> = {
  not_started: { label: 'Not Started', tone: 'muted' },
  in_progress: { label: 'In Progress', tone: 'info' },
  ready_for_review: { label: 'Ready for Review', tone: 'warn' },
  approved: { label: 'Approved', tone: 'ok' },
  changes_requested: { label: 'Changes Requested', tone: 'bad' },
}

export const PRIORITY_META: Record<Priority, { label: string; tone: string }> = {
  low: { label: 'Low', tone: 'muted' },
  medium: { label: 'Medium', tone: 'info' },
  high: { label: 'High', tone: 'warn' },
  critical: { label: 'Critical', tone: 'bad' },
}
