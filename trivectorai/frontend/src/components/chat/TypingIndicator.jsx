export default function TypingIndicator() {
  return (
    <div className="animate-fade-in px-4 py-2">
      <div className="max-w-fit rounded-2xl rounded-bl-sm border border-surface-border bg-surface-card px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 animate-pulse-dot rounded-full bg-brand-400" />
          <span className="h-2.5 w-2.5 animate-pulse-dot rounded-full bg-brand-400 [animation-delay:0.2s]" />
          <span className="h-2.5 w-2.5 animate-pulse-dot rounded-full bg-brand-400 [animation-delay:0.4s]" />
        </div>
      </div>
    </div>
  )
}
