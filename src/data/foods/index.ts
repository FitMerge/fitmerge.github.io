// Aggregated food database, split into category files that are only pulled in
// through this module — which the search service loads on demand (dynamic
// import) so the ~1500 entries never bloat app startup.

import type { CommonFood } from '../commonFoods'
import { COMMON_FOODS } from '../commonFoods'
import { FOODS as proteins } from './proteins'
import { FOODS as vegetables } from './vegetables'
import { FOODS as fruits } from './fruits'
import { FOODS as dairyEggs } from './dairyEggs'
import { FOODS as grainsLegumesNuts } from './grainsLegumesNuts'
import { FOODS as preparedPantry } from './preparedPantry'

/** Remove duplicates by id and by normalized name; earlier entries win, so the
 * hand-verified core (COMMON_FOODS) takes precedence over generated variants. */
function dedupe(foods: CommonFood[]): CommonFood[] {
  const seenId = new Set<string>()
  const seenName = new Set<string>()
  const out: CommonFood[] = []
  for (const f of foods) {
    const nameKey = f.name.trim().toLowerCase()
    if (seenId.has(f.id) || seenName.has(nameKey)) continue
    seenId.add(f.id)
    seenName.add(nameKey)
    out.push(f)
  }
  return out
}

export const ALL_COMMON_FOODS: CommonFood[] = dedupe([
  ...COMMON_FOODS,
  ...proteins,
  ...vegetables,
  ...fruits,
  ...dairyEggs,
  ...grainsLegumesNuts,
  ...preparedPantry,
])
