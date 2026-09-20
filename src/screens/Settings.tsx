import { ROLES, STAGES, roleLabel } from '../domain/lifecycle'
import { useApp } from '../store/store'
import { Alert, Badge, Button, Card, CardHead } from '../components/ui'

const ENTITIES: { name: string; fields: string }[] = [
  { name: 'Users / BusinessUnits / Departments', fields: 'id, name, role, title, businessUnitId' },
  { name: 'Projects', fields: 'id, code, stage, owner, analyst, developer, businessOwner, originalDeliveryDate, expectedDeliveryDate' },
  { name: 'ProjectStageHistory', fields: 'projectId, stage, enteredAt, exitedAt, approvedBy' },
  { name: 'StageGates / StageGateCriteria', fields: 'gateId, stage, state, approverRole, criterion, required, done, evidence, completedBy' },
  { name: 'Milestones', fields: 'projectId, stage, ownerId, baselineDue, dueDate, status, progress, weight' },
  { name: 'Tasks', fields: 'milestoneId, title, assigneeId, dueDate, status, priority' },
  { name: 'Blockers', fields: 'projectId, milestoneId, category, responsibleId, impactDays, requiredAction, status' },
  { name: 'ScopeChanges', fields: 'projectId, requestedById, deliveryImpactDays, proposedDeliveryDate, decision, reviewerId' },
  { name: 'Files', fields: 'projectId, name, kind, stage, uploadedById' },
  { name: 'Approvals', fields: 'projectId, kind, requiredRole, decision, decidedById, decidedAt, note' },
  { name: 'ActivityLogs', fields: 'projectId, kind, actorId, message, detail, at' },
  { name: 'Notifications', fields: 'projectId, audienceRoles, kind, title, body, read, href' },
]

export function Settings() {
  const { db, role, failNext, setFailNext, resetDemo, pushToast } = useApp()

  return (
    <div className="content" style={{ maxWidth: 1000 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">Settings</div>
          <h1 className="h1">Prototype settings & data model</h1>
          <p className="muted small" style={{ marginTop: 4 }}>
            This is a working prototype: state lives in a single store behind a simulated API layer, and persists in this
            browser.
          </p>
        </div>
      </div>

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="col" style={{ gap: 14 }}>
          <Card>
            <CardHead title="Prototype controls" />
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="between">
                <div>
                  <div className="strong small">Simulate an API failure on the next action</div>
                  <div className="tiny muted">Shows the error handling path: failed command, error toast, no state change.</div>
                </div>
                <label className="row" style={{ gap: 8 }}>
                  <input type="checkbox" checked={failNext} onChange={(e) => setFailNext(e.target.checked)} style={{ accentColor: 'var(--brand)' }} />
                  <span className="small">{failNext ? 'Armed' : 'Off'}</span>
                </label>
              </div>
              <hr className="hr" />
              <div className="between">
                <div>
                  <div className="strong small">Reset the prototype</div>
                  <div className="tiny muted">Restores the seeded portfolio and clears anything created during the demo.</div>
                </div>
                <Button variant="danger" onClick={resetDemo}>
                  Reset demo data
                </Button>
              </div>
              <hr className="hr" />
              <div>
                <div className="strong small">Prototype clock</div>
                <div className="tiny muted">
                  Fixed at {db.today} so overdue work is reproducible for every evaluator.
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHead title="Roles in this system" sub="One application, five perspectives" />
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ROLES.map((r) => (
                <div key={r.key} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                  <Badge tone={role === r.key ? 'info' : 'muted'}>{r.label}</Badge>
                  <span className="small muted" style={{ flex: 1 }}>
                    {r.blurb}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="col" style={{ gap: 14 }}>
          <Card>
            <CardHead title="Data model" sub="The tables this frontend expects from the API" />
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {ENTITIES.map((e) => (
                <div key={e.name}>
                  <div className="small strong">{e.name}</div>
                  <div className="tiny muted mono">{e.fields}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHead title="Lifecycle & gates" sub="Ten stages, seven of which have exit criteria" />
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {STAGES.map((s) => (
                <div key={s.key} className="row" style={{ gap: 9 }}>
                  <span className="small" style={{ width: 150 }}>
                    {s.label}
                  </span>
                  {s.gate ? (
                    <>
                      <Badge tone="info">{s.gate.criteria.length} criteria</Badge>
                      <span className="tiny muted">approved by {roleLabel(s.gate.approverRole)}</span>
                    </>
                  ) : (
                    <span className="tiny muted">No exit gate</span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Alert tone="info" title="Demo data notice">
            All people, departments and figures in this prototype are fictional and created for demonstration. They are
            not real Anwar Group employees or records.
          </Alert>
        </div>
      </div>
    </div>
  )
}
