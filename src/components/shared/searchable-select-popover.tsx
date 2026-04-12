import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils/cn'

export interface SearchableSelectOption {
  value: string
  label: string
  description?: string
  searchText?: string
  prefix?: ReactNode
}

interface SearchableSelectPopoverProps {
  value?: string
  options: SearchableSelectOption[]
  placeholder: string
  searchPlaceholder: string
  emptyLabel: string
  disabled?: boolean
  triggerClassName?: string
  contentClassName?: string
  onValueChange: (value: string) => void
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightMatch(text: string, keyword: string) {
  const trimmedKeyword = keyword.trim()
  if (!trimmedKeyword) {
    return text
  }

  const matcher = new RegExp(`(${escapeRegExp(trimmedKeyword)})`, 'ig')
  const parts = text.split(matcher)
  const normalizedKeyword = trimmedKeyword.toLowerCase()

  return parts.map((part, index) => (
    part.toLowerCase() === normalizedKeyword
      ? <mark key={`${text}-${index}`} className="rounded bg-primary/15 px-0.5 text-foreground">{part}</mark>
      : <span key={`${text}-${index}`}>{part}</span>
  ))
}

export function SearchableSelectPopover({
  value,
  options,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  disabled = false,
  triggerClassName,
  contentClassName,
  onValueChange,
}: SearchableSelectPopoverProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) {
      setSearch('')
    }
  }, [open])

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  )

  const normalizedSearch = search.trim().toLowerCase()
  const filteredOptions = useMemo(() => {
    if (!normalizedSearch) {
      return options
    }

    return options.filter((option) => {
      const haystack = `${option.label} ${option.description ?? ''} ${option.searchText ?? ''}`.toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [normalizedSearch, options])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between gap-2 px-3 font-normal', triggerClassName)}
        >
          <span className="min-w-0 flex-1 truncate text-left text-sm text-foreground/90">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn('w-(--radix-popover-trigger-width) min-w-72 p-0', contentClassName)}>
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={searchPlaceholder}
          />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            {filteredOptions.map((option) => {
              const isSelected = option.value === value

              return (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    onValueChange(option.value)
                    setOpen(false)
                  }}
                  className="items-start gap-3 px-3 py-2.5"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {option.prefix ? (
                      <span className="mt-0.5 shrink-0">{option.prefix}</span>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {highlightMatch(option.label, search)}
                      </p>
                      {option.description ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {highlightMatch(option.description, search)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <Check className={cn('mt-0.5 size-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
                </CommandItem>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}