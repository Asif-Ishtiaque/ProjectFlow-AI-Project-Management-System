import { useState } from 'react'
import { stageIndex } from '../domain/lifecycle'
import { gateFor, healthOf, openBlockers } from '../domain/logic'
import type { DatabaseShape, Project } from '../domain/types'
import { navigate } from '../router'
import { useApp } from '../store/store'
import { Badge, Button } from '../components/ui'

interface Step {
  n: number
  title: string
  hint: string
  done: (p: Project | undefined, db: DatabaseShape) => boolean
  href: (p?: Project) => string
}

const gateApproved = (p: Project | undefined, stage: Parameters<typeof gateFor>[1]) =>
  Boolean(p && gateFor(p, stage)?.state === 'approved')

/**
 * A guide, not a script. Each step reads the real project state, so the list
 * ticks itself off as the evaluator clicks through the product.
 */
export const JOURNEY: Step[] = [
  { n: 1, title: 'Project created', hint: 'Projects → New project → Create', done: (p) => Boolean(p), href: () => '#/projects/new' },
  { n: 2, title: 'AI Analyst assigned', hint: 'Named on intake — discovery cannot start without one', done: (p) => Boolean(p?.analystId), href: (p) => `#/projects/${p?.id}` },
  { n: 3, title: 'Discovery started', hint: 'Intake gate approved → Discovery', done: (p) => Boolean(p && stageIndex(p.stage) >= 1), href: (p) => `#/projects/${p?.id}/timeline` },
  { n: 4, title: 'Discovery criteria evidenced', hint: 'Four exit criteria ticked with evidence', done: (p) => Boolean(p && (gateFor(p, 'discovery')?.criteria.every((c) => c.done) ?? false)), href: (p) => `#/projects/${p?.id}/timeline` },
  { n: 5, title: 'Discovery approved', hint: 'AI Team Lead approves the gate', done: (p) => gateApproved(p, 'discovery'), href: (p) => `#/projects/${p?.id}/timeline` },
  { n: 6, title: 'Design criteria evidenced', hint: 'Requirements, workflow, UI/UX and technical approach', done: (p) => Boolean(p && (gateFor(p, 'design')?.criteria.every((c) => c.done) ?? false)), href: (p) => `#/projects/${p?.id}/timeline` },
  { n: 7, title: 'Design approved by the business', hint: 'Business Owner decides — nobody else can', done: (p) => gateApproved(p, 'design'), href: (p) => `#/projects/${p?.id}/timeline` },
  { n: 8, title: 'Business commitment recorded', hint: 'Scope, date and resources accepted → Development', done: (p) => gateApproved(p, 'approval'), href: (p) => `#/projects/${p?.id}/timeline` },
  { n: 9, title: 'Development started', hint: 'Developer picks up the milestones and logs progress', done: (p) => Boolean(p?.milestones.some((m) => m.stage === 'development' && m.progress > 0)), href: (p) => `#/projects/${p?.id}/timeline` },
  { n: 10, title: 'Milestone becomes overdue', hint: 'Let days pass with the clock control in the top bar until 20 Sep is behind you', done: (p) => Boolean(p?.milestones.some((m) => m.status === 'delayed' || m.delay)), href: (p) => `#/projects/${p?.id}/milestones` },
  { n: 11, title: 'Delay reason recorded', hint: 'Integration dependency · impact · responsible person', done: (p) => Boolean(p?.milestones.some((m) => m.delay)), href: (p) => `#/projects/${p?.id}/milestones` },
  { n: 12, title: 'Blocker created', hint: 'API credentials unavailable — owned by the IT Lead', done: (p) => Boolean(p && p.blockers.length > 0), href: (p) => `#/projects/${p?.id}/blockers` },
  { n: 13, title: 'Project visibly BLOCKED to management', hint: 'It now leads the dashboard attention queue', done: (p, db) => Boolean(p && (healthOf(p, db.today).health === 'blocked' || p.blockers.some((b) => b.status === 'resolved'))), href: () => '#/' },
  { n: 14, title: 'Blocker resolved', hint: 'Milestone returns to active progress', done: (p) => Boolean(p && p.blockers.length > 0 && openBlockers(p).length === 0), href: (p) => `#/projects/${p?.id}/blockers` },
  { n: 15, title: 'Development gate approved', hint: 'Functionality, internal testing, no major bugs', done: (p) => gateApproved(p, 'development'), href: (p) => `#/projects/${p?.id}/timeline` },
  { n: 16, title: 'Internal testing approved → UAT', hint: 'Test evidence and a UAT environment', done: (p) => gateApproved(p, 'internal_testing'), href: (p) => `#/projects/${p?.id}/timeline` },
  { n: 17, title: 'UAT approved by the business', hint: 'Feedback recorded, critical issues cleared, approval given', done: (p) => gateApproved(p, 'uat'), href: (p) => `#/projects/${p?.id}/uat` },
  { n: 18, title: 'Deployed to production', hint: 'Version reference and deployment notes recorded', done: (p) => Boolean(p?.deployedAt), href: (p) => `#/projects/${p?.id}/timeline` },
  { n: 19, title: 'Stabilized and closed — 100%', hint: 'No critical issues, closure gate approved, outcome recorded', done: (p) => p?.stage === 'completed', href: (p) => `#/projects/${p?.id}` },
]

export const demoProject = (db: DatabaseShape): Project | undefined =>
  db.projects.find((p) => p.name.toLowerCase().includes('hr ai assistant')) ??
  db.projects.find((p) => !p.id.startsWith('p-'))

export function JourneyPanel() {
  const { db, resetDemo } = useApp()
  const [open, setOpen] = useState(false)
  const project = demoProject(db)
  const doneCount = JOURNEY.filter((s) => s.done(project, db)).length
  const currentIdx = JOURNEY.findIndex((s) => !s.done(project, db))

  if (!open)
    return (
      <Button className="demo-fab" variant="primary" onClick={() => setOpen(true)}>
        <span aria-hidden>▶</span> Prototype journey · {doneCount}/{JOURNEY.length}
      </Button>
    )

  return (
    <aside className="demo-panel" aria-label="Prototype journey">
      <div className="dp-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="h3">Prototype journey</div>
          <div className="tiny muted">
            {project ? project.name : 'Start by creating the HR AI Assistant project'} · {doneCount} of{' '}
            {JOURNEY.length} states reached
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} aria-label="Close journey panel">
          ✕
        </Button>
      </div>
      <div className="dp-body">
        {JOURNEY.map((s, i) => {
          const done = s.done(project, db)
          const now = i === currentIdx
          return (
            <button
              key={s.n}
              className={`demo-step${done ? ' done' : ''}${now ? ' now' : ''}`}
              style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
              onClick={() => navigate(s.href(project))}
            >
              <span className="sn" aria-hidden>
                {done ? '✓' : s.n}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="st">{s.title}</span>
                <span className="sd" style={{ display: 'block' }}>
                  {s.hint}
                </span>
              </span>
              {now && <Badge tone="info">Next</Badge>}
            </button>
          )
        })}
      </div>
      <div className="card-foot row" style={{ borderRadius: '0 0 var(--r-lg) var(--r-lg)' }}>
        <span className="tiny muted" style={{ flex: 1 }}>
          Steps tick themselves from real project state.
        </span>
        <Button size="sm" onClick={resetDemo}>
          Reset
        </Button>
      </div>
    </aside>
  )
}
