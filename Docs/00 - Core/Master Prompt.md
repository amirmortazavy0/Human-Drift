# Human Drift / Pist — Master Prompt

## Product

Human Drift is an R&D product about plan-execution drift. User-facing name: **Pist**.

Core loop:

**Plan → Reality → Drift → Understanding → Adaptation**

Pist preserves the difference between what was planned and what actually happened. It is not primarily a productivity app, task manager, habit tracker, or calendar.

## Locked product language

| Concept | User-facing term |
|---|---|
| Product | Pist |
| User | Drifter |
| Universal object | Thing |
| Intention | Plan |
| Session | Tracking |
| SessionEntry | Log / Entry |
| Natural-language logging | Quick Log |
| Analytical interface | Ask / Ask Pist |
| Gap between Plan and Reality | Drift |

Do not expose Journey, Node, Session, SessionEntry, Intention, Commitment, Thread, internal event names, or storage filenames as product terminology. Internal code may retain those names.

## Domain model

Internal model:

**Journey → Node → Session → SessionEntry**

with Condition as contextual state.

User-facing translation:

**Thing → Thing → Tracking → Log**

There is no artificial hierarchy depth and no fixed Project → Task model. Do not create separate domain models for different use cases.

## Plan and Reality

The original Plan is preserved.

If the Plan changes:

- preserve the original
- record the revision
- preserve timing when known
- preserve the reason when known
- never silently overwrite history

Logs record Reality. Historical records must remain auditable.

Prefer **append → correct → supersede** over overwrite or erase.

## Evidence and Drift

Keep these separate:

**Observed fact → Recorded event → Derived state → Inference**

Drift is the evidence-supported gap between Plan and Reality. It is not automatically failure, lateness, inactivity, pausing, or a Plan change.

Do not present inference as fact.

## Architecture

Current architecture is hybrid:

**stored current state + append-only historical event/audit log**

Do not replace it with pure event sourcing without an explicit architectural decision.

Preserve the existing technology stack and architecture unless there is a concrete reason to change it. Avoid unnecessary migrations, abstractions, frameworks, and rewrites.

## Current implementation priorities

### P0 — Broken core behavior

1. Create Thing through the UI and persist it.
2. Logs must persist and appear on the Board.
3. Start Tracking must perform the complete UI → API → state → history → persistence flow.
4. Fix backend 500 errors at their root cause.
5. Export must work end-to-end without misleading success/error UI.

### P1 — Product language and UX

Use the locked vocabulary. Use local display time. Focus and Energy are editable contextual observations. Work Type choices must be meaningful.

### Out of scope unless explicitly requested

- location detection
- Drift Mode
- social/community
- advanced Ask intelligence
- major Audit Trail redesign
- speculative automation
- unnecessary profile/settings complexity

## Testing

Verify in this order:

1. Typecheck
2. Lint/static checks
3. Build
4. Targeted tests
5. API/integration behavior
6. Browser/UI behavior

Never claim a test passed unless it was actually run.

For failures:

**reproduce → locate layer → inspect error → find root cause → fix → re-test**

## Documentation synchronization

Code and active documentation must remain synchronized.

When a product or architecture decision changes, update the relevant active files under `Docs/`, including this Master Prompt and `Docs/03 - Architecture/Architecture Decisions.md` when architecture is affected.

Preserve historical decisions. Mark superseded decisions rather than deleting history.

## Definition of done

A change is complete only when:

- requested behavior works
- user-facing terminology is correct
- relevant static checks/build/tests pass
- API/UI behavior is verified where applicable
- Plan and Reality remain distinguishable
- historical data is preserved
- no unnecessary architecture was introduced
- relevant documentation is synchronized

## Fundamental rule

**When choosing between making Pist look correct and making it accurately represent reality, choose accurate representation of reality.**

Always preserve the difference between:

**what was planned**

and

**what actually happened.**
