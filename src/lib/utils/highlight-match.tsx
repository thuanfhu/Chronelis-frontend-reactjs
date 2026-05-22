import type { ReactNode } from 'react'

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function highlightMatch(text: string, keyword: string): ReactNode {
  const trimmedKeyword = keyword.trim()
  if (!trimmedKeyword) return text

  const matcher = new RegExp(`(${escapeRegExp(trimmedKeyword)})`, 'ig')
  const parts = text.split(matcher)
  const normalizedKeyword = trimmedKeyword.toLowerCase()

  return parts.map((part, index) =>
    part.toLowerCase() === normalizedKeyword ? (
      <mark key={`${text}-${index}`} className="rounded bg-primary/20 px-0.5 text-foreground not-italic">
        {part}
      </mark>
    ) : (
      <span key={`${text}-${index}`}>{part}</span>
    ),
  )
}
