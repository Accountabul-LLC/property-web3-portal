export const CAUSES_RELEASE_SAFETY_BUFFER_MS = 10_000

export function getCauseReleaseUnlockAt(releaseDate: string): number {
  return new Date(releaseDate).getTime() + CAUSES_RELEASE_SAFETY_BUFFER_MS
}

export function isCauseReleaseReady(releaseDate: string, now = Date.now()): boolean {
  return now >= getCauseReleaseUnlockAt(releaseDate)
}

export function formatCauseReleaseCountdown(releaseDate: string, now = Date.now()): string {
  const remaining = getCauseReleaseUnlockAt(releaseDate) - now
  if (remaining <= 0) return 'Ready to release \u2713'

  const totalSeconds = Math.ceil(remaining / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) return `Unlocks in ${days}d ${hours}h`
  if (hours > 0) return `Unlocks in ${hours}h ${minutes}m`
  if (minutes > 0) return `Unlocks in ${minutes}m ${seconds}s`
  return `Unlocks in ${seconds}s`
}

export function formatCauseReleaseUnlockTimestamp(releaseDate: string): string {
  const unlockAt = getCauseReleaseUnlockAt(releaseDate)
  return new Date(unlockAt).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  })
}
