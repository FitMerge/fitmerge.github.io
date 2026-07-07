import type { ReactNode } from 'react'

type CardProps = {
  className?: string
  children?: ReactNode
  onClick?: () => void
}

export default function Card({ className = '', children, onClick }: CardProps) {
  return (
    <div
      className={`rounded-2xl bg-slate-900 border border-slate-800 p-4 ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
