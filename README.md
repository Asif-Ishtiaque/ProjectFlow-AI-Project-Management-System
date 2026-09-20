#ProjectFlow

**AI Project Management & Governance System — clickable high-fidelity prototype**

> Management should be able to open the system and understand within seconds where every AI project
> stands, what is late, why it is late, who needs to act, and when it will be delivered.

This prototype makes AI project execution **visible → accountable → measurable → actionable → predictable**.
It is deliberately not a Jira/Trello/ERP clone: there are no boards, no ticket taxonomies, no timesheets.
It does one job — govern the delivery of AI and software initiatives across Anwar Group.

---

## Run it

```bash
npm install
npm run dev
```

Then open <http://localhost:5183>. No backend or API key is required — the app runs against a simulated
API layer with realistic latency, and persists to `localStorage` so a demo survives a page refresh.
**Settings → Reset demo data** restores the seeded portfolio at any time.

Built with React 18 + TypeScript + Vite. No UI framework: the design system in `src/styles/app.css`
and `src/components/ui.tsx` is written for this product.

---

## The five questions every screen answers

| Question | Where it is answered |
|---|---|
| **Where is the project now?** | One current stage, shown on the dashboard, the portfolio and the workspace header |
| **Who owns it?** | One project owner, plus a named owner on every milestone, blocker and action |
| **What happens next?** | One next milestone and one next action, with the person responsible |
| **What is blocking or risking delivery?** | Health, blockers, delays and scope changes — each a separate, explicit record |
| **When will it be delivered?** | One expected delivery date, with every day of slippage attributed |

---

## Reading the dashboard at a glance

The dashboard leads with exceptions, then backs them with four graphics that answer a management
question each. All of them are inline SVG — no charting dependency — and every one is clickable through
to the underlying list.

| Graphic | The question it answers |
|---|---|
| **Portfolio health bar** | How much of the portfolio is actually fine? Click a segment to open that slice. |
| **Delivery outlook** | When is everything landing, and what has moved? One row per active project: grey to the original commitment, then a coloured extension for the slip — orange for execution, blue for an approved scope change. |
| **Milestone load** | Where is the crunch? Commitments per week, with already-overdue ones in deep red. |
| **Why delivery has moved** | Are we slow, or did the business change its mind? Portfolio slippage split into execution days vs approved-scope days, with the biggest contributors named. |

**On the colours.** Health is an *ordered severity ramp*, not four competing hues: on-track green, then
three steps that fall in lightness as severity rises. That choice came from running the palette
through a CVD validator — the original amber/orange/red badge colours sit ΔE 1.8 apart under
deuteranopia, which is fine for a badge carrying a glyph and a word but unreadable as adjacent chart
segments. The shipped ramp separates at ΔE >= 17 for every adjacent pair, in normal vision and under
simulated colour-blindness. Every segment still prints its count, every series is named in a legend,
and the same numbers appear in the tables below — so no fact on this page is available only as a colour.

---

## The product model

### Lifecycle — ten stages, evidence-based gates

```
Idea / Request → Discovery → Requirements & Design → Approval → Development
→ Internal Testing → Business Testing / UAT → Deployment → Stabilization → Completed
```

A stage is never changed with a dropdown. Each stage has **exit criteria** that must be ticked with an
owner, a date and (optionally) evidence, then submitted, then decided by a **named approver role**:

```
Not Started → In Progress → Ready for Review → Approved
```

If a required criterion is open, the gate shows **GATE NOT READY** and names exactly what is missing.
The Design, Approval and UAT gates can only be approved by the Business Owner — the team that did the
work cannot sign off on its own work.

### Progress ≠ stage readiness

Progress is earned from milestone weight, never typed in:

```
completed milestone weight + (weight × own completion for milestones in progress)
─────────────────────────────────────────────────────────────────────────────────
                            total milestone weight
```

The workspace shows the arithmetic ("3 of 8 milestones completed… plus 1.5 weight part-complete"), and
next to it the gate verdict. A project can be **Development · 45% · Development Gate NOT READY —
major known bugs unresolved**. Those are two different facts and the UI keeps them apart.

### Health — four states, independent of stage and progress

| State | Meaning |
|---|---|
| **ON TRACK** | Every committed milestone is on its planned date |
| **AT RISK** | Something may move the date: a decision pending, a slip already absorbed, a near date at low completion |
| **DELAYED** | A milestone has passed its committed date |
| **BLOCKED** | Work cannot continue until a specific, named person clears something |

So a project can legitimately read `Development · 45% · BLOCKED`.

### Overdue is not the same as blocked

When a milestone passes its date the system asks *why* — reason category, description, delivery impact
and the person responsible for recovery. Recording a delay revises the committed date and moves the
project delivery date. It does **not** mark the project blocked. A blocker is a separate, optional
record created only when work genuinely cannot continue, and it carries its own owner and required action.

### Execution delay vs approved scope change

Every day of slippage is attributed. The workspace "Delivery date, explained" card shows:

```
Original commitment 30 Sep 2026  →  Current expectation 08 Oct 2026
  API credentials unavailable          Execution delay        +3d
  Add Bengali language support         Approved scope change  +5d
```

Management can therefore tell the difference between *we were slow* and *the business asked for more*.

### Baseline vs committed dates

Milestones keep their original `baselineDue` forever and a `dueDate` that moves only through a recorded
delay or an approved scope change. Variance against baseline is shown in the milestone table, so a
revised plan never hides the original promise.

---

## Roles

One application, five perspectives (switch in the top bar):

