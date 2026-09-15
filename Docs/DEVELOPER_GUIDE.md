# Human Drift — Developer Guide

**Status:** Living Document  
**Audience:** Developers, contributors, future maintainers  
**Current stage:** R&D prototype / domain validation

> Human Drift is an R&D project about **plan-execution drift**: preserving what a person originally intended while reality changes around them.

The most important principle for anyone working on this project is:

> **When choosing between making Human Drift look correct and making it accurately represent reality, choose the second.**

---

# 1. The Source of Truth

Human Drift has three layers:

```text
Obsidian Vault
    ↓
Product/domain/architecture knowledge

Developer Guide
    ↓
Developer onboarding and repository rules

Source Code
    ↓
Current implementation
```

The **Obsidian Vault is authoritative** for the project's domain, philosophy, product decisions, research, and architecture.

If code conflicts with an authoritative Vault document, the code is wrong unless the decision has explicitly been changed in the Vault.

## Read first

A developer should read these documents before making substantive changes:

1. `00 - Core/Domain Model v1.md`
2. `03 - Architecture/Architecture Decisions.md`
3. `03 - Architecture/Event Schema v1.md`
4. `00 - Core/Vision & Philosophy.md`
5. `00 - Core/Core Loop.md`
6. `02 - Product/Product Principles.md`
7. `02 - Product/Software Concept & Requirements.md`
8. `04 - Development/Prototype Spec v1.md`
9. `04 - Development/Phase 1 - Python Web/Phase 1 Action Plan.md`
10. The relevant User Journey and Research documents

Do not rely on `_History/` documents when a current document supersedes them.

---

# 2. What Human Drift Is

Human Drift is both:

- a research project investigating why people and organizations drift from what they planned;
- an emerging product intended to preserve continuity of human intention over time.

It is **not primarily**:

- a task manager;
- a productivity optimizer;
- a habit tracker;
- a calendar;
- a checklist.

The long-term product vision is a context-aware system that understands what matters to a person, observes reality, distinguishes intentional change from unconscious drift, and supports adaptation without rewriting history.

---

# 3. The Fundamental Model

The universal domain model is:

```text
Journey
   ↓
Node
   ↓
Session
   ↓
SessionEntry
   +
Condition
```

These are the domain nouns.

The Core Loop is different: it describes what the product does over time.

```text
Intention
→ Understanding
→ Plan / Support Model
→ Approval / Permission
→ Context Detection
→ Events / SessionEntries
→ Autonomous or Assisted Actions
→ Historical Log
→ Analysis / Learning
→ Completion / Adaptation
```

Do not confuse the Core Loop with the Domain Model.

---

# 4. Journey

A Journey is a long-lived context.

Examples:

- Train Performance Study
- R&D Work
- Learning
- A long-running personal objective

A Journey is not necessarily a project.

---

# 5. Node

A Node is the universal unit of work/structure inside a Journey.

Current Node types include:

```text
ROUTE
STATION
PROJECT
TASK
MILESTONE
NOTE
```

A Node can contain child Nodes.

There is **no artificial maximum depth**.

Example:

```text
Journey: R&D Work
├── Project: Human Drift
│   ├── Milestone: Domain Model
│   │   ├── Task: Event Schema
│   │   └── Task: Session Model
│   └── Task: Prototype
└── Project: Other Research
```

Do not create separate domain models such as:

```text
ProjectTask
ResearchTask
TrainStation
MilestoneTask
```

when the unified Node model can represent the case.

---

# 6. Session

A Session is a working period.

A Session:

- belongs to a Journey;
- references Nodes;
- can touch multiple Nodes;
- contains SessionEntries.

A Session is **not owned by one Node**.

Correct:

```text
Journey
   ↓
Node A ←── Session ──→ Node B
```

Incorrect:

```text
Node
  ↓
Session
```

This distinction preserves continuity when a person moves between activities during one working period.

---

# 7. Session Intention

A Session has an intention declared at the beginning.

The original intention is immutable.

If the user changes direction, record a revision:

```text
Original intention
        ↓
Intention revision
        ↓
Reality
```

Never silently replace the original intention.

Example:

```text
Original:
Write API documentation.

Later:
Prioritize fixing authentication.

Reason:
Authentication problem discovered.
```

The system must preserve the fact that the first intention existed.

---

# 8. SessionEntry

A SessionEntry is the atomic unit of evidence during a Session.

Examples include:

- starting a Node;
- completing a Node;
- pausing a Node;
- switching context;
- logging a discovery;
- adding a note;
- recording a meaningful observation.

Events and entries are evidence.

They are not automatically interpretations.

---

# 9. Condition

Condition records contextual state at an entry.

Examples:

```text
Energy
Focus
Location
Environment
```

Conditions help explain what was happening around an observation.

Do not turn Condition into a generic mood tracker.

---

# 10. Intention vs Reality

This is the central product distinction.

Example:

| Layer | Example |
|---|---|
| Intention | Write API documentation |
| Reality | Debug authentication |
| Interpretation | Possible execution drift |

