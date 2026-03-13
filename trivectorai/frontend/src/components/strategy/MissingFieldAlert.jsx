export default function MissingFieldAlert({ fields = [] }) {
  if (!fields.length) return null
  return (
    <div className="rounded-lg border border-amber-700/70 bg-amber-950/30 p-2 text-xs text-amber-200">
      <p className="font-semibold">Missing</p>
      <ul className="mt-1 list-disc pl-4">
        {fields.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </div>
  )
}
