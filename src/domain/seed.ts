/**
 * Prototype data set.
 *
 * All names, departments and figures below are FICTIONAL demo data created for
 * this prototype. They are not real Anwar Group employees or records.
 */
import { addDays } from './dates'
import { nextId, resetIds } from './ids'
import { STAGES, stageIndex } from './lifecycle'
import { buildGates, emptyProject } from './templates'
import type {
  ActivityLog,
  DatabaseShape,
  GateState,
  Milestone,
  Notification,
  Project,
  StageGate,
  StageKey,
  Task,
  User,
} from './types'

/**
 * The prototype clock.
 *
 * The journey starts on 08 Sep 2026 so a project created "today" has a plan that
 * lies ahead of it. Use the clock control in the top bar to let days pass — that
 * is how the API Integration milestone (due 20 Sep) genuinely becomes overdue.
 */
export const TODAY = '2026-09-08'

export const USERS: User[] = [
  { id: 'u-kamal', name: 'Kamal Anwar', title: 'Group Director, Operations', role: 'management', initials: 'KA' },
  { id: 'u-sarah', name: 'Sarah Ahmed', title: 'Head of AI Delivery', role: 'team_lead', initials: 'SA' },
  { id: 'u-nadia', name: 'Nadia Rahman', title: 'AI Analyst', role: 'ai_analyst', initials: 'NR' },
  { id: 'u-sabina', name: 'Sabina Yasmin', title: 'AI Analyst', role: 'ai_analyst', initials: 'SY' },
  { id: 'u-ayesha', name: 'Ayesha Siddika', title: 'AI Analyst', role: 'ai_analyst', initials: 'AS' },
  { id: 'u-rahim', name: 'Rahim Hasan', title: 'Software Engineer', role: 'developer', initials: 'RH' },
  { id: 'u-mizan', name: 'Mizanur Rahman', title: 'Data Engineer', role: 'developer', initials: 'MR' },
  { id: 'u-tanvir', name: 'Tanvir Alam', title: 'QA Engineer', role: 'developer', initials: 'TA' },
  { id: 'u-farhana', name: 'Farhana Karim', title: 'Product Designer', role: 'developer', initials: 'FK' },
  { id: 'u-imran', name: 'Imran Chowdhury', title: 'IT Infrastructure Lead', role: 'developer', initials: 'IC' },
  { id: 'u-shahriar', name: 'Shahriar Kabir', title: 'ML Engineer', role: 'developer', initials: 'SK' },
  { id: 'u-hrdir', name: 'Farzana Haque', title: 'HR Director', role: 'business_owner', initials: 'FH' },
  { id: 'u-salesdir', name: 'Arif Mahmud', title: 'Sales Director', role: 'business_owner', initials: 'AM' },
  { id: 'u-fin', name: 'Nusrat Jahan', title: 'Finance Controller', role: 'business_owner', initials: 'NJ' },
  { id: 'u-plant', name: 'Golam Kibria', title: 'Plant Manager', role: 'business_owner', initials: 'GK' },
  { id: 'u-cs', name: 'Rubaiya Islam', title: 'Customer Service Manager', role: 'business_owner', initials: 'RI' },
  { id: 'u-proc', name: 'Tanzim Ahmed', title: 'Head of Procurement', role: 'business_owner', initials: 'TZ' },
]

export const BUSINESS_UNITS = [
  { id: 'bu-group', name: 'Anwar Group (Corporate)' },
  { id: 'bu-cement', name: 'Anwar Cement Sheet' },
  { id: 'bu-ispat', name: 'Anwar Ispat' },
  { id: 'bu-landmark', name: 'Anwar Landmark' },
  { id: 'bu-galv', name: 'Anwar Galvanizing' },
  { id: 'bu-textile', name: 'Hossain Dyeing & Printing' },
]

export const DEPARTMENTS = [
  { id: 'dp-hr', businessUnitId: 'bu-group', name: 'Human Resources' },
  { id: 'dp-fin', businessUnitId: 'bu-group', name: 'Finance & Accounts' },
  { id: 'dp-proc', businessUnitId: 'bu-group', name: 'Procurement' },
  { id: 'dp-it', businessUnitId: 'bu-group', name: 'Information Technology' },
  { id: 'dp-sales', businessUnitId: 'bu-cement', name: 'Sales & Distribution' },
  { id: 'dp-mfg', businessUnitId: 'bu-ispat', name: 'Manufacturing' },
  { id: 'dp-cs', businessUnitId: 'bu-landmark', name: 'Customer Service' },
  { id: 'dp-hse', businessUnitId: 'bu-galv', name: 'Health & Safety' },
  { id: 'dp-qc', businessUnitId: 'bu-cement', name: 'Production & Quality' },
  { id: 'dp-wh', businessUnitId: 'bu-group', name: 'Warehouse & Logistics' },
]

/* ------------------------------------------------------------- seed tools */

type MsSeed = {
  name: string
  desc?: string
  stage: StageKey
  owner: string
  due: string
  baseline?: string
  weight?: number
  status: Milestone['status']
  progress?: number
  deliverables?: string[]
}

const ms = (projectId: string, s: MsSeed): Milestone => ({
  id: nextId('ms'),
  projectId,
  name: s.name,
  description: s.desc ?? '',
  ownerId: s.owner,
  stage: s.stage,
  baselineDue: s.baseline ?? s.due,
  dueDate: s.due,
  status: s.status,
  progress: s.progress ?? (s.status === 'completed' ? 100 : 0),
  weight: s.weight ?? 1,
  deliverables: s.deliverables ?? [],
  completedAt: s.status === 'completed' ? s.due : undefined,
})

