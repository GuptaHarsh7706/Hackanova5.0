const statusStyle = {
  done: {
    dot: "bg-[var(--success)]",
    label: "Done",
    labelClass: "text-[var(--success)]",
  },
  active: {
    dot: "bg-[var(--info)] animate-pulse",
    label: "In progress",
    labelClass: "text-[var(--info)]",
  },
  pending: {
    dot: "bg-[var(--text-muted)]",
    label: "Pending",
    labelClass: "text-[var(--text-muted)]",
  },
  error: {
    dot: "bg-[var(--danger)]",
    label: "Failed",
    labelClass: "text-[var(--danger)]",
  },
  blocked: {
    dot: "bg-[var(--warning)]",
    label: "Blocked",
    labelClass: "text-[var(--warning)]",
  },
}

export default function TypingIndicator({ text, steps = [] }) {
  return (
    <div className="max-w-[84%] rounded-sm border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2">
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <span className="font-mono font-semibold text-[var(--brand-200)]">TV</span>
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-[var(--text-secondary)] [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-[var(--text-secondary)] [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-[var(--text-secondary)] [animation-delay:300ms]" />
        </div>
      </div>
      {text ? <div className="mt-2 font-mono text-[11px] text-[var(--text-secondary)]">{text}</div> : null}

      {steps.length > 0 ? (
        <div className="mt-2 space-y-1.5 border-t border-[var(--border-default)] pt-2">
          {steps.map((step) => {
            const style = statusStyle[step.status] || statusStyle.pending
            return (
              <div key={step.id} className="flex items-start justify-between gap-3 text-[11px]">
                <div className="flex min-w-0 items-start gap-2 text-[var(--text-secondary)]">
                  <span className={`mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full ${style.dot}`} />
                  <div className="min-w-0">
                    <p className="truncate">{step.label}</p>
                    {step.agent ? <p className="truncate font-mono text-[10px] text-[var(--text-muted)]">{step.agent}</p> : null}
                    {step.detail ? <p className="text-[10px] text-[var(--text-muted)]">{step.detail}</p> : null}
                  </div>
                </div>
                <span className={`mt-0.5 flex-shrink-0 font-mono font-medium ${style.labelClass}`}>{style.label}</span>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
