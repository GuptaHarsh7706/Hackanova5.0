import { X } from "lucide-react"

export default function Modal({ open, title, children, onClose, actions }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--bg-overlay)] p-4 backdrop-blur-sm animate-message-in">
      <div className="w-full max-w-lg rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow-lg)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="rounded-md p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-base)]" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div>{children}</div>
        {actions ? <div className="mt-5 flex justify-end gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}
