import { useState } from 'react'
import { MoreVertical } from 'lucide-react'
import Card from '../../components/Card'
import Sheet from '../../components/Sheet'
import Button from '../../components/Button'
import { weekdayLabels } from './utils'
import type { Routine } from '../../types'

type RoutineCardProps = {
  routine: Routine
  onOpen: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}

export default function RoutineCard({ routine, onOpen, onEdit, onDuplicate, onDelete }: RoutineCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function closeMenu() {
    setMenuOpen(false)
    setConfirmDelete(false)
  }

  const scheduleDays = routine.scheduleDays ?? []

  return (
    <>
      <Card className="active:bg-slate-800/60" onClick={onOpen}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-100 truncate">{routine.name}</h3>
            <p className="text-xs text-slate-500">
              {routine.items.length} exercise{routine.items.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen(true)
            }}
            aria-label="Routine options"
            className="shrink-0 w-8 h-8 rounded-full bg-slate-800 active:bg-slate-700 flex items-center justify-center text-slate-400"
          >
            <MoreVertical size={16} />
          </button>
        </div>

        <div className="mt-3 flex gap-1.5">
          {weekdayLabels().map((label, idx) => (
            <span
              key={idx}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium ${
                scheduleDays.includes(idx) ? 'bg-primary-500 text-slate-950' : 'bg-slate-800 text-slate-500'
              }`}
            >
              {label}
            </span>
          ))}
        </div>
      </Card>

      <Sheet open={menuOpen} onClose={closeMenu} title={routine.name}>
        {!confirmDelete ? (
          <div className="space-y-2">
            <Button
              variant="ghost"
              full
              onClick={() => {
                closeMenu()
                onEdit()
              }}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              full
              onClick={() => {
                closeMenu()
                onDuplicate()
              }}
            >
              Duplicate
            </Button>
            <Button variant="danger" full onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              Delete &ldquo;{routine.name}&rdquo;? This can&apos;t be undone.
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" full onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                full
                onClick={() => {
                  closeMenu()
                  onDelete()
                }}
              >
                Yes, delete
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  )
}
