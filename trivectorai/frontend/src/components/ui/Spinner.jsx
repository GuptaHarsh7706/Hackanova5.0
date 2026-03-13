export default function Spinner({ className = "h-5 w-5" }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" className="stroke-surface-border" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 1-10 10" className="stroke-brand-400" strokeWidth="4" />
    </svg>
  )
}
