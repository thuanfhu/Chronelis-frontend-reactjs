import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils/cn'

export interface SearchableSelectOption {
  value: string
  label: string
  description?: string
  searchText?: string
  prefix?: ReactNode
  statusName?: string
  priority?: string
  goalId?: string | number
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

  return parts.map((part, index) =>
    part.toLowerCase() === normalizedKeyword ? (
      <mark key={`${text}-${index}`} className="rounded bg-primary/15 px-0.5 text-foreground">
        {part}
      </mark>
    ) : (
      <span key={`${text}-${index}`}>{part}</span>
    ),
  )
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

  const selectedOption = useMemo(() => options.find((option) => option.value === value), [options, value])

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
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between gap-2 px-3 font-normal min-w-0', triggerClassName)}
        >
          <span className="min-w-0 flex-1 truncate text-left text-sm text-foreground/90">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn('w-(--radix-popover-trigger-width) min-w-72 p-0', contentClassName)}>
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder={searchPlaceholder} />
          <CommandList className="max-h-[250px] overflow-y-auto">
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
                    {option.prefix ? <span className="mt-0.5 shrink-0">{option.prefix}</span> : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{highlightMatch(option.label, search)}</p>
                      {option.statusName || option.priority || option.goalId ? (
                        <div className="grid grid-cols-[80px_80px_auto] gap-1.5 mt-1 text-xs items-center">
                          {option.statusName ? (
                            <span
                              className={cn(
                                'inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border w-full',
                                (() => {
                                  const name = option.statusName.toLowerCase()
                                  if (name.includes('todo') || name.includes('to do'))
                                    return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                  if (name.includes('progress') || name.includes('doing'))
                                    return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800'
                                  if (name.includes('done') || name.includes('complete'))
                                    return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800'
                                  return 'bg-background text-muted-foreground border-border/70'
                                })(),
                              )}
                            >
                              {option.statusName}
                            </span>
                          ) : null}
                          {option.priority ? (
                            <span
                              className={cn(
                                'inline-flex items-center justify-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium border w-full',
                                option.priority === 'LOW' &&
                                  'border-emerald-800/60 bg-emerald-700/30 text-emerald-950 dark:border-emerald-200/70 dark:bg-emerald-500/44 dark:text-emerald-50',
                                option.priority === 'MEDIUM' &&
                                  'border-blue-700/60 bg-blue-600/30 text-blue-950 dark:border-blue-300/70 dark:bg-blue-500/40 dark:text-blue-50',
                                option.priority === 'HIGH' &&
                                  'border-orange-700/60 bg-orange-600/30 text-orange-950 dark:border-orange-300/70 dark:bg-orange-500/40 dark:text-orange-50',
                                option.priority === 'URGENT' &&
                                  'border-rose-700/60 bg-rose-600/30 text-rose-950 dark:border-rose-300/70 dark:bg-rose-500/42 dark:text-rose-50',
                              )}
                            >
                              <span
                                className={cn(
                                  'inline-block size-1 rounded-full',
                                  option.priority === 'LOW' && 'bg-emerald-800 dark:bg-emerald-200',
                                  option.priority === 'MEDIUM' && 'bg-blue-700 dark:bg-blue-300',
                                  option.priority === 'HIGH' && 'bg-orange-700 dark:bg-orange-300',
                                  option.priority === 'URGENT' && 'bg-rose-700 dark:bg-rose-300',
                                )}
                              />
                              {option.priority}
                            </span>
                          ) : null}
                          {option.goalId ? (
                            <span className="inline-flex items-center rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/50 dark:text-violet-300 w-fit justify-self-start">
                              Goal #{option.goalId}
                            </span>
                          ) : (
                            <div />
                          )}
                        </div>
                      ) : option.description ? (
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
