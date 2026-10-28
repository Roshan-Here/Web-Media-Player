// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { useMemo, type ReactNode } from 'react'
import { LabelsContext, makeTranslate, resolveLabels, type PlayerLabels } from '../lib/labels.js'

/**
 * The player's labels for its parts used outside a `<Player>`: `SubtitleStyleControls` on a
 * settings page, `PlayerLoader` on a placeholder. Inside a player, its `labels` prop does this.
 */
export function LabelsProvider({
  labels,
  children,
}: {
  labels?: Partial<PlayerLabels>
  children: ReactNode
}) {
  const t = useMemo(() => makeTranslate(resolveLabels(labels)), [labels])
  return <LabelsContext.Provider value={t}>{children}</LabelsContext.Provider>
}
