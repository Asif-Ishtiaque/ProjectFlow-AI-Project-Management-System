import { useState } from 'react'
import { fmtDate } from '../../domain/dates'
import { roleLabel, stageDef, stageIndex } from '../../domain/lifecycle'
import { gateFor, userById } from '../../domain/logic'
import type { Project, UatFeedback } from '../../domain/types'
import { useApp } from '../../store/store'
import { Alert, Badge, Button, Card, CardHead, EmptyState, Field, Modal, Person } from '../../components/ui'
import { GatePanel } from './GatePanel'

const SEVERITY: Record<UatFeedback['severity'], { label: string; tone: string }> = {
  critical: { label: 'Critical', tone: 'bad' },
  issue: { label: 'Issue', tone: 'warn' },
  observation: { label: 'Observation', tone: 'muted' },
}

export function UatTab({ project }: { project: Project }) {
  const { db, role, run, pending, actorFor } = useApp()
  const actor = actorFor(project)
  const gate = gateFor(project, 'uat')
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [severity, setSeverity] = useState<UatFeedback['severity']>('issue')
  const [resolving, setResolving] = useState<UatFeedback | null>(null)
  const [resolution, setResolution] = useState('')

  const reached = stageIndex(project.stage) >= stageIndex('uat')
  const uatMilestone = project.milestones.find((m) => m.stage === 'uat')
  const testResults = project.files.filter((f) => f.kind === 'test_result')
  const items = project.uatFeedback ?? []
  const open = items.filter((f) => f.status === 'open' && f.severity !== 'observation')
  const critical = open.filter((f) => f.severity === 'critical')

  if (!reached)
    return (
      <Card>
        <CardHead title="Business testing / UAT" sub={stageDef('uat').purpose} />
        <div className="card-body">
          <EmptyState
            icon="◷"
            title="UAT has not started"
            body={`The project is in ${stageDef(project.stage).label}. Business testing opens once internal testing is approved.`}
          />
        </div>
      </Card>
    )

  return (
    <div className="col" style={{ gap: 14 }}>
      <Card>
        <CardHead
          title={`${project.name} — UAT`}
          sub={`Business owner: ${userById(db, project.businessOwnerId)?.name ?? 'Unassigned'}`}
          right={
            <Badge tone={project.stage === 'uat' ? 'warn' : 'ok'} size="lg">
              {project.stage === 'uat' ? 'READY FOR BUSINESS TESTING' : 'UAT COMPLETE'}
            </Badge>
          }
        />
        <div className="card-body grid g2" style={{ gap: 18 }}>
          <div>
            <div className="eyebrow">Expected outcome being tested</div>
            <p className="small" style={{ marginTop: 5, color: 'var(--ink-2)' }}>
              {project.expectedOutcome}
            </p>
            <div className="eyebrow" style={{ marginTop: 14 }}>
              UAT milestone
            </div>
            <p className="small" style={{ marginTop: 5 }}>
              {uatMilestone
                ? `${uatMilestone.name} · due ${fmtDate(uatMilestone.dueDate)} · ${userById(db, uatMilestone.ownerId)?.name}`
                : '—'}
            </p>
          </div>
          <div>
            <dl className="kv">
              <dt>Test results</dt>
              <dd>{testResults.length ? testResults.map((t) => t.name).join(', ') : 'Attach results on the Files tab'}</dd>
              <dt>Feedback recorded</dt>
              <dd>{items.length} item{items.length === 1 ? '' : 's'}</dd>
              <dt>Open issues</dt>
              <dd style={open.length ? { color: 'var(--warn)', fontWeight: 650 } : undefined}>{open.length}</dd>
              <dt>Critical issues</dt>
              <dd style={critical.length ? { color: 'var(--bad)', fontWeight: 650 } : undefined}>{critical.length}</dd>
            </dl>
            <Button size="sm" style={{ marginTop: 12 }} disabled={role === 'management'} onClick={() => setFeedbackOpen(true)}>
              Add feedback
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead
          title="Business testing feedback"
          sub="What the business found, and what was done about it"
          right={
            <Badge tone={critical.length ? 'bad' : open.length ? 'warn' : 'ok'}>
              {critical.length
                ? `${critical.length} critical open`
                : open.length
                  ? `${open.length} open`
                  : 'Nothing outstanding'}
            </Badge>
          }
        />
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.length === 0 && (
            <EmptyState
              title="No feedback recorded yet"
              body="Business testers record what they found here — it is the evidence behind the UAT gate."
              action={
                role !== 'management' ? <Button onClick={() => setFeedbackOpen(true)}>Add the first item</Button> : undefined
              }
            />
          )}
          {items.map((f) => (
            <div
              key={f.id}
              style={{
                border: '1px solid var(--line)',
                borderLeft: `3px solid var(--${f.status === 'resolved' ? 'line-strong' : SEVERITY[f.severity].tone === 'bad' ? 'bad' : SEVERITY[f.severity].tone === 'warn' ? 'warn' : 'line-strong'})`,
                borderRadius: 'var(--r)',
                padding: '11px 13px',
              }}
            >
              <div className="row wrap" style={{ gap: 8 }}>
                <Badge tone={SEVERITY[f.severity].tone}>{SEVERITY[f.severity].label}</Badge>
                <Badge tone={f.status === 'open' ? 'warn' : 'ok'}>{f.status === 'open' ? 'OPEN' : 'RESOLVED'}</Badge>
                <span className="spacer" style={{ flex: 1 }} />
                <span className="tiny muted nowrap">
                  {userById(db, f.raisedById)?.name} · {fmtDate(f.raisedAt)}
                </span>
              </div>
              <p className="small" style={{ marginTop: 6, color: 'var(--ink-2)' }}>
                {f.note}
              </p>
              {f.resolutionNote && (
                <p className="tiny" style={{ marginTop: 5, color: 'var(--ok)' }}>
                  ✓ {f.resolutionNote} {f.resolvedAt ? `(${fmtDate(f.resolvedAt)})` : ''}
                </p>
              )}
              {f.status === 'open' && (
                <div className="row" style={{ marginTop: 9 }}>
                  <Button size="sm" disabled={role === 'management'} onClick={() => setResolving(f)}>
                    Mark resolved
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {gate && <GatePanel project={project} gate={gate} />}

      <Card>
        <CardHead title="Approval history" sub="Every business decision on this project" />
        <div className="table-wrap">
          {project.approvals.length === 0 ? (
            <EmptyState title="No approvals recorded yet" />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Decision point</th>
                  <th>Required role</th>
                  <th>Decided by</th>
                  <th>Date</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {project.approvals.map((a) => (
                  <tr key={a.id}>
                    <td className="cell-main">
                      {a.title}
                      {a.note && <div className="cell-sub">“{a.note}”</div>}
                    </td>
                    <td>{roleLabel(a.requiredRole)}</td>
                    <td>{userById(db, a.decidedById)?.name ?? '—'}</td>
                    <td className="nowrap">{a.decidedAt ? fmtDate(a.decidedAt) : '—'}</td>
                    <td>
                      <Badge tone={a.decision === 'approved' ? 'ok' : a.decision === 'pending' ? 'warn' : 'bad'}>
                        {a.decision === 'approved' ? 'Approved' : a.decision === 'pending' ? 'Pending' : 'Changes requested'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {feedbackOpen && (
        <Modal
          title="Record UAT feedback"
          sub="Feedback is the evidence behind the UAT gate"
          onClose={() => setFeedbackOpen(false)}
          footer={
            <>
              <Button onClick={() => setFeedbackOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!feedback.trim()}
                loading={pending === 'add_uat_feedback'}
                onClick={async () => {
                  await run(
                    { type: 'add_uat_feedback', projectId: project.id, note: feedback, severity, actorId: actor.id },
                    { success: 'Feedback recorded.' },
                  )
                  setFeedback('')
                  setSeverity('issue')
                  setFeedbackOpen(false)
                }}
              >
                Record feedback
              </Button>
            </>
          }
        >
          <Field label="What did business testing find?" required>
            <textarea
              className="textarea"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="e.g. 42 policy questions tested across three departments. Answers matched the approved handbook in 40 cases; two wordings corrected."
            />
          </Field>
          <Field label="Severity" help="Critical findings must be cleared before the gate can be approved.">
            <select className="select" value={severity} onChange={(e) => setSeverity(e.target.value as UatFeedback['severity'])}>
              <option value="observation">Observation — no change needed</option>
              <option value="issue">Issue — should be fixed</option>
              <option value="critical">Critical — blocks approval</option>
            </select>
          </Field>
          <Alert tone="info" title="What this does">
            Recording feedback ticks the “Feedback recorded” exit criterion and writes an activity entry. Clearing the
            last critical finding ticks “Critical issues resolved” on its own.
          </Alert>
        </Modal>
      )}

      {resolving && (
        <Modal
          title="Resolve this finding"
          sub={resolving.note.slice(0, 90)}
          onClose={() => setResolving(null)}
          footer={
            <>
              <Button onClick={() => setResolving(null)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!resolution.trim()}
                loading={pending === 'resolve_uat_feedback'}
                onClick={async () => {
                  await run(
                    {
                      type: 'resolve_uat_feedback',
                      projectId: project.id,
                      feedbackId: resolving.id,
                      note: resolution,
                      actorId: actor.id,
                    },
                    { success: 'Finding resolved.' },
                  )
                  setResolution('')
                  setResolving(null)
                }}
              >
                Mark resolved
              </Button>
            </>
          }
        >
          <Field label="How was it addressed?" required>
            <textarea className="textarea" value={resolution} onChange={(e) => setResolution(e.target.value)} />
          </Field>
          {resolving.severity === 'critical' && critical.length === 1 && (
            <Alert tone="ok" title="This is the last critical finding">
              Resolving it ticks “Critical issues resolved” on the UAT gate automatically.
            </Alert>
          )}
        </Modal>
      )}
    </div>
  )
}
