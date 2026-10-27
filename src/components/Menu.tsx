// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cx } from '../lib/cx.js'
import { Icon } from './Icon.js'

export interface MenuOption {
  value: string
  label: string
  detail?: string | null
  disabled?: boolean
}

export interface MenuSection {
  heading?: string
  options: MenuOption[]
  selected: string | null
  onSelect: (value: string) => void
  /** Shown instead of the options when there are none. */
  empty?: string
  /** Short options side by side on one row, such as playback speeds. */
  layout?: 'list' | 'row'
}

export interface MenuButtonProps {
  /** Renders the button that opens the menu; receives what the button must carry. */
  trigger: (props: {
    open: boolean
    toggle: () => void
    ariaProps: Record<string, string | boolean>
  }) => ReactNode
  label: string
  sections: MenuSection[]
  onOpenChange?: (open: boolean) => void
  /** Which edge of the button the menu lines up with: the end (the default) or the start. */
  align?: 'start' | 'end'
  className?: string
}

/**
 * A pop-up list of choices above the player's control bar, built on the menu pattern:
 * arrow keys move between items, Enter or Space picks one, Escape and a click outside close it.
 */
export function MenuButton({
  trigger,
  label,
  sections,
  onOpenChange,
  align = 'end',
  className,
}: MenuButtonProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const id = useId()

  const setOpenState = (next: boolean) => {
    setOpen(next)
    onOpenChange?.(next)
  }

  useEffect(() => {
    if (!open) return
    const menu = menuRef.current
    const items = () =>
      Array.from(
        menu?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]:not(:disabled)') ?? [],
      )
    const checked = menu?.querySelector<HTMLButtonElement>('[aria-checked="true"]:not(:disabled)')
    ;(checked ?? items()[0])?.focus()

    const onPointer = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpenState(false)
    }
    const onKey = (event: KeyboardEvent) => {
      const list = items()
      const index = list.indexOf(document.activeElement as HTMLButtonElement)
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setOpenState(false)
        wrapRef.current?.querySelector<HTMLButtonElement>('[aria-haspopup]')?.focus()
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        event.stopPropagation()
        const step = event.key === 'ArrowDown' ? 1 : -1
        list[(index + step + list.length) % list.length]?.focus()
      } else if (event.key === 'Tab') {
        setOpenState(false)
      }
    }
    document.addEventListener('pointerdown', onPointer)
    menu?.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      menu?.removeEventListener('keydown', onKey)
    }
    // setOpenState only wraps setState and a callback prop; re-running each render is not wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <div className={cx('mp:relative', className)} ref={wrapRef}>
      {trigger({
        open,
        toggle: () => setOpenState(!open),
        ariaProps: { 'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-controls': id },
      })}
      {open ? (
        <div
          className={cx(
            'mp:absolute mp:bottom-[calc(100%+10px)] mp:z-30',
            align === 'start' ? 'mp:left-0' : 'mp:right-0',
            'mp:max-h-[min(70vh,440px)] mp:max-w-[min(340px,86vw)] mp:min-w-60 mp:overflow-y-auto mp:rounded-xl mp:border mp:border-line-strong mp:bg-surface/96 mp:p-2 mp:shadow-[0_18px_40px_-12px_color-mix(in_srgb,var(--mp-color-shadow)_70%,transparent)] mp:backdrop-blur-md',
          )}
          role="menu"
          id={id}
          aria-label={label}
          ref={menuRef}
        >
          {sections.map((section, s) => (
            <div
              key={section.heading ?? s}
              role="group"
              className="mp:not-first:mt-2 mp:not-first:border-t mp:not-first:border-line mp:not-first:pt-1"
              aria-label={section.heading ?? label}
            >
              {section.heading ? (
                <div className="mp:px-3 mp:pt-2 mp:pb-1 mp:text-xs mp:font-semibold mp:text-faint">
                  {section.heading}
                </div>
              ) : null}
              {section.options.length === 0 && section.empty ? (
                <p className="mp:p-3 mp:text-sm mp:text-muted">{section.empty}</p>
              ) : null}
              {section.layout === 'row' ? (
                <div className="mp:flex mp:flex-wrap mp:gap-1 mp:px-2 mp:pt-1 mp:pb-2">
                  {section.options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="menuitemradio"
                      aria-checked={option.value === section.selected}
                      aria-label={option.detail ?? option.label}
                      disabled={option.disabled}
                      className={cx(
                        'mp:min-h-[34px] mp:min-w-11 mp:rounded-control mp:border mp:px-2 mp:text-sm mp:tabular-nums mp:transition-colors mp:hover:bg-raised mp:focus-visible:bg-raised mp:focus-visible:outline-none',
                        option.value === section.selected
                          ? 'mp:border-accent mp:bg-accent/14 mp:text-accent'
                          : 'mp:border-line-strong mp:text-ink',
                      )}
                      onClick={() => {
                        section.onSelect(option.value)
                        setOpenState(false)
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
              {section.layout === 'row'
                ? null
                : section.options.map((option) => {
                    const checked = option.value === section.selected
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={checked}
                        disabled={option.disabled}
                        className="mp:grid mp:min-h-10 mp:w-full mp:grid-cols-[18px_minmax(0,1fr)] mp:items-center mp:gap-2 mp:rounded-control mp:border-0 mp:bg-transparent mp:px-3 mp:py-1 mp:text-left mp:text-sm mp:text-ink mp:hover:bg-raised mp:focus-visible:bg-raised mp:focus-visible:outline-none mp:disabled:cursor-not-allowed mp:disabled:text-faint mp:disabled:hover:bg-transparent"
                        onClick={() => {
                          section.onSelect(option.value)
                          setOpenState(false)
                        }}
                      >
                        <span className="mp:text-accent">
                          {checked ? <Icon name="check" size={16} /> : null}
                        </span>
                        <span className="mp:grid mp:min-w-0">
                          <span className="mp:truncate">{option.label}</span>
                          {option.detail ? (
                            <span className="mp:text-xs mp:text-faint">{option.detail}</span>
                          ) : null}
                        </span>
                      </button>
                    )
                  })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
