import { fmtDate, daysBetween } from '../domain/dates'
import { roleLabel, stageDef } from '../domain/lifecycle'
import { gateReadiness, userById } from '../domain/logic'
import type { RoleKey } from '../domain/types'
import { navigate } from '../router'
import { useApp } from '../store/store'
import { Alert, Badge, Button, Card, CardHead, EmptyState } from '../components/ui'

export function Approvals() {
  const { db, role, setRole } = useApp()

  const gateItems = db.projects.flatMap((p) =>
    p.gates
      .filter((g) => g.state === 'ready_for_review')
      .map((g) => ({
        id: g.id,
        project: p,
        title: g.name,
        detail: `${stageDef(g.stage).label} · ${gateReadiness(g).total} exit criteria evidenced`,
        approver: g.approverRole as RoleKey,
        waiting: daysBetween(g.submittedAt ?? db.today, db.today),
        href: `#/projects/${p.id}/${g.stage === 'uat' ? 'uat' : 'timeline'}`,
        kind: 'Stage gate',
      })),
  )

  const scopeItems = db.projects.flatMap((p) =>
    p.scopeChanges
      .filter((s) => s.decision === 'under_review')
      .map((s) => ({
        id: s.id,
        project: p,
        title: s.title,
        detail: `Requested by ${userById(db, s.requestedById)?.name} · +${s.deliveryImpactDays} days → ${fmtDate(s.proposedDeliveryDate)}`,
        approver: 'business_owner' as RoleKey,
        waiting: daysBetween(s.createdAt, db.today),
        href: `#/projects/${p.id}/blockers`,
        kind: 'Scope change',
      })),
  )

  const all = [...gateItems, ...scopeItems]
  const mine = all.filter((i) => i.approver === role)
  const others = all.filter((i) => i.approver !== role)

  const decided = db.projects
    .flatMap((p) => p.approvals.filter((a) => a.decision !== 'pending').map((a) => ({ p, a })))
    .sort((x, y) => (y.a.decidedAt ?? '').localeCompare(x.a.decidedAt ?? ''))
    .slice(0, 8)

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="eyebrow">Approvals</div>
          <h1 className="h1">Decisions holding projects up</h1>
          <p className="muted small" style={{ marginTop: 4 }}>
            A stage cannot advance until the named role decides. Nothing here can be self-approved by the team that did
            the work.
          </p>
        </div>
      </div>

      <div className="split">
        <div className="col" style={{ gap: 14 }}>
          <Card>
            <CardHead title={`Waiting on you (${roleLabel(role)})`} right={<Badge tone={mine.length ? 'warn' : 'ok'}>{mine.length}</Badge>} />
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {mine.length === 0 && <EmptyState icon="✓" title="No decisions waiting on this role" body="Switch role in the top bar to review another queue." />}
              {mine.map((i) => (
                <article key={i.id} className="attention at_risk">
                  <div className="body">
                    <div className="row wrap" style={{ gap: 9 }}>
                      <span className="nm">{i.title}</span>
                      <Badge tone={i.kind === 'Scope change' ? 'warn' : 'info'}>{i.kind}</Badge>
                      {i.waiting >= 2 && <Badge tone="late">Waiting {i.waiting} days</Badge>}
                    </div>
                    <div className="why">{i.project.name} — {i.detail}</div>
                  </div>
                  <Button size="sm" variant="primary" onClick={() => navigate(i.href)}>
                    Review
                  </Button>
                </article>
              ))}
            </div>
          </Card>

          <Card>
            <CardHead title="Waiting on other roles" right={<Badge tone="muted">{others.length}</Badge>} />
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {others.length === 0 && <EmptyState title="Nothing outstanding elsewhere" />}
              {others.map((i) => (
                <div key={i.id} className="row" style={{ gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="small strong">{i.title}</div>
                    <div className="tiny muted">
                      {i.project.name} · {i.detail}
                    </div>
                  </div>
                  <Badge tone="muted">{roleLabel(i.approver)}</Badge>
                  <Button size="sm" onClick={() => setRole(i.approver)}>
                    View as {roleLabel(i.approver)}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card>
          <CardHead title="Recent decisions" sub="The approval trail across the portfolio" />
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {decided.length === 0 && <EmptyState title="No decisions recorded yet" />}
            {decided.map(({ p, a }) => (
              <div key={a.id} className="row" style={{ gap: 9 }}>
                <Badge tone={a.decision === 'approved' ? 'ok' : 'bad'}>{a.decision === 'approved' ? '✓' : '✕'}</Badge>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="small strong truncate">{a.title}</div>
                  <div className="tiny muted truncate">
                    {p.name} · {userById(db, a.decidedById)?.name} · {fmtDate(a.decidedAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
