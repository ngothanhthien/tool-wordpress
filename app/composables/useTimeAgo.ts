/**
 * Format a date as a relative time string (e.g., "5 seconds ago", "1 minute ago")
 * Uses Japan timezone (Asia/Tokyo, UTC+9) for the current time reference
 * @param date - Date string, Date object, or null
 * @returns Formatted relative time string
 */
export function useTimeAgo(date: string | Date | null): string {
  if (!date) return '-'

  // Get current time in milliseconds (UTC)
  const now = Date.now()

  // Parse the input date to milliseconds (UTC)
  const past = typeof date === 'string' ? new Date(date).getTime() : date.getTime()

  const diffInSeconds = Math.floor((now - past) / 1000)

  if (diffInSeconds < 0) return 'just now'
  if (diffInSeconds < 60) return `${diffInSeconds} second${diffInSeconds !== 1 ? 's' : ''} ago`

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`

  const diffInWeeks = Math.floor(diffInDays / 7)
  if (diffInWeeks < 4) return `${diffInWeeks} week${diffInWeeks !== 1 ? 's' : ''} ago`

  const diffInMonths = Math.floor(diffInDays / 30)
  if (diffInMonths < 12) return `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''} ago`

  const diffInYears = Math.floor(diffInDays / 365)
  return `${diffInYears} year${diffInYears !== 1 ? 's' : ''} ago`
}
