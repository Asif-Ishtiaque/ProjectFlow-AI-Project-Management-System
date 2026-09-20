import { fmtDate, fmtTime, relativeDay } from '../../domain/dates'
import { userById } from '../../domain/logic'
import type { Project } from '../../domain/types'
import { useApp } from '../../store/store'
import { Card, CardHead, EmptyState } from '../../components/ui'

export function ActivityTab({ project }: { project: Project }) {
  const { db } = useApp()
  const entries = db.activity.filter((a) => a.projectId === project.id)

  const groups: { label: string; items: typeof entries }[] = []
  for (const a of entries) {
    const label = relativeDay(a.at, db.today) === 'Today' ? 'Today' : relativeDay(a.at, db.today) === 'Yesterday' ? 'Yesterday' : fmtDate(a.at)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(a)
    else groups.push({ label, items: [a] })
  }

  return (
    <Card>
      <CardHead title="Activity" sub="Who changed what, and when — the project's audit trail" />
      <div className="card-body">
        {entries.length === 0 ? (
          <EmptyState title="No activity recorded yet" />
        ) : (
          <div className="activity">
            {groups.map((g) => (
              <div key={g.label}>
                <div className="act-day">{g.label}</div>
                {g.items.map((a) => (
                  <div key={a.id} className={`act ${a.kind}`}>
                    <span className="when">{fmtTime(a.at) || '—'}</span>
                    <span className="ai" aria-hidden>
                      <i />
                    </span>
                    <span>
                      <span className="txt">
                        <b>{userById(db, a.actorId)?.name ?? 'Someone'}</b> {a.message}
                      </span>
                      {a.detail && <span className="det" style={{ display: 'block' }}>{a.detail}</span>}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
