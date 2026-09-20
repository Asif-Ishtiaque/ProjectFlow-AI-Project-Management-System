import { fmtDate, daysBetween } from '../../domain/dates'
import { stageDef } from '../../domain/lifecycle'
import { buName, deptName, userById, viewOf } from '../../domain/logic'
import { navigate } from '../../router'
import { useApp } from '../../store/store'
import { Badge, Button, Card, EmptyState, HealthBadge, Person, PriorityBadge, ProgressBar, Tabs } from '../../components/ui'
import { OverviewTab } from './OverviewTab'
import { TimelineTab } from './TimelineTab'
import { MilestonesTab } from './MilestonesTab'
import { BlockersTab } from './BlockersTab'
import { FilesTab } from './FilesTab'
import { UatTab } from './UatTab'
import { ActivityTab } from './ActivityTab'

const TABS = ['overview', 'timeline', 'milestones', 'blockers', 'files', 'uat', 'activity'] as const
export type WorkspaceTab = (typeof TABS)[number]

export function Workspace({ projectId, tab }: { projectId: string; tab: string }) {
  const { db } = useApp()
  const project = db.projects.find((p) => p.id === projectId)

  if (!project)
    return (
      <div className="content">
        <Card>
          <EmptyState
            title="Project not found"
            body="It may have been removed, or the demo data was reset."
            action={<Button onClick={() => navigate('#/projects')}>Back to portfolio</Button>}
          />
        </Card>
      </div>
    )

  const v = viewOf(project, db.today)
  const active = (TABS.includes(tab as WorkspaceTab) ? tab : 'overview') as WorkspaceTab
  const openBlockers = v.openBlockers.length
  const pendingChanges = project.scopeChanges.filter((s) => s.decision === 'under_review').length
  const slip = daysBetween(project.originalDeliveryDate, project.expectedDeliveryDate)
  const nextOwner = userById(db, v.action.ownerId)

  return (
    <div className="content">
      {/* ---------------------------------------------------------- header */}
      <div className="card" style={{ padding: 0, marginBottom: 14 }}>
        <div style={{ padding: '18px 20px 0' }}>
          <div className="row wrap" style={{ gap: 10 }}>
            <span className="eyebrow mono">{project.code}</span>
            <span className="tiny muted">
              {buName(db, project.businessUnitId)} · {deptName(db, project.departmentId)}
            </span>
            <PriorityBadge priority={project.priority} />
          </div>
          <div className="row wrap" style={{ gap: 12, marginTop: 6 }}>
            <h1 className="h1" style={{ margin: 0 }}>
              {project.name}
            </h1>
            <HealthBadge health={v.health.health} size="lg" />
            <span className="spacer" style={{ flex: 1 }} />
            <div style={{ textAlign: 'right' }}>
              <div className="eyebrow">Expected delivery</div>
              <div style={{ fontSize: 16, fontWeight: 650 }}>{fmtDate(project.expectedDeliveryDate)}</div>
              {slip > 0 ? (
                <div className="tiny" style={{ color: 'var(--late)', fontWeight: 600 }}>
                  +{slip} days vs original {fmtDate(project.originalDeliveryDate)}
                </div>
              ) : (
                <div className="tiny muted">On the original commitment</div>
              )}
            </div>
          </div>
          <p className="small muted" style={{ marginTop: 6, maxWidth: 780 }}>
            {v.health.reason}
          </p>

          {/* ------------------------------------------- five key questions */}
          <div
            className="facts"
            style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 14, paddingBottom: 14 }}
          >
            <div className="fact">
              <div className="fl">Current stage</div>
              <div className="fv">{stageDef(project.stage).label}</div>
              <div className="fs">
                Stage {stageDef(project.stage).index + 1} of 10
              </div>
            </div>
            <div className="fact">
              <div className="fl">Overall progress</div>
              <div className="fv" style={{ marginBottom: 2 }}>
                {v.progress.percent}%
              </div>
              <ProgressBar
                value={v.progress.percent}
                showValue={false}
                tone={v.health.health === 'blocked' ? 'bad' : v.health.health === 'on_track' || v.health.health === 'completed' ? 'ok' : 'warn'}
              />
              <div className="fs">
                {v.progress.completedCount} of {v.progress.totalCount} milestones completed
              </div>
            </div>
            <div className="fact">
              <div className="fl">Next milestone</div>
              <div className="fv">{v.next?.name ?? '—'}</div>
              <div className="fs">
                {v.next ? `${fmtDate(v.next.dueDate)} · ${userById(db, v.next.ownerId)?.name ?? 'Unassigned'}` : 'Nothing outstanding'}
              </div>
            </div>
            <div className="fact">
              <div className="fl">Next action</div>
              <div className="fv" style={{ color: v.action.urgency === 'critical' ? 'var(--bad)' : undefined }}>
                {v.action.label}
              </div>
              <div className="fs">{nextOwner ? `Owner: ${nextOwner.name}` : 'Owner: unassigned'}</div>
            </div>
            <div className="fact">
              <div className="fl">Active blockers</div>
              <div className="fv" style={{ color: openBlockers ? 'var(--bad)' : undefined }}>
                {openBlockers}
              </div>
              <div className="fs">{pendingChanges} scope change{pendingChanges === 1 ? '' : 's'} under review</div>
            </div>
          </div>

          <div className="row wrap" style={{ gap: 20, borderTop: '1px solid var(--line)', padding: '12px 0' }}>
            <TeamSlot label="Project owner" userId={project.ownerId} />
            <TeamSlot label="AI Analyst" userId={project.analystId} />
            <TeamSlot label="Developer" userId={project.developerId} />
            <TeamSlot label="Business owner" userId={project.businessOwnerId} />
            <span className="spacer" style={{ flex: 1 }} />
          </div>
        </div>

        <div style={{ padding: '0 12px' }}>
          <Tabs
            active={active}
            onChange={(k) => navigate(`#/projects/${project.id}/${k}`)}
            tabs={[
              { key: 'overview', label: 'Overview' },
              { key: 'timeline', label: 'Timeline & Gates' },
              { key: 'milestones', label: 'Milestones & Tasks', count: v.overdue.length, alert: true },
              { key: 'blockers', label: 'Blockers & Changes', count: openBlockers + pendingChanges, alert: openBlockers > 0 },
              { key: 'files', label: 'Files & Deliverables', count: project.files.length },
              { key: 'uat', label: 'UAT & Approvals' },
              { key: 'activity', label: 'Activity' },
            ]}
          />
        </div>
      </div>

      {active === 'overview' && <OverviewTab project={project} />}
      {active === 'timeline' && <TimelineTab project={project} />}
      {active === 'milestones' && <MilestonesTab project={project} />}
      {active === 'blockers' && <BlockersTab project={project} />}
      {active === 'files' && <FilesTab project={project} />}
      {active === 'uat' && <UatTab project={project} />}
      {active === 'activity' && <ActivityTab project={project} />}
    </div>
  )
}

function TeamSlot({ label, userId }: { label: string; userId?: string }) {
  const { db } = useApp()
  const user = userById(db, userId)
  return (
    <div>
      <div className="fl" style={{ fontSize: 11, fontWeight: 650, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 4 }}>
        {label}
      </div>
      {user ? <Person user={user} /> : <Badge tone="warn">Unassigned</Badge>}
    </div>
  )
}
