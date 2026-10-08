# Spec 15: OpenDot Organisation

An **organisation** is a team of Dots, one per domain (Engineering, Security, HR, Admin, Finance, ...), led by SuperDot acting as a
project manager. The user gives SuperDot a request ("add single sign-on for our customers"). SuperDot writes a plan, the user
approves it, and the work is split across the domain Dots, who each use the skills (playbooks) of their domain. Work is
reviewed, tracked on a board, and reported back.

Everything is built from parts OpenDot already has: Dots, roles, Dot Links (RBAC), approvals, budgets, `LinkBus`, SuperDot's
tools and the daily briefing's way of running a hidden SuperDot turn. The shared types and helpers live in
`src/shared/organisation.ts` (read it first), and the IPC contract is the `org` namespace in `src/shared/ipc.ts`.

## 1. Concepts

| Term | Meaning |
|---|---|
| **Domain** | A department: `engineering`, `product`, `design`, `security`, `it`, `data`, `hr`, `admin`, `finance`, `legal`, `marketing`, `sales`, `support`. Built in (`OrgDomain`). The domain id is also stored in the Dot's `roles`, together with the role `org`. |
| **Member** | A Dot that belongs to the organisation (`OrgMember`: Dot id, domain, skill ids). Members are ordinary Dots: they have their own chat, model, connections and approvals. |
| **Template** | A starting team: `startup`, `software-team`, `small-business`, `full`. Applying one creates the Dots. |
| **Skill** | A markdown playbook ("how we ship a change", "how we screen a CV"). Built-in skills ship with the app; users add and edit their own. Each member has a list of skills. |
| **Project** | One request from the user, with a plan of tasks. |
| **Task** | One unit of work for one member (or for the user), with dependencies, an optional reviewer and deliverables. |

## 2. Data on disk (under `~/.opendot`)

```
organisation/org.json              { name, templateId?, members: OrgMember[] }
organisation/skills/<id>.md        user skills: frontmatter (name, description, domain) + markdown body
organisation/projects/<id>/project.json   OrgProject (atomic writes like the rest of the store)
```
Built-in skills are bundled as TypeScript modules (no loose files to package) and are read-only; "Edit" on one saves a copy.
Deliverable files are written by the Dots inside their own workspace: `dots/<dotId>/workspace/projects/<projectId>/<taskId>/`.

## 3. Domains, templates, team setup (`src/main/organisation/catalog.ts`, `team-service.ts`)

- `catalog.ts` exports `ORG_DOMAINS: OrgDomain[]`, `ORG_TEMPLATES: OrgTemplate[]` and, for each domain, the persona text used to create its Dot
  (see §3.2). Templates: `startup` (engineering, product, design, security, marketing, finance, admin), `software-team`
  (engineering, product, design, security, it, data), `small-business` (admin, finance, hr, sales, marketing, support, legal),
  `full` (all 13).
- `org.setup({ templateId, name?, domains? })` creates one Dot per domain through `DotService.create` (see how the New Dot flow and
  `src/main/dots/templates` build a persona; use the same `Persona` shape, no model call). Rules:
  - Name = the domain name ("Engineering"), icon and colour from the domain (`OrgDomain.icon`, a key from the Dot icon set), `roles: [domain, "org"]`, tagline from the domain.
  - Skip a domain that already has a member. Idempotent: running setup twice must not duplicate Dots.
  - Grants: `engineering`, `it` and `data` get the built-in computer connection (This Mac / This PC) with files and shell if it is available (use the same
    grant shape the app already uses for Dots created with that connection); every other domain gets files only. All other connections stay off, so the user decides
    what each Dot may touch. Dangerous tools still go through approvals (the Approvals inbox).
  - Members start with the domain's built-in skills.
  - Seed Dot Links: one rule `role:org -> role:org`, allow, approval `auto`, `maxPerHour` 30, `sharePii: false`, purpose "Organisation teamwork" (create only if no
    identical rule exists). SuperDot's existing seeded rule already covers `super -> any`. Look at `src/main/links` and the links store for the real rule shape.
  - Returns the new `OrgState`, emits `org:state`.
