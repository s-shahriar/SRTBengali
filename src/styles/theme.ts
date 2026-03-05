export const colors = {
  // Dark backgrounds with cool blue undertones
  bg: '#0a0e1a',           // Deep dark blue-black
  card: '#111827',         // Rich dark slate card
  input: '#1e293b',        // Deep blue-gray input

  // Vibrant cyan/blue accents (replacing purple)
  purple: '#06b6d4',       // Bright cyan (primary) - keeping name for compatibility
  purpleDim: '#0891b2',    // Medium cyan (hover/secondary)
  purpleLight: '#22d3ee',  // Light cyan (highlights)
  purpleDark: '#0e7490',   // Dark cyan (pressed states)

  // Accent colors
  green: '#10b981',        // Vibrant emerald green
  cyan: '#06b6d4',         // Bright cyan (info)
  blue: '#3b82f6',         // Electric blue (secondary accent)
  orange: '#f59e0b',       // Warm orange (warning)

  // Text colors
  text: '#f1f5f9',         // Almost white (primary text)
  textMuted: '#94a3b8',    // Cool blue-gray (secondary text)
  sub: '#38bdf8',          // Light blue (subtext)
  muted: '#64748b',        // Medium slate (disabled/muted)

  // Additional utilities
  border: '#1e3a5f',       // Dark blue border
  success: '#10b981',      // Success state
  error: '#ef4444',        // Error state
  warning: '#f59e0b',      // Warning state
} as const;

export type AppColors = typeof colors;
