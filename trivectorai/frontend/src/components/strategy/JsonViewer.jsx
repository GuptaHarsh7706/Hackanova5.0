import { Copy } from "lucide-react"

import Button from "../ui/Button"

export default function JsonViewer({ data }) {
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] p-2">
      <div className="mb-2 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigator.clipboard.writeText(JSON.stringify(data, null, 2))}
          className="h-7"
        >
          <Copy className="h-3 w-3" /> Copy
        </Button>
      </div>
      <pre className="max-h-64 overflow-auto text-xs text-[var(--brand-200)]">{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
}
