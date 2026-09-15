# Glossary — Human Drift

Definitions of terms used consistently across the vault.
When a term appears in a document, it means exactly what is defined here.

---

**Program**
An ongoing human intention with duration, context, and meaning. More than a task. A Program has a start, a success definition, a completion state, and a drift detection mechanism. Example: "Study train performance for 30 days."

**Session**
One instance of a Program's recurring activity. Example: one train journey.

**Stop**
A timestamped event at one station within a session.

**Drift**
The gradual, often unconscious departure from a stated intention. Not a single failure — a pattern of displacement over time.

**Drift Detection**
The act of identifying that drift is occurring early enough to act on it. The core technical problem Human Drift solves.

**Event**
An atomic unit of what happened. Fires when context conditions are met. Logged regardless of whether an action follows. Named in dot notation: `subject.verb_past_tense`.

**Context Signal**
A real-world condition the system observes to understand the current situation. Examples: location within a geofence, motion pattern, time of day.

**Confidence Score**
A 0–100 composite score representing how certain the system is about a detected context. No autonomous action fires below the threshold defined per Program.

**Autonomous Action**
Something the system does without asking the user each time. Always references the event that triggered it and the permission that authorized it.

**Permission**
User authorization for a category of autonomous action. Granted at Program approval time — never retroactively. Three levels: Always Ask, Ask Once, Automatic.

**Historical Log**
An immutable, append-only record of every event and autonomous action. The source of truth. Never modified — only appended to.

**Correction**
A user amendment to a previously logged value. The original is always preserved. The correction is layered on top. Both are visible.

**Conflict**
A detected contradiction in logged data. Always surfaced to the user. Never silently resolved by the system.

**Completion**
The defined end state of a Program. Can be: success (goal achieved), explicit abandonment (user decided to stop), or drift (program expired without conscious decision).

**Stage (Research)**
A phase of the research process. Stages 0–6 defined in `01 - Research/Research Plan`.

**Phase (Development)**
A phase of the development process. Phase 1: Python web app. Phase 2: enhanced UX. Phase 3: autonomous context detection.

---

*Terms added in Domain Model v1 (2026-09-14):*

**Journey**
Any long-lived intention that unfolds through time. The top-level container in the unified domain model. Journey-001 (train commute) and Journey-002 (R&D work) are both Journeys. The model does not distinguish between them by type — only by the Nodes they contain.

**Node**
Any unit of work at any level of the hierarchy. A Node can be a Route, a Station, a Project, a Task, a Milestone, or a Note. Its meaning comes from its position in the tree and its `node_type`, not from a separate entity per level.

**SessionEntry**
A single logged event within a Session — the moment of the tap. The generalized equivalent of a Stop from Journey-001. Every tap produces a SessionEntry with a timestamp and a Condition snapshot.

**Condition**
A snapshot of the user's circumstances at the moment of a SessionEntry. Captures energy, focus, location, and environment. Uses sticky defaults — fields carry forward from the last entry and only update when something changes.

**Intention**
A declaration of what the user plans to accomplish, written at Session start and locked immediately. Intention is immutable — if it changes mid-session, a revision event is logged and both versions are preserved.

**Discovery**
A first-class event type. When something new surfaces mid-session that was not planned, logging it as a Discovery creates a new Node and records the lineage — what was being worked on when the idea appeared. A Discovery is not just a note. It is evidence of scope emergence.

**Drift Classification**
An inference layer applied to accumulated session evidence. Drift types (Execution, Scope, Priority, Discovery, Context Shift) are never assigned by the user — they are patterns the system recognizes over time. In Phase 1, evidence is collected. Classification comes later.

**Node Lifecycle**
The states a Node moves through: PLANNED → ACTIVE → PAUSED → DORMANT → COMPLETE. There is no ABANDONED state. Inactivity is recorded in the event log. Whether inactivity constitutes abandonment is an inference, not a label.
