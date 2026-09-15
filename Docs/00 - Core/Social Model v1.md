# Social Model v1 — Human Drift

**Version:** 1.0
**Status:** Conceptual — implementation deferred
**Last updated:** 2026-09-14

---

## Overview

Human Drift is a personal tool first. One person, their intentions, their reality, their drift. That is the complete product — not a reduced version waiting for multi-user features.

The social model describes how the same core extends to shared contexts without losing the personal layer. The extension is additive, never replacing.

---

## The reference model: Telegram

The clearest analogy for how Human Drift should handle social contexts is Telegram's primitive-based architecture. Telegram did not invent a fixed organizational hierarchy. It gave users the right primitives and let them compose the governance structure they needed:

- Saved Messages — entirely private, one person
- Group chat — peer governance, anyone can decide the rules
- Channel — one-to-many, creator controls
- Community — large-scale, structured moderation tools built in

Same underlying system. Different social contracts layered on top. No one context is more "real" than another.

Human Drift follows the same principle. **The personal experience is never subordinated to any shared context.**

---

## The four contexts

| Context | Who governs | Drift visibility default |
|---|---|---|
| Solo | The user alone | Entirely private |
| Peers (friends, collaborators) | Decided by the group — admin optional | Each person controls their own |
| Organization | Stakeholder-defined rules + personal rules coexist | Aggregate patterns visible, individual drift private |
| Community | Community-level governance | Individual private, systemic patterns visible without attribution |

---

## The permanent personal layer

In every context — including organizational — every person retains a private layer that is entirely their own. This is non-negotiable.

A person inside an organization using Human Drift has:
- Their assigned shared Journeys (visible to the team per the organization's rules)
- Their personal Journeys (visible to no one but themselves)
- Their private drift signals (never surfaced to anyone above them without explicit consent)

This is equivalent to Telegram's Saved Messages existing inside a workspace where everything else is shared. The private space always exists. It cannot be removed by organizational rules.

---

## Drift visibility rules

**Personal drift belongs to the person who drifted.**

The default is: I see my own drift. No one else does.

Visibility can be changed in two directions:

**The individual can choose to share their drift:**
- With a specific person
- With a group they belong to
- Publicly (rare, but possible)

**A shared context can define drift visibility rules:**
- An organization can specify that certain drift signals are visible to team leads
- A group of friends can agree that everyone sees everyone's drift
- A community can surface aggregate drift patterns without revealing individuals

**The rule that cannot be overridden:** Personal rules always exist alongside organizational rules. An organization can define that certain Journeys have reporting requirements. It cannot eliminate the personal layer. A user always has private space.

---

## Aggregate signals without surveillance

When many people in the same shared context drift in the same direction from the same intention, that pattern is valuable systemic information — without requiring individual exposure.

Example: Ten engineers on a team are all drifting from a Q3 delivery plan in the same week. The pattern is visible at the team level. Who specifically is drifting is not.

This is the same principle Reddit uses for vote aggregation and Discord uses for server-level activity signals. The individual is protected. The collective pattern is visible.

The system records enough evidence to enable this. The implementation is deferred until multi-user is built.

---

## Governance composition

There is no fixed organizational hierarchy in Human Drift. Governance is composed from primitives:

**Primitive: Admin**
Any Journey or shared context can optionally have an admin. The admin sets rules for that context. Admins are not mandatory — a group of peers can operate without one.

**Primitive: Rule**
A rule defines what is visible to whom in a shared context. Rules are defined by whoever governs the context (the admin, or collectively if there is no admin). Rules can only narrow visibility — they cannot force exposure of what a user has chosen to keep private.

**Primitive: Personal override**
A user can always define personal rules for their own visibility that are more restrictive than the context rules. They can never be forced to expose more than the context rules require — and the context rules can never touch the personal layer.

---

## What this means for Phase 1

Phase 1 is solo only. One user. No shared contexts. No governance rules. No visibility decisions beyond "this is mine."

The social model is documented here because it shapes the domain model — specifically, the `visibility` field on Journey and the `owner_id` on every entity. Those fields exist now so the data model is correct from the start, even though the features that use them are deferred.

Nothing in Phase 1 requires multi-user to work. The personal experience is complete on its own.