/** Gates for stages already passed are approved with their evidence recorded. */
const gatesFor = (
  projectId: string,
  currentStage: StageKey,
  currentState: GateState = 'in_progress',
  doneCount?: number,
  submittedDaysAgo = 3,
): StageGate[] => {
  const gates = buildGates(projectId)
  const curIdx = stageIndex(currentStage)
  return gates.map((g) => {
    const gi = stageIndex(g.stage)
    if (gi < curIdx) {
      return {
        ...g,
        state: 'approved' as GateState,
        criteria: g.criteria.map((c) => ({ ...c, done: true, evidence: 'Recorded during delivery' })),
        submittedAt: TODAY,
        decidedAt: TODAY,
        decisionNote: 'Approved.',
      }
    }
    if (gi === curIdx) {
      const n = doneCount ?? (currentState === 'ready_for_review' ? g.criteria.length : 1)
      return {
        ...g,
        state: currentState,
        criteria: g.criteria.map((c, i) => ({ ...c, done: i < n })),
        submittedAt: currentState === 'ready_for_review' ? addDays(TODAY, -submittedDaysAgo) : undefined,
      }
    }
    return g
  })
}

const history = (stages: StageKey[], start: string): Project['stageHistory'] =>
  stages.map((s, i) => ({
    id: nextId('sh'),
    stage: s,
    enteredAt: addDays(start, i * 5),
    exitedAt: i === stages.length - 1 ? undefined : addDays(start, (i + 1) * 5),
  }))

/* ----------------------------------------------------------- the projects */

