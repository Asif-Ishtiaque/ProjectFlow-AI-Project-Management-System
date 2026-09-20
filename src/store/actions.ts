import type {
  ApprovalKind,
  DatabaseShape,
  DelayCategory,
  Health,
  Priority,
  ProjectFile,
  RoleKey,
  StabilizationIssue,
} from '../domain/types'

export interface NewProjectInput {
  name: string
  businessUnitId: string
  departmentId: string
  businessProblem: string
  expectedOutcome: string
  ownerId: string
  analystId?: string
  developerId?: string
  businessOwnerId?: string
  contributorIds: string[]
  expectedDeliveryDate: string
  priority: Priority
}

export interface BlockerInput {
  title: string
  milestoneId?: string
  category: DelayCategory
  description: string
  responsibleId: string
  impactDays: number
  requiredAction: string
  /** False when the impact was already booked by the delay that spawned this blocker. */
  bookImpact: boolean
  fromDelayOnMilestone?: string
}

export interface DelayInput {
  milestoneId: string
  category: DelayCategory
  note: string
  impactDays: number
  responsibleId: string
}

export interface ScopeChangeInput {
  title: string
  description: string
  requestedById: string
  reason: string
  scopeImpact: string
  deliveryImpactDays: number
}

export type Action =
  | { type: 'reset' }
  | { type: '__commit'; db: DatabaseShape }
  | { type: 'set_role'; role: RoleKey }
  | { type: 'create_project'; input: NewProjectInput; actorId: string }
  | { type: 'assign_people'; projectId: string; analystId?: string; developerId?: string; businessOwnerId?: string; actorId: string }
  | { type: 'toggle_criterion'; projectId: string; gateId: string; criterionId: string; done: boolean; evidence?: string; actorId: string }
  | { type: 'submit_gate'; projectId: string; gateId: string; actorId: string }
  | { type: 'decide_gate'; projectId: string; gateId: string; decision: 'approved' | 'changes_requested'; note: string; actorId: string }
  | { type: 'start_stage_work'; projectId: string; actorId: string }
  | { type: 'log_milestone_progress'; projectId: string; milestoneId: string; progress: number; note?: string; actorId: string }
  | { type: 'complete_milestone'; projectId: string; milestoneId: string; actorId: string }
  | { type: 'add_task'; projectId: string; milestoneId: string; title: string; assigneeId: string; dueDate: string; priority: 'low' | 'medium' | 'high'; actorId: string }
  | { type: 'set_task_status'; projectId: string; taskId: string; status: 'todo' | 'in_progress' | 'done'; actorId: string }
  | { type: 'record_delay'; projectId: string; input: DelayInput; actorId: string }
  | { type: 'create_blocker'; projectId: string; input: BlockerInput; actorId: string }
  | { type: 'assign_blocker_action'; projectId: string; blockerId: string; userId: string; actorId: string }
  | { type: 'resolve_blocker'; projectId: string; blockerId: string; note: string; actorId: string }
  | { type: 'create_scope_change'; projectId: string; input: ScopeChangeInput; actorId: string }
  | { type: 'decide_scope_change'; projectId: string; scopeChangeId: string; decision: 'approved' | 'rejected'; note: string; actorId: string }
  | { type: 'add_file'; projectId: string; name: string; kind: ProjectFile['kind']; actorId: string }
  | { type: 'add_uat_feedback'; projectId: string; note: string; severity: 'observation' | 'issue' | 'critical'; actorId: string }
  | { type: 'resolve_uat_feedback'; projectId: string; feedbackId: string; note: string; actorId: string }
  | { type: 'mark_deployed'; projectId: string; reference: string; notes: string; actorId: string }
  | { type: 'add_stabilization_issue'; projectId: string; title: string; severity: StabilizationIssue['severity']; actorId: string }
  | { type: 'resolve_stabilization_issue'; projectId: string; issueId: string; actorId: string }
  | { type: 'close_project'; projectId: string; outcomeSummary: string; actorId: string }
  | { type: 'read_notification'; id: string }
  | { type: 'read_all_notifications' }
  | { type: 'advance_clock'; days: number }