- `org.addMember({ domain, dotId? })` adds one domain (creating the Dot, or adopting the given Dot: add the roles, keep everything else).
  `org.removeMember` only removes the membership and the `org`/domain roles; it never deletes the Dot.
- The `OrgDomain.reviewedBy` hints are used only by the planner prompt (e.g. engineering work is reviewed by security).

### 3.2 Personas
Each domain Dot gets a persona whose role text is 3 to 5 sentences: what the domain owns, how it works with others, what it escalates, and the
**task protocol** (§6.1) in one short paragraph, so a Dot behaves well even when asked outside a project. Keep voice defaults from the New Dot flow.

## 4. Skills (`skill-service.ts`, `builtin-skills/*.ts`)

- A skill = `{ id, name, description, domain?, body }`. Built-in ids are prefixed `builtin:` (e.g. `builtin:engineering-ship-a-change`).
- Ship at least two built-in skills per domain, plus shared ones (`builtin:write-status-update`, `builtin:break-down-a-request`). Each is a **useful
  playbook of 120 to 300 words**: when to use it, steps, what a good result looks like, what to ask the user before acting. Examples:
  engineering: ship-a-change (branch `opendot/<project>-<task>`, small commits, tests, summary of what changed and how to verify; never push without approval),
  code-review; security: threat-review, dependency-audit; hr: job-description, onboarding-checklist; admin: meeting-notes-and-actions, vendor-onboarding;
  finance: budget-check, expense-review; legal: contract-review (always states it is not legal advice); product: write-prd, prioritise;
  design: ux-review, design-brief; it: access-request, incident-runbook; data: metric-analysis, data-quality-check; marketing: launch-announcement,
  content-calendar; sales: outreach-draft, account-brief; support: triage-ticket, write-help-article.
- **Injection:** an inline extension on every member's session (see `runtime/extensions/*` and how `superbot.ts` sets `sections`) adds a prompt section
  `skills` listing `- <name>: <description>` for the member's skills, and registers a read-only tool `use_skill({ name })` that returns the body. The full body is
  never in the prompt (the Dot loads it when it needs it). Rebuilt each turn, so edits apply immediately. A Dot with no skills gets no section and no tool.
- Skills are plain text from the user's own folder; the tool result carries the note "These are the organisation's own instructions."
- IPC: `org.skills`, `org.skill`, `org.saveSkill` (editing a built-in creates a copy with a new id and returns it), `org.deleteSkill` (built-ins can't be deleted;
  deleting a user skill also removes it from members). Emit `org:skills` after changes.

## 5. SuperDot as project manager: tools (`runtime/extensions/organisation.ts`, registered on the Super session only)

```ts
org_team()                                  // read-only: members (name, domain, skills, what they know) and the user as "human"
create_project({ title, brief })            // creates the project and starts planning; returns the project id and where to see it
propose_plan({ projectId, note, tasks })    // the planner's output (only valid while the project is "planning")
project_status({ projectId? })              // read-only: status, tasks, who is waiting on whom
```
- `propose_plan.tasks[]` = `{ id, title, brief, assignee (Dot name or "human"), dependsOn[], reviewer? (Dot name or "human") }`. The tool resolves names to
  Dot ids, runs `validatePlan`, and on problems returns them as an error text so the model fixes the plan in the same turn. On success it saves the plan, sets
  status `awaiting-approval`, emits `org:project`, and posts an `orgUpdate` message (kind `plan-ready`) to SuperDot's chat.
- Super's persona/prompt gets an "organisation" section when an organisation exists: "For a request that needs several people, call create_project. For quick
  questions keep using ask_dots." (Do not change behaviour when no organisation exists.)
