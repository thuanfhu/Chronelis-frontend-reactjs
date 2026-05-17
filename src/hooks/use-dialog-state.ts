import { useState } from 'react'

function useDialogState<T>(defaultOpen: T | null = null) {
  const [open, setOpen] = useState<T | null>(defaultOpen)
  return [open, setOpen] as const
}

export default useDialogState
