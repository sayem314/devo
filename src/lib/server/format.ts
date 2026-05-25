export function formatTime(value?: string) {
  if (!value) return "never";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatDuration(duration_ms?: number) {
  if (duration_ms === undefined) return "pending";
  if (duration_ms < 1000) return `${duration_ms}ms`;
  return `${(duration_ms / 1000).toFixed(1)}s`;
}
