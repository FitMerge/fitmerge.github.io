import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger'
  full?: boolean
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-emerald-500 text-slate-950 font-semibold',
  ghost: 'bg-slate-800 text-slate-100',
  danger: 'bg-red-500/90 text-white',
}

export default function Button({
  variant = 'primary',
  full = false,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`rounded-xl px-4 py-2.5 active:scale-[.98] transition disabled:opacity-40 ${
        VARIANT_CLASSES[variant]
      } ${full ? 'w-full' : ''} ${className}`}
      {...props}
    />
  )
}
