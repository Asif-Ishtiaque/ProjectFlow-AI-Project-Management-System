import { useMemo, useState } from 'react'
import { addDays, fmtDate } from '../domain/dates'
import { MILESTONE_TEMPLATE } from '../domain/templates'
import type { Priority } from '../domain/types'
import { navigate } from '../router'
import { useApp } from '../store/store'
import { Alert, Button, Card, CardHead, Field } from '../components/ui'

/** The assignment's demo project, pre-filled so the journey can start in one click. */
const DEMO = {
  name: 'HR AI Assistant',
  businessUnitId: 'bu-group',
  departmentId: 'dp-hr',
  businessProblem:
    'HR teams spend significant time answering repetitive policy-related questions from employees across the group.',
  expectedOutcome: 'Provide employees with faster access to approved HR information without going through HR staff.',
  ownerId: 'u-sarah',
  analystId: 'u-nadia',
  developerId: 'u-rahim',
  businessOwnerId: 'u-hrdir',
  contributorIds: ['u-farhana', 'u-imran'],
  expectedDeliveryDate: '2026-09-30',
  priority: 'high' as Priority,
}

const BLANK = {
  ...DEMO,
  name: '',
  businessProblem: '',
  expectedOutcome: '',
  analystId: '',
  developerId: '',
  contributorIds: [] as string[],
}

