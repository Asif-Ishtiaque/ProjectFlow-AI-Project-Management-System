import { fmtDate, fmtShort, daysBetween } from '../domain/dates'
import { HEALTH_META, stageDef } from '../domain/lifecycle'
import {
  attentionQueue,
  deliveryOutlook,
  deptName,
  milestoneLoad,
  milestoneRadar,
  portfolioAttribution,
  portfolioSummary,
  userById,
  viewsOf,
  workload,
} from '../domain/logic'
import { AttributionBar, DeliveryOutlook, HealthBar, MilestoneLoad, PipelineBars } from '../components/charts'
import { navigate } from '../router'
import { useApp } from '../store/store'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHead,
  EmptyState,
  HealthBadge,
  MilestoneBadge,
  Person,
  ProgressBar,
  Skeleton,
  Stat,
  TableSkeleton,
} from '../components/ui'

export function Dashboard() {
  const { db, status, role, reload } = useApp()

  if (status === 'loading') return <DashboardSkeleton />
  if (status === 'error')
    return (
      <div className="content">
        <Card>
          <div className="card-body">
            <Alert tone="bad" title="Unable to load portfolio data">
              The ProjectFlow service did not respond.
            </Alert>
            <div style={{ marginTop: 12 }}>
              <Button variant="primary" onClick={reload}>
                Try again
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )

  const summary = portfolioSummary(db)
  const attention = attentionQueue(db)
  const radar = milestoneRadar(db)
  const outlook = deliveryOutlook(db)
  const load = milestoneLoad(db)
  const attribution = portfolioAttribution(db)
  const slipping = outlook.filter((r) => r.slipDays > 0).length
  const analysts = workload(db, ['ai_analyst'])
  const devs = workload(db, ['developer']).slice(0, 5)
  const views = viewsOf(db)

  const decisions = views.flatMap((v) => [
    ...v.project.gates
      .filter((g) => g.state === 'ready_for_review')
      .map((g) => ({
        id: g.id,
        project: v.project,
        label: g.name,
        who: g.approverRole,
        href: `#/projects/${v.project.id}/timeline`,
        kind: 'Stage gate',
      })),
    ...v.project.scopeChanges
      .filter((s) => s.decision === 'under_review')
      .map((s) => ({
        id: s.id,
        project: v.project,
        label: `${s.title} (+${s.deliveryImpactDays} days)`,
        who: 'business_owner' as const,
        href: `#/projects/${v.project.id}/changes`,
        kind: 'Scope change',
      })),
  ])

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="eyebrow">Management Dashboard</div>
          <h1 className="h1">Which projects need attention today?</h1>
          <p className="muted small" style={{ marginTop: 4 }}>
            {summary.totalActive} active AI initiatives · {attention.length} need a decision or an intervention ·{' '}
            {fmtDate(db.today)}
          </p>
        </div>
        <span className="spacer" />
        <Button variant="primary" onClick={() => navigate('#/projects/new')}>
          + New project
        </Button>
      </div>

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <Stat
          label="Active projects"
          value={summary.totalActive}
          hint={`${summary.completed} completed this year`}
        />
        <Stat
          label="Needs attention"
          value={summary.byHealth.blocked + summary.byHealth.delayed}
          tone={summary.byHealth.blocked ? 'bad' : 'late'}
          hint={`${summary.byHealth.blocked} blocked · ${summary.byHealth.delayed} delayed`}
        />
        <Stat
          label="At risk"
          value={summary.byHealth.at_risk}
          tone={summary.byHealth.at_risk ? 'warn' : undefined}
          hint="A decision or dependency may move the date"
        />
        <Stat
          label="Expected this month"
          value={summary.dueThisMonth}
          hint={`Delivering in ${new Date(db.today).toLocaleString('en', { month: 'long' })}`}
        />
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div className="card-body tight" style={{ paddingTop: 14, paddingBottom: 14 }}>
          <div className="between" style={{ marginBottom: 10 }}>
            <div>
              <div className="eyebrow">Portfolio health</div>
              <div className="small muted">
                {summary.byHealth.on_track} of {summary.totalActive} active projects are on their committed plan
              </div>
            </div>
            <div className="small muted nowrap">
              {slipping} project{slipping === 1 ? '' : 's'} carrying a delivery slip
            </div>
          </div>
          <HealthBar
            onSelect={(h) => navigate(`#/projects?health=${h}`)}
            segments={[
              { health: 'on_track', label: 'On Track', icon: HEALTH_META.on_track.icon, count: summary.byHealth.on_track },
              { health: 'at_risk', label: 'At Risk', icon: HEALTH_META.at_risk.icon, count: summary.byHealth.at_risk },
              { health: 'delayed', label: 'Delayed', icon: HEALTH_META.delayed.icon, count: summary.byHealth.delayed },
              { health: 'blocked', label: 'Blocked', icon: HEALTH_META.blocked.icon, count: summary.byHealth.blocked },
            ]}
          />
        </div>
      </Card>

      <div className="split">
        <div className="col" style={{ gap: 14 }}>
          <Card>
            <CardHead
              title="Attention required"
              sub="Exceptions first — what is blocked, late or at risk, and who must act"
              right={<Badge tone={attention.length ? 'bad' : 'ok'}>{attention.length} open</Badge>}
            />
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {attention.length === 0 && (
                <EmptyState icon="✓" title="Nothing needs intervention" body="Every active project is on its committed plan." />
              )}
              {attention.map((v) => {
                const owner = userById(db, v.action.ownerId)
                return (
                  <article key={v.project.id} className={`attention ${v.health.health}`}>
                    <div className="body">
                      <div className="row wrap" style={{ gap: 9 }}>
                        <span className="nm">{v.project.name}</span>
                        <HealthBadge health={v.health.health} />
                        <span className="pill-stage">{stageDef(v.project.stage).label}</span>
                        <span className="tiny muted">{deptName(db, v.project.departmentId)}</span>
                      </div>
                      <div className="why">{v.health.reason}</div>
                      <div className="meta">
                        <div className="m">
                          Action required
                          <b>{v.action.label}</b>
                        </div>
                        <div className="m">
                          Owner
                          <b>{owner?.name ?? 'Unassigned'}</b>
                        </div>
                        <div className="m">
                          Delivery impact
                          <b>
                            {daysBetween(v.project.originalDeliveryDate, v.project.expectedDeliveryDate) > 0
                              ? `+${daysBetween(v.project.originalDeliveryDate, v.project.expectedDeliveryDate)} days → ${fmtDate(
                                  v.project.expectedDeliveryDate,
                                )}`
                              : `On date · ${fmtDate(v.project.expectedDeliveryDate)}`}
                          </b>
                        </div>
                        <div className="m">
                          Progress
                          <b>{v.progress.percent}%</b>
                        </div>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => navigate(v.action.href ?? `#/projects/${v.project.id}`)}>
                      View project
                    </Button>
                  </article>
                )
              })}
            </div>
          </Card>

          <Card>
            <CardHead
              title="Delivery outlook"
              sub="When each active project is expected to land, and how far it has moved from its promise"
              right={<Badge tone={slipping ? 'late' : 'ok'}>{slipping} slipping</Badge>}
            />
            <div className="card-body">
              {outlook.length === 0 ? (
                <EmptyState title="No active projects" />
              ) : (
                <DeliveryOutlook rows={outlook} today={db.today} onSelect={(id) => navigate(`#/projects/${id}`)} />
              )}
            </div>
          </Card>

          <div className="grid g2">
            <Card>
              <CardHead title="Milestone load" sub="Commitments per week across the portfolio" />
              <div className="card-body">
                <MilestoneLoad weeks={load} />
              </div>
            </Card>
            <Card>
              <CardHead
                title="Why delivery has moved"
                sub="Execution slippage kept apart from approved scope"
                right={<Badge tone="muted">{attribution.total} days</Badge>}
              />
              <div className="card-body">
                <AttributionBar execution={attribution.execution} scope={attribution.scope}>
                  {attribution.lines.length > 0 && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {attribution.lines.slice(0, 4).map((l, i) => (
                        <button
                          key={i}
                          className="row"
                          style={{ gap: 8, background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }}
                          onClick={() => navigate(`#/projects/${l.projectId}/blockers`)}
                        >
                          <span className="sw" style={{ width: 8, height: 8, borderRadius: 2, background: l.kind === 'scope' ? 'var(--c-scope)' : 'var(--c-late)', flex: 'none' }} />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span className="small truncate" style={{ display: 'block' }}>{l.label}</span>
                            <span className="tiny muted">{l.projectName}</span>
                          </span>
                          <span className="small strong nowrap">+{l.days}d</span>
                        </button>
                      ))}
                    </div>
                  )}
                </AttributionBar>
              </div>
            </Card>
          </div>

          <Card>
            <CardHead
              title="Milestones due or overdue"
              sub="The next ten days across the portfolio"
              right={
                <Badge tone={radar.some((r) => r.overdueDays > 0) ? 'late' : 'muted'}>
                  {radar.filter((r) => r.overdueDays > 0).length} overdue
                </Badge>
              }
            />
            <div className="table-wrap">
              {radar.length === 0 ? (
                <EmptyState title="No milestones due in the next ten days" />
              ) : (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Milestone</th>
                      <th>Owner</th>
                      <th>Due</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {radar.map((r) => (
                      <tr
                        key={r.milestone.id}
                        className={`clickable${r.overdueDays > 0 ? ' row-alert' : ''}`}
                        onClick={() => navigate(`#/projects/${r.project.id}/milestones`)}
                      >
                        <td className="cell-main">{r.project.name}</td>
                        <td>{r.milestone.name}</td>
                        <td>
                          <Person user={userById(db, r.milestone.ownerId)} compact />
                        </td>
                        <td className="nowrap">
                          {fmtShort(r.milestone.dueDate)}
                          {r.overdueDays > 0 && (
                            <span className="cell-sub" style={{ color: 'var(--late)', fontWeight: 600 }}>
                              {r.overdueDays} day(s) late
                            </span>
                          )}
                        </td>
                        <td>
                          <MilestoneBadge status={r.milestone.status} />
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
            <CardHead title="Decisions waiting" sub="Approvals and scope calls holding projects up" />
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {decisions.length === 0 && <EmptyState title="No pending decisions" body="Nothing is waiting on an approver." />}
              {decisions.map((d) => (
                <button
                  key={d.id}
                  className="card"
                  style={{ textAlign: 'left', padding: '10px 12px', cursor: 'pointer', background: 'var(--surface-2)' }}
                  onClick={() => navigate(d.href)}
                >
                  <div className="row" style={{ gap: 7 }}>
                    <Badge tone={d.kind === 'Scope change' ? 'warn' : 'info'}>{d.kind}</Badge>
                    {d.who === role && <Badge tone="bad">Your decision</Badge>}
                  </div>
                  <div style={{ fontWeight: 620, fontSize: 13, marginTop: 6 }}>{d.label}</div>
                  <div className="tiny muted">{d.project.name}</div>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <CardHead title="Portfolio by stage" sub="Where the work currently sits" />
            <div className="card-body">
              <PipelineBars
                onSelect={(stage) => navigate(`#/projects?stage=${stage}`)}
                stages={summary.byStage.map((s) => ({ key: s.stage, label: stageDef(s.stage).label, count: s.count }))}
              />
            </div>
          </Card>

          <Card>
            <CardHead title="Team workload" sub="Open milestones owned per person" />
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div className="eyebrow">AI Analysts</div>
              {analysts.map((w) => (
                <WorkloadRowView key={w.user.id} row={w} />
              ))}
              <div className="eyebrow" style={{ marginTop: 4 }}>
                Developers
              </div>
              {devs.map((w) => (
                <WorkloadRowView key={w.user.id} row={w} />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function WorkloadRowView({ row }: { row: ReturnType<typeof workload>[number] }) {
  return (
    <div className="row" style={{ gap: 10 }}>
      <Person user={row.user} compact />
      <span className="spacer" style={{ flex: 1 }} />
      <span className="tiny muted nowrap">{row.active} open</span>
      {row.overdue > 0 && <Badge tone="late">{row.overdue} late</Badge>}
      {row.blocked > 0 && <Badge tone="bad">{row.blocked} blocker</Badge>}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="content">
      <Skeleton w={280} h={26} />
      <Skeleton w={420} h={12} style={{ marginTop: 10 }} />
      <div className="grid g4" style={{ margin: '18px 0 14px' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card stat">
            <Skeleton w={90} h={10} />
            <Skeleton w={54} h={24} style={{ marginTop: 10 }} />
          </div>
        ))}
      </div>
      <div className="split">
        <Card>
          <div className="card-head">
            <Skeleton w={160} h={14} />
          </div>
          <TableSkeleton rows={4} cols={4} />
        </Card>
        <Card>
          <div className="card-head">
            <Skeleton w={120} h={14} />
          </div>
          <TableSkeleton rows={3} cols={2} />
        </Card>
      </div>
    </div>
  )
}
