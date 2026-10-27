// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { useId, type CSSProperties, type ReactNode } from 'react'
import { cx } from '../lib/cx.js'
import { useT } from '../lib/labels.js'
import {
  BOX_OPACITIES,
  COLORS,
  EDGES,
  FONTS,
  POSITIONS,
  SIZES,
  captionCss,
  type SubtitleStyle,
} from '../lib/subtitle-style.js'

/**
 * The subtitle look's controls: size, colour, background, edge, position and typeface, each a
 * row of choices that apply at once. The player's panel shows these, and so can your own settings
 * page: the store they write to redraws the subtitles in every player at once.
 */
export function SubtitleStyleControls({
  value,
  onChange,
  compact = false,
}: {
  value: SubtitleStyle
  onChange: (change: Partial<SubtitleStyle>) => void
  /** Tighter, for the panel over the picture. */
  compact?: boolean
}) {
  const t = useT()
  return (
    <div className={cx('mp:grid', compact ? 'mp:gap-3.5' : 'mp:gap-5')}>
      <Field label={t('styleSize')}>
        <Segmented
          label={t('styleSize')}
          value={value.size}
          options={SIZES.map((s) => ({
            value: s.value,
            label: t(s.label),
            content: (
              <span
                aria-hidden="true"
                className="mp:font-semibold"
                style={{ fontSize: `${Math.round(12 * s.scale)}px` }}
              >
                Aa
              </span>
            ),
          }))}
          onChange={(size) => onChange({ size })}
        />
      </Field>

      <Field label={t('styleColour')}>
        <div
          role="radiogroup"
          aria-label={t('styleColour')}
          className="mp:flex mp:flex-wrap mp:gap-2"
        >
          {COLORS.map((c) => {
            const on = c.value === value.color
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={t(c.label)}
                title={t(c.label)}
                onClick={() => onChange({ color: c.value })}
                className={cx(
                  'mp:grid mp:size-8 mp:place-items-center mp:rounded-full mp:border-2 mp:transition-[border-color,transform] mp:duration-150 mp:ease-standard mp:hover:scale-105 mp:active:scale-95',
                  on ? 'mp:border-accent' : 'mp:border-transparent',
                )}
              >
                <span
                  className="mp:size-5 mp:rounded-full mp:shadow-[inset_0_0_0_1px_rgb(0_0_0/30%)]"
                  style={{ background: c.css }}
                />
              </button>
            )
          })}
        </div>
      </Field>

      <Field label={t('styleBackground')}>
        <div className="mp:flex mp:flex-wrap mp:items-center mp:gap-2">
          <Segmented
            label={t('styleBackground')}
            value={value.box ? 'box' : 'none'}
            options={[
              { value: 'none', label: t('styleBackgroundNone') },
              { value: 'box', label: t('styleBackgroundBox') },
            ]}
            onChange={(v) => onChange({ box: v === 'box' })}
          />
          {value.box ? (
            <Segmented
              label={t('styleHowDark')}
              value={String(value.boxOpacity)}
              options={BOX_OPACITIES.map((o) => ({
                value: String(o),
                label: t('stylePercent', { percent: Math.round(o * 100) }),
              }))}
              onChange={(v) => onChange({ boxOpacity: Number(v) })}
            />
          ) : null}
        </div>
      </Field>

      {value.box ? null : (
        <Field label={t('styleEdge')}>
          <Segmented
            label={t('styleEdge')}
            value={value.edge}
            options={EDGES.map((e) => ({ value: e.value, label: t(e.label) }))}
            onChange={(edge) => onChange({ edge })}
          />
        </Field>
      )}

      <Field label={t('stylePosition')}>
        <Segmented
          label={t('stylePosition')}
          value={value.position}
          options={POSITIONS.map((p) => ({ value: p.value, label: t(p.label) }))}
          onChange={(position) => onChange({ position })}
        />
      </Field>

      <Field label={t('styleTypeface')}>
        <div className="mp:flex mp:flex-wrap mp:items-center mp:gap-2">
          <Segmented
            label={t('styleTypeface')}
            value={value.font}
            options={FONTS.map((f) => ({
              value: f.value,
              label: t(f.label),
              style: { fontFamily: f.css },
            }))}
            onChange={(font) => onChange({ font })}
          />
          <Segmented
            label={t('styleWeight')}
            value={value.bold ? 'bold' : 'regular'}
            options={[
              { value: 'regular', label: t('styleWeightRegular') },
              { value: 'bold', label: t('styleWeightBold'), style: { fontWeight: 700 } },
            ]}
            onChange={(v) => onChange({ bold: v === 'bold' })}
          />
        </div>
      </Field>
    </div>
  )
}

/** A line of subtitle over a picture-like ground, to see a style before a video plays. */
export function SubtitlePreview({
  value,
  className,
}: {
  value: SubtitleStyle
  className?: string
}) {
  const t = useT()
  return (
    <div
      className={cx(
        'mp:@container mp:relative mp:grid mp:aspect-[16/7] mp:place-items-end mp:justify-items-center mp:overflow-hidden mp:rounded-control mp:bg-[linear-gradient(135deg,#3b4a5a_0%,#8a6f55_45%,#d9c7a3_70%,#5a6b4e_100%)] mp:px-4 mp:pb-[7%]',
        className,
      )}
      aria-label={t('stylePreview')}
      role="img"
    >
      <span
        className="mp:max-w-[90%] mp:text-center mp:leading-[1.38] mp:whitespace-pre-line"
        style={captionCss(value, 'clamp(13px, 5.2cqi, 28px)')}
      >
        {t('stylePreviewText')}
      </span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mp:grid mp:gap-1.5">
      <span className="mp:text-xs mp:font-semibold mp:tracking-[0.08em] mp:text-muted mp:uppercase">
        {label}
      </span>
      {children}
    </div>
  )
}

interface SegmentOption<T extends string> {
  value: T
  label: string
  /** What the button shows instead of its label, which then names it for screen readers. */
  content?: ReactNode
  style?: CSSProperties
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: ReadonlyArray<SegmentOption<T>>
  onChange: (value: T) => void
}) {
  const id = useId()
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="mp:inline-flex mp:w-fit mp:max-w-full mp:flex-wrap mp:rounded-full mp:border mp:border-line-strong mp:bg-bg/40 mp:p-0.5"
      id={id}
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.content ? o.label : undefined}
            title={o.content ? o.label : undefined}
            onClick={() => onChange(o.value)}
            style={o.style}
            className={cx(
              'mp:inline-flex mp:min-h-8 mp:min-w-10 mp:items-center mp:justify-center mp:rounded-full mp:px-3 mp:text-sm mp:transition-[background-color,color] mp:duration-150 mp:ease-standard',
              on ? 'mp:bg-ink mp:font-semibold mp:text-bg' : 'mp:text-muted mp:hover:text-ink',
            )}
          >
            {o.content ?? o.label}
          </button>
        )
      })}
    </div>
  )
}
