## 1. Project Overview

**Product name:** Human Drift

**Purpose:**  
%%
Describe Human Drift in a few paragraphs as if you are commissioning software from an external engineering team.
%%

Human drift is a smart program that can learn, understand, and remember goals that are planned to achieve, and whenever there's any kind of drift that causes not meeting the deadline to achieve the goal, it notifies the user itself. What identifies as a drift is recognized by the Human Drift itself based on the type of goal and the behavior of the user and how these two affect each other.

%%
This section answers:
	“What am I asking you to build?”
Not:
	“How should you build it?”
%%

---

## 2. The Problem

%%
Describe the real-world problem before describing the solution.

For example:

People often have things that matter to them: goals, interests, relationships, projects, ambitions, habits, ideas, responsibilities, and personal identities.

They do not necessarily decide to abandon these things.

Instead, attention gradually shifts elsewhere. Weeks or months pass, and something meaningful can quietly disappear from a person's life.

The problem Human Drift is intended to address is this **unintentional loss of continuity**.

The system should help a person recognize when something meaningful is gradually disappearing from their life and distinguish that from a deliberate decision to move on.
%%



---

## 3. The Core Idea

This is the conceptual heart of the product.

Human Drift should maintain a long-term understanding of things that matter to a person and observe how those things change over time.

The system should not simply store a list of goals.

It should retain context such as:

- what the person cared about
    
- what they intended to do
    
- what they actually did
    
- what they stopped doing
    
- what they repeatedly postponed
    
- what they became interested in
    
- what they explicitly decided to abandon
    
- what appears to have disappeared without a conscious decision
    

The system uses that history to help identify **drift**.

---

## 4. What the User Gives the System

Describe the inputs from the user's perspective.

For example:

The user may provide information through natural interaction, such as:

> “I want to learn piano.”

> “I want to build Human Drift.”

> “I used to play music every day.”

> “I haven't touched my piano in three months.”

> “I don't actually care about this anymore.”

> “Remind me that this matters to me.”

> “I want to come back to this later.”

The system should be able to accumulate these pieces of information over time rather than treating every interaction as an isolated task.

---

## 5. What the System Should Remember

This is one of the most important sections.

The system should maintain persistent information about the person and their context.

Examples include:

**Goals**  
Things the person wants to accomplish.

**Interests**  
Things the person repeatedly shows curiosity about.

**Projects**  
Things the person is actively building or working on.

**Commitments**  
Things the person has explicitly committed to doing.

**Identity-related interests**  
Things that appear to be meaningful parts of who the person considers themselves to be.

**Behavior/history**  
Evidence of what the person actually does over time.

**Decisions**  
Explicit decisions such as:

> “I no longer want this.”

This distinction is fundamental because:

**Not doing something ≠ abandoning it.**

And:

**Abandoning something intentionally ≠ drifting away from it.**

---

## 6. The Central Concept: Drift

Define precisely what “drift” means in the product.

### Intentional change

The person consciously decides:

> “I don't want to pursue photography anymore.”

The system should recognize this as an intentional change.

### Natural evolution

The person gradually becomes interested in something else and explicitly embraces the change.

This should not necessarily be treated as a problem.

### Potential drift

The system observes that something historically meaningful has gradually disappeared without clear evidence that the person consciously chose to abandon it.

This is the main phenomenon Human Drift is intended to identify.

---

## 7. What the System Should Do

This section describes desired behavior rather than implementation.

For example:

The system should:

**Remember**  
Maintain long-term context.

**Observe**  
Monitor changes in goals, interests, commitments, and behavior.

**Compare**  
Compare current behavior with historical patterns.

**Detect**  
Identify potential cases of unintentional drift.

**Distinguish**  
Attempt to distinguish intentional change from unexplained disappearance.

**Surface**  
Bring potentially meaningful drift to the user's attention.

**Provide context**  
Explain why something has been surfaced.

For example:

> “You used to spend significant time making music. You haven't interacted with it for four months, and there is no indication that you intentionally stopped. Is this something you still care about?”

---

## 8. User Experience

Describe what the user should experience.

Avoid saying:

> “Build a React dashboard.”

Instead say:

> “The user should be able to see the important things currently present in their life and understand how those things have changed over time.”

Possible experiences:

### Current life

What currently matters to the user.

### History

How those things have changed.

### Drift

Things that may be quietly disappearing.

### Decisions

Things the user deliberately chose to stop pursuing.

### Re-entry

Things the user may want to return to after a period of absence.

---

## 9. Example Scenarios

This section is extremely valuable for engineers because scenarios remove ambiguity.

### Scenario 1 — Forgotten interest

A person used to regularly play music.

