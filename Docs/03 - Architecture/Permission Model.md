# Permission Model

Every autonomous action in Human Drift requires a permission basis.
No action is taken without one.

---

## Three permission levels

| Level | Meaning | When used |
|-------|---------|-----------|
| **Always Ask** | System asks the user every time before acting | High-risk or irreversible actions |
| **Ask Once** | User grants permission at Program approval; system acts without asking again | Standard program operations |
| **Automatic** | Pre-approved category of actions; no prompt needed | Low-risk, routine, reversible actions |

---

## Principle

Permissions are granted at Program approval time — not at the moment of first action.

Requesting permission mid-context (e.g., asking for location access while the user is boarding a train) is a design failure. It interrupts at exactly the wrong moment.

---

## Permission record schema

Every autonomous action references a permission record:

```
permission_id:     UUID
program_id:        which Program this covers
action_type:       what category of action is permitted
level:             Always Ask / Ask Once / Automatic
granted_at:        timestamp of user approval
granted_for:       specific scope (e.g., "origin station geofence only")
revocable:         yes / no
```

---

## Current permissions by journey

### Journey-001: Train Performance Study

| Permission | Level |
|------------|-------|
| Continuous location access | Ask Once |
| Motion sensor access | Ask Once |
| Background operation | Ask Once |
| Log timestamped session record | Automatic |
| End-of-day passive notification | Automatic |
| Missed session notification | Ask Once |

---

## Rules

1. Every autonomous action in the Historical Log must reference a valid permission record.
2. Permissions can be revoked by the user at any time. Revocation is logged.
3. A revoked permission does not delete past actions that were taken under it.
4. If a required permission is missing, the system logs the situation and does not act.
