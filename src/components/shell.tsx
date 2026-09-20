import { useMemo, useState } from 'react'
import { ROLES, roleLabel } from '../domain/lifecycle'
import { daysBetween, fmtDate, fmtTime, relativeDay } from '../domain/dates'
import type { RoleKey } from '../domain/types'
import { navigate, useRoute } from '../router'
import { useApp } from '../store/store'
import { Avatar, Badge, Button, EmptyState } from './ui'

const NAV = [
  { key: '', label: 'Dashboard', icon: '▤' },
  { key: 'projects', label: 'Projects', icon: '▦' },
  { key: 'my-work', label: 'My Work', icon: '◫' },
  { key: 'approvals', label: 'Approvals', icon: '✓' },
  { key: 'notifications', label: 'Notifications', icon: '◔' },
]

export function Sidebar() {
  const { db, role } = useApp()
  const route = useRoute()
  const top = route.segments[0] ?? ''

  const unread = db.notifications.filter((n) => !n.read && n.audienceRoles.includes(role)).length
  const pendingApprovals = db.projects.reduce(
    (n, p) =>
      n +
      p.gates.filter((g) => g.state === 'ready_for_review' && g.approverRole === role).length +
      p.scopeChanges.filter((s) => s.decision === 'under_review' && role === 'business_owner').length,
    0,
  )

  const countFor = (key: string) =>
    key === 'notifications' ? unread : key === 'approvals' ? pendingApprovals : undefined

  return (
    <nav className="sidebar" aria-label="Main">
      <div className="brand">
        <span className="brand-mark" aria-hidden>
          AI
        </span>
        <span>
          <span className="brand-name" style={{ display: 'block' }}>
            ProjectFlow
          </span>
          <span className="brand-sub">Anwar Group of Industries</span>
        </span>
      </div>
      <div className="nav">
        {NAV.map((n) => (
          <button
            key={n.key}
            className={`nav-item${top === n.key ? ' active' : ''}`}
            onClick={() => navigate(`#/${n.key}`)}
            aria-current={top === n.key ? 'page' : undefined}
          >
            <span aria-hidden style={{ width: 16, textAlign: 'center', opacity: 0.85 }}>
              {n.icon}
            </span>
            {n.label}
            {countFor(n.key) ? (
              <span className={`count${n.key === 'notifications' ? '' : ''}`}>{countFor(n.key)}</span>
            ) : null}
          </button>
        ))}
        <div className="nav-sep" />
        <button className={`nav-item${top === 'settings' ? ' active' : ''}`} onClick={() => navigate('#/settings')}>
          <span aria-hidden style={{ width: 16, textAlign: 'center', opacity: 0.85 }}>
            ⚙
          </span>
          Settings
        </button>
      </div>
      <div className="nav-foot">
        <div style={{ marginBottom: 4 }}>Prototype date</div>
        <div style={{ color: '#d6e4f0', fontWeight: 600 }}>{fmtDate(db.today)}</div>
      </div>
    </nav>
  )
}

