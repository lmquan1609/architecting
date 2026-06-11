# Architecting for Resilience

Reference materials for designing Business Continuity Plans (BCP) and Disaster Recovery (DR) solutions on AWS.

## BCP Framework

The BCP framework follows a four-phase lifecycle:

1. **Understand** — Business Impact Analysis (BIA) + Risk Assessment
2. **Prepare** — Recovery strategies, DR plan, roles, alternate sites, communication plan
3. **Respond** — Incident Response Plan
4. **Sustain** — Testing, exercises, and plan maintenance

Key metrics defined per system: **RTO** (Recovery Time Objective) and **RPO** (Recovery Point Objective).

## DR Strategies on AWS

Four strategies ordered by cost and recovery speed:

| Level | Strategy | RTO | Cost |
|---|---|---|---|
| 1 | Backup & Restore | Hours | $ |
| 2 | Pilot Light | 30–60 min | $$ |
| 3 | Warm Standby | Minutes | $$$ |
| 4 | Multi-Site Active/Active | Near-zero | $$$$ |
