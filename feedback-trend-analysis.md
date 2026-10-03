This skill should be used when comparing feedback across time periods, measuring the impact of a launch or change, or detecting volume spikes and sentiment shifts. Auto-loads for /post-launch, /launch-audit, /emerging-signals, and any command that compares a "before" state to an "after" state. Also triggers when someone asks "did this launch help", "what changed after we shipped X", or "is this getting better or worse".

---

name: feedback-trend-analysis
description: >
This skill should be used when comparing feedback across time periods, measuring
the impact of a launch or change, or detecting volume spikes and sentiment shifts.
Auto-loads for /post-launch, /launch-audit, /emerging-signals, and any command
that compares a "before" state to an "after" state. Also triggers when someone
asks "did this launch help", "what changed after we shipped X", or "is this
getting better or worse".
version: 0.1.0

---

# Feedback Trend Analysis

## Period Selection

When comparing feedback across time periods, the comparison must be fair. Use these rules:

**For post-launch analysis:**

- Pre-period: 30 days before the launch date
- Post-period: 30 days after the launch date (or the full elapsed period if <30 days have passed)
- Minimum post-period: 14 days. Do not run a post-launch analysis with fewer than 14 days of data — the signal is not yet meaningful.
  **For emerging signals:**
- Recent window: user-specified (default: last 30 days)
- Baseline window: the equivalent prior period (last 30 days → the 30 days before that)
- Do not compare unequal windows (e.g., last 14 days vs. last 30 days) without flagging the mismatch.
  **For recurring trend reports (weekly memo, etc.):**
- Week-over-week: current 7 days vs. prior 7 days
- Month-over-month: current 30 days vs. prior 30 days
- Note any seasonal or calendar effects that might explain differences (end of quarter, product announcements, etc.)

## Classification Types for Post-Launch Analysis

| Classification          | Definition                                                                 |
| ----------------------- | -------------------------------------------------------------------------- |
| **Improved**            | Signal that was negative pre-launch and is reduced or absent post-launch   |
| **Regressed**           | New or worsened negative signal introduced or amplified after the launch   |
| **Mixed**               | Both improvement and regression visible in the same theme area             |
| **No change**           | No measurable movement in the signal despite the launch touching this area |
| **Adjacent regression** | A related area degraded even though the primary target area improved       |
| **New theme**           | A feedback pattern that didn't exist or wasn't visible pre-launch          |

## Statistical Guardrails

**Minimum threshold for "significant" change:** Volume change of ≥20% AND at least 3 distinct accounts involved. A change from 1 mention to 2 mentions is not a trend.

**Baseline stability check:** If the baseline period itself was unusual (e.g., a major incident, a seasonal spike), flag it. Don't treat an abnormal baseline as the norm.

**Sentiment movement:** A 10-point sentiment shift (on a 0–100 scale) is the minimum threshold for a "meaningful" sentiment change. Smaller shifts may be noise.

**Don't over-interpret short windows.** Two weeks post-launch is enough to spot regressions and P0 issues. It is not enough to declare a launch "successful." Four to six weeks is needed for a reliable assessment of positive impact.

## Interpreting Adjacent Regressions

Adjacent regressions are the most commonly missed post-launch finding. They occur when:

- A feature change improves the primary workflow but disrupts a secondary workflow that depended on it
- A UI change improves discoverability for one task but reduces it for another
- Performance improvements in one area create load elsewhere
  When producing a post-launch report, always check one level of adjacency beyond the primary launch scope. If you launched changes to the search feature, also check feedback on features that integrate with search.

## Interpreting "No Change"

No change is not automatically a neutral result. It can mean:

- The launch didn't affect the area you hoped to improve (the fix didn't work)
- The area was never the real problem (the diagnosis was wrong)
- Feedback takes longer to accumulate for this type of issue (check back in 30 days)
- The launch affected a segment that doesn't submit feedback
  Flag no-change findings when the launch was explicitly intended to address a previously-identified customer pain. "We shipped X to fix Y but Y signal is unchanged" is an important product signal.
