export default function MissingFieldAlert({ fields = [] }) {
  if (!fields.length) {
    return null
  }

  return (
    <div className="rounded-xl border border-amber-400/40 bg-amber-300/10 p-3 text-amber-100">
      <p className="text-sm font-semibold">Missing details</p>
      <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
        {fields.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-amber-200/80">Click chat to fill these in</p>
    </div>
  )
}
