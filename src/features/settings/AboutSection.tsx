import Card from '../../components/Card'

export default function AboutSection() {
  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-200 mb-1">About</h2>
      <p className="text-sm text-slate-300">FitMerge</p>
      <p className="text-xs text-slate-500">Version 0.1.0</p>
      <p className="text-xs text-slate-500 mt-2">
        Nutrition tracking, workout logging, and progress charts — all in one lightweight app.
      </p>
    </Card>
  )
}
