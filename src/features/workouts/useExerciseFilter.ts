import { useMemo, useState } from 'react'
import { EXERCISES, MUSCLE_GROUPS } from '../../data/exercises'
import type { Exercise } from '../../types'

export const ALL_GROUP = 'All'
export const FILTER_GROUPS = [ALL_GROUP, ...MUSCLE_GROUPS]

export function useExerciseFilter(): {
  query: string
  setQuery: (q: string) => void
  group: string
  setGroup: (g: string) => void
  filtered: Exercise[]
} {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string>(ALL_GROUP)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return EXERCISES.filter((e) => {
      const matchesGroup = group === ALL_GROUP || e.muscleGroup === group
      const matchesQuery = !q || e.name.toLowerCase().includes(q)
      return matchesGroup && matchesQuery
    })
  }, [query, group])

  return { query, setQuery, group, setGroup, filtered }
}
