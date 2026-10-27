/** Elapsed-time label for a tool call row. */
import { useEffect, useState } from 'react'
import { formatToolDuration, type ToolDurationTranslate, type ToolTiming } from '../models/tool-duration.ts'
import css from './ToolDuration.module.css'

/** How often a running call refreshes its elapsed label. */
export const TOOL_DURATION_TICK_MS = 1000

/**
 * The label for one call's elapsed time: the live counter while the call runs,
 * the settled duration once it has a result, and null when the call carries no
 * timing at all.
 *
 * The ticking state lives here, above the row's shimmer: a running row renders
 * its content twice — once for assistive technology and once as an aria-hidden
 * sweep copy — so a counter placed inside the shimmer would run two timers.
 * @param timing - the call's timing.
 * @param t - translate seat supplying the duration units.
 * @returns the duration label, or null when the call has no timing.
 */
export function useToolDurationLabel(
  timing: ToolTiming | undefined,
  t: ToolDurationTranslate,
): string | null {
  const [now, setNow] = useState(() => Date.now())
  const startedAt = timing?.kind === 'running' ? timing.startedAt : undefined
  const live = startedAt !== undefined
  useEffect(() => {
    if (!live) return
    setNow(Date.now())
    const timer = setInterval(() => { setNow(Date.now()) }, TOOL_DURATION_TICK_MS)
    return () => { clearInterval(timer) }
  }, [live, startedAt])
  if (timing === undefined) return null
  if (timing.kind === 'settled') return formatToolDuration(timing.durationMs, t)
  return formatToolDuration(Math.max(0, now - timing.startedAt), t)
}

/**
 * Render the elapsed label at a tool row's trailing edge.
 * @param props - the formatted duration.
 * @returns the duration label.
 */
export function ToolDuration({ label }: { label: string }) {
  return <span className={css.duration}>{label}</span>
}
