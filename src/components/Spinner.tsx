// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

export function Spinner({ size = 20, label }: { size?: number; label?: string }) {
  return (
    <span
      className="mp:inline-block mp:flex-none mp:animate-spin mp:rounded-full mp:border-2 mp:border-current mp:border-r-transparent mp:opacity-85"
      style={{ width: size, height: size }}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  )
}
