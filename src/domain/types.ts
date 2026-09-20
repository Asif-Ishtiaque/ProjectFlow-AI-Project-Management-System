/**
 * Anwar AI ProjectFlow — domain model.
 *
 * These types mirror the tables a real backend would expose. Every screen in the
 * prototype reads from this shape (via the /api layer), never from screen-local
 * constants, so that a single action updates stage, health, progress, milestones,
 * blockers, approvals, activity and notifications consistently.
 */

export type ID = string

/* ------------------------------------------------------------------ people */

export type RoleKey =
  | 'management'
  | 'team_lead'
  | 'ai_analyst'
  | 'developer'
  | 'business_owner'

export interface User {
  id: ID
  name: string
  title: string
  role: RoleKey
  departmentId?: ID
  initials: string
}

export interface BusinessUnit {
  id: ID
  name: string
}

export interface Department {
  id: ID
  businessUnitId: ID
  name: string
}

/* --------------------------------------------------------------- lifecycle */

export type StageKey =
  | 'idea'
  | 'discovery'
  | 'design'
  | 'approval'
  | 'development'
  | 'internal_testing'
  | 'uat'
  | 'deployment'
  | 'stabilization'
  | 'completed'

export type GateState =
  | 'not_started'
  | 'in_progress'
  | 'ready_for_review'
  | 'approved'
  | 'changes_requested'

export interface StageGateCriterion {
  id: ID
  label: string
  hint?: string
  required: boolean
  done: boolean
  /** Evidence a reviewer can inspect — what proves this criterion is met. */
  evidence?: string
  completedBy?: ID
  completedAt?: string
}

export interface StageGate {
  id: ID
  projectId: ID
  stage: StageKey
  name: string
  state: GateState
  criteria: StageGateCriterion[]
  submittedBy?: ID
  submittedAt?: string
  /** Who is allowed to approve this gate. */
  approverRole: RoleKey
  approverId?: ID
  decidedAt?: string
  decisionNote?: string
}

export interface StageHistoryEntry {
  id: ID
  stage: StageKey
  enteredAt: string
  exitedAt?: string
  approvedBy?: ID
}

/* -------------------------------------------------------------- milestones */

export type MilestoneStatus =
  | 'not_started'
  | 'in_progress'
  | 'delayed'
  | 'blocked'
  | 'completed'

export interface Task {
  id: ID
  milestoneId: ID
  title: string
  assigneeId: ID
  dueDate: string
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
}

export interface Milestone {
  id: ID
  projectId: ID
  name: string
  description: string
  ownerId: ID
  /** Stage this milestone belongs to — drives "what happens next". */
  stage: StageKey
  /** Commitment made at planning time. Never mutated — variance is measured against it. */
  baselineDue: string
  /** Current committed date. Moves only through a recorded delay or approved scope change. */
  dueDate: string
  status: MilestoneStatus
  /** 0..100 — completion of this milestone's own deliverable. */
  progress: number
  /** Relative size. Overall project progress is weighted by this. */
  weight: number
  deliverables: string[]
  completedAt?: string
  delay?: MilestoneDelay
}

export type DelayCategory =
  | 'requirements_not_finalized'
  | 'resource_unavailable'
  | 'waiting_for_business_feedback'
  | 'scope_change'
  | 'data_unavailable'
  | 'testing_issue'
  | 'development_issue'
  | 'approval_pending'
  | 'integration_dependency'
  | 'other'

export interface MilestoneDelay {
  id: ID
  milestoneId: ID
  category: DelayCategory
  note: string
  impactDays: number
  recordedBy: ID
  recordedAt: string
  responsibleId: ID
  blockerId?: ID
}

/* ----------------------------------------------------------------- issues */

export type BlockerStatus = 'open' | 'resolved'

export interface Blocker {
  id: ID
  projectId: ID
  milestoneId?: ID
  title: string
  category: DelayCategory
  description: string
  responsibleId: ID
  identifiedAt: string
  impactDays: number
  impactSummary: string
  requiredAction: string
  status: BlockerStatus
  resolvedAt?: string
  resolutionNote?: string
  assignedActionTo?: ID
}

export type ScopeChangeDecision = 'under_review' | 'approved' | 'rejected'