- **Planner turn:** `ProjectService.plan(project, feedback?)` runs a hidden SuperDot turn (copy how `BriefingService` delivers a hidden `opendot.briefing` custom
  message) with the planner prompt: the brief, the team directory with skills, and these rules: 3 to 12 tasks, each owned by exactly one member, independent tasks
  have no dependencies so they run in parallel, every engineering task has a reviewer from `reviewedBy` (or the user for anything risky or irreversible),
  tasks for the user are `human`, each brief states what "done" means, call `propose_plan` exactly once. If the turn ends with no plan, the project returns to
  `awaiting-approval` with an empty plan and a log line, and the user can ask to replan.
- `create_project` called from chat creates the project, runs the planner in the background, and returns text like "Planning "X". Open Organisation to review the plan."
  The user can also create projects from the Organisation screen (`org.createProject`), which does the same thing.

## 6. Running a project (`project-service.ts`, `runner.ts`)

**State machine.** Project: `planning` → `awaiting-approval` → `running` ⇄ `paused` → `done` | `failed` | `cancelled`. Task: `pending` → `running` →
(`needs-input` ↔ `running`) → `review` → `done`, or `failed` / `skipped`.

**Scheduler** (runs only while the project is `running`): every time something changes, start every task in `readyTaskIds(tasks)` up to `concurrency`
(default 3). Human tasks are never started; they wait until the user calls `completeTask`. When a task fails, tasks that depend on it can never start
(`blockedByFailure`): mark them `skipped` with a note, and when nothing can progress the project becomes `failed` (statusNote says why) unless the user retries/skips.
When every task is `done` or `skipped` the project is done: SuperDot writes the final report (`summary`) with a normal hidden turn that lists what was delivered,
where, what needs the user, and any task that was skipped, then posts an `orgUpdate` (kind `done`) and a notification.

**6.1 Task protocol.** A task runs as a message from SuperDot to the assignee through `LinkBus.send(superDot, assignee, prompt, [superId], { signal, onDelta })`, so
Dot Links rules, approvals, budgets, PII masking and the audit log apply exactly as for any Dot-to-Dot message (look at how `ask_dots` calls it; pass a long
timeout of `ORG_LIMITS.taskTimeoutMin` minutes for tasks instead of the normal reply timeout, adding an option to `LinkBus.send` if needed). Prompt:

```
Task from the project "<title>" (task <id> of <n>): <task title>

Project request: <project brief>
What to do and what "done" means: <task brief>

Work you can build on (from tasks this one depends on):
## <dep title> (<assignee name>)
<dep result, trimmed to ~1500 chars, plus the deliverable names>

Put files you create in your workspace under projects/<projectId>/<taskId>/ and mention each one by name.
Reply when finished. Start your reply with [DONE] and say what you did and where to find it.
If you cannot continue without the user, start with [BLOCKED] and ask one clear question.
<if revision> The reviewer asked for changes: <notes>. Fix them and reply the same way.
```
Reply handling uses `parseTaskReply`: `[BLOCKED]` → status `needs-input`, `question` set, notification + `orgUpdate` (kind `needs-input`); otherwise → `result` set,
deliverables collected (below), then review (§7) or `done`. A timeout, an error from the bus (blocked by Dot Links, over budget, ...) or a stopped Dot → `failed`
with `error` in plain words. `answerTask` sends the user's answer as the next message in the same link session (the Dot remembers the context) and sets `running`.

**Deliverables.** After a task reply: list files that are new or changed under the assignee's workspace folder `projects/<projectId>/<taskId>/` (recursive, max 50,
ignore hidden files) and add them as `kind: "file"` deliverables with a path relative to the workspace; keep earlier ones if the same path is rewritten.
`openDeliverable` resolves the path, **must be confined to that Dot's workspace** (use the existing path guard, reject `..`, symlink escapes and absolute paths) and
opens it with the OS only for safe document types, otherwise reveals it (reuse the `isOpenSafe` rule from the attachments feature).

