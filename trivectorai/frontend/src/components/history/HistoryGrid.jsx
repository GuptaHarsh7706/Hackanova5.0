import EmptyState from "../ui/EmptyState"
import HistoryCard from "./HistoryCard"

export default function HistoryGrid({ items, onOpen, onDelete }) {
  if (!items.length) {
    return <EmptyState title="No strategies yet" description="Run your first backtest to see it here." />
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <HistoryCard key={item.id} item={item} onOpen={onOpen} onDelete={onDelete} />
      ))}
    </div>
  )
}
