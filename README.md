# Architecting for Resilience

Reference materials for designing Business Continuity Plans (BCP) and Disaster Recovery (DR) solutions on AWS.

## Contents

| File | Description |
|---|---|
| `bcp-framework-v1.md` | BCP Framework v1 — foundational structure |
| `bcp-framework-v2.md` | BCP Framework v2 — expanded components |
| `bcp-framework-v3.md` | BCP Framework v3 — latest, includes scenario library |
| `dr-solution-on-aws.md` | DR strategies on AWS (Backup & Restore → Multi-Site Active/Active) |
| `aws-backup-restore-guide.md` | Deep-dive guide for the Backup & Restore DR strategy |
| `generate_bcp_excel.py` | Script to generate a BCP scenario workbook (Excel) |
| `bcp-scenario-library.xlsx` | Pre-built BCP scenario library spreadsheet |

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

## Generate the BCP Workbook

Requires Python 3 and `openpyxl`:

```bash
pip install openpyxl
python generate_bcp_excel.py
```

This produces an Excel workbook with the full BCP scenario library, colour-coded by severity and recovery level.
