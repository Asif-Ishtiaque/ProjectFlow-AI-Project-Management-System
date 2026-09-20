import { useState } from 'react'
import { addDays, fmtDate } from '../../domain/dates'
import { DELAY_CATEGORIES, delayLabel } from '../../domain/lifecycle'
import type { DelayCategory, Milestone, Project } from '../../domain/types'
import { useApp } from '../../store/store'
import { Alert, Badge, Button, Field, Modal } from '../../components/ui'

/* ---------------------------------------------------------- record a delay */

export function RecordDelayDialog({
  project,
  milestone,
  onClose,
  onCreateBlocker,
}: {
  project: Project
  milestone: Milestone
  onClose: () => void
  onCreateBlocker: (prefill: { milestoneId: string; category: DelayCategory; impactDays: number; responsibleId: string; note: string }) => void
}) {
  const { db, run, pending, actorFor } = useApp()
  const actor = actorFor(project)
  const [category, setCategory] = useState<DelayCategory>('integration_dependency')
  const [note, setNote] = useState('')
  const [impactDays, setImpactDays] = useState(3)
  const [responsibleId, setResponsibleId] = useState(project.developerId ?? project.ownerId)
  const [alsoBlocker, setAlsoBlocker] = useState(true)
  const [touched, setTouched] = useState(false)

  const valid = note.trim().length > 3 && impactDays >= 0

  return (
    <Modal
      title="Record the delay"
      sub={`${milestone.name} · committed ${fmtDate(milestone.dueDate)}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={pending === 'record_delay'}
            onClick={async () => {
              setTouched(true)
              if (!valid) return
              const ok = await run(
                {
                  type: 'record_delay',
                  projectId: project.id,
                  actorId: actor.id,
                  input: { milestoneId: milestone.id, category, note, impactDays, responsibleId },
                },
                { success: `Delay recorded — ${milestone.name} revised to ${fmtDate(addDays(milestone.dueDate, impactDays))}.` },
              )
              if (!ok) return
              onClose()
              if (alsoBlocker)
                onCreateBlocker({ milestoneId: milestone.id, category, impactDays, responsibleId, note })
            }}
          >
            Record delay
          </Button>
        </>
      }
    >
      <Alert tone="warn" title="This milestone is overdue. What caused the delay?">
        Every missed date needs a reason, an owner and a delivery impact — that is what management sees, instead of a
        silent slip.
      </Alert>

      <Field label="Delay reason" required>
        <select className="select" value={category} onChange={(e) => setCategory(e.target.value as DelayCategory)}>
          {DELAY_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="What happened?" required error={touched && !valid ? 'Describe the cause in one or two sentences.' : undefined}>
        <textarea
          className={`textarea${touched && !valid ? ' invalid' : ''}`}
          value={note}
          placeholder="e.g. Production API credentials were not issued by IT, so the integration could not be completed."
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      <div className="grid g2" style={{ gap: 14 }}>
        <Field label="Delivery impact (days)" required help={`Milestone moves to ${fmtDate(addDays(milestone.dueDate, impactDays))}`}>
          <input className="input" type="number" min={0} max={60} value={impactDays} onChange={(e) => setImpactDays(Number(e.target.value))} />
        </Field>
        <Field label="Responsible for recovery" required>
          <select className="select" value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}>
            {db.users
              .filter((u) => u.role !== 'management')
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.title}
                </option>
              ))}
          </select>
        </Field>
      </div>

      <Alert tone="info" title="Delivery impact">
        Project delivery moves from {fmtDate(project.expectedDeliveryDate)} to{' '}
        <b>{fmtDate(addDays(project.expectedDeliveryDate, impactDays))}</b>. This is recorded as an execution delay, not
        a scope change.
      </Alert>

      <label className="check" style={{ alignItems: 'flex-start' }}>
        <input type="checkbox" checked={alsoBlocker} onChange={(e) => setAlsoBlocker(e.target.checked)} />
        <span>
          <span className="strong small">Work cannot continue — also record a blocker</span>
          <span className="small muted" style={{ display: 'block' }}>
            An overdue milestone is not automatically blocked. Tick this only when something specific must be cleared by
            someone else before work can resume.
          </span>
        </span>
      </label>
    </Modal>
  )
}

/* ------------------------------------------------------------ new blocker */

export interface BlockerPrefill {
  milestoneId?: string
  category?: DelayCategory
  impactDays?: number
  responsibleId?: string
  note?: string
  bookImpact?: boolean
}

export function CreateBlockerDialog({
  project,
  prefill,
  onClose,
}: {
  project: Project
  prefill: BlockerPrefill
  onClose: () => void
}) {
  const { db, run, pending, actorFor } = useApp()
  const actor = actorFor(project)
  const linkedMilestone = project.milestones.find((m) => m.id === prefill.milestoneId)
  const suggested = prefill.category === 'integration_dependency' ? 'API credentials unavailable' : ''
  const [title, setTitle] = useState(suggested)
  const [milestoneId, setMilestoneId] = useState(prefill.milestoneId ?? '')
  const [category, setCategory] = useState<DelayCategory>(prefill.category ?? 'other')
  const [description, setDescription] = useState(prefill.note ?? '')
  // An integration dependency is cleared by whoever owns the system being integrated,
  // not by the developer waiting on it.
  const [responsibleId, setResponsibleId] = useState(
    prefill.category === 'integration_dependency' ? 'u-imran' : (prefill.responsibleId ?? 'u-imran'),
  )
  const [impactDays, setImpactDays] = useState(prefill.impactDays ?? 3)
  const [requiredAction, setRequiredAction] = useState(
    prefill.category === 'integration_dependency' ? 'Provide the API endpoint and production credentials' : '',
  )
  const [touched, setTouched] = useState(false)
  const bookImpact = prefill.bookImpact ?? false
  const valid = title.trim() && description.trim() && requiredAction.trim() && responsibleId

  return (
    <Modal
      title="Record a blocker"
      sub="Something specific is stopping the work, owned by someone specific"
      wide
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={pending === 'create_blocker'}
            onClick={async () => {
              setTouched(true)
              if (!valid) return
              const ok = await run(
                {
                  type: 'create_blocker',
                  projectId: project.id,
                  actorId: actor.id,
                  input: {
                    title,
                    milestoneId: milestoneId || undefined,
                    category,
                    description,
                    responsibleId,
                    impactDays,
                    requiredAction,
                    bookImpact,
                    fromDelayOnMilestone: prefill.milestoneId,
                  },
                },
                { success: `Blocker created — ${project.name} is now BLOCKED.` },
              )
              if (ok) onClose()
            }}
          >
            Create blocker
          </Button>
        </>
      }
    >
      {linkedMilestone && (
        <Alert tone="warn" title={`Linked to ${linkedMilestone.name}`}>
          The milestone will show as blocked and the project health becomes BLOCKED until this is cleared.
        </Alert>
      )}
      <Field label="Blocker title" required error={touched && !title.trim() ? 'Required' : undefined}>
        <input className={`input${touched && !title.trim() ? ' invalid' : ''}`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. API credentials unavailable" />
      </Field>
      <div className="grid g2" style={{ gap: 14 }}>
        <Field label="Related milestone">
          <select className="select" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
            <option value="">Not milestone-specific</option>
            {project.milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reason category" required>
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value as DelayCategory)}>
            {DELAY_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Description" required error={touched && !description.trim() ? 'Required' : undefined}>
        <textarea className={`textarea${touched && !description.trim() ? ' invalid' : ''}`} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="grid g2" style={{ gap: 14 }}>
        <Field label="Responsible person" required help="The person who can actually clear it.">
          <select className="select" value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}>
            {db.users
              .filter((u) => u.role !== 'management')
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.title}
                </option>
              ))}
          </select>
        </Field>
        <Field
          label="Impact (days)"
          help={bookImpact ? 'Adds to the delivery date.' : 'Already booked by the recorded delay — not counted twice.'}
        >
          <input className="input" type="number" min={0} value={impactDays} onChange={(e) => setImpactDays(Number(e.target.value))} disabled={!bookImpact} />
        </Field>
      </div>
      <Field label="Required action" required error={touched && !requiredAction.trim() ? 'Required' : undefined} help="Written so the responsible person knows exactly what to do.">
        <input className={`input${touched && !requiredAction.trim() ? ' invalid' : ''}`} value={requiredAction} onChange={(e) => setRequiredAction(e.target.value)} />
      </Field>
      <div className="row" style={{ gap: 8 }}>
        <Badge tone="muted">Status on creation</Badge>
        <Badge tone="bad">OPEN</Badge>
        <span className="small muted">Category: {delayLabel(category)}</span>
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------- scope change */

export function ScopeChangeDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const { db, run, pending, actorFor } = useApp()
  const actor = actorFor(project)
  const [title, setTitle] = useState('Add Bengali language support')
  const [description, setDescription] = useState(
    'The assistant should answer in Bengali as well as English so factory and depot employees can use it.',
  )
  const [requestedById, setRequestedById] = useState(project.businessOwnerId ?? 'u-hrdir')
  const [reason, setReason] = useState('Support regional employees who do not read English policy documents.')
  const [scopeImpact, setScopeImpact] = useState('Additional translation layer, second answer template set and extra UAT scenarios.')
  const [deliveryImpactDays, setDeliveryImpactDays] = useState(5)

  return (
    <Modal
      title="Request a scope change"
      sub="Kept separate from blockers — this is new work, not a stuck task"
      wide
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={pending === 'create_scope_change'}
            onClick={async () => {
              const ok = await run(
                {
                  type: 'create_scope_change',
                  projectId: project.id,
                  actorId: actor.id,
                  input: { title, description, requestedById, reason, scopeImpact, deliveryImpactDays },
                },
                { success: 'Scope change raised — awaiting a business decision.' },
              )
              if (ok) onClose()
            }}
          >
            Submit for decision
          </Button>
        </>
      }
    >
      <Field label="Change title" required>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Description" required>
        <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="grid g2" style={{ gap: 14 }}>
        <Field label="Requested by" required>
          <select className="select" value={requestedById} onChange={(e) => setRequestedById(e.target.value)}>
            {db.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {u.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Delivery impact (days)" required help={`Delivery would move to ${fmtDate(addDays(project.expectedDeliveryDate, deliveryImpactDays))}`}>
          <input className="input" type="number" min={0} value={deliveryImpactDays} onChange={(e) => setDeliveryImpactDays(Number(e.target.value))} />
        </Field>
      </div>
      <Field label="Reason" required>
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <Field label="Impact on scope" required>
        <textarea className="textarea" value={scopeImpact} onChange={(e) => setScopeImpact(e.target.value)} />
      </Field>
    </Modal>
  )
}
