This skill should be used when producing evidence sections, selecting quotes, sizing customer problems, assessing impact, or writing insight summaries from customer feedback data. Auto-loads when producing output from /prd-evidence, /account-brief, /sprint-planning, /roadmap-review, /weekly-memo, or any command that turns raw feedback into a product narrative. Core rule: synthesize, never dump.

---

name: customer-evidence-synthesis
description: >
This skill should be used when producing evidence sections, selecting quotes,
sizing customer problems, assessing impact, or writing insight summaries from
customer feedback data. Auto-loads when producing output from /prd-evidence,
/account-brief, /sprint-planning, /roadmap-review, /weekly-memo, or any command
that turns raw feedback into a product narrative. Core rule: synthesize, never dump.
version: 0.1.0

---

# Customer Evidence Synthesis

Value is narrative, not retrieval. Raw feedback quotes and theme counts are inputs — the output is a structured argument about what customers need and why it matters.

## The Core Rules

**Use distinct accounts, not ticket counts.**
Report how many unique companies or users are affected, not how many feedback submissions exist. One frustrated enterprise customer submitting 40 tickets is not 40 data points — it is one account signal. Always clarify the unit: "12 accounts" not "47 mentions."

**Label inferences as HYPOTHESIS.**
Any statement that goes beyond what the data directly shows — a causal explanation, a predicted impact, a root cause — must be labeled HYPOTHESIS. Never present interpretations as facts.

**Include a limitations section in every output.**
End every analysis with a plain-language summary of what the data doesn't tell you. Common limitations to address:

- Recency gaps (how fresh is the data?)
- Coverage gaps (are all customers represented, or just those who submit feedback?)
- Selection bias (are vocal customers representative of the whole?)
- What you'd need to validate the findings
  **Cite sources.**
  Every quote should be attributable. Include account name (or anonymized tier), date, and source channel where available.

## Problem Sizing

When estimating impact, use this hierarchy:

1. **Distinct affected accounts** — primary metric. How many unique companies have raised this?
2. **Account tier distribution** — are the affected accounts enterprise, mid-market, or SMB? Weight accordingly.
3. **Trend direction** — is the signal growing, stable, or declining? A growing signal at low volume may outrank a stable signal at high volume.
4. **Sentiment severity** — how frustrated are customers? Mild inconvenience vs. blocking issue vs. churn driver.
   Avoid:

- Using ticket count as a proxy for impact without noting it is a raw count, not account count
- Extrapolating impact beyond what the data supports
- Treating silence as satisfaction (customers who don't submit feedback are not necessarily happy)

## Quote Selection

When selecting quotes for evidence sections, choose for diversity:

- **At least one enterprise-tier account** (if available)
- **At least one self-serve or SMB account** (if available)
- **At least one recent quote** (within the last 30 days if possible)
- **Varied phrasing** — avoid selecting quotes that all say the same thing in different words
- **Avoid cherry-picking** — if most quotes are mild but one is extreme, include a representative mild quote, not only the extreme one
  A good quote is specific (names a workflow, action, or outcome), not just an expression of frustration. "I can't export to CSV" is better evidence than "this is broken."

## Narrative Structure

When synthesizing evidence into a section of a PRD or brief, use this structure:

1. **Problem statement** — one sentence stating what customers can't do or what's going wrong
2. **Scale** — how many distinct accounts, what tier distribution, what trend direction
3. **Sentiment** — is this mild friction, significant frustration, or a churn driver?
4. **Segment pattern** — does this affect all customers equally, or is it concentrated?
5. **Supporting quotes** — 3–5 diverse quotes with attribution
6. **Impact assessment** — HYPOTHESIS about business impact (retention risk, expansion blocker, etc.)
7. **Limitations** — what this analysis doesn't cover

## What Not to Do

- Do not present a list of quotes without interpretation — this is a data dump, not synthesis
- Do not use emotionally charged language ("customers are furious") unless supported by sentiment data
- Do not omit the limitations section because it weakens the argument — it strengthens trust in the analysis
- Do not conflate frequency with severity — a bug mentioned by 3 accounts that causes data loss outranks a cosmetic issue mentioned by 30 accounts
