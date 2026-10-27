// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDisclosure } from '@deepseek-ai/dsh-client-ui-chat/src/client/chat/use-disclosure.ts'
import { act, cleanup, render } from '@testing-library/react'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { PreparingToolCall, StartedToolCall, ToolResultNode } from '@deepseek-ai/dsh-client-ui-chat/client'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { zh } from '@deepseek-ai/dsh-client-ui-conversation/src/client/locales.ts'
import { PartialArguments } from '@deepseek-ai/dsh-util-values'
import { formatToolDuration, toolTiming, type ToolTiming } from '../src/client/tool/models/tool-duration.ts'
import { ToolRow } from '../src/client/tool/components/ToolRow.tsx'
import { BashRow } from '../src/client/tool/toolviews/bash-sample.tsx'

type BashRowProps = Parameters<typeof BashRow>[0]

const t = makeTranslate(zh, commonZh)

const SID = 's1' as SessionId

const ARGS = '{"command":"ls -la","description":"List files"}'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const preparing = (over?: Partial<PreparingToolCall>): PreparingToolCall => ({
  phase: 'preparing', args: PartialArguments.fromText(ARGS), callId: 'c1', name: 'bash',
  turn: 1, step: 1, time: 1_000, subCalls: [], ...over,
})

const started = (over?: Partial<StartedToolCall>): StartedToolCall => ({
  phase: 'start', argsRaw: ARGS, args: PartialArguments.fromText(ARGS),
  callId: 'c1', name: 'bash', turn: 1, step: 1, time: 1_000, subCalls: [], ...over,
})

const settled = (over?: Partial<ToolResultNode>): ToolResultNode => ({
  kind: 'tool-result', seq: 10, time: 2_000, callId: 'c1', name: 'bash',
  args: PartialArguments.fromText(ARGS), call: { name: 'bash', argsRaw: ARGS },
  callTime: 1_000, content: [], isError: false, subCalls: [], ...over,
})

const runningTiming = (startedAt: number): ToolTiming => ({ kind: 'running', startedAt })
const settledTiming = (durationMs: number): ToolTiming => ({ kind: 'settled', durationMs })

/**
 * The visible copies of a label: a running row also renders it inside the
 * shimmer's aria-hidden sweep copy, which assistive technology never reads.
 */
function visibleLabels(container: HTMLElement, text: string): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('*')).filter(el =>
    el.children.length === 0 && el.textContent === text && el.closest('[aria-hidden="true"]') === null)
}

describe('toolTiming', () => {
  it('starts the clock when the arguments are dispatched, not while they stream', () => {
    expect(toolTiming(preparing())).toBeUndefined()
    expect(toolTiming(started())).toEqual({ kind: 'running', startedAt: 1_000 })
  })

  it('measures a settled call from its paired call stamp', () => {
    expect(toolTiming(settled())).toEqual({ kind: 'settled', durationMs: 1_000 })
    // A result whose call left the loaded window carries no duration.
    expect(toolTiming(settled({ callTime: null }))).toBeUndefined()
    // A clock that moved backwards never reports a negative duration.
    expect(toolTiming(settled({ time: 500 }))).toEqual({ kind: 'settled', durationMs: 0 })
  })
})

describe('formatToolDuration', () => {
  it.each([
    { ms: 0, label: '0毫秒' },
    { ms: 340, label: '340毫秒' },
    { ms: 999, label: '999毫秒' },
    { ms: 1_000, label: '1秒' },
    { ms: 1_500, label: '1.5秒' },
    { ms: 59_500, label: '59.5秒' },
    { ms: 60_000, label: '1分0秒' },
    { ms: 125_000, label: '2分5秒' },
  ])('formats $ms ms as $label', ({ ms, label }) => {
    expect(formatToolDuration(ms, t)).toBe(label)
  })
})

describe('tool row duration', () => {
  const rowProps = {
    useDisclosure,
    t,
    variant: 'bash' as const, icon: <i data-testid="tool-icon" />, title: 'Bash',
    summary: 'List files', bodyRaw: '{"a":1}', state: 'ok' as const,
  }

  it('shows the settled duration at the row\'s trailing edge', () => {
    const view = render(<ToolRow {...rowProps} timing={settledTiming(1_500)} />)
    const duration = view.getByText('1.5秒')
    expect(duration.className).toContain('duration')
    // The label trails the summary instead of travelling inside its ellipsis.
    const summary = view.getByText('List files')
    expect(summary.contains(duration)).toBe(false)
  })

  it('keeps the duration on a failed row, where the summary carries the failure', () => {
    const view = render(
      <ToolRow {...rowProps} state="error" errorSummary="boom" timing={settledTiming(1_500)} />,
    )
    expect(view.getByText('boom')).toBeTruthy()
    expect(view.getByText('1.5秒')).toBeTruthy()
  })

  it('shows no duration for a call without timing', () => {
    const view = render(<ToolRow {...rowProps} />)
    expect(view.queryByText(/秒/)).toBeNull()
  })

  it('ticks the elapsed time while the call runs and freezes it once it settles', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    const view = render(<ToolRow {...rowProps} state="running" timing={runningTiming(1_000_000)} />)
    expect(visibleLabels(view.container, '0毫秒')).toHaveLength(1)
    act(() => { vi.advanceTimersByTime(1_000) })
    expect(visibleLabels(view.container, '1秒')).toHaveLength(1)
    // The settled call reports the duration it took, not the running counter.
    view.rerender(<ToolRow {...rowProps} state="ok" timing={settledTiming(2_500)} />)
    expect(visibleLabels(view.container, '2.5秒')).toHaveLength(1)
    act(() => { vi.advanceTimersByTime(5_000) })
    expect(visibleLabels(view.container, '2.5秒')).toHaveLength(1)
  })

  it('shows no duration for a call still preparing its arguments', () => {
    const view = render(<ToolRow {...rowProps} state="preparing" />)
    expect(view.queryByText(/秒/)).toBeNull()
  })
})

describe('bash row duration', () => {
  const list = () => createSnapshotStore<SessionListState>({
    ids: [SID],
    byId: { [SID]: { id: SID, displayTitle: 'r', running: false, retainedBy: {}, blank: false, updatedAt: 0 } },
    phase: 'ready',
    projectionsBySession: {},
  })

  const rowProps = (block: StartedToolCall | ToolResultNode): BashRowProps => ({
    useDisclosure, callId: 'c1', toolName: 'bash',
    ...('kind' in block ? { phase: 'result' as const, block } : { phase: block.phase, block }),
    openFile: vi.fn(), sessionId: SID, useSessions: bindSnapshotSelector(list()), t,
  } as BashRowProps)

  it('shows the settled duration beside the command summary', () => {
    const view = render(<BashRow {...rowProps(settled())} />)
    expect(view.getByText('List files')).toBeTruthy()
    expect(view.getByText('1秒')).toBeTruthy()
  })

  it('counts up while the command runs', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    const view = render(<BashRow {...rowProps(started({ time: 1_000_000 }))} />)
    expect(visibleLabels(view.container, '0毫秒')).toHaveLength(1)
    act(() => { vi.advanceTimersByTime(2_000) })
    expect(visibleLabels(view.container, '2秒')).toHaveLength(1)
  })
})
