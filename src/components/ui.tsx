/**
 * Design system primitives.
 *
 * Every status element pairs colour with a word or a glyph, so the UI is
 * readable without relying on colour perception.
 */
import { useEffect, type ReactNode } from 'react'
import { GATE_META, HEALTH_META, PRIORITY_META, stageDef } from '../domain/lifecycle'
import type { GateState, Health, MilestoneStatus, Priority, StageKey, User } from '../domain/types'

/* ---------------------------------------------------------------- button */

export function Button({
  children,
  variant = 'default',
  size = 'md',
  loading,
  icon,
  block,
  ...rest
}: {
  children?: ReactNode
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
  block?: boolean
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'size'>) {
  const { className, ...attrs } = rest
  const cls = ['btn', variant !== 'default' ? variant : '', size !== 'md' ? size : '', block ? 'block' : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return (
    <button type="button" {...attrs} className={cls} disabled={attrs.disabled || loading}>
      {loading ? <span className="spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}

/* ----------------------------------------------------------------- badges */

export const Badge = ({ tone = 'muted', children, size }: { tone?: string; children: ReactNode; size?: 'lg' }) => (
  <span className={`badge ${tone}${size === 'lg' ? ' lg' : ''}`}>{children}</span>
)

export const HealthBadge = ({ health, size }: { health: Health; size?: 'lg' }) => {
  const m = HEALTH_META[health]
  return (
    <span className={`badge ${m.tone}${size === 'lg' ? ' lg' : ''}`}>
      <span className="dot" aria-hidden>
        {m.icon}
      </span>
      {m.label.toUpperCase()}
    </span>
  )
}

export const GateBadge = ({ state }: { state: GateState }) => (
  <span className={`badge ${GATE_META[state].tone}`}>{GATE_META[state].label}</span>
)

export const StagePill = ({ stage }: { stage: StageKey }) => (
  <span className="pill-stage">
    <span aria-hidden>◷</span>
    {stageDef(stage).label}
  </span>
)

export const PriorityBadge = ({ priority }: { priority: Priority }) => (
  <span className={`badge ${PRIORITY_META[priority].tone}`}>{PRIORITY_META[priority].label}</span>
)

const MS_META: Record<MilestoneStatus, { label: string; tone: string; icon: string }> = {
  not_started: { label: 'Not Started', tone: 'muted', icon: '○' },
  in_progress: { label: 'In Progress', tone: 'info', icon: '◐' },
  delayed: { label: 'Delayed', tone: 'late', icon: '◆' },
  blocked: { label: 'Blocked', tone: 'bad', icon: '■' },
  completed: { label: 'Completed', tone: 'ok', icon: '✓' },
}

export const MilestoneBadge = ({ status }: { status: MilestoneStatus }) => (
  <span className={`badge ${MS_META[status].tone}`}>
    <span className="dot" aria-hidden>
      {MS_META[status].icon}
    </span>
    {MS_META[status].label}
  </span>
)

/* --------------------------------------------------------------- progress */

export const ProgressBar = ({
  value,
  tone,
  showValue = true,
  size,
}: {
  value: number
  tone?: 'ok' | 'warn' | 'bad'
  showValue?: boolean
  size?: 'lg'
}) => (
  <div className="progress-line">
    <div className={`bar${tone ? ` ${tone}` : ''}${size === 'lg' ? ' lg' : ''}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
    {showValue && <span className="pct">{value}%</span>}
  </div>
)

/* --------------------------------------------------------------- identity */

export const Avatar = ({ user, size }: { user?: User; size?: 'sm' | 'lg' }) => (
  <span className={`avatar${size ? ` ${size}` : ''}`} title={user?.name}>
    {user?.initials ?? '—'}
  </span>
)

export const Person = ({ user, sub, compact }: { user?: User; sub?: string; compact?: boolean }) =>
  user ? (
    <span className="person">
      <Avatar user={user} size={compact ? 'sm' : undefined} />
      <span className="truncate">
        <span className="nm">{user.name}</span>
        {!compact && <span className="rl" style={{ display: 'block' }}>{sub ?? user.title}</span>}
      </span>
    </span>
  ) : (
    <span className="muted">Unassigned</span>
  )

/* ----------------------------------------------------------------- inputs */

export function Field({
  label,
  help,
  error,
  required,
  children,
}: {
  label: string
  help?: string
  error?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="field">
      <label>
        {label}
        {required && <span style={{ color: 'var(--bad)' }}> *</span>}
      </label>
      {children}
      {error ? <span className="err">{error}</span> : help ? <span className="help">{help}</span> : null}
    </div>
  )
}

export const Checkbox = ({
  checked,
  onChange,
  disabled,
  label,
  hint,
  evidence,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  label: ReactNode
  hint?: string
  evidence?: string
}) => (
  <label className={`crit${checked ? ' on' : ''}${disabled ? ' disabled' : ''}`}>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      style={{ width: 16, height: 16, accentColor: 'var(--brand)', marginTop: 2 }}
    />
    <span style={{ minWidth: 0 }}>
      <span className="cl">{label}</span>
      {hint && <span className="ch" style={{ display: 'block' }}>{hint}</span>}
      {checked && evidence && <span className="ce" style={{ display: 'block' }}>✓ Evidence: {evidence}</span>}
    </span>
  </label>
)

/* ------------------------------------------------------------------ cards */

export const Card = ({
  children,
  className = '',
  style,
}: {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}) => (
  <section className={`card ${className}`} style={style}>
    {children}
  </section>
)

export const CardHead = ({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) => (
  <header className="card-head">
    <div style={{ minWidth: 0 }}>
      <div className="h3">{title}</div>
      {sub && <div className="small muted">{sub}</div>}
    </div>
    <span className="spacer" />
    {right}
  </header>
)

export const Stat = ({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: string }) => (
  <div className="card stat">
    <div className="label">{label}</div>
    <div className="value" style={tone ? { color: `var(--${tone})` } : undefined}>
      {value}
    </div>
    {hint && <div className="hint">{hint}</div>}
  </div>
)

export const Fact = ({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) => (
  <div className="fact">
    <div className="fl">{label}</div>
    <div className="fv">{value}</div>
    {sub && <div className="fs">{sub}</div>}
  </div>
)

export const Alert = ({
  tone = 'info',
  title,
  children,
  action,
  icon,
}: {
  tone?: 'info' | 'warn' | 'bad' | 'ok'
  title: ReactNode
  children?: ReactNode
  action?: ReactNode
  icon?: string
}) => (
  <div className={`alert ${tone}`}>
    <span className="ic" aria-hidden>
      {icon ?? (tone === 'bad' ? '■' : tone === 'warn' ? '▲' : tone === 'ok' ? '✓' : 'ℹ')}
    </span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="at">{title}</div>
      {children && <div className="ab">{children}</div>}
    </div>
    {action}
  </div>
)

export const EmptyState = ({ icon = '◇', title, body, action }: { icon?: string; title: string; body?: string; action?: ReactNode }) => (
  <div className="empty">
    <div className="ei" aria-hidden>
      {icon}
    </div>
    <div className="et">{title}</div>
    {body && <div className="eb">{body}</div>}
    {action && <div style={{ marginTop: 12 }}>{action}</div>}
  </div>
)

export const Skeleton = ({ w = '100%', h = 12, style }: { w?: string | number; h?: number; style?: React.CSSProperties }) => (
  <div className="skel" style={{ width: w, height: h, ...style }} />
)

export const TableSkeleton = ({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) => (
  <div style={{ padding: 14 }}>
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="row" style={{ padding: '9px 0', gap: 18 }}>
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} w={c === 0 ? '26%' : '14%'} h={c === 0 ? 14 : 10} />
        ))}
      </div>
    ))}
  </div>
)

/* ------------------------------------------------------------------ tabs */

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string; count?: number; alert?: boolean }[]
  active: T
  onChange: (k: T) => void
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={active === t.key}
          className={`tab${active === t.key ? ' on' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.count !== undefined && t.count > 0 && <span className={`n${t.alert ? ' alert' : ''}`}>{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

/* --------------------------------------------------------- modal & drawer */

export function Modal({
  title,
  sub,
  children,
  onClose,
  footer,
  wide,
}: {
  title: ReactNode
  sub?: ReactNode
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <header className="modal-head">
          <div className="h2">{title}</div>
          {sub && <div className="small muted" style={{ marginTop: 2 }}>{sub}</div>}
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function Drawer({
  title,
  sub,
  children,
  onClose,
  footer,
}: {
  title: ReactNode
  sub?: ReactNode
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <header className="drawer-head">
          <div className="between">
            <div style={{ minWidth: 0 }}>
              <div className="h2">{title}</div>
              {sub && <div className="small muted" style={{ marginTop: 2 }}>{sub}</div>}
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close panel">
              ✕
            </Button>
          </div>
        </header>
        <div className="drawer-body">{children}</div>
        {footer && <footer className="drawer-foot">{footer}</footer>}
      </aside>
    </>
  )
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel = 'Confirm',
  tone = 'primary',
  loading,
  onConfirm,
  onCancel,
  children,
}: {
  title: string
  body: ReactNode
  confirmLabel?: string
  tone?: 'primary' | 'danger'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant={tone} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>{body}</div>
      {children}
    </Modal>
  )
}
