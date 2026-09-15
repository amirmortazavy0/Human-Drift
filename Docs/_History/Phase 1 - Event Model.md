# Event Model

Events are the atomic units of what happened inside a Human Drift Program.
Every autonomous action is triggered by an event. Every event is logged regardless of whether an action follows.

Events use dot notation: `subject.verb_past_tense`

---

## Master event list

### User location events
```
user.approached_origin_station
user.exited_origin_station
user.arrived_destination
user.exited_destination
```

### User motion events
```
user.on_platform
user.boarded_train
user.exited_train
user.walking
user.stationary
```

### Train / environment events
```
train.started_moving
train.in_transit
train.arrived_station
train.stopped
```

### Program lifecycle events
```
program.started
program.session_completed
program.session_missed
program.paused
program.resumed
program.completed
program.abandoned
```

---

## Event schema

Every event record contains:

```
event_id:        UUID
event_type:      user.boarded_train
timestamp:       ISO 8601
program_id:      which Program this belongs to
confidence:      0–100
context_snapshot:
  location:      lat/lng at time of event
  motion:        walking / stationary / train / unknown
  time_of_day:   HH:MM
raw_signals:     what the sensors reported before classification
```

---

## Rules

1. Events are immutable once logged. They cannot be edited.
2. Events fire independently of actions. An event that triggers no action is still logged.
3. A low-confidence event is still logged — with its confidence score.
4. Every journey adds events to this master list. No journey creates private events.

---

## Source journeys

| Event | First defined in |
|-------|-----------------|
| user.approached_origin_station | Journey-001 Train Performance |
| user.boarded_train | Journey-001 Train Performance |
| train.started_moving | Journey-001 Train Performance |
| train.arrived_station | Journey-001 Train Performance |
| program.session_completed | Journey-001 Train Performance |
| program.session_missed | Journey-001 Train Performance |
| program.completed | Journey-001 Train Performance |