Over time, work becomes more demanding.

They stop playing.

They never decide:

> “I don't want music anymore.”

Human Drift notices the disappearance and eventually surfaces it.

---

### Scenario 2 — Intentional abandonment

A person stops learning guitar and explicitly says:

> “I don't want to learn guitar anymore.”

Human Drift records the decision.

It should not repeatedly interpret the absence as drift.

---

### Scenario 3 — Temporary pause

A person stops working on a project because they are busy for two months.

They still consider the project important.

The system should distinguish this from permanent abandonment.

---

### Scenario 4 — Returning to something

A person previously abandoned photography and later becomes interested again.

Human Drift should retain the historical context rather than treating photography as a completely new interest.

---

## 10. System Behavior Rules

These are product rules, not engineering rules.

Examples:

1. The system must not automatically assume that absence means abandonment.
    
2. The system should consider explicit user decisions stronger evidence than behavioral inference.
    
3. The system should preserve historical context.
    
4. The system should distinguish temporary inactivity from meaningful disappearance where possible.
    
5. The system should allow the user to correct the system's interpretation.
    
6. The system should not force the user to maintain everything they once cared about.
    
7. The purpose is awareness, not guilt.
    

That last distinction is important.

Human Drift should not become:

> “You haven't worked on your goals for 17 days. You are failing.”

It should be closer to:

> “Something that used to matter to you seems to have disappeared. You may have consciously moved on, or you may have drifted away from it.”

---

# 11. Information the System Should Produce

Describe outputs.

Examples:

**Current priorities**

What appears important now.

**Historical interests**

Things that have mattered over time.

**Potential drift**

Things that appear to be fading without an explicit decision.

**Intentional changes**

Things the person consciously moved away from.

**Patterns**

Potential recurring patterns across the person's behavior.

**Contextual explanations**

Why the system believes something deserves attention.

---

# 12. What Human Drift Is Not

This is worth explicitly defining.

Human Drift is not primarily:

- a conventional to-do list
    
- a calendar
    
- a habit tracker
    
- a productivity score
    
- a reminder application
    
- a goal-management system
    
- a motivational coach
    

Those things may eventually become components of the system, but they are not the fundamental idea.

The fundamental idea is:

> **Maintaining continuity of meaning across time and identifying when meaningful parts of a person's life may be disappearing unintentionally.**

---

# 13. Desired Long-Term Behavior

Describe the vision without prescribing implementation.

Over time, Human Drift should become better at understanding:

- what matters to a person
    
- what repeatedly matters
    
- what temporarily matters
    
- what has been consciously abandoned
    
- what has quietly disappeared
    
- what tends to cause the person's attention to shift
    
- what kinds of changes represent genuine personal evolution
    

The system should become increasingly contextual rather than merely increasingly complicated.

---

# 14. Boundaries

This section protects the idea from becoming an uncontrolled monster.

For the initial product:

**The system should prioritize understanding and surfacing meaningful change rather than attempting to manage every aspect of the user's life.**

Engineering/product teams should determine the appropriate scope and architecture from these requirements.

---

# 15. Open Questions

Do not pretend you have solved things you haven't solved.

Examples:

- What exactly constitutes sufficient evidence of drift?
    
- How long should inactivity persist before something is surfaced?
    
- How should the system weigh explicit statements versus behavior?
    
- How should conflicting signals be handled?
    
- How should privacy and long-term personal data be handled?
    
- How much autonomy should the system have?
    
- When should it ask the user versus simply record information?
    

These are **questions for product/engineering/design investigation**, not things you need to prematurely solve.

---

# 16. Acceptance at the Conceptual Level

At the end, define what success means.

Human Drift succeeds if a person can say:

> “There are things that matter to me that I would have forgotten, ignored, or unconsciously abandoned without this system.”

And also:

> “The system understands that some changes in my life are deliberate, and does not treat every change as a problem.”

---

## The important distinction

This document should contain:

**What**

- What the product is
    
- What problem it solves
    
- What information enters it
    
- What it remembers
    
- What it should notice
    
- What it should do
    
- What the user should experience
    
- Examples
    
- Rules
    
- Boundaries
    

It should **not** contain:

**How**

- React vs Angular
    
- PostgreSQL vs MongoDB
    
- Kafka
    
- APIs
    
- microservices
    
- database schema
    
- Jira tickets
    
- sprint structure
    
- deployment architecture
    
- cloud provider
    
- engineering estimates
    

Those belong to the team receiving the document.

So the artifact we are really building is:

**Human idea → structured customer requirements → engineering/product interpretation → implementation.**

That gives you a stable document you can keep updating without having to redesign the entire project every time your understanding of the implementation changes.