export interface ScopeChange {
  id: ID
  projectId: ID
  title: string
  description: string
  requestedById: ID
  reason: string
  scopeImpact: string
  deliveryImpactDays: number
  proposedDeliveryDate: string
  decision: ScopeChangeDecision
  reviewerId?: ID
  decisionNote?: string
  decidedAt?: string
  createdAt: string
}

/* ------------------------------------------------- files, approvals, audit */

export interface ProjectFile {
  id: ID
  projectId: ID
  name: string
  kind: 'document' | 'design' | 'test_result' | 'link' | 'release'
  stage: StageKey
  uploadedById: ID
  uploadedAt: string
  size: string
}

/** What business testers actually found — the evidence behind the UAT gate. */
export interface UatFeedback {
  id: ID
  projectId: ID
  note: string
  raisedById: ID
  raisedAt: string
  severity: 'observation' | 'issue' | 'critical'
  status: 'open' | 'resolved'
  resolutionNote?: string
  resolvedAt?: string
}

export type ApprovalKind =
  | 'discovery_gate'
  | 'design_gate'
  | 'development_gate'
  | 'uat_gate'
  | 'deployment_gate'
  | 'closure'
  | 'scope_change'

export interface Approval {
  id: ID
  projectId: ID
  kind: ApprovalKind
  title: string
  decision: 'approved' | 'changes_requested' | 'pending'
  decidedById?: ID
  decidedAt?: string
  note?: string
  requiredRole: RoleKey
}

export type ActivityKind =
  | 'project'
  | 'stage'
  | 'milestone'
  | 'blocker'
  | 'approval'
  | 'scope'
  | 'delay'
  | 'file'
  | 'assignment'

export interface ActivityLog {
  id: ID
  projectId: ID
  kind: ActivityKind
  actorId: ID
  message: string
  detail?: string
  at: string
}

export interface Notification {
  id: ID
  projectId?: ID
  audienceRoles: RoleKey[]
  kind:
    | 'assignment'
    | 'overdue'
    | 'blocker'
    | 'approval_request'
    | 'approval_result'
    | 'scope'
    | 'status'
  title: string
  body: string
  at: string
  read: boolean
  /** Deep link into the app, e.g. "#/projects/p-hr/milestones". */
  href?: string
}

/* --------------------------------------------------------------- projects */

export type Health = 'on_track' | 'at_risk' | 'delayed' | 'blocked' | 'completed'
export type Priority = 'low' | 'medium' | 'high' | 'critical'

export interface Project {
  id: ID
  code: string
  name: string
  businessUnitId: ID
  departmentId: ID
  businessProblem: string
  expectedOutcome: string

  ownerId: ID
  analystId?: ID
  developerId?: ID
  businessOwnerId?: ID
  contributorIds: ID[]

  stage: StageKey
  priority: Priority
  /** The commitment made when the project was approved. Never mutated. */
  originalDeliveryDate: string
  /** Current commitment. Moves only through recorded delay impact or approved scope change. */
  expectedDeliveryDate: string
  createdAt: string
  completedAt?: string
  closureNote?: string
  outcomeSummary?: string
  deploymentRef?: string
  deployedAt?: string

  /** Health may be pinned by seed data; otherwise it is derived (see logic.ts). */
  stageHistory: StageHistoryEntry[]
  gates: StageGate[]
  milestones: Milestone[]
  tasks: Task[]
  blockers: Blocker[]
  scopeChanges: ScopeChange[]
  files: ProjectFile[]
  approvals: Approval[]
  uatFeedback: UatFeedback[]
  stabilizationIssues: StabilizationIssue[]
}

export interface StabilizationIssue {
  id: ID
  projectId: ID
  title: string
  severity: 'critical' | 'major' | 'minor'
  status: 'open' | 'resolved'
  reportedById: ID
  reportedAt: string
  note?: string
}

/* ------------------------------------------------------------ store shape */

export interface DatabaseShape {
  users: User[]
  businessUnits: BusinessUnit[]
  departments: Department[]
  projects: Project[]
  activity: ActivityLog[]
  notifications: Notification[]
  /** Prototype clock — every "today" in the app resolves through this. */
  today: string
}
