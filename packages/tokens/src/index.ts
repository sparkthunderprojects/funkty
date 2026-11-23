/**
 * Funkty design tokens. DRAFT: placeholder values until the Phase 0 design system
 * is approved. Every colour, size and radius in web and native comes from here.
 */
export const colors = {
  light: {
    background: '#F6F3EA',
    surface: '#ECE8DC',
    card: '#FFFFFF',
    text: '#1A1A1A',
    textMuted: '#7A766B',
    border: '#E3DFD2',
    primary: '#7C3AED',
    onPrimary: '#FFFFFF',
    danger: '#E5484D',
  },
  dark: {
    background: '#0B0B0D',
    surface: '#1E1E22',
    card: '#17171A',
    text: '#F5F5F5',
    textMuted: '#A1A1AA',
    border: '#2A2A2E',
    primary: '#8B5CF6',
    onPrimary: '#FFFFFF',
    danger: '#FF5C63',
  },
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 12, md: 16, lg: 24, pill: 999 } as const;
export const fontSize = { caption: 12, body: 15, title: 20, headline: 28 } as const;

export type ColorScheme = keyof typeof colors;
export type ColorToken = keyof (typeof colors)['light'];
