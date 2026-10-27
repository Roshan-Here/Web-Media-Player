// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '../lib/cx.js'
import { Icon, type IconName } from './Icon.js'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'medium' | 'small'

const base = cx(
  'mp:inline-flex mp:items-center mp:justify-center mp:gap-2 mp:rounded-control mp:border mp:border-transparent mp:font-medium mp:leading-none mp:no-underline mp:transition-[background-color,border-color,color,transform] mp:duration-150 mp:ease-soft mp:active:not-disabled:scale-[0.98] mp:disabled:cursor-not-allowed mp:disabled:opacity-55',
)

const variants: Record<Variant, string> = {
  primary: cx('mp:bg-accent mp:text-accent-ink mp:hover:not-disabled:bg-accent-hover'),
  secondary: cx(
    'mp:border-line-strong mp:bg-raised mp:text-ink mp:hover:not-disabled:border-muted',
  ),
  ghost: cx(
    'mp:bg-transparent mp:text-muted mp:hover:not-disabled:bg-raised mp:hover:not-disabled:text-ink',
  ),
}

const sizes: Record<Size, string> = {
  medium: cx('mp:min-h-11 mp:px-5 mp:text-base'),
  small: cx('mp:min-h-9 mp:px-4 mp:text-sm'),
}

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: Variant
  size?: Size
  icon?: IconName
  children?: ReactNode
}

/** The player's text buttons: in its error panel and its end-of-video cards. */
export function Button({
  variant = 'secondary',
  size = 'medium',
  icon,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={cx(base, variants[variant], sizes[size], className)} {...rest}>
      {icon ? <Icon name={icon} size={18} /> : null}
      {children}
    </button>
  )
}
