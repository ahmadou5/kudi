/**
 * Intelligent relative timestamp formatting for transactions.
 * Rules:
 * - < 5s ago: "Just now"
 * - < 60s ago: "25s ago"
 * - < 60m ago: "5m ago"
 * - < 24h ago: "2h ago"
 * - 1 day ago: "Yesterday, 10:32 AM"
 * - > 1 day ago: "Sep 22, 10:32 AM"
 */
export function formatIntelligentTimestamp(timestamp?: string | number | Date): string {
  if (!timestamp) return 'Recently';

  const dateObj = new Date(timestamp);
  if (isNaN(dateObj.getTime())) return String(timestamp || 'Recently');

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();

  // If timestamp is in the future or within 5 seconds
  if (diffMs < 5000) return 'Just now';

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffSec < 60) {
    return `${diffSec}s ago`;
  }

  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }

  if (diffHrs < 24) {
    return `${diffHrs}h ago`;
  }

  if (diffDays === 1) {
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `Yesterday, ${timeStr}`;
  }

  // After 1 day: Date format e.g. "Sep 22, 10:32 AM"
  const dateStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${dateStr}, ${timeStr}`;
}
