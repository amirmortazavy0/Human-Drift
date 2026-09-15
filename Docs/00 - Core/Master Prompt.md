## What Human Drift Is

Human Drift is an R&D project investigating plan-execution drift.

The product preserves the relationship between: **Intention → Reality →  
Drift → Understanding → Adaptation**

It is not primarily a productivity app, task manager, habit tracker, or  
calendar. Its long-term purpose is continuity of meaning.

Core principle:

> Intention is immutable. Reality is logged. The gap between them is  
> drift.

Full philosophy: `Vision & Philosophy.md`

## Current Canonical Model

The authoritative domain model is `Domain Model v1.md`.

Universal structure:

```
Journey
└── Node
    └── Node ...
        └── Session
            └── SessionEntry
                └── Condition
```

More precisely: - Journey = long-lived context - Node = any unit of work  
at any hierarchy level - Session = one working period - SessionEntry =  
one logged event/tap - Condition = contextual snapshot at the moment of  
the entry

Node depth is intentionally flexible. Do not impose a maximum depth.

A Route, Station, Project, Task, Milestone, or Note can all be Nodes.  
Different use cases do not receive different domain models.

## Intention

A Session's initial intention is declared at start and is immutable.

If direction changes during the session, the original intention remains  
intact and the change is recorded as an intention-revision event.

The system must preserve: 1. what was originally intended; 2. what  
actually happened; 3. what changed between them.

## Evidence and History

Keep observation, event, derived state, and inference distinct.

The system uses a hybrid state/history architecture: - current state is  
stored directly; - mutations append to the Event Log; - the Event Log is  
the audit trail; - corrections preserve original values.

Do not silently overwrite history.

## Current Journeys

### Journey-001 --- Train Performance Study

The first experimental Journey. It validates the universal model using  
station-by-station commute observations.

The train is a real use case and dataset, not the definition of the  
product architecture.

### Journey-002 --- R&D Work

The second experimental Journey. It validates Human Drift against real  
work where hierarchy, context, intention, interruption, and discovery  
can change dynamically.

Do not force this Journey into a fixed Project → Task structure.

## Current Development Direction

The current prototype is the **R&D Work Logger**, specified in:

`04 - Development/Prototype Spec v1.md`

It implements the current Domain Model rather than the superseded  
train-specific Phase 1 data model.

The prototype is intentionally disposable code with a production-grade  
domain model. Real logged data is evidence and must be preserved.

Core prototype behavior: - create Journeys and flexible Node trees; -  
start a Session and lock its intention; - log SessionEntries; - capture  
sticky Condition values; - record task starts/completions/pauses,  
context switches, discoveries, intention revisions, and notes; - end  
sessions with reflection and quality; - browse history; - answer  
priority duration/progress queries.

Explicitly outside this prototype: - multi-user collaboration; - AI  
drift classification; - Journey-001 train logging; - broad analytics; -  
governance/permission system; - hardcoded demo data.

## Architecture Authority

Before changing architecture, read: - `00 - Core/Domain Model v1.md` -  
`03 - Architecture/Architecture Decisions.md` -  
`03 - Architecture/Event Schema v1.md`

These are authoritative over older Phase 1 specifications.

The old Phase 1 data model and related train-specific implementation  
documents are historical unless explicitly reinstated.

## Research Discipline

Human Drift is discovered through evidence.

Separate: - observation - evidence - hypothesis - interpretation -  
decision - implementation

Real usage of the prototype is research data. The next domain-model  
revision should be driven by what real use reveals.

## Vault Structure

```
00 - Core/          → philosophy, domain, glossary, core model
01 - Research/      → evidence, hypotheses, research
02 - Product/       → principles, journeys, product requirements
03 - Architecture/  → architecture, events, permissions, history
04 - Development/   → prototype and implementation work
05 - Future Outreach/ → future-stage material
Inbox/              → fast capture
Templates/          → reusable note templates
_History/           → superseded material
```

## Session Behavior

At the start of work: 1. identify the actual question or task; 2.  
consult the relevant authoritative vault documents; 3. distinguish  
settled decisions from open questions; 4. work from current truth, not  
historical assumptions.

Do not ask the user which thread to choose merely because the old Master  
Prompt said so. Follow the user's actual request.

When proposing changes, classify them as: **Observation / Evidence /  
Hypothesis / Product Requirement / Architecture Decision / Development  
Task / Future Possibility.**

When in doubt, preserve reality and uncertainty rather than inventing  
certainty.