const buildSeedProjects = (): Project[] => {
  const projects: Project[] = []

  /* 1 — Sales Demand Forecasting: design gate submitted, waiting on the business */
  {
    const id = 'p-forecast'
    projects.push({
      ...emptyProject(),
      id,
      code: 'AI-2026-014',
      name: 'Sales Demand Forecasting',
      businessUnitId: 'bu-cement',
      departmentId: 'dp-sales',
      businessProblem:
        'Depot-level demand is estimated manually each month, which causes stock-outs in peak season and excess inventory afterwards.',
      expectedOutcome: 'Monthly depot-level demand forecast with an accuracy the sales team can plan dispatch against.',
      ownerId: 'u-sarah',
      analystId: 'u-sabina',
      developerId: 'u-mizan',
      businessOwnerId: 'u-salesdir',
      contributorIds: ['u-tanvir'],
      stage: 'design',
      priority: 'high',
      originalDeliveryDate: '2026-10-14',
      expectedDeliveryDate: '2026-10-14',
      createdAt: '2026-07-21',
      stageHistory: history(['idea', 'discovery', 'design'], '2026-07-21'),
      gates: gatesFor(id, 'design', 'ready_for_review'),
      milestones: [
        ms(id, { name: 'Complete Discovery', stage: 'discovery', owner: 'u-sabina', due: '2026-08-14', status: 'completed' }),
        ms(id, { name: 'Historical data assessment', stage: 'discovery', owner: 'u-mizan', due: '2026-08-22', status: 'completed' }),
        ms(id, { name: 'Requirements & Solution Design', stage: 'design', owner: 'u-sabina', due: '2026-09-10', status: 'in_progress', progress: 80 }),
        ms(id, { name: 'Forecast model build', stage: 'development', owner: 'u-mizan', due: '2026-09-26', status: 'not_started', weight: 2 }),
        ms(id, { name: 'Business UAT', stage: 'uat', owner: 'u-salesdir', due: '2026-10-10', status: 'not_started' }),
        ms(id, { name: 'Production Deployment', stage: 'deployment', owner: 'u-mizan', due: '2026-10-14', status: 'not_started' }),
      ],
      approvals: [],
      files: [
        { id: nextId('f'), projectId: id, name: 'Demand Forecasting — Discovery Report.pdf', kind: 'document', stage: 'discovery', uploadedById: 'u-sabina', uploadedAt: '2026-08-14', size: '1.4 MB' },
      ],
    })
  }

  /* 2 — Invoice Data Extraction: healthy development */
  {
    const id = 'p-invoice'
    projects.push({
      ...emptyProject(),
      id,
      code: 'AI-2026-011',
      name: 'Invoice Data Extraction',
      businessUnitId: 'bu-group',
      departmentId: 'dp-fin',
      businessProblem:
        'Accounts payable keys supplier invoice data by hand, which delays payment runs and introduces posting errors.',
      expectedOutcome: 'Supplier invoices read automatically with values posted for review instead of manual entry.',
      ownerId: 'u-sarah',
      analystId: 'u-nadia',
      developerId: 'u-mizan',
      businessOwnerId: 'u-fin',
      contributorIds: [],
      stage: 'development',
      priority: 'medium',
      originalDeliveryDate: '2026-10-29',
      expectedDeliveryDate: '2026-11-04',
      createdAt: '2026-07-06',
      stageHistory: history(['idea', 'discovery', 'design', 'approval', 'development'], '2026-07-06'),
      gates: gatesFor(id, 'development', 'in_progress', 1),
      milestones: [
        ms(id, { name: 'Complete Discovery', stage: 'discovery', owner: 'u-nadia', due: '2026-07-25', status: 'completed' }),
        ms(id, { name: 'Requirements & Solution Design', stage: 'design', owner: 'u-nadia', due: '2026-08-12', status: 'completed' }),
        ms(id, { name: 'Extraction pipeline', stage: 'development', owner: 'u-mizan', due: '2026-09-16', status: 'in_progress', progress: 55, weight: 2 }),
        ms(id, { name: 'ERP posting integration', stage: 'development', owner: 'u-mizan', due: '2026-10-01', status: 'not_started', weight: 2 }),
        ms(id, { name: 'Internal Testing', stage: 'internal_testing', owner: 'u-tanvir', due: '2026-10-15', status: 'not_started' }),
        ms(id, { name: 'Business UAT', stage: 'uat', owner: 'u-fin', due: '2026-10-31', baseline: '2026-10-25', status: 'not_started' }),
        ms(id, { name: 'Production Deployment', stage: 'deployment', owner: 'u-mizan', due: '2026-11-04', baseline: '2026-10-29', status: 'not_started' }),
      ],
      scopeChanges: [
        {
          id: nextId('sc'),
          projectId: id,
          title: 'Include handwritten delivery challans',
          description:
            'Around a fifth of supplier invoices arrive with a handwritten delivery challan attached. Finance wants those read as well, not just the printed invoice.',
          requestedById: 'u-fin',
          reason: 'Without the challan the posting still needs a manual check, so the saving is only partly realised.',
          scopeImpact: 'Second extraction model for handwriting, extra review queue and additional test set.',
          deliveryImpactDays: 6,
          proposedDeliveryDate: '2026-11-04',
          decision: 'approved',
          reviewerId: 'u-fin',
          decisionNote: 'Worth the six days — the half-automated version would not have removed the manual step.',
          decidedAt: '2026-09-02',
          createdAt: '2026-08-29',
        },
      ],
    })
  }

  /* 3 — Predictive Maintenance: overdue milestone, delay recorded, NOT blocked */
  {
    const id = 'p-maint'
    const m1 = ms(id, { name: 'Sensor data pipeline', stage: 'development', owner: 'u-mizan', due: '2026-09-11', baseline: '2026-09-04', status: 'in_progress', progress: 65, weight: 2 })
    const m2 = ms(id, { name: 'Failure model training', stage: 'development', owner: 'u-mizan', due: '2026-09-05', status: 'delayed', progress: 40, weight: 2 })
    m2.delay = {
      id: nextId('dly'),
      milestoneId: m2.id,
      category: 'data_unavailable',
      note: 'Two of the four line sensors were offline during the sampling window, so the training set is incomplete.',
      impactDays: 4,
      recordedBy: 'u-sabina',
      recordedAt: '2026-09-06',
      responsibleId: 'u-mizan',
    }
    projects.push({
      ...emptyProject(),
      id,
      code: 'AI-2026-009',
      name: 'Predictive Maintenance Pilot',
      businessUnitId: 'bu-ispat',
      departmentId: 'dp-mfg',
      businessProblem:
        'Unplanned rolling-mill stoppages are only detected after failure, costing production hours every month.',
      expectedOutcome: 'Early warning of likely equipment failure so maintenance can be scheduled before a stoppage.',
      ownerId: 'u-sarah',
      analystId: 'u-sabina',
      developerId: 'u-mizan',
      businessOwnerId: 'u-plant',
      contributorIds: ['u-imran'],
      stage: 'development',
      priority: 'high',
      originalDeliveryDate: '2026-09-25',
      expectedDeliveryDate: '2026-09-29',
      createdAt: '2026-06-18',
      stageHistory: history(['idea', 'discovery', 'design', 'approval', 'development'], '2026-06-18'),
      gates: gatesFor(id, 'development', 'in_progress', 0),
      milestones: [
        ms(id, { name: 'Complete Discovery', stage: 'discovery', owner: 'u-sabina', due: '2026-07-10', status: 'completed' }),
        ms(id, { name: 'Requirements & Solution Design', stage: 'design', owner: 'u-sabina', due: '2026-07-31', status: 'completed' }),
        m2,
        m1,
        ms(id, { name: 'Internal Testing', stage: 'internal_testing', owner: 'u-tanvir', due: '2026-09-18', status: 'not_started' }),
        ms(id, { name: 'Business UAT', stage: 'uat', owner: 'u-plant', due: '2026-09-24', status: 'not_started' }),
      ],
    })
  }

  /* 4 — Customer Service Assistant: blocked in UAT */
  {
    const id = 'p-cs'
    const uatMs = ms(id, { name: 'Business UAT', stage: 'uat', owner: 'u-cs', due: '2026-09-07', status: 'blocked', progress: 20 })
    projects.push({
      ...emptyProject(),
      id,
      code: 'AI-2026-007',
      name: 'Customer Service Assistant',
      businessUnitId: 'bu-landmark',
      departmentId: 'dp-cs',
      businessProblem:
        'Customer service agents search three separate systems to answer handover and warranty questions, which keeps call times high.',
      expectedOutcome: 'Agents get one approved answer with its source, reducing average handling time.',
      ownerId: 'u-sarah',
      analystId: 'u-nadia',
      developerId: 'u-rahim',
      businessOwnerId: 'u-cs',
      contributorIds: [],
      stage: 'uat',
      priority: 'critical',
      originalDeliveryDate: '2026-09-16',
      expectedDeliveryDate: '2026-09-21',
      createdAt: '2026-06-01',
      stageHistory: history(['idea', 'discovery', 'design', 'approval', 'development', 'internal_testing', 'uat'], '2026-06-01'),
      gates: gatesFor(id, 'uat', 'in_progress', 2),
      milestones: [
        ms(id, { name: 'Complete Discovery', stage: 'discovery', owner: 'u-nadia', due: '2026-06-20', status: 'completed' }),
        ms(id, { name: 'Requirements & Solution Design', stage: 'design', owner: 'u-nadia', due: '2026-07-11', status: 'completed' }),
        ms(id, { name: 'Knowledge base build', stage: 'development', owner: 'u-rahim', due: '2026-08-08', status: 'completed', weight: 2 }),
        ms(id, { name: 'Agent console', stage: 'development', owner: 'u-rahim', due: '2026-08-22', status: 'completed', weight: 2 }),
        ms(id, { name: 'Internal Testing', stage: 'internal_testing', owner: 'u-tanvir', due: '2026-09-01', status: 'completed' }),
        uatMs,
        ms(id, { name: 'Production Deployment', stage: 'deployment', owner: 'u-rahim', due: '2026-09-21', status: 'not_started' }),
      ],
      files: [
        { id: nextId('f'), projectId: id, name: 'Agent Assistant — internal test results.xlsx', kind: 'test_result', stage: 'internal_testing', uploadedById: 'u-tanvir', uploadedAt: '2026-09-01', size: '0.8 MB' },
        { id: nextId('f'), projectId: id, name: 'UAT script — 30 handover & warranty scenarios.docx', kind: 'document', stage: 'uat', uploadedById: 'u-cs', uploadedAt: '2026-09-03', size: '0.4 MB' },
      ],
      uatFeedback: [
        {
          id: nextId('uf'),
          projectId: id,
          note: 'Warranty answers quote the 2023 policy instead of the current one for two product lines.',
          raisedById: 'u-cs',
          raisedAt: '2026-09-04',
          severity: 'critical',
          status: 'open',
        },
        {
          id: nextId('uf'),
          projectId: id,
          note: 'Handover checklist answers are correct but too long for a live call — agents want the summary first.',
          raisedById: 'u-cs',
          raisedAt: '2026-09-04',
          severity: 'issue',
          status: 'open',
        },
        {
          id: nextId('uf'),
          projectId: id,
          note: 'Source link on every answer works well; agents said it settles disputes with customers on the call.',
          raisedById: 'u-cs',
          raisedAt: '2026-09-03',
          severity: 'observation',
          status: 'resolved',
          resolutionNote: 'Noted — no change required.',
          resolvedAt: '2026-09-03',
        },
        {
          id: nextId('uf'),
          projectId: id,
          note: 'Assistant returned nothing for Bengali-language queries from the Chattogram desk.',
          raisedById: 'u-cs',
          raisedAt: '2026-09-02',
          severity: 'issue',
          status: 'resolved',
          resolutionNote: 'Out of scope for this release; raised as a separate request.',
          resolvedAt: '2026-09-05',
        },
      ],
      approvals: [
        { id: nextId('ap'), projectId: id, kind: 'design_gate', title: 'Design Completion Gate', decision: 'approved', decidedById: 'u-cs', decidedAt: '2026-07-11', note: 'Agent console layout agreed with the service desk team.', requiredRole: 'business_owner' },
        { id: nextId('ap'), projectId: id, kind: 'development_gate', title: 'Development Completion Gate', decision: 'approved', decidedById: 'u-sarah', decidedAt: '2026-08-26', note: 'All approved requirements delivered.', requiredRole: 'team_lead' },
        { id: nextId('ap'), projectId: id, kind: 'uat_gate', title: 'UAT Completion Gate', decision: 'pending', requiredRole: 'business_owner' },
      ],
      blockers: [
        {
          id: nextId('blk'),
          projectId: id,
          milestoneId: uatMs.id,
          title: 'UAT test accounts not provisioned',
          category: 'resource_unavailable',
          description:
            'Business testers cannot sign in to the UAT environment because the service desk has not created the eight test accounts requested on 16 Sep.',
          responsibleId: 'u-imran',
          identifiedAt: '2026-09-05',
          impactDays: 5,
          impactSummary: 'Business UAT cannot start — delivery +5 days',
          requiredAction: 'Provision 8 UAT accounts and confirm access to the service desk ticket',
          status: 'open',
        },
      ],
    })
  }

  /* 5 — Supplier Document Classifier: healthy, in internal testing */
  {
    const id = 'p-docs'
    projects.push({
      ...emptyProject(),
      id,
      code: 'AI-2026-012',
      name: 'Supplier Document Classifier',
      businessUnitId: 'bu-group',
      departmentId: 'dp-proc',
      businessProblem:
        'Procurement receives supplier documents by email and sorts them by hand before they reach the right buyer.',
      expectedOutcome: 'Incoming supplier documents routed to the right buyer automatically on arrival.',
      ownerId: 'u-sarah',
      analystId: 'u-nadia',
      developerId: 'u-rahim',
      businessOwnerId: 'u-proc',
      contributorIds: [],
      stage: 'internal_testing',
      priority: 'medium',
      originalDeliveryDate: '2026-10-06',
      expectedDeliveryDate: '2026-10-06',
      createdAt: '2026-07-14',
      stageHistory: history(['idea', 'discovery', 'design', 'approval', 'development', 'internal_testing'], '2026-07-14'),
      gates: gatesFor(id, 'internal_testing', 'in_progress', 2),
      files: [
        { id: nextId('f'), projectId: id, name: 'Classifier accuracy — internal test run 3.xlsx', kind: 'test_result', stage: 'internal_testing', uploadedById: 'u-tanvir', uploadedAt: '2026-09-05', size: '0.6 MB' },
      ],
      milestones: [
        ms(id, { name: 'Complete Discovery', stage: 'discovery', owner: 'u-nadia', due: '2026-07-29', status: 'completed' }),
        ms(id, { name: 'Requirements & Solution Design', stage: 'design', owner: 'u-nadia', due: '2026-08-15', status: 'completed' }),
        ms(id, { name: 'Classifier build', stage: 'development', owner: 'u-rahim', due: '2026-09-04', status: 'completed', weight: 2 }),
        ms(id, { name: 'Internal Testing', stage: 'internal_testing', owner: 'u-tanvir', due: '2026-09-15', status: 'in_progress', progress: 45 }),
        ms(id, { name: 'Business UAT', stage: 'uat', owner: 'u-proc', due: '2026-09-30', status: 'not_started' }),
        ms(id, { name: 'Production Deployment', stage: 'deployment', owner: 'u-rahim', due: '2026-10-06', status: 'not_started' }),
      ],
      scopeChanges: [
        {
          id: nextId('sc'),
          projectId: id,
          title: 'Return rejected documents to the supplier automatically',
          description:
            'When a document cannot be classified, procurement wants it sent back to the supplier with a note instead of landing in a manual queue.',
          requestedById: 'u-proc',
          reason: 'The manual queue is what the project was meant to remove.',
          scopeImpact: 'Supplier notification template, bounce-back rules and an audit trail for returned documents.',
          deliveryImpactDays: 4,
          proposedDeliveryDate: '2026-10-10',
          decision: 'under_review',
          createdAt: '2026-09-06',
        },
      ],
    })
  }

  /* 6 — Exit Interview Analyzer: brand new request, no analyst yet */
  {
    const id = 'p-exit'
    projects.push({
      ...emptyProject(),
      id,
      code: 'AI-2026-016',
      name: 'Exit Interview Analyzer',
      businessUnitId: 'bu-textile',
      departmentId: 'dp-hr',
      businessProblem:
        'Exit interview notes are stored as free text and never analysed, so recurring reasons for leaving are not visible to management.',
      expectedOutcome: 'Themes and trends from exit interviews summarised each quarter for the HR leadership review.',
      ownerId: 'u-sarah',
      analystId: undefined,
      developerId: undefined,
      businessOwnerId: 'u-hrdir',
      contributorIds: [],
      stage: 'idea',
      priority: 'low',
      originalDeliveryDate: '2026-12-01',
      expectedDeliveryDate: '2026-12-01',
      createdAt: '2026-09-04',
      stageHistory: history(['idea'], '2026-09-04'),
      gates: gatesFor(id, 'idea', 'in_progress', 1),
      milestones: [],
    })
  }

  /* 7 — Safety Incident Assistant: delivered and closed */
  {
    const id = 'p-safety'
    projects.push({
      ...emptyProject(),
      id,
      code: 'AI-2026-003',
      name: 'Safety Incident Reporting Assistant',
      businessUnitId: 'bu-galv',
      departmentId: 'dp-hse',
      businessProblem:
        'Shop-floor incidents were reported on paper and reached the HSE team days later, which delayed corrective action.',
      expectedOutcome: 'Incidents reported from the floor in minutes with the HSE team notified immediately.',
      ownerId: 'u-sarah',
      analystId: 'u-nadia',
      developerId: 'u-rahim',
      businessOwnerId: 'u-plant',
      contributorIds: [],
      stage: 'completed',
      priority: 'high',
      originalDeliveryDate: '2026-08-14',
      expectedDeliveryDate: '2026-08-17',
      completedAt: '2026-08-17',
      deployedAt: '2026-08-12',
      deploymentRef: 'REL-2026.08.26-HSE-1.0',
      outcomeSummary:
        'Average time from incident to HSE notification fell from 2 days to under 10 minutes in the first three weeks.',
      createdAt: '2026-04-22',
      stageHistory: history(
        ['idea', 'discovery', 'design', 'approval', 'development', 'internal_testing', 'uat', 'deployment', 'stabilization', 'completed'],
        '2026-04-22',
      ),
      gates: gatesFor(id, 'completed'),
      milestones: [
        ms(id, { name: 'Complete Discovery', stage: 'discovery', owner: 'u-nadia', due: '2026-05-14', status: 'completed' }),
        ms(id, { name: 'Requirements & Solution Design', stage: 'design', owner: 'u-nadia', due: '2026-06-04', status: 'completed' }),
        ms(id, { name: 'Reporting app build', stage: 'development', owner: 'u-rahim', due: '2026-07-10', status: 'completed', weight: 2 }),
        ms(id, { name: 'Internal Testing', stage: 'internal_testing', owner: 'u-tanvir', due: '2026-07-23', status: 'completed' }),
        ms(id, { name: 'Business UAT', stage: 'uat', owner: 'u-plant', due: '2026-08-06', status: 'completed' }),
        ms(id, { name: 'Production Deployment', stage: 'deployment', owner: 'u-rahim', due: '2026-08-12', status: 'completed' }),
      ],
      files: [
        { id: nextId('f'), projectId: id, name: 'Safety Assistant — UAT results and sign-off.pdf', kind: 'test_result', stage: 'uat', uploadedById: 'u-plant', uploadedAt: '2026-08-06', size: '1.1 MB' },
        { id: nextId('f'), projectId: id, name: 'REL-2026.08.12-HSE-1.0 — release note', kind: 'release', stage: 'deployment', uploadedById: 'u-rahim', uploadedAt: '2026-08-12', size: '0.3 MB' },
      ],
      uatFeedback: [
        {
          id: nextId('uf'),
          projectId: id,
          note: 'Photo upload failed on the older shop-floor handsets used on night shift.',
          raisedById: 'u-plant',
          raisedAt: '2026-08-03',
          severity: 'critical',
          status: 'resolved',
          resolutionNote: 'Image compression added before upload; retested on both handset models.',
          resolvedAt: '2026-08-05',
        },
        {
          id: nextId('uf'),
          projectId: id,
          note: 'Incident categories should match the HSE register wording exactly.',
          raisedById: 'u-plant',
          raisedAt: '2026-08-03',
          severity: 'issue',
          status: 'resolved',
          resolutionNote: 'Category list replaced with the register list.',
          resolvedAt: '2026-08-04',
        },
        {
          id: nextId('uf'),
          projectId: id,
          note: 'Operators completed a report in under a minute without training.',
          raisedById: 'u-plant',
          raisedAt: '2026-08-06',
          severity: 'observation',
          status: 'resolved',
          resolutionNote: 'Recorded as an outcome measure.',
          resolvedAt: '2026-08-06',
        },
      ],
      approvals: [
        { id: nextId('ap'), projectId: id, kind: 'uat_gate', title: 'UAT Completion Gate', decision: 'approved', decidedById: 'u-plant', decidedAt: '2026-08-07', note: 'Tested on two shifts. Approved.', requiredRole: 'business_owner' },
        { id: nextId('ap'), projectId: id, kind: 'closure', title: 'Project closure', decision: 'approved', decidedById: 'u-plant', decidedAt: '2026-08-17', note: 'Outcome confirmed.', requiredRole: 'business_owner' },
      ],
    })
  }

  /* 8 — Visual Quality Check: discovery gate sitting with the AI Team Lead */
  {
    const id = 'p-vision'
    projects.push({
      ...emptyProject(),
      id,
      code: 'AI-2026-017',
      name: 'Production Line Visual Quality Check',
      businessUnitId: 'bu-cement',
      departmentId: 'dp-qc',
      businessProblem:
        'Sheet defects are caught by spot checks at the end of the line, so a faulty batch can run for hours before anyone notices.',
      expectedOutcome: 'Defects flagged on the line within seconds so the batch can be corrected instead of scrapped.',
      ownerId: 'u-sarah',
      analystId: 'u-ayesha',
      developerId: 'u-shahriar',
      businessOwnerId: 'u-plant',
      contributorIds: ['u-tanvir'],
      stage: 'discovery',
      priority: 'medium',
      originalDeliveryDate: '2026-11-28',
      expectedDeliveryDate: '2026-11-28',
      createdAt: '2026-08-24',
      stageHistory: history(['idea', 'discovery'], '2026-08-24'),
      gates: gatesFor(id, 'discovery', 'ready_for_review', undefined, 0),
      milestones: [
        ms(id, { name: 'Line survey and defect catalogue', stage: 'discovery', owner: 'u-ayesha', due: '2026-09-03', status: 'completed' }),
        ms(id, { name: 'Complete Discovery', stage: 'discovery', owner: 'u-ayesha', due: '2026-09-09', status: 'in_progress', progress: 90 }),
        ms(id, { name: 'Requirements & Solution Design', stage: 'design', owner: 'u-ayesha', due: '2026-09-26', status: 'not_started' }),
        ms(id, { name: 'Defect model training', stage: 'development', owner: 'u-shahriar', due: '2026-10-30', status: 'not_started', weight: 2 }),
        ms(id, { name: 'Line camera integration', stage: 'development', owner: 'u-shahriar', due: '2026-11-13', status: 'not_started', weight: 2 }),
        ms(id, { name: 'Business UAT', stage: 'uat', owner: 'u-plant', due: '2026-11-24', status: 'not_started' }),
        ms(id, { name: 'Production Deployment', stage: 'deployment', owner: 'u-shahriar', due: '2026-11-28', status: 'not_started' }),
      ],
      files: [
        { id: nextId('f'), projectId: id, name: 'Line 2 defect catalogue — 14 defect types.xlsx', kind: 'document', stage: 'discovery', uploadedById: 'u-ayesha', uploadedAt: '2026-09-03', size: '0.9 MB' },
      ],
    })
  }

  /* 9 — Dealer Credit Risk: waiting on the business to commit to scope and date */
  {
    const id = 'p-credit'
    projects.push({
      ...emptyProject(),
      id,
      code: 'AI-2026-015',
      name: 'Dealer Credit Risk Scoring',
      businessUnitId: 'bu-ispat',
      departmentId: 'dp-fin',
      businessProblem:
        'Credit limits for dealers are set from experience and last year’s ledger, so exposure is only reviewed after a payment is missed.',
      expectedOutcome: 'A monthly risk score per dealer that finance can act on before exposure builds up.',
      ownerId: 'u-sarah',
      analystId: 'u-sabina',
      developerId: 'u-mizan',
      businessOwnerId: 'u-fin',
      contributorIds: [],
      stage: 'approval',
      priority: 'high',
      originalDeliveryDate: '2026-12-10',
      expectedDeliveryDate: '2026-12-10',
      createdAt: '2026-08-10',
      stageHistory: history(['idea', 'discovery', 'design', 'approval'], '2026-08-10'),
      gates: gatesFor(id, 'approval', 'ready_for_review', undefined, 1),
      milestones: [
        ms(id, { name: 'Complete Discovery', stage: 'discovery', owner: 'u-sabina', due: '2026-08-22', status: 'completed' }),
        ms(id, { name: 'Requirements & Solution Design', stage: 'design', owner: 'u-sabina', due: '2026-09-05', status: 'completed' }),
        ms(id, { name: 'Scoring model build', stage: 'development', owner: 'u-mizan', due: '2026-10-24', status: 'not_started', weight: 2 }),
        ms(id, { name: 'Ledger data integration', stage: 'development', owner: 'u-mizan', due: '2026-11-14', status: 'not_started', weight: 2 }),
        ms(id, { name: 'Internal Testing', stage: 'internal_testing', owner: 'u-tanvir', due: '2026-11-27', status: 'not_started' }),
        ms(id, { name: 'Business UAT', stage: 'uat', owner: 'u-fin', due: '2026-12-06', status: 'not_started' }),
        ms(id, { name: 'Production Deployment', stage: 'deployment', owner: 'u-mizan', due: '2026-12-10', status: 'not_started' }),
      ],
      approvals: [
        { id: nextId('ap'), projectId: id, kind: 'design_gate', title: 'Design Completion Gate', decision: 'approved', decidedById: 'u-fin', decidedAt: '2026-09-05', note: 'Scoring factors agreed with the credit committee.', requiredRole: 'business_owner' },
        { id: nextId('ap'), projectId: id, kind: 'approval_gate' as never, title: 'Business Commitment Gate', decision: 'pending', requiredRole: 'business_owner' },
      ],
    })
  }

  /* 10 — Stock Count Assistant: live in production, stabilizing */
  {
    const id = 'p-stock'
    projects.push({
      ...emptyProject(),
      id,
      code: 'AI-2026-010',
      name: 'Warehouse Stock Count Assistant',
      businessUnitId: 'bu-group',
      departmentId: 'dp-wh',
      businessProblem:
        'Monthly stock counts are recorded on paper and keyed in days later, so the system stock never matches the floor.',
      expectedOutcome: 'Counts captured on a handset at the rack and posted the same day.',
      ownerId: 'u-sarah',
      analystId: 'u-nadia',
      developerId: 'u-rahim',
      businessOwnerId: 'u-proc',
      contributorIds: ['u-imran'],
      stage: 'stabilization',
      priority: 'medium',
      originalDeliveryDate: '2026-09-05',
      expectedDeliveryDate: '2026-09-05',
      deployedAt: '2026-09-01',
      deploymentRef: 'REL-2026.09.01-WH-1.0',
      createdAt: '2026-06-08',
      stageHistory: history(
        ['idea', 'discovery', 'design', 'approval', 'development', 'internal_testing', 'uat', 'deployment', 'stabilization'],
        '2026-06-08',
      ),
      gates: gatesFor(id, 'stabilization', 'in_progress', 1),
      milestones: [
        ms(id, { name: 'Complete Discovery', stage: 'discovery', owner: 'u-nadia', due: '2026-06-27', status: 'completed' }),
        ms(id, { name: 'Requirements & Solution Design', stage: 'design', owner: 'u-nadia', due: '2026-07-11', status: 'completed' }),
        ms(id, { name: 'Handset capture app', stage: 'development', owner: 'u-rahim', due: '2026-08-07', status: 'completed', weight: 2 }),
        ms(id, { name: 'Stock posting integration', stage: 'development', owner: 'u-rahim', due: '2026-08-18', status: 'completed', weight: 2 }),
        ms(id, { name: 'Internal Testing', stage: 'internal_testing', owner: 'u-tanvir', due: '2026-08-24', status: 'completed' }),
        ms(id, { name: 'Business UAT', stage: 'uat', owner: 'u-proc', due: '2026-08-29', status: 'completed' }),
        ms(id, { name: 'Production Deployment', stage: 'deployment', owner: 'u-rahim', due: '2026-09-01', status: 'completed' }),
      ],
      stabilizationIssues: [
        {
          id: nextId('si'),
          projectId: id,
          title: 'Handset loses the count session when it drops off wifi in the cold store',
          severity: 'minor',
          status: 'open',
          reportedById: 'u-proc',
          reportedAt: '2026-09-04',
        },
        {
          id: nextId('si'),
          projectId: id,
          title: 'Rack labels on aisle 7 scan intermittently',
          severity: 'major',
          status: 'resolved',
          reportedById: 'u-proc',
          reportedAt: '2026-09-02',
        },
      ],
      approvals: [
        { id: nextId('ap'), projectId: id, kind: 'uat_gate', title: 'UAT Completion Gate', decision: 'approved', decidedById: 'u-proc', decidedAt: '2026-08-30', note: 'Counted two aisles against the manual count. Matched.', requiredRole: 'business_owner' },
      ],
    })
  }

  /* 11 — Tender Summarizer: a second delivered outcome for the record */
  {
    const id = 'p-tender'
    projects.push({
      ...emptyProject(),
      id,
      code: 'AI-2026-005',
      name: 'Tender Document Summarizer',
      businessUnitId: 'bu-group',
      departmentId: 'dp-proc',
      businessProblem:
        'Buyers read 60-page tender documents in full to find the few clauses that decide whether Anwar can bid.',
      expectedOutcome: 'Key clauses, dates and eligibility conditions summarised on the day a tender arrives.',
      ownerId: 'u-sarah',
      analystId: 'u-nadia',
      developerId: 'u-rahim',
      businessOwnerId: 'u-proc',
      contributorIds: [],
      stage: 'completed',
      priority: 'medium',
      originalDeliveryDate: '2026-08-14',
      expectedDeliveryDate: '2026-08-20',
      completedAt: '2026-08-20',
      deployedAt: '2026-08-15',
      deploymentRef: 'REL-2026.08.15-PROC-1.2',
      outcomeSummary:
        'Buyers now shortlist tenders the day they arrive; the team reported roughly two hours saved on each document.',
      createdAt: '2026-05-18',
      stageHistory: history(
        ['idea', 'discovery', 'design', 'approval', 'development', 'internal_testing', 'uat', 'deployment', 'stabilization', 'completed'],
        '2026-05-18',
      ),
      gates: gatesFor(id, 'completed'),
      milestones: [
        ms(id, { name: 'Complete Discovery', stage: 'discovery', owner: 'u-nadia', due: '2026-06-05', status: 'completed' }),
        ms(id, { name: 'Requirements & Solution Design', stage: 'design', owner: 'u-nadia', due: '2026-06-19', status: 'completed' }),
        ms(id, { name: 'Clause extraction build', stage: 'development', owner: 'u-rahim', due: '2026-07-17', status: 'completed', weight: 2 }),
        ms(id, { name: 'Internal Testing', stage: 'internal_testing', owner: 'u-tanvir', due: '2026-07-31', status: 'completed' }),
        ms(id, { name: 'Business UAT', stage: 'uat', owner: 'u-proc', due: '2026-08-11', status: 'completed' }),
        ms(id, { name: 'Production Deployment', stage: 'deployment', owner: 'u-rahim', due: '2026-08-15', status: 'completed' }),
      ],
      approvals: [
        { id: nextId('ap'), projectId: id, kind: 'uat_gate', title: 'UAT Completion Gate', decision: 'approved', decidedById: 'u-proc', decidedAt: '2026-08-12', note: 'Checked against four live tenders.', requiredRole: 'business_owner' },
        { id: nextId('ap'), projectId: id, kind: 'closure', title: 'Project closure', decision: 'approved', decidedById: 'u-proc', decidedAt: '2026-08-20', note: 'Outcome confirmed by the buying team.', requiredRole: 'business_owner' },
      ],
    })
  }

  return withSeedTasks(projects)
}

