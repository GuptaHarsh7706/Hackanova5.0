import Button from "../ui/Button"
import Modal from "../ui/Modal"

export default function FilterDrawer({ open, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Filters"
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Reset</Button>
          <Button onClick={onClose}>Apply Filters</Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-[var(--text-secondary)]">
        <p>Asset Class: All / Equity / Crypto / Forex</p>
        <p>Timeframe: All / 1D / 1H / 15M</p>
        <p>Return: All / Profitable / Loss-making</p>
        <p>Date Range: Jan 2020 - Dec 2024</p>
      </div>
    </Modal>
  )
}
