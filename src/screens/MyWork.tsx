import { daysBetween, fmtDate } from '../domain/dates'
import { roleLabel, stageDef } from '../domain/lifecycle'
import { userById, viewsOf } from '../domain/logic'
import { navigate } from '../router'
import { useApp } from '../store/store'
import { Badge, Button, Card, CardHead, EmptyState, HealthBadge, MilestoneBadge, Person, ProgressBar } from '../components/ui'

export function MyWork() {
  const { db, role, actor } = useApp()
  const views = viewsOf(db)

  const isMine = (userId?: string) => {
    if (!userId) return false
    const u = userById(db, userId)
    return u?.role === role
  }

  const myProjects = views.filter((v) => {
    const p = v.project
    if (role === 'management') return p.stage !== 'completed'
    return [p.ownerId, p.analystId, p.developerId, p.businessOwnerId].some((id) => isMine(id))
  })

  const myMilestones = db.projects.flatMap((p) =>
    p.milestones
      .filter((m) => m.status !== 'completed' && isMine(m.ownerId))
      .map((m) => ({ project: p, milestone: m })),
  )

  const myBlockers = db.projects.flatMap((p) =>
    p.blockers
      .filter((b) => b.status === 'open' && (isMine(b.responsibleId) || isMine(b.assignedActionTo)))
      .map((b) => ({ project: p, blocker: b })),
  )

  const myApprovals = db.projects.flatMap((p) => [
    ...p.gates.filter((g) => g.state === 'ready_for_review' && g.approverRole === role).map((g) => ({ project: p, label: g.name, href: `#/projects/${p.id}/timeline` })),
    ...(role === 'business_owner'
      ? p.scopeChanges.filter((s) => s.decision === 'under_review').map((s) => ({ project: p, label: `Scope change: ${s.title}`, href: `#/projects/${p.id}/blockers` }))
      : []),
  ])

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="eyebrow">My work</div>
          <h1 className="h1">What is on me, as {roleLabel(role)}</h1>
          <p className="muted small" style={{ marginTop: 4 }}>
            Showing the queue for the {roleLabel(role)} role (represented here by {actor.name}). In a live deployment
            each person sees only the projects they are named on; the prototype switches perspective instead of users.
          </p>
        </div>
      </div>

      <div className="grid g3" style={{ marginBottom: 14 }}>
        <Card>
          <CardHead title="Decisions on me" right={<Badge tone={myApprovals.length ? 'warn' : 'muted'}>{myApprovals.length}</Badge>} />
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {myApprovals.length === 0 && <EmptyState title="Nothing waiting on you" />}
            {myApprovals.map((a, i) => (
              <button key={i} className="row" style={{ gap: 8, background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }} onClick={() => navigate(a.href)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="small strong truncate">{a.label}</div>
                  <div className="tiny muted">{a.project.name}</div>
                </div>
                <span aria-hidden>→</span>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="Blockers I must clear" right={<Badge tone={myBlockers.length ? 'bad' : 'muted'}>{myBlockers.length}</Badge>} />
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {myBlockers.length === 0 && <EmptyState title="No blockers assigned to you" />}
            {myBlockers.map(({ project, blocker }) => (
              <button key={blocker.id} className="row" style={{ gap: 8, background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }} onClick={() => navigate(`#/projects/${project.id}/blockers`)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="small strong truncate">{blocker.title}</div>
                  <div className="tiny muted truncate">{blocker.requiredAction}</div>
                </div>
                <Badge tone="bad">OPEN</Badge>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="My milestones" right={<Badge tone="muted">{myMilestones.length}</Badge>} />
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {myMilestones.length === 0 && <EmptyState title="No open milestones owned by you" />}
            {myMilestones.map(({ project, milestone }) => (
              <button key={milestone.id} className="row" style={{ gap: 8, background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }} onClick={() => navigate(`#/projects/${project.id}/milestones`)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="small strong truncate">{milestone.name}</div>
                  <div className="tiny muted">
                    {project.name} · due {fmtDate(milestone.dueDate)}
                    {daysBetween(milestone.dueDate, db.today) > 0 ? ` · ${daysBetween(milestone.dueDate, db.today)}d late` : ''}
                  </div>
                </div>
                <MilestoneBadge status={milestone.status} />
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title="Projects I am on" sub="Everything where this role carries a named responsibility" />
        <div className="table-wrap">
          {myProjects.length === 0 ? (
            <EmptyState title="No projects for this role yet" />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>My part</th>
                  <th>Stage</th>
                  <th>Health</th>
                  <th style={{ minWidth: 120 }}>Progress</th>
                  <th>Next action</th>
                  <th>Delivery</th>
                </tr>
              </thead>
              <tbody>
                {myProjects.map((v) => {
                  const p = v.project
                  const part =
                    userById(db, p.ownerId)?.role === role
                      ? 'Project owner'
                      : userById(db, p.analystId)?.role === role
                        ? 'AI Analyst'
                        : userById(db, p.developerId)?.role === role
                          ? 'Developer'
                          : userById(db, p.businessOwnerId)?.role === role
                            ? 'Business owner'
                            : 'Oversight'
                  return (
                    <tr key={p.id} className="clickable" onClick={() => navigate(`#/projects/${p.id}`)}>
                      <td className="cell-main">{p.name}</td>
                      <td>{part}</td>
                      <td>
                        <span className="pill-stage">{stageDef(p.stage).short}</span>
                      </td>
                      <td>
                        <HealthBadge health={v.health.health} />
                      </td>
                      <td>
                        <ProgressBar value={v.progress.percent} />
                      </td>
                      <td>
                        <div className="small">{v.action.label}</div>
                        <div className="cell-sub">{userById(db, v.action.ownerId)?.name ?? '—'}</div>
                      </td>
                      <td className="nowrap">{fmtDate(p.expectedDeliveryDate)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  )
}
