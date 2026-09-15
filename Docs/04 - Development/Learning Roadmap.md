# Learning Roadmap — Human Drift

Learning is tied to building. Every item here exists because a User Journey or Architecture file revealed a capability gap.

---

## Principle

Do not learn technology in advance of needing it.
Learn when a Journey reveals that you cannot build what you designed without it.

Progression model: Python → data structures → event handling → persistence → Kafka → larger architecture.
Every technology must earn its place by solving a discovered problem.

---

## Current learning priorities

| Priority | Topic | Why it's needed | Status |
|----------|-------|----------------|--------|
| 1 | Python fundamentals | Build the train logger prototype | 🔄 CS50 in progress |
| 2 | File I/O + JSON | Store session records locally before any database | ⬜ |
| 3 | GPS / geofencing APIs | Detect station proximity on Android | ⬜ |
| 4 | Background services (Android) | Keep detection running when app is closed | ⬜ |
| 5 | SQLite | Local data persistence for session records | ⬜ |
| 6 | Kafka | Event streaming when scale requires it | ⬜ — do not start until SQLite is insufficient |

---

## Learning rule

Before adding a new item to this list, answer:
> Which Journey or Architecture file revealed this gap?

If you cannot name one, the item probably belongs in a curiosity note, not here.
