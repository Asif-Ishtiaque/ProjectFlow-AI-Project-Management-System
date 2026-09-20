import { useState } from 'react'
import { daysBetween, fmtDate, fmtShort } from '../../domain/dates'
import { delayLabel, stageDef } from '../../domain/lifecycle'
import { userById } from '../../domain/logic'
import type { DelayCategory, Milestone, Project } from '../../domain/types'
import { useApp } from '../../store/store'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHead,
  Drawer,
  EmptyState,
  Field,
  MilestoneBadge,
  Person,
  ProgressBar,
} from '../../components/ui'
import { CreateBlockerDialog, RecordDelayDialog, type BlockerPrefill } from './dialogs'

export function MilestonesTab({ project }: { project: Project }) {
  const { db, role, run, pending, actorFor } = useApp()
  const actor = actorFor(project)
  const [openId, setOpenId] = useState<string | null>(null)
  const [delayFor, setDelayFor] = useState<Milestone | null>(null)
  const [blockerPrefill, setBlockerPrefill] = useState<BlockerPrefill | null>(null)

  const open = project.milestones.find((m) => m.id === openId)
  const taskCount = (milestoneId: string) => project.tasks.filter((t) => t.milestoneId === milestoneId).length
  const taskDone = (milestoneId: string) =>
    project.tasks.filter((t) => t.milestoneId === milestoneId && t.status === 'done').length
  const overdueUnexplained = project.milestones.filter(
    (m) => m.status !== 'completed' && daysBetween(m.dueDate, db.today) > 0 && !m.delay,
  )

  return (
    <div className="col" style={{ gap: 14 }}>
      {overdueUnexplained.map((m) => (
        <Alert
          key={m.id}
          tone="bad"
          title={`${m.name} is overdue by ${daysBetween(m.dueDate, db.today)} day(s)`}
          action={
            <Button size="sm" variant="primary" disabled={role === 'management'} onClick={() => setDelayFor(m)}>
              Record delay
            </Button>
          }
        >
          Committed date was {fmtDate(m.dueDate)} and the prototype date is {fmtDate(db.today)}. This milestone is
          overdue — it is <b>not</b> automatically treated as blocked. The owner must record what caused the delay.
        </Alert>
      ))}

      <Card>
        <CardHead
          title="Milestones"
          sub="Meaningful delivery checkpoints — the basis for progress, not a task list"
          right={
            <div className="row" style={{ gap: 8 }}>
              <Badge tone="muted">{project.milestones.filter((m) => m.status === 'completed').length} completed</Badge>
              <Badge tone={overdueUnexplained.length ? 'late' : 'muted'}>
                {project.milestones.filter((m) => m.status === 'delayed').length} delayed
              </Badge>
            </div>
          }
        />
        <div className="table-wrap">
          {project.milestones.length === 0 ? (
            <EmptyState title="No milestones planned" body="Apply a delivery plan to make progress measurable." />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Milestone</th>
                  <th>Stage</th>
                  <th>Owner</th>
                  <th>Baseline</th>
                  <th>Committed</th>
                  <th style={{ minWidth: 120 }}>Progress</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {project.milestones.map((m) => {
                  const variance = daysBetween(m.baselineDue, m.dueDate)
                  const late = m.status !== 'completed' && daysBetween(m.dueDate, db.today) > 0
                  return (
                    <tr key={m.id} className={`clickable${late ? ' row-alert' : ''}`} onClick={() => setOpenId(m.id)}>
                      <td>
                        <div className="cell-main">{m.name}</div>
                        {taskCount(m.id) > 0 && (
                          <div className="cell-sub">
                            {taskDone(m.id)} of {taskCount(m.id)} task{taskCount(m.id) === 1 ? '' : 's'} complete
                          </div>
                        )}
                        {m.delay && (
                          <div className="cell-sub">
                            Delay: {delayLabel(m.delay.category)} · +{m.delay.impactDays}d
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="pill-stage">{stageDef(m.stage).short}</span>
                      </td>
                      <td>
                        <Person user={userById(db, m.ownerId)} compact />
                      </td>
                      <td className="nowrap muted small">{fmtShort(m.baselineDue)}</td>
                      <td className="nowrap">
                        {fmtShort(m.dueDate)}
                        {variance > 0 && (
                          <div className="cell-sub" style={{ color: 'var(--late)', fontWeight: 600 }}>
                            +{variance}d vs baseline
                          </div>
                        )}
                      </td>
                      <td>
                        <ProgressBar
                          value={m.status === 'completed' ? 100 : m.progress}
                          tone={m.status === 'completed' ? 'ok' : m.status === 'blocked' ? 'bad' : undefined}
                        />
                      </td>
                      <td>
                        <MilestoneBadge status={m.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {open && (
        <MilestoneDrawer
          project={project}
          milestone={open}
          onClose={() => setOpenId(null)}
          onRecordDelay={() => setDelayFor(open)}
          onCreateBlocker={() =>
            setBlockerPrefill({ milestoneId: open.id, responsibleId: project.developerId, bookImpact: true, impactDays: 2 })
          }
        />
      )}

      {delayFor && (
        <RecordDelayDialog
          project={project}
          milestone={delayFor}
          onClose={() => setDelayFor(null)}
          onCreateBlocker={(prefill) => setBlockerPrefill({ ...prefill, bookImpact: false })}
        />
      )}

      {blockerPrefill && (
        <CreateBlockerDialog project={project} prefill={blockerPrefill} onClose={() => setBlockerPrefill(null)} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------ detail panel */

function MilestoneDrawer({
  project,
  milestone,
  onClose,
  onRecordDelay,
  onCreateBlocker,
}: {
  project: Project
  milestone: Milestone
  onClose: () => void
  onRecordDelay: () => void
  onCreateBlocker: () => void
}) {
  const { db, role, run, pending, actorFor } = useApp()
  const actor = actorFor(project)
  const tasks = project.tasks.filter((t) => t.milestoneId === milestone.id)
  const blockers = project.blockers.filter((b) => b.milestoneId === milestone.id)
  const activity = db.activity.filter((a) => a.projectId === project.id && a.message.includes(milestone.name)).slice(0, 6)
  const [progress, setProgress] = useState(milestone.progress)
  const [taskTitle, setTaskTitle] = useState('')
  const variance = daysBetween(milestone.baselineDue, milestone.dueDate)
  const late = milestone.status !== 'completed' && daysBetween(milestone.dueDate, db.today) > 0
  const canEdit = role !== 'management' && milestone.status !== 'completed'

  return (
    <Drawer
      title={milestone.name}
      sub={`${stageDef(milestone.stage).label} · weight ${milestone.weight}`}
      onClose={onClose}
      footer={
        milestone.status === 'completed' ? (
          <span className="small muted">Completed {fmtDate(milestone.completedAt)}</span>
        ) : (
          <>
            {late && !milestone.delay && (
              <Button variant="danger" disabled={!canEdit} onClick={onRecordDelay}>
                Record delay
              </Button>
            )}
            <Button disabled={!canEdit} onClick={onCreateBlocker}>
              Raise blocker
            </Button>
            <Button
              variant="primary"
              disabled={!canEdit}
              loading={pending === 'complete_milestone'}
              onClick={async () => {
                await run(
                  { type: 'complete_milestone', projectId: project.id, milestoneId: milestone.id, actorId: actor.id },
                  { success: `${milestone.name} completed.` },
                )
                onClose()
              }}
            >
              Mark complete
            </Button>
          </>
        )
      }
    >
      <div className="row wrap" style={{ gap: 8 }}>
        <MilestoneBadge status={milestone.status} />
        {late && <Badge tone="late">{daysBetween(milestone.dueDate, db.today)} day(s) past the committed date</Badge>}
        {variance > 0 && <Badge tone="warn">+{variance}d vs baseline</Badge>}
      </div>

      <p className="small" style={{ color: 'var(--ink-2)' }}>
        {milestone.description || 'No description recorded.'}
      </p>

      <dl className="kv">
        <dt>Owner</dt>
        <dd>
          <Person user={userById(db, milestone.ownerId)} compact />
        </dd>
        <dt>Baseline date</dt>
        <dd>{fmtDate(milestone.baselineDue)}</dd>
        <dt>Committed date</dt>
        <dd>{fmtDate(milestone.dueDate)}</dd>
        <dt>Weight</dt>
        <dd>
          {milestone.weight} of {project.milestones.reduce((s, m) => s + m.weight, 0)} total
        </dd>
      </dl>

      {milestone.delay && (
        <Alert tone="warn" title={`Delay recorded — ${delayLabel(milestone.delay.category)}`}>
          {milestone.delay.note}
          <div className="tiny" style={{ marginTop: 4 }}>
            +{milestone.delay.impactDays} day(s) · responsible {userById(db, milestone.delay.responsibleId)?.name} ·
            recorded {fmtDate(milestone.delay.recordedAt)}
            {milestone.delay.blockerId ? ' · linked to a blocker' : ''}
          </div>
        </Alert>
      )}

      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          Progress
        </div>
        <ProgressBar value={milestone.status === 'completed' ? 100 : milestone.progress} size="lg" />
        {canEdit && (
          <div className="row" style={{ gap: 10, marginTop: 10 }}>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--brand)' }}
              aria-label="Milestone progress"
            />
            <span className="small strong" style={{ width: 38 }}>
              {progress}%
            </span>
            <Button
              size="sm"
              disabled={progress === milestone.progress}
              loading={pending === 'log_milestone_progress'}
              onClick={() =>
                run(
                  { type: 'log_milestone_progress', projectId: project.id, milestoneId: milestone.id, progress, actorId: actor.id },
                  { success: 'Progress logged.' },
                )
              }
            >
              Log progress
            </Button>
          </div>
        )}
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          Deliverables
        </div>
        {milestone.deliverables.length === 0 ? (
          <p className="small muted">No deliverables listed for this milestone.</p>
        ) : (
          <ul className="small" style={{ margin: 0, paddingLeft: 18, color: 'var(--ink-2)' }}>
            {milestone.deliverables.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="row" style={{ marginBottom: 6 }}>
          <span className="eyebrow">Tasks</span>
          <span className="spacer" style={{ flex: 1 }} />
          {tasks.length > 0 && (
            <span className="tiny muted">
              {tasks.filter((t) => t.status === 'done').length} of {tasks.length} complete
            </span>
          )}
        </div>
        {tasks.length === 0 ? (
          <EmptyState title="No tasks have been added to this milestone" body="Tasks are optional — milestones carry the commitment." />
        ) : (
          <div className="col" style={{ gap: 6 }}>
            {tasks.map((t) => (
              <label key={t.id} className="row" style={{ gap: 9 }}>
                <input
                  type="checkbox"
                  checked={t.status === 'done'}
                  disabled={!canEdit}
                  style={{ accentColor: 'var(--brand)' }}
                  onChange={(e) =>
                    run({
                      type: 'set_task_status',
                      projectId: project.id,
                      taskId: t.id,
                      status: e.target.checked ? 'done' : 'todo',
                      actorId: actor.id,
                    })
                  }
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 13,
                      display: 'block',
                      color: t.status === 'done' ? 'var(--ink-3)' : undefined,
                      textDecoration: t.status === 'done' ? 'line-through' : undefined,
                    }}
                  >
                    {t.title}
                  </span>
                  <span className="tiny muted">
                    {userById(db, t.assigneeId)?.name ?? 'Unassigned'} · due {fmtShort(t.dueDate)}
                  </span>
                </span>
                {t.status === 'in_progress' && <Badge tone="info">In progress</Badge>}
                <Badge tone={t.priority === 'high' ? 'warn' : 'muted'}>{t.priority}</Badge>
              </label>
            ))}
          </div>
        )}
        {canEdit && (
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <input className="input" placeholder="Add a task…" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
            <Button
              size="sm"
              disabled={!taskTitle.trim()}
              onClick={async () => {
                await run({
                  type: 'add_task',
                  projectId: project.id,
                  milestoneId: milestone.id,
                  title: taskTitle,
                  assigneeId: milestone.ownerId,
                  dueDate: milestone.dueDate,
                  priority: 'medium',
                  actorId: actor.id,
                })
                setTaskTitle('')
              }}
            >
              Add
            </Button>
          </div>
        )}
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          Blockers
        </div>
        {blockers.length === 0 ? (
          <p className="small muted">No active blockers on this milestone.</p>
        ) : (
          blockers.map((b) => (
            <div key={b.id} className="row" style={{ gap: 8 }}>
              <Badge tone={b.status === 'open' ? 'bad' : 'ok'}>{b.status === 'open' ? 'OPEN' : 'RESOLVED'}</Badge>
              <span className="small">{b.title}</span>
            </div>
          ))
        )}
      </div>

      {activity.length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Milestone activity
          </div>
          <div className="activity">
            {activity.map((a) => (
              <div key={a.id} className={`act ${a.kind}`}>
                <span className="when">{fmtShort(a.at)}</span>
                <span className="ai" aria-hidden>
                  <i />
                </span>
                <span className="txt">
                  <b>{userById(db, a.actorId)?.name.split(' ')[0]}</b> {a.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Drawer>
  )
}