export function CreateProject() {
  const { db, run, pending, actor } = useApp()
  const [form, setForm] = useState({ ...DEMO })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k as string]: '' }))
  }

  const departments = db.departments.filter((d) => d.businessUnitId === form.businessUnitId)
  const plan = useMemo(
    () =>
      MILESTONE_TEMPLATE.map((t) => ({
        name: t.name,
        due: addDays(form.expectedDeliveryDate || db.today, t.offsetFromDelivery),
        weight: t.weight,
      })),
    [form.expectedDeliveryDate, db.today],
  )

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'A project name is required.'
    if (!form.departmentId) e.departmentId = 'Select the requesting department.'
    if (!form.businessProblem.trim()) e.businessProblem = 'Describe the problem the business wants solved.'
    if (!form.expectedOutcome.trim()) e.expectedOutcome = 'State the outcome the business expects.'
    if (!form.ownerId) e.ownerId = 'One person must be accountable for delivery.'
    if (!form.expectedDeliveryDate) e.expectedDeliveryDate = 'Management needs one delivery expectation.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    const before = new Set(db.projects.map((p) => p.id))
    const next = await run(
      {
        type: 'create_project',
        actorId: actor.id,
        input: {
          ...form,
          analystId: form.analystId || undefined,
          developerId: form.developerId || undefined,
          businessOwnerId: form.businessOwnerId || undefined,
        },
      },
      { success: `${form.name} created — the project is now at Idea / Request.` },
    )
    if (!next) return
    const created = next.projects.find((p) => !before.has(p.id))
    navigate(created ? `#/projects/${created.id}` : '#/projects')
  }

  const userOptions = (roles: string[]) => db.users.filter((u) => roles.includes(u.role))

  return (
    <div className="content" style={{ maxWidth: 1080 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">New AI project</div>
          <h1 className="h1">Register a new AI initiative</h1>
          <p className="muted small" style={{ marginTop: 4 }}>
            Intake captures the five things management needs from day one: the problem, the owner, the team, the outcome
            and the delivery date.
          </p>
        </div>
        <span className="spacer" />
        <Button variant="ghost" onClick={() => setForm({ ...BLANK })}>
          Clear form
        </Button>
        <Button variant="ghost" onClick={() => setForm({ ...DEMO })}>
          Use demo example
        </Button>
      </div>

      <div className="split">
        <div className="col" style={{ gap: 14 }}>
          <Card>
            <CardHead title="Project basics" sub="What is being solved and for whom" />
            <div className="card-body" style={{ display: 'grid', gap: 14 }}>
              <Field label="Project name" required error={errors.name}>
                <input
                  className={`input${errors.name ? ' invalid' : ''}`}
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="e.g. HR AI Assistant"
                />
              </Field>
              <div className="grid g2">
                <Field label="Business unit" required>
                  <select
                    className="select"
                    value={form.businessUnitId}
                    onChange={(e) => {
                      const bu = e.target.value
                      const firstDept = db.departments.find((d) => d.businessUnitId === bu)
                      setForm((f) => ({ ...f, businessUnitId: bu, departmentId: firstDept?.id ?? '' }))
                    }}
                  >
                    {db.businessUnits.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Department" required error={errors.departmentId}>
                  <select className="select" value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
                    <option value="">Select a department…</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field
                label="Business problem"
                required
                error={errors.businessProblem}
                help="Written in the words of the business, not the solution."
              >
                <textarea
                  className={`textarea${errors.businessProblem ? ' invalid' : ''}`}
                  value={form.businessProblem}
                  onChange={(e) => set('businessProblem', e.target.value)}
                />
              </Field>
              <Field label="Expected outcome" required error={errors.expectedOutcome} help="What measurably changes once this is live.">
                <textarea
                  className={`textarea${errors.expectedOutcome ? ' invalid' : ''}`}
                  value={form.expectedOutcome}
                  onChange={(e) => set('expectedOutcome', e.target.value)}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHead title="People" sub="One accountable owner, one analyst, one business counterpart" />
            <div className="card-body grid g2" style={{ gap: 14 }}>
              <Field label="Project owner" required error={errors.ownerId} help="Accountable for delivery.">
                <select className="select" value={form.ownerId} onChange={(e) => set('ownerId', e.target.value)}>
                  <option value="">Select…</option>
                  {userOptions(['team_lead', 'management']).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="AI Analyst" help="Owns discovery and requirements. Discovery cannot start without one.">
                <select className="select" value={form.analystId} onChange={(e) => set('analystId', e.target.value)}>
                  <option value="">Assign later…</option>
                  {userOptions(['ai_analyst']).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Developer">
                <select className="select" value={form.developerId} onChange={(e) => set('developerId', e.target.value)}>
                  <option value="">Assign later…</option>
                  {userOptions(['developer']).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Business owner" help="Reviews requirements, performs UAT and gives final approval.">
                <select className="select" value={form.businessOwnerId} onChange={(e) => set('businessOwnerId', e.target.value)}>
                  <option value="">Assign later…</option>
                  {userOptions(['business_owner']).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.title}
                    </option>
                  ))}
                </select>
              </Field>
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Contributors" help="People who support delivery but do not own the outcome.">
                  <div className="row wrap" style={{ gap: 14 }}>
                    {userOptions(['developer', 'ai_analyst']).map((u) => (
                      <label key={u.id} className="row" style={{ gap: 6, fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={form.contributorIds.includes(u.id)}
                          onChange={(e) =>
                            set(
                              'contributorIds',
                              e.target.checked
                                ? [...form.contributorIds, u.id]
                                : form.contributorIds.filter((x) => x !== u.id),
                            )
                          }
                          style={{ accentColor: 'var(--brand)' }}
                        />
                        {u.name}
                      </label>
                    ))}
                  </div>
                </Field>
              </div>
            </div>
          </Card>

          <Card>
            <CardHead title="Planning" sub="The commitment management will be shown" />
            <div className="card-body grid g2" style={{ gap: 14 }}>
              <Field label="Expected delivery date" required error={errors.expectedDeliveryDate}>
                <input
                  type="date"
                  className={`input${errors.expectedDeliveryDate ? ' invalid' : ''}`}
                  value={form.expectedDeliveryDate}
                  onChange={(e) => set('expectedDeliveryDate', e.target.value)}
                />
              </Field>
              <Field label="Priority">
                <select className="select" value={form.priority} onChange={(e) => set('priority', e.target.value as Priority)}>
                  {(['low', 'medium', 'high', 'critical'] as Priority[]).map((p) => (
                    <option key={p} value={p}>
                      {p[0].toUpperCase() + p.slice(1)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="card-foot row">
              <span className="small muted">The project starts at Idea / Request with 0% progress.</span>
              <span className="spacer" style={{ flex: 1 }} />
              <Button onClick={() => navigate('#/projects')}>Cancel</Button>
              <Button variant="primary" loading={pending === 'create_project'} onClick={submit}>
                Create project
              </Button>
            </div>
          </Card>
        </div>

        <div className="col" style={{ gap: 14 }}>
          <Card>
            <CardHead title="Delivery plan preview" sub="Generated from the delivery date" />
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {plan.map((m) => (
                <div key={m.name} className="row" style={{ gap: 8 }}>
                  <span style={{ fontSize: 13, flex: 1 }}>{m.name}</span>
                  <span className="tiny muted nowrap">{fmtDate(m.due)}</span>
                  <span className="badge muted">w{m.weight}</span>
                </div>
              ))}
              <hr className="hr" style={{ margin: '4px 0' }} />
              <p className="tiny muted">
                Progress is calculated from these milestone weights — never typed in by hand. The plan can be adjusted in
                the workspace once the project exists.
              </p>
            </div>
          </Card>
          <Alert tone="info" title="What happens on create">
            The project is registered at Idea / Request, the standard delivery plan is applied, the AI Analyst is
            notified of the assignment, an activity record is written and management sees the project immediately.
          </Alert>
        </div>
      </div>
    </div>
  )
}