The system must preserve the first two independently.

The third should be derived from evidence.

---

# 11. Evidence Before Inference

Keep these separate:

```text
Observed fact
    ↓
Recorded event
    ↓
Current / derived state
    ↓
Inference
```

Do not turn an inference into a fact.

Do not classify drift from one weak signal.

A missed action could mean:

- ordinary variation;
- temporary interruption;
- intentional reprioritization;
- changed intention;
- meaningful drift.

The system needs accumulated evidence and context before making such a distinction.

---

# 12. Historical Integrity

Human Drift must preserve history.

Prefer:

- append;
- correct;
- supersede.

Avoid:

- silent overwrite;
- deletion;
- rewriting history.

Corrections must preserve the original value.

Contradictions should be recorded and surfaced rather than silently resolved.

---

# 13. Event Architecture

The current architecture uses **hybrid storage**, not pure event sourcing.

This is an explicit Architecture Decision:

> Current state is stored directly. The Event Log is append-only and acts as the historical audit trail.

When stored state and the event log contradict each other, the event log wins and the discrepancy should be surfaced.

Do not replace this with pure event sourcing without a new architectural decision.

---

# 14. Event Log

The Event Schema is authoritative at:

`03 - Architecture/Event Schema v1.md`

Every meaningful mutation produces an event.

Examples:

```text
JOURNEY_CREATED

NODE_CREATED
NODE_UPDATED
NODE_MOVED
NODE_STATUS_CHANGED
NODE_CLOSED

SESSION_STARTED
SESSION_INTENTION_LOCKED
SESSION_INTENTION_REVISED
SESSION_COMPLETED

ENTRY_LOGGED
ENTRY_CORRECTED
DISCOVERY_CREATED
DISCOVERY_LINKED
CONDITION_CHANGED

CONFLICT_DETECTED
CONFLICT_RESOLVED
```

Events are immutable.

The Event Log is evidence of what happened and how current state came to exist.

---

# 15. Autonomous Actions

Human Drift may eventually take autonomous actions.

Those actions require:

1. sufficient context;
2. sufficient confidence;
3. appropriate permission.

The preferred pattern is:

```text
Event
 ↓
Understand context
 ↓
Determine whether action is warranted
 ↓
Check confidence + permission
 ↓
Act
 ↓
Record action in Historical Log
```

Never design autonomous behavior as:

```text
Event → immediate notification
```

The system should understand context before interrupting.

---

# 16. Historical Action Log

Autonomous actions are separately recorded in:

`03 - Architecture/Historical Action Log.md`

A user should be able to ask:

> "What did you do while I wasn't looking?"

and receive a complete, understandable answer.

Every autonomous action should record things such as:

- triggering event;
- program;
- action;
- permission basis;
- context;
- confidence;
- result;
- reversibility.

No hidden autonomous behavior.

---

# 17. Permission Model

Autonomous behavior currently has three conceptual permission levels:

```text
Always Ask
Ask Once
Automatic
```

Permissions are granted at Program approval time rather than at the moment an action becomes necessary.

If a required permission is missing:

- do not act;
- record the situation where appropriate.

---

# 18. Context Detection

Context detection combines signals rather than trusting one signal.

Possible layers:

```text
Location
Motion
Transition
Environment
Time
Confidence
```

The current Context Detection document defines a confidence model and emphasizes that a single signal is insufficient.

The future shared Context Engine is explicitly a **future possibility**, not a current requirement.

---

# 19. Current Prototype

The current authoritative prototype specification is:

`04 - Development/Prototype Spec v1.md`

It defines the current R&D Work logger.

The current prototype stack specified there is:

```text
Python
FastAPI
SQLite
Jinja2 / HTML
```

Do not infer a different stack from an older implementation, generated code, or archived development material.

The prototype is intentionally:

> **throwaway code, production model**

The code can be replaced.

The real data and observations cannot be casually discarded.

---

# 20. Prototype Purpose

The prototype exists to answer:

> Does Domain Model v1 survive real R&D work?

It must support:

- Journey and Node creation;
- arbitrary Node nesting;
- session intention;
- SessionEntry logging;
- Conditions;
- discoveries;
- context switching;
- intention revisions;
- session reflection;
- session history;
- actual vs estimated duration;
- program progress.

It explicitly does **not** currently need:

- multi-user collaboration;
- AI drift classification;
- broad analytics;
- speculative autonomous behavior;
- Journey-001 train logging;
- hardcoded demo data;
- speculative infrastructure.

---

# 21. Development Phases

The current development direction is:

```text
Phase 1
Manual R&D Work logging
        ↓
Real usage + data
        ↓
Retrospective
        ↓
Phase 2
Analytics / notifications / deployment improvements
        ↓
Phase 3
Autonomous context detection
```

Do not build Phase 2 or Phase 3 merely because the future architecture is imaginable.

Phase scope should be informed by evidence from the previous phase.

---

# 22. How to Work on the Code

Before changing code:

### 1. Find the domain object

Ask:

> Which Journey, Node, Session, SessionEntry, or Condition does this change?