**Budget and limits.** `spentUsd` is the sum of the cost of each task turn (read it from the usage service the way `usage.ts` records turn cost; if per-turn
cost is not available, use the difference of the assignee's usage cost before and after). If `budgetUsd` is set and spending reaches it, pause the project with
`statusNote` "Budget reached" and an `orgUpdate` (kind `paused`). Never start more than `concurrency` tasks. Cancel aborts running tasks (abort signal) and marks
unfinished tasks `skipped`. Pause lets running tasks finish their current turn, and starts nothing new.

**Restart.** On app start every project that was `running` becomes `paused` with statusNote "OpenDot was closed. Resume when you're ready.", and its `running`
tasks go back to `pending` (attempt unchanged). Nothing runs without the user.

**Log.** Append `OrgLogEntry` lines (cap `ORG_LIMITS.logMax`) for starts, finishes, reviews, questions and errors. Never log message contents or file contents:
titles, names and counts only.

## 7. Review gate

- A task with a `reviewer` goes to `review` after the assignee's `[DONE]`. A Dot reviewer is sent (via `LinkBus`, from SuperDot) the task brief, the assignee's result
  and the deliverable names (plus the text of small text deliverables, ≤ 6000 chars), and told: "Reply [APPROVE] and a one-line reason, or [CHANGES] and a numbered list
  of what must change." `parseReviewReply` decides: approved → `done`; changes → record the review, increment `attempt`, and send the notes back to the assignee
  (same link session) as a revision; unclear → hand to the user (`reviewer` treated as human for this round).
- After `maxRevisions` rounds of requested changes the task is handed to the user (a human review with the whole history).
- `reviewer: "human"`: the task waits in `review` until `reviewTask(approved | changes, note)`. "changes" with a note re-runs the assignee as a revision.
- A reviewer can't be the assignee (validated). Reviews are stored in `task.reviews`. Use the `orgUpdate` kind `needs-review` + a notification for human reviews.

## 8. Status in SuperDot's chat and notifications

- `orgUpdate` messages are custom messages `opendot.org-update` (display true) added to SuperDot's transcript; map them in `runtime/views.ts` to
  `ChatMessageView.orgUpdate`; the renderer shows a compact card with a button that opens `#/organisation/<projectId>`.
- Notifications (one per event, via the existing `notify` bridge with `hash: "#/organisation/<id>"`): plan ready, a question for the user, a human review or
  human task is ready, project done, failed or paused. Use the Approvals notifier's coalescing idea if several arrive within 10 s (optional).
- The daily briefing prompt gets one extra line when projects are active: "Active projects: <title> (3 of 7 done, 1 waiting for you)". (Small, additive change in `briefing/prompt.ts`.)

## 9. IPC behaviour notes

- Every mutating channel validates the project/task state and throws `OpenDotError` with a plain-language message when the action isn't allowed
  (e.g. `savePlan` outside `awaiting-approval`, `approve` with problems from `validatePlan`, `answerTask` on a task that isn't `needs-input`).
- `savePlan` replaces `tasks` (new tasks get `status: "pending"`, `attempt: 0`, empty reviews/deliverables), runs `validatePlan`, and emits `org:project`.
- `approve` requires a valid plan and status `awaiting-approval`; it sets `running` and starts the scheduler. `replan` is allowed in `awaiting-approval` only.
- `retryTask` (failed or skipped → pending, attempt reset) and `skipTask` (pending/failed/needs-input → skipped) re-evaluate the scheduler. `deleteProject` is only for finished projects.
- Emit `org:project` (full `OrgProject`) after every change and `org:state` after team changes. Throttle project events to at most one per 100 ms per project.

## 10. Screens (`src/renderer/src/features/organisation/`, spec 09 and 10 for the look)

Route `#/organisation` with sub-routes `#/organisation/<projectId>`, `#/organisation/team`, `#/organisation/skills`. NavRail item "Organisation" (icon: a small
grid of dots / building; badge = sum of `attention` over projects). Tabs at the top of the screen: **Projects**, **Team**, **Skills**.

1. **Set-up (no organisation yet):** a welcoming empty state with the four templates as cards (name, one line, the domain avatars), a "Choose domains" option
   (tick list), and "Create my team". After creating: land on Projects with a short "Try: Ask SuperDot to ..." suggestion.
2. **Projects:** list of project cards (title, status chip, progress "3 of 7", attention badge, spend), "New project" dialog (title, brief textarea, optional budget).
   Creating opens the project, which shows a "SuperDot is planning..." state (skeleton rows) until the plan arrives (`org:project` events).
3. **Project detail:**
   - Header: title, status chip, pause / resume / cancel, spend vs budget, back link. `statusNote` shown as a callout.
   - **Plan review (`awaiting-approval`):** SuperDot's `plannerNote`, then an editable task list: title, brief, assignee picker (members + "Me"), reviewer picker, depends-on
     multi-select, move up/down, remove, add task; live validation using `validatePlan` shown inline; buttons **Approve and start**, **Ask SuperDot to replan** (with a
     feedback box), **Save changes**.
   - **Board (running and after):** columns To do (pending), In progress (running, needs-input), In review, Done (done, skipped, failed shown with a red mark). Cards: title,
     assignee avatar+name, dependency count, attempt badge. A toggle switches to a simple list. Clicking a card opens a **task drawer**: brief, status, assignee,
     result (markdown), deliverables (open/reveal), review history, the question with an answer box (`needs-input`), review actions for human reviews (Approve / Request
     changes with note), "I did this" for human tasks, Retry / Skip for failed tasks.
   - **Activity** section: the log, newest first. **Summary** card when done (SuperDot's report in markdown).
   - Live updates through `org:project`; keyboard accessible; works in light and dark.
4. **Team:** grid of members (avatar, name, domain, skills as chips, link "Open chat" → `#/chats/<dotId>`), "Add a domain" (picker of catalog domains not yet present, plus
   "Use an existing Dot"), per-member skills editor (multi-select from the library), remove from organisation.
5. **Skills:** library grouped by domain with search; built-ins marked and read-only (Duplicate to edit); editor with name, description, domain, markdown body; delete for user skills.
6. **Chat:** `orgUpdate` cards in SuperDot's chat (`MessageBubble`): compact card with the project title, the update text, and "Open project". SuperDot's empty-state suggestions
   gain "Plan a project with my team" when an organisation exists.

## 11. Security and privacy

- All inputs validated (zod schemas in `schemas.ts`); the renderer never passes file paths for reading, only project/task ids and a deliverable index.
- Deliverable access is confined to the assignee's workspace (path guard). Skills are text; they can't run anything by themselves.
- Task runs go through Dot Links and approvals like any Dot action: a Dot that wants to send an email, delete a file or run a command still waits for the user in the Approvals inbox.
- Cloud models only see what the existing PII masking allows; logs hold titles and counts only.
- Cost is bounded by `concurrency`, `maxRevisions`, `ORG_LIMITS.maxTasks`, the per-Dot budgets and the optional project budget. Nothing runs before the user approves a plan.

## 12. Tests

- Unit (Vitest, next to the code): catalog integrity (every template domain exists, every domain skill exists, ids unique); team setup idempotency and role/rule seeding;
  skill service (built-in read-only, copy on edit, delete removes from members, frontmatter round-trip); skill injection extension; scheduler (dependency order,
  concurrency cap, parallelism, failure propagation, pause/resume/cancel, restart → paused); task protocol parsing; review loop (approve, changes, max revisions, unclear → human);
  deliverable collection and path confinement (traversal, symlink, absolute, Windows paths); budget pause; `propose_plan` tool validation errors; project persistence round-trip.
- E2E (Playwright Electron, fake provider, `test/e2e/organisation.spec.ts`): set up a team from a template and see the Dots; create a project, see the scripted plan arrive,
  edit a task, approve, watch tasks run in dependency order and parallel where possible, see a deliverable file, answer a `[BLOCKED]` question, request changes in a human
  review and see a revision, finish with a summary and a SuperDot chat card. Use the fake provider's scripting (see `test/fixtures/fake-scripts`, `OPENDOT_FAKE_SCRIPTS_DIR`).
