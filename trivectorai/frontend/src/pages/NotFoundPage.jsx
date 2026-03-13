import { Link } from "react-router-dom"

import Button from "../components/ui/Button"

export default function NotFoundPage() {
  return (
    <div className="grid min-h-[70vh] place-items-center p-6">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">404</p>
        <h1 className="mt-2 text-4xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">The route you requested does not exist.</p>
        <div className="mt-4">
          <Link to="/app">
            <Button>Go to App</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
