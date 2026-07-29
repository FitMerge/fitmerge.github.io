/**
 * Whether a query reads like a meal rather than a single food.
 *
 * A database lookup can find "chicken breast"; it cannot find "chicken burrito
 * bowl with rice and guac". Both get the AI offer in the one box — this only
 * decides whether it goes ABOVE the rows or below them, because for a described
 * meal none of the rows are the answer.
 *
 * Deliberately generous: a false positive costs a card in the wrong place, a
 * false negative costs someone scrolling results that will never match.
 */
export function looksLikeMeal(query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q.length < 6) return false
  if (/[,+]|\bwith\b|\band\b|\bplus\b/.test(q)) return true
  // A leading quantity ("two eggs", "8oz sirloin", "1 cup rice") is a portion
  // statement, which search handles badly and the parser handles well.
  if (/^\d|\b(one|two|three|four|half|large|small|medium)\b/.test(q)) return true
  return q.split(/\s+/).length >= 3
}
