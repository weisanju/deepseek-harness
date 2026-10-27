# Agent Note: Tool rows show the call's elapsed time

Status: implemented

English | [中文](2026-10-27-tool-call-elapsed-time.zh.md)

## Problem

A tool row in the conversation transcript says what was called and what came back, but never how long the call took. `ToolResultNode.callTime` already carries the paired call's start stamp, and its contract reserves that field for the call row's duration, yet no row reads it. The trajectory view renders a duration per call, so the same fact is visible in one place and missing in the place the user reads while the call runs. Someone watching a slow tool has no way to tell a call that is about to finish from one that has just begun.

## Decision

Every tool row carries the call's elapsed time at its trailing edge: a live counter while the call runs, then the duration it took once the result arrives.

The transcript's own timestamps are the timing authority. A running row measures from the dispatched call's start stamp; a settled row measures from the result's paired call time. A result whose call time was truncated out of the loaded window carries neither, and the row shows no label — the transcript cannot show a duration it does not have.

The live counter reads the viewer's own clock, so it can differ slightly from the settled label, which the Host recorded. It ticks once per second, and the label uses the code font so its tabular digits do not jitter while it ticks.

The label draws its units from the `conversation` locale namespace, which `ui-tool` already uses for its row copy, and formats them like the chat stats pills: milliseconds below a second, seconds with a tenth below a minute, and minutes with seconds above it. The question row is exempt, because a question's elapsed time is human wait time rather than tool work.

## Alternatives considered

- **A duration the Host computes.** Rejected: the Host already records both timestamps, so a duration field would be a third representation of a subtraction the client can perform, and the live counter needs the viewer's clock regardless.
- **A label on every row, including calls with no timing.** Rejected: a row whose transcript lost its start stamp would then show a duration no record backs.
- **The counter inside the row's shimmer.** Rejected: a running row renders its content twice — once for assistive technology and once as an aria-hidden sweep copy — so a ticking counter there would run two timers, and the sweep copy would advance at half the intended rate.

## Consequences

- The transcript answers "how long did this take" without opening the trajectory view.
- The label joins the row's accessible name, beside the exit code and diff totals that already sit in it, so an assistive-technology user hears the elapsed time with the row.
- A running row's counter and its settled label can differ by the clock skew between the viewer's machine and the Host; the settled value is the recorded one.
- A call truncated out of the loaded window shows no duration, so one transcript can hold rows both with and without a label.
- The duration units now exist in the `conversation` namespace of all eight locales, mirroring the `chat` namespace's values.

## Testing

`packages/client/ui-tool/tests/tool-duration.client.spec.tsx` covers the timing derivation from preparing, dispatched, and settled blocks, the window-truncated result, the formatter's three tiers, the trailing placement of the label, the live counter under fake timers, and its freezing at the recorded duration.

The recorded-session goldens carry the label as the `{{duration}}` token in every locale. The Chinese millisecond spelling needed a normalizer rule beside the existing second and minute forms, so a zh golden collapses the label the same way the others do.

## Related

[the ui-tool README](../../../../packages/client/ui-tool/README.md) documents the label as user-facing behavior.