export function RoleSwitcher() {
  const { role, setRole, actor } = useApp()
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button className="btn sm" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        <Avatar user={actor} size="sm" />
        <span style={{ textAlign: 'left' }}>
          <span style={{ display: 'block', fontSize: 12.5, fontWeight: 650 }}>{actor.name}</span>
          <span style={{ display: 'block', fontSize: 10.5, color: 'var(--ink-3)', fontWeight: 500 }}>
            {roleLabel(role)}
          </span>
        </span>
        <span aria-hidden style={{ color: 'var(--ink-3)' }}>
          ▾
        </span>
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="card"
            style={{ position: 'absolute', right: 0, top: 'calc(100% + 7px)', width: 320, zIndex: 41, boxShadow: 'var(--shadow-3)' }}
          >
            <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--line)' }}>
              <div className="eyebrow">View the system as</div>
              <div className="tiny muted" style={{ marginTop: 3 }}>
                One system, five perspectives. Approvals stay with the role that owns them.
              </div>
            </div>
            <div style={{ padding: 6 }}>
              {ROLES.map((r) => (
                <button
                  key={r.key}
                  role="menuitemradio"
                  aria-checked={role === r.key}
                  className="nav-item"
                  style={{
                    color: 'var(--ink)',
                    background: role === r.key ? 'var(--brand-soft)' : 'transparent',
                    alignItems: 'flex-start',
                  }}
                  onClick={() => {
                    setRole(r.key)
                    setOpen(false)
                  }}
                >
                  <span aria-hidden style={{ marginTop: 2 }}>
                    {role === r.key ? '●' : '○'}
                  </span>
                  <span style={{ whiteSpace: 'normal' }}>
                    <span style={{ fontWeight: 620, fontSize: 13 }}>{r.label}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 400 }}>
                      {r.blurb}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function NotificationBell() {
  const { db, role, run } = useApp()
  const [open, setOpen] = useState(false)
  const mine = useMemo(
    () => db.notifications.filter((n) => n.audienceRoles.includes(role)).slice(0, 12),
    [db.notifications, role],
  )
  const unread = mine.filter((n) => !n.read).length

  return (
    <div style={{ position: 'relative' }}>
      <Button size="sm" onClick={() => setOpen((v) => !v)} aria-label={`Notifications, ${unread} unread`}>
        <span aria-hidden>◔</span>
        Alerts
        {unread > 0 && <Badge tone="bad">{unread}</Badge>}
      </Button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div
            className="card"
            style={{ position: 'absolute', right: 0, top: 'calc(100% + 7px)', width: 390, zIndex: 41, boxShadow: 'var(--shadow-3)', maxHeight: 460, display: 'flex', flexDirection: 'column' }}
          >
            <div className="card-head" style={{ padding: '11px 14px' }}>
              <div className="h3">Notifications</div>
              <span className="spacer" />
              <button className="linkish small" onClick={() => run({ type: 'read_all_notifications' })}>
                Mark all read
              </button>
            </div>
            <div style={{ overflow: 'auto' }}>
              {mine.length === 0 && <EmptyState title="Nothing for this role" body="Switch role to see other inboxes." />}
              {mine.map((n) => (
                <div
                  key={n.id}
                  className={`notif ${n.read ? 'read' : 'unread'}`}
                  onClick={() => {
                    run({ type: 'read_notification', id: n.id })
                    if (n.href) navigate(n.href)
                    setOpen(false)
                  }}
                >
                  <span className="nd" aria-hidden />
                  <div style={{ minWidth: 0 }}>
                    <div className="nt">{n.title}</div>
                    <div className="nb">{n.body}</div>
                    <div className="nw">
                      {relativeDay(n.at, db.today)} {fmtTime(n.at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="card-foot" style={{ padding: '10px 14px' }}>
              <button className="linkish small" onClick={() => { navigate('#/notifications'); setOpen(false) }}>
                Open notification centre →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** Lets an evaluator watch dates actually pass — the only way an overdue milestone is honest. */
function ClockControl() {
  const { db, run, pending } = useApp()
  const [open, setOpen] = useState(false)

  const nextDue = db.projects
    .filter((p) => p.stage !== 'completed')
    .flatMap((p) => p.milestones.filter((m) => m.status !== 'completed').map((m) => m.dueDate))
    .sort()
    .find((d) => d >= db.today)
  const toPastNextDue = nextDue ? daysBetween(db.today, nextDue) + 1 : 1

  const advance = async (days: number, label: string) => {
    await run({ type: 'advance_clock', days }, { success: label })
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button className="badge muted" style={{ cursor: 'pointer', padding: '4px 10px' }} onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        Prototype date · {fmtDate(db.today)} ▾
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div className="card" style={{ position: 'absolute', right: 0, top: 'calc(100% + 7px)', width: 300, zIndex: 41, boxShadow: 'var(--shadow-3)' }}>
            <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--line)' }}>
              <div className="eyebrow">Simulate time passing</div>
              <div className="tiny muted" style={{ marginTop: 3 }}>
                Milestones become overdue by date, not by a switch. Advancing the clock re-evaluates every project and
                raises the delay notifications management would receive.
              </div>
            </div>
            <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[1, 7, 14].map((d) => (
                <Button key={d} size="sm" block loading={pending === 'advance_clock'} onClick={() => advance(d, `Clock advanced ${d} day(s).`)}>
                  + {d} day{d > 1 ? 's' : ''}
                </Button>
              ))}
              {nextDue && (
                <Button size="sm" block variant="primary" loading={pending === 'advance_clock'} onClick={() => advance(toPastNextDue, 'Clock advanced past the next committed date.')}>
                  Advance past the next due date (+{toPastNextDue}d)
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function TopBar({ crumbs }: { crumbs: { label: string; href?: string }[] }) {
  const { db } = useApp()
  return (
    <header className="topbar">
      <select
        className="select nav-compact"
        aria-label="Navigate"
        value={window.location.hash.slice(1).split('/')[1] ?? ''}
        onChange={(e) => navigate(`#/${e.target.value}`)}
      >
        {NAV.map((n) => (
          <option key={n.key} value={n.key}>
            {n.label}
          </option>
        ))}
        <option value="settings">Settings</option>
      </select>
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <span key={i} className="row" style={{ gap: 7, minWidth: 0 }}>
            {i > 0 && (
              <span aria-hidden style={{ color: 'var(--ink-4)' }}>
                /
              </span>
            )}
            {c.href ? (
              <button className="linkish" style={{ color: 'var(--ink-3)', fontWeight: 500 }} onClick={() => navigate(c.href!)}>
                {c.label}
              </button>
            ) : (
              <b className="truncate">{c.label}</b>
            )}
          </span>
        ))}
      </div>
      <span className="spacer" />
      <ClockControl />
      <NotificationBell />
      <RoleSwitcher />
    </header>
  )
}

export function Toasts() {
  const { toasts, dismissToast } = useApp()
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          <span aria-hidden style={{ fontSize: 13 }}>
            {t.tone === 'success' ? '✓' : t.tone === 'error' ? '■' : 'ℹ'}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="tt">{t.title}</div>
            {t.body && <div className="tb">{t.body}</div>}
          </div>
          <button className="linkish tiny" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
