const previousOpenStatusByTaskId = new Map<number, number>()

export function rememberTaskOpenStatus(taskId: number, statusId: number): void {
  previousOpenStatusByTaskId.set(taskId, statusId)
}

export function getRememberedTaskOpenStatus(taskId: number): number | null {
  return previousOpenStatusByTaskId.get(taskId) ?? null
}

export function clearRememberedTaskOpenStatus(taskId: number): void {
  previousOpenStatusByTaskId.delete(taskId)
}
