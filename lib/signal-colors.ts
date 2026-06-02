/**
 * Color per Inter-1 signal type. The ten-signal vocabulary splits into
 * supportive cues (cool/green), strain cues (amber/red), and reading cues
 * (blue/violet), so a glance at the timeline reads as "going well" vs "strain"
 * without needing the legend.
 */
export const SIGNAL_COLORS: Record<string, string> = {
  agreement: "#34d399", // emerald
  confidence: "#22d3ee", // cyan
  interest: "#a3e635", // lime
  hesitation: "#fbbf24", // amber
  uncertainty: "#f59e0b", // darker amber
  confusion: "#fb923c", // orange
  stress: "#f87171", // red
  frustration: "#ef4444", // deeper red
  disagreement: "#c084fc", // violet
  skepticism: "#818cf8", // indigo
};

export const SIGNAL_FALLBACK_COLOR = "#a3a3a3";

export function signalColor(type: string): string {
  return SIGNAL_COLORS[type] ?? SIGNAL_FALLBACK_COLOR;
}
