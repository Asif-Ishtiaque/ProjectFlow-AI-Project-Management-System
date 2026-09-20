import { fmtDate, fmtTime, relativeDay } from '../../domain/dates'
import { stageDef } from '../../domain/lifecycle'
import { currentGate, deliveryBreakdown, gateReadiness, progressOf, userById, viewOf } from '../../domain/logic'
import type { Project } from '../../domain/types'
import { navigate } from '../../router'
import { useApp } from '../../store/store'
import { Alert, Badge, Button, Card, CardHead, EmptyState, MilestoneBadge, Person, ProgressBar } from '../../components/ui'

export function OverviewTab({ project }: { project: Project }) {
  const { db } = useApp()
  const v = viewOf(project, db.today)
  const progress = progressOf(project)
  const delivery = deliveryBreakdown(project)
  const gate = currentGate(project)
  const readiness = gateReadiness(gate)
  const activity = db.activity.filter((a) => a.projectId === project.id).slice(0, 6)

  return (
    <div className="split">
      <div className="col" style={{ gap: 14 }}>
        {v.openBlockers.length > 0 && (
          <Alert
            tone="bad"
            title={`Blocked — ${v.openBlockers[0].title}`}
            action={
              <Button size="sm" onClick={() => navigate(`#/projects/${project.id}/blockers`)}>
                Open blocker
              </Button>
            }
          >
            {v.openBlockers[0].requiredAction} · Responsible: {userById(db, v.openBlockers[0].responsibleId)?.name} ·
            Impact: {v.openBlockers[0].impactSummary}
          </Alert>
        )}

        <Card>
          <CardHead title="Why this project exists" />
          <div className="card-body grid g2" style={{ gap: 18 }}>
            <div>
              <div className="eyebrow">Business problem</div>
              <p className="small" style={{ marginTop: 5, color: 'var(--ink-2)' }}>
                {project.businessProblem}
              </p>
            </div>
            <div>
              <div className="eyebrow">Expected outcome</div>
              <p className="small" style={{ marginTop: 5, color: 'var(--ink-2)' }}>
                {project.expectedOutcome}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead
            title="Progress, explained"
            sub="Progress is earned from milestone weight — it is never typed in"
            right={<Badge tone="info">{progress.percent}%</Badge>}
          />
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ProgressBar value={progress.percent} size="lg" tone={v.health.health === 'blocked' ? 'bad' : undefined} />
            <p className="small" style={{ color: 'var(--ink-2)' }}>{progress.explanation}</p>
            <div className="grid g2" style={{ gap: 10 }}>
              {project.milestones.map((m) => (
                <div key={m.id} className="row" style={{ gap: 9 }}>
                  <span style={{ fontSize: 12.5, flex: 1, minWidth: 0 }} className="truncate">
                    {m.name}
                  </span>
                  <span className="tiny muted nowrap">w{m.weight}</span>
                  <div style={{ width: 66 }}>
                    <ProgressBar value={m.status === 'completed' ? 100 : m.progress} showValue={false} tone={m.status === 'completed' ? 'ok' : m.status === 'blocked' ? 'bad' : undefined} />
                  </div>
                  <span className="tiny nowrap" style={{ width: 30, textAlign: 'right' }}>
                    {m.status === 'completed' ? 100 : m.progress}%
                  </span>
                </div>
              ))}
              {project.milestones.length === 0 && <EmptyState title="No milestones planned yet" />}
            </div>
            <Alert tone={readiness.ready ? 'ok' : 'warn'} title={`${stageDef(project.stage).label} gate: ${readiness.ready ? 'READY FOR REVIEW' : 'NOT READY'}`}>
              {gate
                ? readiness.ready
                  ? `All ${readiness.total} exit criteria are evidenced. Progress and stage readiness are separate — this gate is ready because the evidence exists, not because a percentage was reached.`
                  : `Reason: ${readiness.blockingReason}. The project can be ${progress.percent}% complete and still not be allowed to advance.`
                : 'This stage has no exit gate.'}
            </Alert>
          </div>
        </Card>

        <Card>
          <CardHead
            title="Delivery date, explained"
            sub="Execution slippage and approved scope changes are kept apart"
            right={<Badge tone={delivery.totalSlip > 0 ? 'late' : 'ok'}>{delivery.totalSlip > 0 ? `+${delivery.totalSlip} days` : 'On plan'}</Badge>}
          />
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>
              <div>
                <div className="eyebrow">Original commitment</div>
                <div className="strong">{fmtDate(delivery.original)}</div>
              </div>
              <div aria-hidden style={{ color: 'var(--ink-4)' }}>→</div>
              <div>
                <div className="eyebrow">Current expectation</div>
                <div className="strong" style={{ color: delivery.totalSlip > 0 ? 'var(--late)' : 'var(--ok)' }}>
                  {fmtDate(delivery.current)}
                </div>
              </div>
              <span className="spacer" style={{ flex: 1 }} />
              <div className="row" style={{ gap: 10 }}>
                <Badge tone="late">Execution +{delivery.executionSlip}d</Badge>
                <Badge tone="info">Approved scope +{delivery.scopeSlip}d</Badge>
              </div>
            </div>
            {delivery.lines.length === 0 ? (
              <p className="small muted">Nothing has moved the delivery date. The original commitment still stands.</p>
            ) : (
              <table className="tbl">
                <tbody>
                  {delivery.lines.map((l, i) => (
                    <tr key={i}>
                      <td>{l.label}</td>
                      <td style={{ width: 150 }}>
                        <Badge tone={l.kind === 'scope' ? 'info' : 'late'}>
                          {l.kind === 'scope' ? 'Approved scope change' : 'Execution delay'}
                        </Badge>
                      </td>
                      <td style={{ width: 70, textAlign: 'right', fontWeight: 600 }}>+{l.days}d</td>
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
          <CardHead title="What happens next" />
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div className="eyebrow">Next action</div>
              <div style={{ fontWeight: 620, marginTop: 3 }}>{v.action.label}</div>
              <div className="small muted">Owner: {userById(db, v.action.ownerId)?.name ?? 'Unassigned'}</div>
            </div>
            {v.action.href && (
              <Button variant="primary" block onClick={() => navigate(v.action.href!)}>
                Go to it
              </Button>
            )}
            <hr className="hr" />
            <div className="eyebrow">Upcoming milestones</div>
            {project.milestones
              .filter((m) => m.status !== 'completed')
              .slice(0, 4)
              .map((m) => (
                <div key={m.id} className="row" style={{ gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="small strong truncate">{m.name}</div>
                    <div className="tiny muted">
                      {fmtDate(m.dueDate)} · {userById(db, m.ownerId)?.name}
                    </div>
                  </div>
                  <MilestoneBadge status={m.status} />
                </div>
              ))}
            {project.milestones.filter((m) => m.status !== 'completed').length === 0 && (
              <p className="small muted">Every milestone is complete.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHead title="Recent activity" right={<button className="linkish small" onClick={() => navigate(`#/projects/${project.id}/activity`)}>View all</button>} />
          <div className="card-body">
            {activity.length === 0 && <EmptyState title="Nothing has happened yet" />}
            <div className="activity">
              {activity.map((a) => (
                <div key={a.id} className={`act ${a.kind}`}>
                  <span className="when">{relativeDay(a.at, db.today) === 'Today' ? fmtTime(a.at) : relativeDay(a.at, db.today)}</span>
                  <span className="ai" aria-hidden>
                    <i />
                  </span>
                  <span>
                    <span className="txt">
                      <b>{userById(db, a.actorId)?.name.split(' ')[0] ?? 'Someone'}</b> {a.message}
                    </span>
                    {a.detail && <span className="det" style={{ display: 'block' }}>{a.detail}</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
