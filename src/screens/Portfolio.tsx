import { useEffect, useMemo, useState } from 'react'
import { fmtDate, fmtShort, daysBetween } from '../domain/dates'
import { HEALTH_META, STAGES, stageDef } from '../domain/lifecycle'
import { buName, deptName, userById, viewsOf } from '../domain/logic'
import type { Health, StageKey } from '../domain/types'
import { navigate, useRoute } from '../router'
import { useApp } from '../store/store'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  HealthBadge,
  Person,
  ProgressBar,
  TableSkeleton,
} from '../components/ui'

const ALL = 'all'

export function Portfolio() {
  const { db, status } = useApp()
  const route = useRoute()
  // A click on the dashboard charts lands here already filtered.
  const [stage, setStage] = useState<string>(route.query.stage ?? ALL)
  const [health, setHealth] = useState<string>(route.query.health ?? ALL)
  const [dept, setDept] = useState<string>(ALL)
  const [owner, setOwner] = useState<string>(ALL)
  const [period, setPeriod] = useState<string>(ALL)
  const [q, setQ] = useState('')

  const views = useMemo(() => viewsOf(db), [db])

  const filtered = views.filter((v) => {
    const p = v.project
    if (stage !== ALL && p.stage !== stage) return false
    if (health !== ALL && v.health.health !== health) return false
    if (dept !== ALL && p.departmentId !== dept) return false
    if (owner !== ALL && p.ownerId !== owner && p.analystId !== owner && p.developerId !== owner) return false
    if (period !== ALL && p.expectedDeliveryDate.slice(0, 7) !== period) return false
    if (q && !`${p.name} ${p.code}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  const periods = Array.from(new Set(views.map((v) => v.project.expectedDeliveryDate.slice(0, 7)))).sort()
  const owners = db.users.filter((u) => ['team_lead', 'ai_analyst', 'developer'].includes(u.role))
  const active = stage !== ALL || health !== ALL || dept !== ALL || owner !== ALL || period !== ALL || q !== ''

  useEffect(() => {
    if (route.query.stage) setStage(route.query.stage)
    if (route.query.health) setHealth(route.query.health)
  }, [route.query.stage, route.query.health])

  const clear = () => {
    setStage(ALL)
    setHealth(ALL)
    setDept(ALL)
    setOwner(ALL)
    setPeriod(ALL)
    setQ('')
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="eyebrow">AI Project Portfolio</div>
          <h1 className="h1">All AI & software initiatives</h1>
          <p className="muted small" style={{ marginTop: 4 }}>
            {views.length} projects · one owner, one stage, one next milestone and one delivery date each.
          </p>
        </div>
        <span className="spacer" />
        <Button variant="primary" onClick={() => navigate('#/projects/new')}>
          + New project
        </Button>
      </div>

      <Card>
        <div className="card-head" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ width: 200 }}
            placeholder="Search projects…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search projects"
          />
          <select className="select" style={{ width: 150 }} value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Filter by stage">
            <option value={ALL}>All stages</option>
            {STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <select className="select" style={{ width: 130 }} value={health} onChange={(e) => setHealth(e.target.value)} aria-label="Filter by health">
            <option value={ALL}>All health</option>
            {(Object.keys(HEALTH_META) as Health[]).map((h) => (
              <option key={h} value={h}>
                {HEALTH_META[h].label}
              </option>
            ))}
          </select>
          <select className="select" style={{ width: 160 }} value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Filter by department">
            <option value={ALL}>All departments</option>
            {db.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select className="select" style={{ width: 150 }} value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Filter by person">
            <option value={ALL}>Anyone</option>
            {owners.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select className="select" style={{ width: 150 }} value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Filter by delivery period">
            <option value={ALL}>Any delivery month</option>
            {periods.map((p) => (
              <option key={p} value={p}>
                {new Date(`${p}-01T00:00:00Z`).toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
              </option>
            ))}
          </select>
          <span className="spacer" />
          {active && (
            <Button size="sm" variant="ghost" onClick={clear}>
              Clear filters
            </Button>
          )}
          <span className="small muted nowrap">{filtered.length} shown</span>
        </div>

        <div className="table-wrap">
          {status === 'loading' ? (
            <TableSkeleton rows={6} cols={7} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No projects match your filters"
              body="Try widening the stage, health or delivery period."
              action={<Button onClick={clear}>Clear filters</Button>}
            />
          ) : (
            <table className="tbl wide">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Business unit / department</th>
                  <th>Owner</th>
                  <th>AI Analyst</th>
                  <th>Stage</th>
                  <th>Health</th>
                  <th style={{ minWidth: 130 }}>Progress</th>
                  <th>Next milestone</th>
                  <th>Expected delivery</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => {
                  const p = v.project
                  const slip = daysBetween(p.originalDeliveryDate, p.expectedDeliveryDate)
                  return (
                    <tr
                      key={p.id}
                      className={`clickable${v.health.health === 'blocked' ? ' row-alert' : ''}`}
                      onClick={() => navigate(`#/projects/${p.id}`)}
                    >
                      <td>
                        <div className="cell-main">{p.name}</div>
                        <div className="cell-sub mono">{p.code}</div>
                      </td>
                      <td>
                        <div>{buName(db, p.businessUnitId)}</div>
                        <div className="cell-sub">{deptName(db, p.departmentId)}</div>
                      </td>
                      <td>
                        <Person user={userById(db, p.ownerId)} compact />
                      </td>
                      <td>
                        <Person user={userById(db, p.analystId)} compact />
                      </td>
                      <td>
                        <span className="pill-stage">{stageDef(p.stage).short}</span>
                      </td>
                      <td>
                        <HealthBadge health={v.health.health} />
                      </td>
                      <td>
                        <ProgressBar
                          value={v.progress.percent}
                          tone={v.health.health === 'blocked' ? 'bad' : v.health.health === 'on_track' || v.health.health === 'completed' ? 'ok' : 'warn'}
                        />
                        <div className="cell-sub">
                          {v.progress.completedCount}/{v.progress.totalCount} milestones
                        </div>
                      </td>
                      <td>
                        {v.next ? (
                          <>
                            <div>{v.next.name}</div>
                            <div className="cell-sub">
                              {fmtShort(v.next.dueDate)} · {userById(db, v.next.ownerId)?.name.split(' ')[0]}
                            </div>
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="nowrap">
                        <div>{fmtDate(p.expectedDeliveryDate)}</div>
                        {slip > 0 ? (
                          <div className="cell-sub" style={{ color: 'var(--late)', fontWeight: 600 }}>
                            +{slip} days vs plan
                          </div>
                        ) : (
                          <div className="cell-sub">On original date</div>
                        )}
                      </td>
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
