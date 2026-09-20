/**
 * Charts for the management dashboard.
 *
 * Built as inline SVG with no charting dependency. Three rules hold throughout:
 * every mark carries a hover tooltip, every series is named in text as well as
 * colour, and the same numbers appear in a table elsewhere on the page — so the
 * charts speed reading up without ever being the only way to get the fact.
 */
import { useState, type ReactNode } from 'react'
import { daysBetween, fmtDate, fmtShort } from '../domain/dates'
import type { DeliveryRow, WeekLoad } from '../domain/logic'
import type { Health } from '../domain/types'

export const HEALTH_FILL: Record<Health, string> = {
  on_track: 'var(--c-ok)',
  at_risk: 'var(--c-risk)',
  delayed: 'var(--c-late)',
  blocked: 'var(--c-blocked)',
  completed: 'var(--done)',
}

/* ------------------------------------------------------------- tooltip */

interface Tip {
  x: number
  y: number
  title: string
  rows: string[]
}

export function useTooltip() {
  const [tip, setTip] = useState<Tip | null>(null)
  const bind = (title: string, rows: string[]) => ({
    onMouseMove: (e: React.MouseEvent) => setTip({ x: e.clientX, y: e.clientY, title, rows }),
    onMouseLeave: () => setTip(null),
  })
  const node = tip ? (
    <div className="tipbox" style={{ left: Math.min(tip.x + 14, window.innerWidth - 270), top: tip.y + 16 }}>
      <div className="tt">{tip.title}</div>
      {tip.rows.map((r, i) => (
        <div key={i} className="tr">
          {r}
        </div>
      ))}
    </div>
  ) : null
  return { bind, node }
}

/* ------------------------------------------------ portfolio health bar */

