/**
 * Tool-call timing: the call's start stamp, the elapsed time a settled call
 * took, and the compact label the summary rows show for both.
 */
import type { ToolCallBlock } from '@deepseek-ai/dsh-client-ui-chat/client'
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'

/** The duration vocabulary a tool row's label draws on. */
export type ToolDurationTranslate = Translate<
  'duration.milliseconds' | 'duration.compactSeconds' | 'duration.compactMinutes'
>

/**
 * Locale-neutral timing facts for one tool call: a call still in flight carries
 * its start stamp, a settled call carries the time it took.
 */
export type ToolTiming =
  | { kind: 'running'; startedAt: number }
  | { kind: 'settled'; durationMs: number }

/**
 * Derive the timing facts of one call slice.
 * @param block - preparing call, dispatched call, or result from the snapshot.
 * @returns the call's timing, or undefined when the transcript carries none.
 */
export function toolTiming(block: ToolCallBlock): ToolTiming | undefined {
  if (!('kind' in block)) {
    // A preparing call is still the model streaming its arguments; the call
    // starts when the arguments are dispatched.
    return block.phase === 'start' ? { kind: 'running', startedAt: block.time } : undefined
  }
  const callTime = block.callTime
  // A result whose call fell outside the loaded window carries no timing.
  if (callTime === null) return undefined
  return { kind: 'settled', durationMs: Math.max(0, block.time - callTime) }
}

/**
 * Format an elapsed duration for a tool row: milliseconds below a second,
 * seconds with a tenth below a minute, and minutes with seconds above it.
 * The second and minute tiers match the chat stats pills, so a tool row and
 * the session stats read the same elapsed time the same way.
 * @param ms - elapsed milliseconds.
 * @param t - translate seat supplying the duration units.
 * @returns the duration label.
 */
export function formatToolDuration(ms: number, t: ToolDurationTranslate): string {
  const s = ms / 1000
  if (s < 1) return t('duration.milliseconds', { milliseconds: Math.round(ms) })
  if (s < 60) return t('duration.compactSeconds', { seconds: Math.round(s * 10) / 10 })
  const whole = Math.round(s)
  return t('duration.compactMinutes', { minutes: Math.floor(whole / 60), seconds: whole % 60 })
}