### 2. Identify the layer

Is this:

- observation;
- evidence;
- derived state;
- inference;
- product behavior;
- architecture;
- implementation?

### 3. Check the Vault

Search the authoritative documents before inventing a solution.

### 4. Check Architecture Decisions

Do not casually reverse a settled decision.

### 5. Make the smallest justified change

Do not rewrite the system simply because the existing code is imperfect.

---

# 23. When Code and the Model Disagree

Because early development included rapid/vibe coding, the current implementation may contain shortcuts or incorrect assumptions.

When this happens:

```text
Observe actual behavior
        ↓
Compare with Vault
        ↓
Identify mismatch
        ↓
Classify:
  - bug
  - incomplete implementation
  - prototype shortcut
  - outdated decision
  - model problem
        ↓
Make the smallest justified correction
```

Do not automatically treat existing code as authoritative.

Do not automatically rewrite everything either.

---

# 24. Testing Philosophy

Tests must verify more than whether the UI works.

They must verify **meaning preservation**.

Example:

```text
Journey:
Learn React

Node:
Read Hooks

Session 1:
Intention:
Read Hooks

Reality:
Debugged a build error

Session 2:
Reality:
Continued reading Hooks
```

The system should preserve:

- the original intention;
- the actual observations;
- the same Node across Sessions;
- Conditions;
- corrections;
- historical events.

A test that passes while silently rewriting intention is a failed test.

---

# 25. Research Discipline

Human Drift is an R&D project.

Maintain the distinction:

```text
Observation
Evidence
Hypothesis
Interpretation
Decision
Implementation
```

Example:

**Observation**

> A user frequently switches Nodes during Sessions.

**Hypothesis**

> The current representation of work may not match how the user actually works.

**Decision**

> Collect more evidence before changing the domain model.

Do not jump directly from observation to feature.

---

# 26. Real Usage Is Research

Unexpected behavior is valuable.

If users behave in a way the model did not predict:

1. preserve the observation;
2. identify the mismatch;
3. determine whether the model is wrong;
4. determine whether it is incomplete;
5. determine whether it is an exceptional case;
6. change the model only when evidence justifies it.

The goal is not to make reality fit the software.

The goal is to make the software accurately represent reality.

---

# 27. UI / UX

UI/UX is important even at the prototype stage.

The interface should make it easy to understand:

- what was intended;
- what happened;
- where the user is in the hierarchy;
- what happened during a Session;
- what context existed;
- how the current state relates to history.

Avoid making the interface look like a generic task manager.

The UI should reinforce Human Drift's central concept:

> **continuity of meaning.**

---

# 28. New Ideas

Before turning an idea into development work, classify it.

```text
Observation
Research Evidence
Hypothesis
Product Requirement
Architecture Decision
Development Task
Future Possibility
```

Not every good idea is a feature.

Not every problem requires an architectural change.

---

# 29. Decision Handling

Before proposing a significant decision:

1. Check the Vault.
2. Determine whether the decision already exists.
3. If decided, follow it.
4. If open, identify the actual decision.
5. Challenge weak assumptions.
6. Explain the reasoning.
7. Record the decision appropriately.

Useful statuses:

```text
Open
Proposed
Decided
Superseded
Reversed
```

Do not reopen settled decisions without a concrete reason.

---

# 30. Current High-Priority Areas

The exact implementation status must be checked against the current code and Development documents.

Conceptually, the areas most sensitive to the domain model are:

| Area | Why it matters |
|---|---|
| Node continuity | Prevents Sessions from becoming isolated tasks |
| Intention preservation | Protects historical meaning |
| SessionEntry evidence | Creates the raw material for drift analysis |
| Conditions | Provides contextual explanation |
| Corrections | Preserves historical integrity |
| Event Log | Makes state changes auditable |
| History views | Lets users reconstruct reality |
| Actual vs estimated duration | Tests whether the model can answer useful questions |

---

# 31. Golden Rules

Before committing a change:

- [ ] Did I check the authoritative Vault document?
- [ ] Does the change preserve original intention?
- [ ] Does it preserve historical reality?
- [ ] Does it avoid silent rewriting?
- [ ] Does it follow Journey → Node → Session → SessionEntry?
- [ ] Can a Node persist across multiple Sessions?
- [ ] Is Condition treated as contextual evidence?
- [ ] Is drift derived rather than asserted from weak evidence?
- [ ] Does every meaningful mutation remain auditable?
- [ ] Am I adding complexity that current evidence justifies?
- [ ] If I changed a domain or architectural decision, did I record it in the Vault?

---

# 32. The Question Behind the Project

Everything ultimately comes back to:

> **How can a system preserve the meaning of what a person intended while reality changes around them?**

Human Drift must preserve the difference between:

```text
WHAT WAS INTENDED
        ↓
WHAT ACTUALLY HAPPENED
        ↓
WHAT CHANGED
        ↓
WHAT CAN BE UNDERSTOOD
        ↓
HOW TO ADAPT
```

Do not optimize that difference away.

**The difference is the product.**
