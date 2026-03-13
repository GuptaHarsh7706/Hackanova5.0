import { useState } from "react"

import { clearHistoryApi } from "../api/strategyApi"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import Input from "../components/ui/Input"
import Modal from "../components/ui/Modal"
import { useStrategyStore } from "../store/useStrategyStore"

export default function SettingsPage() {
  const settings = useStrategyStore((s) => s.settings)
  const updateSettings = useStrategyStore((s) => s.updateSettings)
  const clearHistory = useStrategyStore((s) => s.clearHistory)
  const addToast = useStrategyStore((s) => s.addToast)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const onSave = () => {
    addToast("success", "Settings saved")
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="text-sm text-[var(--text-secondary)]">Personalize your experience.</p>
      </div>

      <Card className="grid gap-3 p-4 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-[var(--text-secondary)]">Default Capital</label>
          <Input
            value={settings.defaultCapital}
            onChange={(e) => updateSettings({ defaultCapital: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-[var(--text-secondary)]">Risk Profile</label>
          <select
            className="h-10 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-sm"
            value={settings.riskProfile}
            onChange={(e) => updateSettings({ riskProfile: e.target.value })}
          >
            <option value="Conservative">Conservative</option>
            <option value="Balanced">Balanced</option>
            <option value="Aggressive">Aggressive</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.autosave}
            onChange={(e) => updateSettings({ autosave: e.target.checked })}
          />
          Autosave strategies
        </label>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onSave}>Save Settings</Button>
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>Delete all history</Button>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Delete history?">
        <p className="text-sm text-[var(--text-secondary)]">This action is permanent and cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              try {
                await clearHistoryApi()
              } catch {
                // Keep local reset even if backend history is unreachable.
              }
              clearHistory()
              setConfirmOpen(false)
              addToast("warning", "History deleted")
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  )
}
