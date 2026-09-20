import { useState } from 'react'
import { fmtDate } from '../../domain/dates'
import { roleLabel, stageDef, nextStage } from '../../domain/lifecycle'
import { gateReadiness, userById } from '../../domain/logic'
import type { Project, StageGate } from '../../domain/types'
import { useApp } from '../../store/store'
import { Alert, Badge, Button, Card, CardHead, ConfirmDialog, Field, GateBadge } from '../../components/ui'

/**
 * Evidence-based stage progression.
 *
 * A stage cannot be left because someone changed a dropdown: every required exit
 * criterion must be ticked with an owner and a date, the gate must be submitted,
 * and the named approver must decide.
 */
export function GatePanel({ project, gate }: { project: Project; gate: StageGate }) {
  const { db, role, run, pending, setRole, actorFor } = useApp()
  const actor = actorFor(project)
  const readiness = gateReadiness(gate)
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [confirm, setConfirm] = useState<null | 'submit' | 'approve' | 'changes'>(null)
  const [decisionNote, setDecisionNote] = useState('')

  const canEdit = role !== 'management' && gate.state !== 'approved'
  const canDecide = role === gate.approverRole
  const target = nextStage(gate.stage)

  const toggle = (criterionId: string, done: boolean, evidence?: string) =>
    run(
      { type: 'toggle_criterion', projectId: project.id, gateId: gate.id, criterionId, done, evidence, actorId: actor.id },
      { pendingKey: criterionId },
    )

  const statusBanner = () => {
    if (gate.state === 'approved')
      return (
        <Alert tone="ok" title={`${gate.name} approved`}>
          Approved by {userById(db, gate.approverId)?.name ?? 'the reviewer'} on {fmtDate(gate.decidedAt)}.
          {gate.decisionNote ? ` “${gate.decisionNote}”` : ''}
        </Alert>
      )
    if (gate.state === 'changes_requested')
      return (
        <Alert tone="bad" title="Changes requested — this stage cannot close yet">
          {gate.decisionNote || 'The reviewer asked for changes.'}
        </Alert>
      )
    if (gate.state === 'ready_for_review')
      return (
        <Alert
          tone="warn"
          title="Ready for review — waiting for a decision"
          action={
            canDecide ? undefined : (
              <Button size="sm" onClick={() => setRole(gate.approverRole)}>
                View as {roleLabel(gate.approverRole)}
              </Button>
            )
          }
        >
          Submitted on {fmtDate(gate.submittedAt)} by {userById(db, gate.submittedBy)?.name ?? 'the team'}. Only the{' '}
          {roleLabel(gate.approverRole)} can approve this gate.
        </Alert>
      )
    return readiness.ready ? (
      <Alert tone="info" title="All exit criteria are evidenced — ready to submit">
        Submitting sends the gate to the {roleLabel(gate.approverRole)} for a decision.
      </Alert>
    ) : (
      <Alert tone="warn" title="GATE NOT READY" icon="▲">
        {readiness.total - readiness.met} of {readiness.total} required criteria are still open: {readiness.blockingReason}
      </Alert>
    )
  }

  return (
    <Card>
      <CardHead
        title={gate.name}
        sub={`Exit criteria for ${stageDef(gate.stage).label} · approver: ${roleLabel(gate.approverRole)}`}
        right={
          <div className="row" style={{ gap: 8 }}>
            <Badge tone={readiness.ready ? 'ok' : 'warn'}>
              {readiness.met}/{readiness.total} criteria
            </Badge>
            <GateBadge state={gate.state} />
          </div>
        }
      />
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {statusBanner()}
        {role === 'management' && gate.state !== 'approved' && (
          <Alert
            tone="info"
            title="You are viewing as Management"
            action={
              <Button size="sm" onClick={() => setRole(gate.state === 'ready_for_review' ? gate.approverRole : 'ai_analyst')}>
                Switch role
              </Button>
            }
          >
            Management reviews delivery; it does not evidence or approve stage gates. Switch role to act on this gate.
          </Alert>
        )}

        <div className="crit-list">
          {gate.criteria.map((c) => {
            const who = userById(db, c.completedBy)
            return (
              <div key={c.id}>
                <label className={`crit${c.done ? ' on' : ''}${!canEdit ? ' disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={c.done}
                    disabled={!canEdit || pending === c.id}
                    onChange={(e) => toggle(c.id, e.target.checked)}
                    style={{ width: 16, height: 16, marginTop: 2, accentColor: 'var(--brand)' }}
                  />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="cl">
                      {c.done ? '✅ ' : '⬜ '}
                      {c.label}
                      {c.required && <span className="tiny muted"> · required</span>}
                    </span>
                    {c.hint && <span className="ch" style={{ display: 'block' }}>{c.hint}</span>}
                    {c.done && (
                      <span className="ce" style={{ display: 'block' }}>
                        Evidenced by {who?.name ?? 'the team'} on {fmtDate(c.completedAt)}
                        {c.evidence ? ` — ${c.evidence}` : ''}
                      </span>
                    )}
                  </span>
                  {canEdit && c.done && (
                    <button
                      className="linkish tiny"
                      onClick={(e) => {
                        e.preventDefault()
                        setNoteFor(noteFor === c.id ? null : c.id)
                        setNoteText(c.evidence ?? '')
                      }}
                    >
                      {c.evidence ? 'Edit evidence' : 'Add evidence'}
                    </button>
                  )}
                </label>
                {noteFor === c.id && (
                  <div className="row" style={{ padding: '0 12px 10px 39px', gap: 8 }}>
                    <input
                      className="input"
                      placeholder="Link, document name or short note proving this is done"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={async () => {
                        await toggle(c.id, true, noteText)
                        setNoteFor(null)
                      }}
                    >
                      Save
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {gate.state !== 'approved' && (
        <div className="card-foot row">
          <span className="small muted">
            {gate.stage === 'stabilization'
              ? 'Approving records the business sign-off. The project owner then formally closes the project.'
              : target
                ? `Approving moves the project to ${stageDef(target).label}.`
                : 'Approving closes the project.'}
          </span>
          <span className="spacer" style={{ flex: 1 }} />
          {gate.state === 'ready_for_review' ? (
            canDecide ? (
              <>
                <Button onClick={() => setConfirm('changes')}>Request changes</Button>
                <Button variant="primary" onClick={() => setConfirm('approve')}>
                  Approve stage
                </Button>
              </>
            ) : (
              <Button disabled title={`Only the ${roleLabel(gate.approverRole)} can approve this gate`}>
                Awaiting {roleLabel(gate.approverRole)}
              </Button>
            )
          ) : (
            <Button
              variant="primary"
              disabled={!readiness.ready || role === 'management'}
              title={readiness.ready ? undefined : `Gate not ready — ${readiness.blockingReason}`}
              onClick={() => setConfirm('submit')}
            >
              Submit for review
            </Button>
          )}
        </div>
      )}

      {confirm === 'submit' && (
        <ConfirmDialog
          title="Submit this gate for review?"
          body={
            <>
              All {readiness.total} required exit criteria are evidenced. The {roleLabel(gate.approverRole)} will be
              notified and the project will show as awaiting approval until they decide.
            </>
          }
          confirmLabel="Submit for review"
          loading={pending === 'submit_gate'}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await run(
              { type: 'submit_gate', projectId: project.id, gateId: gate.id, actorId: actor.id },
              { success: `${gate.name} submitted — ${roleLabel(gate.approverRole)} notified.` },
            )
            setConfirm(null)
          }}
        />
      )}

      {confirm === 'approve' && (
        <ConfirmDialog
          title="Approve this stage gate?"
          body={
            gate.stage === 'stabilization' ? (
              <>
                Approving records the business sign-off for <b>{project.name}</b>. The project owner can then close the
                project, which sets it to Completed at 100%.
              </>
            ) : (
              <>
                Approving this gate will move <b>{project.name}</b> from {stageDef(gate.stage).label} to{' '}
                <b>{target ? stageDef(target).label : 'closure'}</b>, close the milestones belonging to this stage and
                notify the team.
              </>
            )
          }
          confirmLabel="Approve stage"
          loading={pending === 'decide_gate'}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await run(
              {
                type: 'decide_gate',
                projectId: project.id,
                gateId: gate.id,
                decision: 'approved',
                note: decisionNote,
                actorId: actor.id,
              },
              {
                success:
                  gate.stage === 'stabilization'
                    ? `${gate.name} approved — the project can now be closed.`
                    : `${gate.name} approved — project moved to ${target ? stageDef(target).label : 'closure'}.`,
              },
            )
            setConfirm(null)
            setDecisionNote('')
          }}
        >
          <Field label="Decision note" help="Recorded in the approval history.">
            <textarea
              className="textarea"
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              placeholder="e.g. Reviewed the requirements pack and the workflow. Approved."
            />
          </Field>
        </ConfirmDialog>
      )}

      {confirm === 'changes' && (
        <ConfirmDialog
          title="Request changes"
          body="The project stays in this stage and the team is notified of what must be addressed."
          confirmLabel="Request changes"
          tone="danger"
          loading={pending === 'decide_gate'}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await run(
              {
                type: 'decide_gate',
                projectId: project.id,
                gateId: gate.id,
                decision: 'changes_requested',
                note: decisionNote || 'Changes requested.',
                actorId: actor.id,
              },
              { success: 'Changes requested — the team has been notified.' },
            )
            setConfirm(null)
            setDecisionNote('')
          }}
        >
          <Field label="What must change?" required>
            <textarea className="textarea" value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} />
          </Field>
        </ConfirmDialog>
      )}
    </Card>
  )
}
