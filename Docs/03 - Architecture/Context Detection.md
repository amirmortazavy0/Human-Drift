# Context Detection

The central theory for how Human Drift recognizes real-world situations.

Context Detection is the bridge between the physical world and the Event Model.
Without it, the system cannot act autonomously — it would need the user to tell it what is happening.

---

## Detection layers

| Layer | What it observes | Example |
|-------|-----------------|---------|
| Location | GPS, geofences | User within 150m of train station |
| Motion | Accelerometer, gyroscope | Walking vs train movement |
| Transition | Change of state | Moving → stationary (arriving at platform) |
| Environment | Speed, vibration, acoustic pattern | Train in motion vs bus in motion |
| Time | Clock, calendar | Within configured commute window |
| Confidence | Composite score | 0–100, threshold before event fires |

---

## Confidence scoring principle

No single signal is sufficient. Context is confirmed by combining multiple layers.

A boarding event requires:
- Geofence confirmed (high weight)
- Motion pattern consistent with train (high weight)
- Time within expected window (supporting weight)
- Stationary period on platform before motion change (supporting weight)

The system does not act below the confidence threshold defined per Program.

---

## Behavior below threshold

| Confidence | System behavior |
|------------|----------------|
| >80% | Fire event, take autonomous action |
| 60–80% | Fire event as low-confidence, log only, no action |
| <60% | Discard signal, log detection attempt |

---

## Context Engine (future)

As more journeys are added, Context Detection will evolve from a set of per-journey rules into a shared Context Engine — a service that any Program can subscribe to.

The Context Engine will:
- Maintain a live model of the user's current situation
- Broadcast context changes as events
- Allow Programs to subscribe to specific context transitions
- Improve detection accuracy over time using historical patterns

This is a discovery, not a current requirement.

---

## Source journeys

| Context signal | First defined in |
|---------------|-----------------|
| Railway geofence | Journey-001 Train Performance |
| Walking motion | Journey-001 Train Performance |
| Platform stationary | Journey-001 Train Performance |
| Train environment | Journey-001 Train Performance |