/** A representative slice of day-to-day work under the milestones currently in flight. */
const SEED_TASKS: Record<string, Record<string, [string, string, Task['priority'], Task['status']][]>> = {
  'p-invoice': {
    'Extraction pipeline': [
      ['Train the field extraction model on 500 sample invoices', 'u-mizan', 'high', 'done'],
      ['Handle multi-page and scanned invoices', 'u-mizan', 'high', 'in_progress'],
      ['Confidence thresholds for manual review', 'u-mizan', 'medium', 'todo'],
    ],
    'ERP posting integration': [['Agree the posting schema with Finance', 'u-nadia', 'medium', 'todo']],
  },
  'p-maint': {
    'Failure model training': [
      ['Re-sample the two offline line sensors', 'u-mizan', 'high', 'in_progress'],
      ['Label historical stoppage events', 'u-sabina', 'medium', 'done'],
    ],
    'Sensor data pipeline': [['Stream ingestion from the rolling mill PLC', 'u-mizan', 'high', 'in_progress']],
  },
  'p-cs': {
    'Business UAT': [
      ['Provision 8 UAT accounts for the service desk', 'u-imran', 'high', 'todo'],
      ['Prepare 30 handover and warranty test questions', 'u-cs', 'medium', 'done'],
    ],
  },
  'p-docs': {
    'Internal Testing': [
      ['Run the classification test set', 'u-tanvir', 'high', 'in_progress'],
      ['Triage misrouted document types', 'u-tanvir', 'medium', 'todo'],
    ],
  },
  'p-forecast': {
    'Requirements & Solution Design': [
      ['Agree forecast granularity with the depots', 'u-sabina', 'high', 'done'],
      ['Document the accuracy target', 'u-sabina', 'medium', 'in_progress'],
    ],
  },
}

