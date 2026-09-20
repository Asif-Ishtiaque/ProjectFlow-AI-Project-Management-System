import { useState } from 'react'
import { fmtDate } from '../../domain/dates'
import { delayLabel } from '../../domain/lifecycle'
import { userById } from '../../domain/logic'
import type { Blocker, Project, ScopeChange } from '../../domain/types'
import { useApp } from '../../store/store'
import { Alert, Badge, Button, Card, CardHead, ConfirmDialog, EmptyState, Field, Person } from '../../components/ui'
import { CreateBlockerDialog, ScopeChangeDialog, type BlockerPrefill } from './dialogs'

export function BlockersTab({ project }: { project: Project }) {
  const { db, role, run, pending, actorFor } = useApp()
  const actor = actorFor(project)
  const [newBlocker, setNewBlocker] = useState<BlockerPrefill | null>(null)
  const [newScope, setNewScope] = useState(false)
  const [resolving, setResolving] = useState<Blocker | null>(null)
  const [resolutionNote, setResolutionNote] = useState('')
  const [deciding, setDeciding] = useState<{ sc: ScopeChange; decision: 'approved' | 'rejected' } | null>(null)
  const [decisionNote, setDecisionNote] = useState('')
  const [assigning, setAssigning] = useState<Blocker | null>(null)
  const [assignee, setAssignee] = useState('u-imran')

  const open = project.blockers.filter((b) => b.status === 'open')
  const resolved = project.blockers.filter((b) => b.status === 'resolved')
  const pendingScope = project.scopeChanges.filter((s) => s.decision === 'under_review')
  const decidedScope = project.scopeChanges.filter((s) => s.decision !== 'under_review')

  return (
    <div className="col" style={{ gap: 14 }}>
      <Card>
        <CardHead
          title="Blockers"
          sub="Work cannot continue until someone specific clears these"
          right={
            <div className="row" style={{ gap: 8 }}>
              <Badge tone={open.length ? 'bad' : 'ok'}>{open.length} open</Badge>
              <Button size="sm" disabled={role === 'management'} onClick={() => setNewBlocker({ bookImpact: true, impactDays: 3 })}>
                + Record blocker
              </Button>
            </div>
          }
        />
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {open.length === 0 && resolved.length === 0 && (
            <EmptyState icon="✓" title="No active blockers" body="Nothing is preventing the team from working." />
          )}
          {open.map((b) => (
            <article key={b.id} className="attention blocked" style={{ alignItems: 'stretch' }}>
              <div className="body">
                <div className="row wrap" style={{ gap: 9 }}>
                  <span className="nm">{b.title}</span>
                  <Badge tone="bad">OPEN</Badge>
                  <Badge tone="muted">{delayLabel(b.category)}</Badge>
                </div>
                <p className="why">{b.description}</p>
                <div className="meta">
                  <div className="m">
                    Related milestone
                    <b>{project.milestones.find((m) => m.id === b.milestoneId)?.name ?? 'Project level'}</b>
                  </div>
                  <div className="m">
                    Responsible
                    <b>{userById(db, b.responsibleId)?.name}</b>
                  </div>
                  <div className="m">
                    Identified
                    <b>{fmtDate(b.identifiedAt)}</b>
                  </div>
                  <div className="m">
                    Impact
                    <b>{b.impactSummary}</b>
                  </div>
                  <div className="m">
                    Required action
                    <b>{b.requiredAction}</b>
                  </div>
                  {b.assignedActionTo && (
                    <div className="m">
                      Action assigned to
                      <b>{userById(db, b.assignedActionTo)?.name}</b>
                    </div>
                  )}
                </div>
                <div className="row" style={{ gap: 8, marginTop: 12 }}>
                  <Button size="sm" disabled={role === 'management'} onClick={() => setAssigning(b)}>
                    Assign action
                  </Button>
                  <Button size="sm" variant="primary" disabled={role === 'management'} onClick={() => setResolving(b)}>
                    Mark resolved
                  </Button>
                </div>
              </div>
            </article>
          ))}

          {resolved.length > 0 && (
            <>
              <div className="eyebrow" style={{ marginTop: 6 }}>
                Resolved
              </div>
              {resolved.map((b) => (
                <div key={b.id} className="row" style={{ gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  <Badge tone="ok">RESOLVED</Badge>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="small strong">{b.title}</div>
                    <div className="tiny muted">
                      Cleared {fmtDate(b.resolvedAt)} by {userById(db, b.responsibleId)?.name}
                      {b.resolutionNote ? ` — ${b.resolutionNote}` : ''}
                    </div>
                  </div>
                  <span className="tiny muted nowrap">+{b.impactDays}d booked</span>
                </div>
              ))}
            </>
          )}
        </div>
      </Card>

      <Card>
        <CardHead
          title="Scope changes"
          sub="New or changed requirements — tracked apart from execution delays"
          right={
            <div className="row" style={{ gap: 8 }}>
              <Badge tone={pendingScope.length ? 'warn' : 'muted'}>{pendingScope.length} under review</Badge>
              <Button size="sm" disabled={role === 'management'} onClick={() => setNewScope(true)}>
                + Request change
              </Button>
            </div>
          }
        />
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {project.scopeChanges.length === 0 && (
            <EmptyState title="No scope changes requested" body="The approved scope is unchanged since the commitment gate." />
          )}
          {pendingScope.map((s) => (
            <article key={s.id} className="attention at_risk">
              <div className="body">
                <div className="row wrap" style={{ gap: 9 }}>
                  <span className="nm">{s.title}</span>
                  <Badge tone="warn">UNDER REVIEW</Badge>
                </div>
                <p className="why">{s.description}</p>
                <div className="meta">
                  <div className="m">
                    Requested by
                    <b>{userById(db, s.requestedById)?.name}</b>
                  </div>
                  <div className="m">
                    Reason
                    <b>{s.reason}</b>
                  </div>
                  <div className="m">
                    Impact on scope
                    <b>{s.scopeImpact}</b>
                  </div>
                  <div className="m">
                    Delivery impact
                    <b style={{ color: 'var(--late)' }}>
                      +{s.deliveryImpactDays} days → {fmtDate(s.proposedDeliveryDate)}
                    </b>
                  </div>
                </div>
                <div className="row" style={{ gap: 8, marginTop: 12 }}>
                  {role === 'business_owner' ? (
                    <>
                      <Button size="sm" onClick={() => setDeciding({ sc: s, decision: 'rejected' })}>
                        Reject
                      </Button>
                      <Button size="sm" variant="primary" onClick={() => setDeciding({ sc: s, decision: 'approved' })}>
                        Approve change
                      </Button>
                    </>
                  ) : (
                    <span className="small muted">Awaiting the Business Owner's decision.</span>
                  )}
                </div>
              </div>
            </article>
          ))}
          {decidedScope.map((s) => (
            <div key={s.id} className="row" style={{ gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <Badge tone={s.decision === 'approved' ? 'ok' : 'muted'}>{s.decision === 'approved' ? 'APPROVED' : 'REJECTED'}</Badge>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="small strong">{s.title}</div>
                <div className="tiny muted">
                  {userById(db, s.reviewerId)?.name} on {fmtDate(s.decidedAt)}
                  {s.decisionNote ? ` — ${s.decisionNote}` : ''}
                </div>
              </div>
              {s.decision === 'approved' && <Badge tone="info">+{s.deliveryImpactDays}d scope</Badge>}
            </div>
          ))}
        </div>
      </Card>

      {newBlocker && <CreateBlockerDialog project={project} prefill={newBlocker} onClose={() => setNewBlocker(null)} />}
      {newScope && <ScopeChangeDialog project={project} onClose={() => setNewScope(false)} />}

      {assigning && (
        <ConfirmDialog
          title="Assign the required action"
          body={`Who will carry out: “${assigning.requiredAction}”?`}
          confirmLabel="Assign"
          onCancel={() => setAssigning(null)}
          onConfirm={async () => {
            await run(
              { type: 'assign_blocker_action', projectId: project.id, blockerId: assigning.id, userId: assignee, actorId: actor.id },
              { success: 'Action assigned and the owner notified.' },
            )
            setAssigning(null)
          }}
        >
          <Field label="Assign to">
            <select className="select" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              {db.users
                .filter((u) => u.role !== 'management')
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.title}
                  </option>
                ))}
            </select>
          </Field>
        </ConfirmDialog>
      )}

      {resolving && (
        <ConfirmDialog
          title="Mark this blocker as resolved?"
          confirmLabel="Mark resolved"
          loading={pending === 'resolve_blocker'}
          onCancel={() => setResolving(null)}
          onConfirm={async () => {
            await run(
              {
                type: 'resolve_blocker',
                projectId: project.id,
                blockerId: resolving.id,
                note: resolutionNote || 'Resolved.',
                actorId: actor.id,
              },
              { success: 'Blocker resolved — work can continue.' },
            )
            setResolving(null)
            setResolutionNote('')
          }}
          body={
            <>
              <p>
                <b>{resolving.title}</b> will be closed. Here is what changes:
              </p>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                <li>
                  {project.milestones.find((m) => m.id === resolving.milestoneId)?.name ?? 'The project'} returns to
                  active progress
                </li>
                <li>Project health stops being BLOCKED and is recalculated from the remaining evidence</li>
                <li>
                  The {resolving.impactDays}-day delivery impact already booked stays — delivery remains{' '}
                  {fmtDate(project.expectedDeliveryDate)}
                </li>
                <li>An activity entry is written and the team is notified</li>
              </ul>
            </>
          }
        >
          <Field label="Resolution note" help="How it was cleared.">
            <textarea
              className="textarea"
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="e.g. IT issued the production endpoint and credentials; connection verified."
            />
          </Field>
        </ConfirmDialog>
      )}

      {deciding && (
        <ConfirmDialog
          title={deciding.decision === 'approved' ? 'Approve this scope change?' : 'Reject this scope change?'}
          confirmLabel={deciding.decision === 'approved' ? 'Approve change' : 'Reject change'}
          tone={deciding.decision === 'approved' ? 'primary' : 'danger'}
          loading={pending === 'decide_scope_change'}
          onCancel={() => setDeciding(null)}
          onConfirm={async () => {
            await run(
              {
                type: 'decide_scope_change',
                projectId: project.id,
                scopeChangeId: deciding.sc.id,
                decision: deciding.decision,
                note: decisionNote || (deciding.decision === 'approved' ? 'Approved.' : 'Not approved for this release.'),
                actorId: actor.id,
              },
              { success: `Scope change ${deciding.decision}.` },
            )
            setDeciding(null)
            setDecisionNote('')
          }}
          body={
            deciding.decision === 'approved' ? (
              <Alert tone="warn" title="Delivery impact of approving">
                Delivery moves from {fmtDate(project.expectedDeliveryDate)} to{' '}
                <b>{fmtDate(deciding.sc.proposedDeliveryDate)}</b> (+{deciding.sc.deliveryImpactDays} days). Management
                will see this slip attributed to an approved scope change, not to execution.
              </Alert>
            ) : (
              <span>The scope stays as approved at the commitment gate and the delivery date does not move.</span>
            )
          }
        >
          <Field label="Decision note">
            <textarea className="textarea" value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} />
          </Field>
        </ConfirmDialog>
      )}
    </div>
  )
}
