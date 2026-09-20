import { useState } from 'react'
import { fmtDate } from '../../domain/dates'
import { STAGES, roleLabel, stageDef, stageIndex } from '../../domain/lifecycle'
import { currentGate, gateFor, gateReadiness, userById, viewOf } from '../../domain/logic'
import type { Project, StageKey } from '../../domain/types'
import { navigate } from '../../router'
import { useApp } from '../../store/store'
import { Alert, Badge, Button, Card, CardHead, ConfirmDialog, EmptyState, Field, GateBadge, HealthBadge, MilestoneBadge, ProgressBar } from '../../components/ui'
import { GatePanel } from './GatePanel'

export function TimelineTab({ project }: { project: Project }) {
  const { db, role, run, pending, actorFor } = useApp()
  const v = viewOf(project, db.today)
  const gate = currentGate(project)
  const current = stageIndex(project.stage)

  return (
    <div className="split">
      <div className="col" style={{ gap: 14 }}>
        <StageActionPanel project={project} />
        {gate ? (
          <GatePanel project={project} gate={gate} />
        ) : (
          <Card>
            <CardHead title="No open gate" sub={stageDef(project.stage).purpose} />
            <div className="card-body">
              <EmptyState icon="✓" title="This stage has no outstanding exit criteria" />
            </div>
          </Card>
        )}

        <Card>
          <CardHead title="Approval history" sub="Who decided what, and when" />
          <div className="table-wrap">
            {project.approvals.length === 0 ? (
              <EmptyState title="No approvals recorded yet" body="Gate decisions will appear here as the project advances." />
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
      </div>

      <div className="col" style={{ gap: 14 }}>
        <Card>
          <CardHead title="Project lifecycle" sub="Ten stages — one current, everything else either done or ahead" />
          <div className="card-body">
            <div className="stage-rail">
              {STAGES.map((s, i) => {
                const g = gateFor(project, s.key)
                const isDone = i < current || project.stage === 'completed'
                const isCurrent = s.key === project.stage
                const awaiting = isCurrent && g?.state === 'ready_for_review'
                const blocked = isCurrent && v.health.health === 'blocked'
                const cls = isDone ? 'done' : blocked ? 'current blocked' : awaiting ? 'current await' : isCurrent ? 'current' : 'upcoming'
                const hist = project.stageHistory.find((h) => h.stage === s.key)
                return (
                  <div key={s.key} className={`stage-node ${cls}`}>
                    <div className="gutter">
                      <span className="knob" aria-hidden>
                        {isDone ? '✓' : isCurrent ? '●' : ''}
                      </span>
                      {i < STAGES.length - 1 && <span className="stalk" />}
                    </div>
                    <div className="body">
                      <div className="title">
                        {s.label}
                        {isCurrent && <Badge tone="info">Current</Badge>}
                        {blocked && <Badge tone="bad">Blocked</Badge>}
                        {awaiting && <Badge tone="warn">Awaiting approval</Badge>}
                        {isDone && hist?.enteredAt && <span className="tiny muted">{fmtDate(hist.exitedAt ?? hist.enteredAt)}</span>}
                      </div>
                      {(isCurrent || !isDone) && <div className="desc">{s.purpose}</div>}
                      {isCurrent && (
                        <div className="col" style={{ gap: 8, marginTop: 8 }}>
                          <div className="row" style={{ gap: 8 }}>
                            <HealthBadge health={v.health.health} />
                            {g && <GateBadge state={g.state} />}
                          </div>
                          <ProgressBar value={v.progress.percent} />
                          <div className="tiny muted">
                            Next: {v.next?.name ?? '—'} · Action: {v.action.label}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ------------------------------------------------------ stage-specific work */

function StageActionPanel({ project }: { project: Project }) {
  const { db, role, run, pending, actorFor } = useApp()
  const actor = actorFor(project)
  const v = viewOf(project, db.today)
  const stage = project.stage
  const notStarted = project.milestones.filter((m) => m.stage === stage && m.status === 'not_started')
  const [deployRef, setDeployRef] = useState(`REL-2026.09.30-HR-1.0`)
  const [deployNotes, setDeployNotes] = useState('Released to all group employees. Rollback point captured before release.')
  const [issueTitle, setIssueTitle] = useState('')
  const [outcome, setOutcome] = useState(
    'Employees can self-serve approved HR policy answers, removing the repetitive question load from the HR team.',
  )
  const [confirmClose, setConfirmClose] = useState(false)

  if (stage === 'idea' && !project.analystId)
    return (
      <Alert tone="warn" title="No AI Analyst assigned — discovery cannot start">
        Someone must own discovery before the intake gate can close. Assign an AI Analyst from the Overview tab or the
        project team header.
      </Alert>
    )

  if (stage === 'completed')
    return (
      <Card>
        <CardHead title="Project closed" sub={`Delivered ${fmtDate(project.completedAt)}`} right={<Badge tone="ok" size="lg">COMPLETED</Badge>} />
        <div className="card-body grid g2" style={{ gap: 14 }}>
          <div>
            <div className="eyebrow">Outcome</div>
            <p className="small" style={{ marginTop: 4 }}>{project.outcomeSummary}</p>
          </div>
          <div>
            <div className="eyebrow">Deployment reference</div>
            <p className="small mono" style={{ marginTop: 4 }}>{project.deploymentRef ?? '—'}</p>
            <div className="eyebrow" style={{ marginTop: 10 }}>Final delivery date</div>
            <p className="small" style={{ marginTop: 4 }}>{fmtDate(project.completedAt)}</p>
          </div>
        </div>
      </Card>
    )

  if (stage === 'deployment')
    return (
      <Card>
        <CardHead
          title="Deployment"
          sub="All business approvals are recorded — the release can be made"
          right={project.deployedAt ? <Badge tone="ok">Deployed {fmtDate(project.deployedAt)}</Badge> : <Badge tone="warn">Not deployed</Badge>}
        />
        <div className="card-body grid g2" style={{ gap: 14 }}>
          <Field label="Version / release reference" required>
            <input className="input" value={project.deploymentRef ?? deployRef} disabled={!!project.deployedAt} onChange={(e) => setDeployRef(e.target.value)} />
          </Field>
          <Field label="Deployment date">
            <input className="input" value={fmtDate(project.deployedAt ?? db.today)} disabled />
          </Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Deployment notes">
              <textarea className="textarea" value={project.deployedAt ? 'Recorded at release.' : deployNotes} disabled={!!project.deployedAt} onChange={(e) => setDeployNotes(e.target.value)} />
            </Field>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Alert tone="ok" title="Business approval recorded">
              UAT was approved by {userById(db, project.businessOwnerId)?.name}. The deployment gate criteria are ticked
              automatically when the release is recorded.
            </Alert>
          </div>
        </div>
        {!project.deployedAt && (
          <div className="card-foot row">
            <span className="small muted">Recording the release completes the deployment milestone.</span>
            <span className="spacer" style={{ flex: 1 }} />
            <Button
              variant="primary"
              loading={pending === 'mark_deployed'}
              disabled={role === 'management' || role === 'business_owner'}
              onClick={() =>
                run(
                  { type: 'mark_deployed', projectId: project.id, reference: deployRef, notes: deployNotes, actorId: actor.id },
                  { success: `Deployed as ${deployRef}.` },
                )
              }
            >
              Mark as deployed
            </Button>
          </div>
        )}
      </Card>
    )

  if (stage === 'stabilization') {
    const open = project.stabilizationIssues.filter((i) => i.status === 'open')
    const criticalOpen = open.filter((i) => i.severity === 'critical')
    return (
      <Card>
        <CardHead
          title="Stabilization"
          sub="Early production issues and feedback before the project is closed"
          right={<Badge tone={criticalOpen.length ? 'bad' : 'ok'}>{criticalOpen.length ? `${criticalOpen.length} critical open` : 'No critical issues'}</Badge>}
        />
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {project.stabilizationIssues.length === 0 ? (
            <EmptyState icon="✓" title="No production issues reported" body="Three weeks of clean running is the closure condition." />
          ) : (
            <table className="tbl">
              <tbody>
                {project.stabilizationIssues.map((i) => (
                  <tr key={i.id}>
                    <td className="cell-main">{i.title}</td>
                    <td style={{ width: 110 }}>
                      <Badge tone={i.severity === 'critical' ? 'bad' : i.severity === 'major' ? 'warn' : 'muted'}>{i.severity}</Badge>
                    </td>
                    <td style={{ width: 120 }}>
                      <Badge tone={i.status === 'open' ? 'warn' : 'ok'}>{i.status === 'open' ? 'Open' : 'Resolved'}</Badge>
                    </td>
                    <td style={{ width: 120, textAlign: 'right' }}>
                      {i.status === 'open' && (
                        <Button size="sm" onClick={() => run({ type: 'resolve_stabilization_issue', projectId: project.id, issueId: i.id, actorId: actor.id }, { success: 'Issue resolved.' })}>
                          Resolve
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="row" style={{ gap: 8 }}>
            <input className="input" placeholder="Log a production issue…" value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)} />
            <Button
              disabled={!issueTitle.trim()}
              onClick={async () => {
                await run({ type: 'add_stabilization_issue', projectId: project.id, title: issueTitle, severity: 'minor', actorId: actor.id }, { success: 'Issue logged.' })
                setIssueTitle('')
              }}
            >
              Add issue
            </Button>
          </div>
          <Alert tone={criticalOpen.length ? 'warn' : 'ok'} title={criticalOpen.length ? 'Not ready to complete' : 'Ready to complete'}>
            {criticalOpen.length
              ? 'Critical production issues must be resolved before the project can be closed.'
              : 'No outstanding critical production issues. The closure gate can be evidenced and the project closed.'}
          </Alert>
        </div>
        <div className="card-foot row">
          <span className="small muted">
            {gateFor(project, 'stabilization')?.state === 'approved'
              ? 'Business sign-off recorded. Closing sets the project to Completed at 100%.'
              : 'The closure gate must be evidenced and approved by the Business Owner before the project can be closed.'}
          </span>
          <span className="spacer" style={{ flex: 1 }} />
          <Button
            variant="primary"
            disabled={criticalOpen.length > 0 || gateFor(project, 'stabilization')?.state !== 'approved'}
            title={
              gateFor(project, 'stabilization')?.state === 'approved'
                ? undefined
                : 'Closure gate not approved yet'
            }
            onClick={() => setConfirmClose(true)}
          >
            Close project
          </Button>
        </div>
        {confirmClose && (
          <ConfirmDialog
            title="Mark this project as completed?"
            body={
              <>
                This records <b>{project.name}</b> as delivered on {fmtDate(db.today)}, sets progress to 100%, writes the
                final activity entry and notifies every stakeholder. It cannot be undone in the prototype.
              </>
            }
            confirmLabel="Close project"
            loading={pending === 'close_project'}
            onCancel={() => setConfirmClose(false)}
            onConfirm={async () => {
              await run({ type: 'close_project', projectId: project.id, outcomeSummary: outcome, actorId: actor.id }, { success: `${project.name} completed.` })
              setConfirmClose(false)
            }}
          >
            <Field label="Outcome delivered" help="Shown to management on the closed project record.">
              <textarea className="textarea" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
            </Field>
          </ConfirmDialog>
        )}
      </Card>
    )
  }

  if (stage === 'uat')
    return (
      <Alert
        tone="info"
        title="Business testing is in progress"
        action={
          <Button size="sm" onClick={() => navigate(`#/projects/${project.id}/uat`)}>
            Open UAT
          </Button>
        }
      >
        UAT evidence, feedback and the business approval are recorded on the UAT & Approvals tab.
      </Alert>
    )

  if (notStarted.length > 0)
    return (
      <Card>
        <CardHead
          title={`Start ${stageDef(stage).label.toLowerCase()} work`}
          sub={`${notStarted.length} milestone${notStarted.length === 1 ? '' : 's'} in this stage have not been started`}
        />
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notStarted.map((m) => (
            <div key={m.id} className="row" style={{ gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="strong small">{m.name}</div>
                <div className="tiny muted">
                  Due {fmtDate(m.dueDate)} · {userById(db, m.ownerId)?.name}
                </div>
              </div>
              <MilestoneBadge status={m.status} />
            </div>
          ))}
        </div>
        <div className="card-foot row">
          <span className="small muted">
            {stage === 'development'
              ? 'The developer picks up the development milestones and logs the work completed so far.'
              : 'Starting the stage moves its milestones into progress.'}
          </span>
          <span className="spacer" style={{ flex: 1 }} />
          <Button
            variant="primary"
            disabled={role === 'management'}
            loading={pending === 'start_stage_work'}
            onClick={() =>
              run({ type: 'start_stage_work', projectId: project.id, actorId: actor.id }, { success: `${stageDef(stage).label} work started.` })
            }
          >
            {stage === 'development' ? 'Start development' : `Start ${stageDef(stage).short.toLowerCase()} work`}
          </Button>
        </div>
      </Card>
    )

  return null
}
