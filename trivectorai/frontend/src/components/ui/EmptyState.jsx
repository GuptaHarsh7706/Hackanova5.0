import Button from "./Button"

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      {Icon ? <Icon className="h-9 w-9 text-[var(--text-muted)]" /> : null}
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="max-w-md text-sm text-[var(--text-secondary)]">{description}</p>
      {action ? (
        <Button variant={action.variant || "primary"} onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}