const withSeedTasks = (projects: Project[]): Project[] =>
  projects.map((p) => {
    const spec = SEED_TASKS[p.id]
    if (!spec) return p
    const tasks = Object.entries(spec).flatMap(([milestoneName, items]) => {
      const m = p.milestones.find((x) => x.name === milestoneName)
      if (!m) return []
      return items.map(([title, assigneeId, priority, status]) => ({
        id: nextId('tsk'),
        milestoneId: m.id,
        title,
        assigneeId,
        dueDate: m.dueDate,
        status,
        priority,
      }))
    })
    return { ...p, tasks }
  })

const seedActivity = (): ActivityLog[] => [
  { id: nextId('act'), projectId: 'p-cs', kind: 'blocker', actorId: 'u-nadia', message: 'recorded blocker "UAT test accounts not provisioned"', detail: 'Business UAT · Resource unavailable · +5 days', at: '2026-09-19T15:40:00' },
  { id: nextId('act'), projectId: 'p-maint', kind: 'delay', actorId: 'u-sabina', message: 'recorded a delay on "Failure model training"', detail: 'Data unavailable · +4 days · revised to 23 Sep 2026', at: '2026-09-20T11:05:00' },
  { id: nextId('act'), projectId: 'p-forecast', kind: 'approval', actorId: 'u-sabina', message: 'submitted Design Completion Gate for review', detail: 'Awaiting Arif Mahmud (Business Owner)', at: '2026-09-19T09:20:00' },
  { id: nextId('act'), projectId: 'p-exit', kind: 'project', actorId: 'u-hrdir', message: 'raised a new AI request "Exit Interview Analyzer"', at: '2026-09-18T16:10:00' },
  { id: nextId('act'), projectId: 'p-safety', kind: 'stage', actorId: 'u-plant', message: 'closed the project after stabilization', detail: 'Delivered 31 Aug 2026', at: '2026-08-31T17:00:00' },
]