- **Management** — portfolio status, delays, delivery dates, decisions needing attention. Reads; does not evidence or approve gates.
- **AI Team Lead / PM** — all projects, assignment, priorities, escalation; approves the delivery-side gates.
- **AI Analyst** — discovery, requirements, progress, stakeholders, blockers.
- **Developer** — assigned work, development updates, blockers, deliverables.
- **Business Owner** — reviews requirements and design, gives feedback, performs UAT, approves scope changes and closure.

The prototype switches *perspective*, not user accounts. In a deployment each person would see only the
projects they are named on.

---

## The prototype journey

The floating **Prototype journey** panel tracks nineteen states and ticks itself off from the real
project state — it is a guide, not a script. The full path:

1. **Dashboard** → see the portfolio and what needs attention
2. **Projects → New project** → the HR AI Assistant example is pre-filled → **Create project**
3. Project opens at *Idea / Request*, 0%, with the standard delivery plan generated from the delivery date
4. **Timeline & Gates** → intake criteria are met → **Submit for review** → **Approve stage** → *Discovery*
5. **Start discovery work**, tick the four discovery exit criteria, submit, approve → *Requirements & Design*
6. Tick the four design criteria, submit → the gate now waits on the **Business Owner** (switch role in place) → approve → *Approval*
7. Tick the business commitment criteria, submit, approve → *Development*
8. **Start development** → the developer's logged progress puts the project at **45%**
9. Top bar → **Prototype date → +14 days** → 22 Sep 2026: **API Integration is overdue by 2 days**
10. **Milestones & Tasks** → **Record delay** → *Integration dependency*, +3 days, responsible person → the milestone date is revised and delivery moves to 03 Oct
11. The delay dialog offers to raise a blocker → **API credentials unavailable**, owned by the IT Lead → the project turns **BLOCKED**
12. **Dashboard** → HR AI Assistant now leads *Attention required* with the blocker, the owner, the action and the impact
13. **Blockers & Changes** → **Mark resolved** (the dialog states exactly what will change) → health returns to **AT RISK**, the milestone resumes
14. Optional: **Request change** → *Add Bengali language support* (+5 days) → approve as Business Owner → delivery moves to 08 Oct, attributed to scope
15. Development gate → submit → approve → *Internal Testing* → gate → *UAT*
16. **UAT & Approvals** → **Add feedback**, tick the UAT criteria, submit → **Business Owner approves** → *Deployment*
17. **Mark as deployed** with a release reference → approve the deployment gate → *Stabilization*
18. Stabilization: log or clear production issues → evidence and approve the closure gate → **Close project**
19. **COMPLETED — 100%**, with outcome, deployment reference and the full approval history. The dashboard and portfolio update accordingly.

### The prototype clock

The app runs on a fixed date (08 Sep 2026) so the demo is reproducible, and the top-bar date control
lets days actually pass. Advancing the clock re-evaluates every project, flips passed milestones to
*Delayed* and raises the notifications management would receive — overdue is a consequence of dates,
not a toggle.

---

## Architecture

```
src/
  domain/      types · lifecycle & gate definitions · derived logic · templates · seed data
  api/         simulated transport (latency, failure injection) + endpoint surface
  store/       one reducer, one state tree, serialised commands, persistence
  components/  design system primitives + app shell
  screens/     dashboard · portfolio · create · workspace (7 tabs) · my work · approvals · notifications · settings
  demo/        the prototype journey panel
```

- **One state tree.** Every action — `create_project`, `toggle_criterion`, `submit_gate`, `decide_gate`,
  `record_delay`, `create_blocker`, `resolve_blocker`, `decide_scope_change`, `mark_deployed`,
  `close_project`, `advance_clock` — is a reducer case that updates stage, milestones, blockers,
  approvals, activity and notifications *together*. The dashboard cannot disagree with the workspace
  because both read the same derived selectors.
- **Nothing important is stored twice.** Health, progress, gate readiness, next milestone and next action
  are computed in `domain/logic.ts` from the underlying records.
- **API-shaped.** Screens never mutate state directly; they call `run(command)`, which goes through
  `api.command()` with latency and can be made to fail (Settings → *Simulate an API failure*) to exercise
  the error path. Swapping the simulated transport for `fetch` is the only change a real backend needs.

### Data model

`Users`, `BusinessUnits`, `Departments`, `Projects`, `ProjectStageHistory`, `StageGates`,
`StageGateCriteria`, `Milestones`, `Tasks`, `Blockers`, `ScopeChanges`, `Files`, `Approvals`,
`ActivityLogs`, `Notifications` — declared in `src/domain/types.ts` and listed with their key fields on
the Settings screen.

```
Project
 ├── Stage history          ├── Blockers
 ├── Stage gates            ├── Scope changes
 │    └── Criteria          ├── Files & deliverables
 ├── Milestones             ├── Approvals / UAT
 │    └── Tasks             ├── Activity log
 └── Stabilization issues   └── Notifications
```

---

## States beyond the happy path

Loading skeletons on first load, a portfolio error state with retry, empty states for no blockers,
no tasks, no deliverables, no filtered results and no pending approvals, disabled actions with the
reason attached, confirmation dialogs on every consequential action (gate approval, blocker resolution,
scope approval, project closure), inline validation on the intake and blocker forms, and an error path
that leaves state untouched.

Accessibility: status is always colour **plus** a word or glyph (`■ BLOCKED`, `◆ DELAYED`, `✓ COMPLETED`),
focus is visible, dialogs close on `Escape`, controls are labelled, and the layout reflows to tablet
and phone widths (desktop 1440 is the design target).

---

## Deliberately not included

No Kanban board, no AI agents or chatbot, no finance, attendance, source control, QA suite, resource
planning or ERP integration. Anything that does not help management see and unblock delivery was left out.

---

## Demo data

Every person, department, project and figure in this prototype is **fictional**, created for
demonstration purposes. They are not real Anwar Group employees or records.
