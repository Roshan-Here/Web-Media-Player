// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cx } from '../lib/cx.js'

export interface ControlButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Draws a short accent line under the button, for a setting that is on (subtitles). */
  on?: boolean
  /** Hidden when the player is narrow, for buttons that have a shortcut or a menu twin. */
  wide?: boolean
}

/** A button on the player's control bar: icon sized, with hover and press feedback. */
export const ControlButton = forwardRef<HTMLButtonElement, ControlButtonProps>(
  function ControlButton({ on = false, wide = false, className, type = 'button', ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cx(
          // Phone widths take a slightly smaller button, so every one of them fits in portrait.
          'mp:relative mp:grid mp:h-10 mp:min-w-10 mp:shrink-0 mp:place-items-center mp:rounded-control mp:text-ink mp:@max-[420px]:h-9 mp:@max-[420px]:min-w-9',
          'mp:transition-[background-color,transform] mp:duration-150 mp:ease-soft',
          'mp:hover:not-disabled:bg-ink/12 mp:active:not-disabled:scale-[0.96]',
          'mp:disabled:cursor-not-allowed mp:disabled:text-faint',
          on &&
            'mp:after:absolute mp:after:inset-x-[11px] mp:after:bottom-[5px] mp:after:h-0.5 mp:after:rounded-full mp:after:bg-accent',
          wide && 'mp:@max-[520px]:hidden',
          className,
        )}
        {...rest}
      />
    )
  },
)
