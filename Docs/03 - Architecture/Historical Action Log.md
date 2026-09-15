# Historical Action Log

Every autonomous action Human Drift takes is recorded here.
No hidden behavior.

---

## Principle

The Historical Log is the source of truth for what the system did and why.

A user must be able to ask at any time:
> "What did you do while I wasn't looking?"

And receive a complete, plain-language answer.

---

## Log record schema

```
action_id:          UUID
timestamp:          ISO 8601
program_id:         which Program triggered this action
trigger_event_id:   which event caused this action
action_type:        what the system did
action_detail:      plain-language description of the specific action
permission_id:      which permission authorized this action
permission_level:   Automatic / Ask Once / Always Ask
context_at_time:
  location:         where the user was
  motion:           what the user was doing
  confidence:       detection confidence score
result:             success / partial / failed
result_detail:      what actually happened
reversible:         yes / no
reversed:           yes / no (if user undid the action)