const seedNotifications = (): Notification[] => [
  { id: nextId('nt'), projectId: 'p-cs', audienceRoles: ['management', 'team_lead', 'developer'], kind: 'blocker', title: 'Blocker affecting Customer Service Assistant', body: 'UAT test accounts not provisioned — business testing cannot start. Owner: Imran Chowdhury.', at: '2026-09-19T15:41:00', read: false, href: '#/projects/p-cs/blockers' },
  { id: nextId('nt'), projectId: 'p-forecast', audienceRoles: ['business_owner'], kind: 'approval_request', title: 'Design approval requested', body: 'Sales Demand Forecasting is ready for design approval.', at: '2026-09-19T09:21:00', read: false, href: '#/projects/p-forecast/timeline' },
  { id: nextId('nt'), projectId: 'p-maint', audienceRoles: ['management', 'team_lead'], kind: 'overdue', title: 'Milestone overdue', body: 'Failure model training on Predictive Maintenance Pilot is past its committed date.', at: '2026-09-20T08:00:00', read: true, href: '#/projects/p-maint/milestones' },
]

export const createSeedDatabase = (): DatabaseShape => {
  resetIds()
  return {
    users: USERS,
    businessUnits: BUSINESS_UNITS,
    departments: DEPARTMENTS,
    projects: buildSeedProjects(),
    activity: seedActivity(),
    notifications: seedNotifications(),
    today: TODAY,
  }
}
