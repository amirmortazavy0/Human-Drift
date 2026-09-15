# Kafka Notes

Apache Kafka is an event streaming platform.
Relevant to Human Drift because the Event Model produces a continuous stream of events that eventually needs to be processed reliably at scale.

**Do not start learning Kafka until SQLite local storage becomes insufficient for your needs.**

---

## Why Kafka is relevant (future)

Human Drift's Event Model fires events from context detection. As the number of Programs and Users scales, a simple database write per event becomes a bottleneck. Kafka allows events to be produced, consumed, and processed independently — which matches the architecture of the Core Loop.

## Why it is not needed yet

For one user running one Program (Journey-001), SQLite is more than sufficient.
Kafka introduces operational complexity that is not justified at prototype stage.

---

## When to revisit

- When you need to process events from multiple simultaneous Programs
- When you need different parts of the system to react to the same event independently
- When you need replay capability (re-process historical events)

Until then: this file is a placeholder.
