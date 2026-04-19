import { Link, useLocation } from '@tanstack/react-router'
import { VARIATIONS } from '../data'

export function VariationNav() {
  const location = useLocation()
  const current = location.pathname
  return (
    <nav className="vnav" aria-label="variations">
      {VARIATIONS.map((v) => (
        <Link
          key={v.path}
          to={v.path}
          className={`vnav-link ${current === v.path ? 'is-active' : ''}`}
        >
          {v.label}
        </Link>
      ))}
    </nav>
  )
}