export function HealthBar({
  segments,
  onSelect,
}: {
  segments: { health: Health; label: string; icon: string; count: number }[]
  onSelect?: (h: Health) => void
}) {
  const total = segments.reduce((s, x) => s + x.count, 0) || 1
  const shown = segments.filter((s) => s.count > 0)
  return (
    <div>
      <div className="hbar" role="img" aria-label={shown.map((s) => `${s.count} ${s.label}`).join(', ')}>
        {shown.map((s) => {
          const pct = (s.count / total) * 100
          return (
            <div
              key={s.health}
              className={`seg${s.health === 'at_risk' ? ' light' : ''}`}
              style={{ width: `${pct}%`, background: HEALTH_FILL[s.health] }}
              title={`${s.label}: ${s.count} of ${total} projects`}
              onClick={() => onSelect?.(s.health)}
            >
              {pct > 7 ? s.count : ''}
            </div>
          )
        })}
      </div>
      <div className="chart-legend">
        {segments.map((s) => (
          <span key={s.health} className="key">
            <span className="sw" style={{ background: HEALTH_FILL[s.health] }} />
            <span aria-hidden>{s.icon}</span>
            {s.label} <b style={{ color: 'var(--ink)' }}>{s.count}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------ delivery outlook */

export function DeliveryOutlook({
  rows,
  today,
  onSelect,
}: {
  rows: DeliveryRow[]
  today: string
  onSelect: (projectId: string) => void
}) {
  const { bind, node } = useTooltip()
  // The viewBox is sized close to the real rendered width so SVG text is not
  // scaled down below its intended size.
  const rowH = 26
  const labelW = 192
  const padR = 52
  const height = rows.length * rowH + 30
  const width = 760
  const plotW = width - labelW - padR

  const maxDay = Math.max(
    ...rows.map((r) => daysBetween(today, r.current)),
    ...rows.map((r) => daysBetween(today, r.original)),
    14,
  )
  const x = (iso: string) => labelW + (Math.max(0, daysBetween(today, iso)) / maxDay) * plotW

  // month ticks
  const ticks: { iso: string; label: string }[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    const key = r.current.slice(0, 7)
    if (!seen.has(key)) {
      seen.add(key)
      ticks.push({ iso: `${key}-01`, label: new Date(`${key}-01T00:00:00Z`).toLocaleString('en', { month: 'short', timeZone: 'UTC' }) })
    }
  }

  return (
    <>
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Expected delivery date per active project, with any slip against the original commitment">
        {ticks.map((t) => {
          const tx = x(t.iso)
          return tx > labelW && tx < width - padR ? (
            <g key={t.iso}>
              <line className="grid-line" x1={tx} x2={tx} y1={14} y2={height - 16} />
              <text className="axis-label" x={tx} y={height - 4} textAnchor="middle">
                {t.label}
              </text>
            </g>
          ) : null
        })}

        <line className="today-line" x1={labelW} x2={labelW} y1={10} y2={height - 16} />
        <text className="axis-label" x={labelW} y={8} textAnchor="middle" style={{ fill: 'var(--brand)', fontWeight: 650 }}>
          today
        </text>

        {rows.map((r, i) => {
          const y = 18 + i * rowH
          const xOrig = x(r.original)
          const xCurr = x(r.current)
          const slipped = r.slipDays > 0
          const tipRows = [
            `Expected ${fmtDate(r.current)}${slipped ? ` · ${r.slipDays} days later than promised` : ' · on the original date'}`,
            slipped ? `${r.executionDays}d execution · ${r.scopeDays}d approved scope` : 'No slippage recorded',
            `${r.progress}% complete`,
          ]
          return (
            <g key={r.project.id} onClick={() => onSelect(r.project.id)} style={{ cursor: 'pointer' }} {...bind(r.project.name, tipRows)}>
              <rect className="hit" x={0} y={y - 9} width={width} height={rowH - 2} />
              <text className="row-label" x={0} y={y + 4}>
                {r.project.name.length > 30 ? `${r.project.name.slice(0, 29)}…` : r.project.name}
              </text>
              {/* planned span: today → original commitment */}
              <rect className="mark" x={labelW} y={y - 4} width={Math.max(2, xOrig - labelW)} height={9} rx={3} fill="var(--c-plan)" />
              {/* slip: original → current expectation */}
              {slipped && (
                <>
                  <rect
                    className="mark"
                    x={xOrig + 2}
                    y={y - 4}
                    width={Math.max(2, xCurr - xOrig - 2)}
                    height={9}
                    rx={3}
                    fill={r.scopeDays > r.executionDays ? 'var(--c-scope)' : HEALTH_FILL[r.health]}
                  />
                  <text className="val-label" x={xCurr + 7} y={y + 4} style={{ fill: 'var(--late)' }}>
                    +{r.slipDays}d
                  </text>
                </>
              )}
              {!slipped && (
                <text className="val-label" x={xOrig + 7} y={y + 4}>
                  {fmtShort(r.current)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="chart-legend">
        <span className="key">
          <span className="sw" style={{ background: 'var(--c-plan)' }} />
          Original commitment
        </span>
        <span className="key">
          <span className="sw" style={{ background: 'var(--c-late)' }} />
          Slip — execution
        </span>
        <span className="key">
          <span className="sw" style={{ background: 'var(--c-scope)' }} />
          Slip — approved scope change
        </span>
      </div>
      {node}
    </>
  )
}

/* ------------------------------------------------------- milestone load */

export function MilestoneLoad({ weeks }: { weeks: WeekLoad[] }) {
  const { bind, node } = useTooltip()
  const width = 420
  const height = 150
  const padB = 26
  const padT = 14
  const max = Math.max(4, ...weeks.map((w) => w.due + w.overdue))
  const bw = width / weeks.length
  const scale = (n: number) => ((height - padB - padT) * n) / max

  return (
    <>
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Milestones committed per week, with overdue ones highlighted">
        <line className="axis-line" x1={0} x2={width} y1={height - padB} y2={height - padB} />
        {weeks.map((w, i) => {
          const total = w.due + w.overdue
          const x = i * bw + bw * 0.22
          const barW = bw * 0.56
          const hOver = scale(w.overdue)
          const hDue = scale(w.due)
          const yOver = height - padB - hOver
          const yDue = yOver - hDue - (w.overdue && w.due ? 2 : 0)
          return (
            <g key={w.weekStart} {...bind(`Week of ${fmtDate(w.weekStart)}`, [`${w.due} due`, `${w.overdue} already overdue`])}>
              <rect className="hit" x={i * bw} y={padT} width={bw} height={height - padB - padT} />
              {w.overdue > 0 && <rect className="mark" x={x} y={yOver} width={barW} height={hOver} rx={3} fill="var(--c-blocked)" />}
              {w.due > 0 && <rect className="mark" x={x} y={yDue} width={barW} height={hDue} rx={3} fill="var(--c-plan)" />}
              {total > 0 && (
                <text className="val-label" x={x + barW / 2} y={yDue - 5} textAnchor="middle">
                  {total}
                </text>
              )}
              <text className="axis-label" x={x + barW / 2} y={height - 9} textAnchor="middle">
                {w.label}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="chart-legend">
        <span className="key">
          <span className="sw" style={{ background: 'var(--c-plan)' }} />
          Committed
        </span>
        <span className="key">
          <span className="sw" style={{ background: 'var(--c-blocked)' }} />
          Already overdue
        </span>
      </div>
      {node}
    </>
  )
}

/* ------------------------------------------------------ slip attribution */

export function AttributionBar({
  execution,
  scope,
  children,
}: {
  execution: number
  scope: number
  children?: ReactNode
}) {
  const total = execution + scope
  if (total === 0)
    return <p className="small muted">No delivery date has moved. Every active project is still on its original commitment.</p>
  return (
    <div>
      <div className="hbar" style={{ height: 34 }} role="img" aria-label={`${execution} days execution slip, ${scope} days approved scope change`}>
        {execution > 0 && (
          <div className="seg" style={{ width: `${(execution / total) * 100}%`, background: 'var(--c-late)' }} title={`${execution} days of execution delay`}>
            {execution}d
          </div>
        )}
        {scope > 0 && (
          <div className="seg" style={{ width: `${(scope / total) * 100}%`, background: 'var(--c-scope)' }} title={`${scope} days of approved scope change`}>
            {scope}d
          </div>
        )}
      </div>
      <div className="chart-legend">
        <span className="key">
          <span className="sw" style={{ background: 'var(--c-late)' }} />
          Execution delay <b style={{ color: 'var(--ink)' }}>{execution} days</b>
        </span>
        <span className="key">
          <span className="sw" style={{ background: 'var(--c-scope)' }} />
          Approved scope change <b style={{ color: 'var(--ink)' }}>{scope} days</b>
        </span>
      </div>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------- pipeline */

export function PipelineBars({
  stages,
  onSelect,
}: {
  stages: { key: string; label: string; count: number }[]
  onSelect?: (stage: string) => void
}) {
  const max = Math.max(1, ...stages.map((s) => s.count))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {stages.map((s) => (
        <button
          key={s.key}
          onClick={() => onSelect?.(s.key)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 0, padding: '2px 0', cursor: onSelect ? 'pointer' : 'default', textAlign: 'left' }}
          title={`${s.count} project(s) in ${s.label}`}
        >
          <span className="small" style={{ width: 118, color: 'var(--ink-2)', flex: 'none' }}>
            {s.label}
          </span>
          <span style={{ flex: 1, height: 12, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
            <span
              style={{
                display: 'block',
                height: '100%',
                width: `${(s.count / max) * 100}%`,
                background: s.count ? 'var(--brand-2)' : 'transparent',
                borderRadius: 3,
              }}
            />
          </span>
          <span className="small strong" style={{ width: 16, textAlign: 'right' }}>
            {s.count}
          </span>
        </button>
      ))}
    </div>
  )
}
