import { useEffect } from "react"
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react"

const iconMap = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const tone = {
  success: "border-emerald-700 bg-emerald-950/60 text-emerald-200",
  error: "border-red-700 bg-red-950/60 text-red-200",
  warning: "border-amber-700 bg-amber-950/60 text-amber-200",
  info: "border-blue-700 bg-blue-950/60 text-blue-200",
}

export function ToastItem({ toast, onDismiss }) {
  const Icon = iconMap[toast.type] || Info

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div className={`w-[320px] rounded-lg border p-3 shadow-[var(--shadow-md)] transition-ui ${tone[toast.type] || tone.info}`}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4" />
        <p className="flex-1 text-sm">{toast.message}</p>
        <button onClick={() => onDismiss(toast.id)}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default function Toast({ toasts, onDismiss }) {
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {toasts.slice(-3).map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
