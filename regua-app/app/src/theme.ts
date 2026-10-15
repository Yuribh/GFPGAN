import { tokens } from './tokens.ts';

/** Short names for the design tokens. Components use these, never raw hex or sizes. */
export const c = {
  bg: tokens.color.bg,
  surface: tokens.color.surface,
  surfaceMuted: tokens.color['surface-muted'],
  border: tokens.color.border,
  borderInput: tokens.color['border-input'],
  text: tokens.color.text,
  muted: tokens.color['text-muted'],
  accent: tokens.color.accent,
  onAccent: tokens.color['on-accent'],
  accentSoft: tokens.color['accent-soft'],
  danger: tokens.color.danger,
};
export const s = tokens.space;            // [0, 4, 8, 12, 16, 24, 32, 48, 64]
export const r = tokens.radius;           // sm 8, md 12, lg 20, pill 999
export const font = tokens.type;          // xs .. display, each { fontSize, lineHeight, fontWeight }
export const layout = tokens.layout;      // screen-gutter 16, tool-tile 72, min-touch-target 48 ...
export const card = {
  backgroundColor: tokens.color.surface,
  borderRadius: tokens.radius.lg,
  shadowColor: '#101828', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1,
};
