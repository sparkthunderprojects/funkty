/**
 * Funkty design tokens. DRAFT: placeholder values until the Phase 0 design system
 * is approved. Every colour, size and radius in web and native comes from here.
 */
export const colors = {
  light: {
    background: '#FFFFFF',
    surface: '#F5F5F7',
    text: '#0B0B10',
    textMuted: '#6B6B76',
    border: '#E4E4E9',
    primary: '#7B3FF2',
    onPrimary: '#FFFFFF',
    danger: '#E5484D',
  },
  dark: {
    background: '#000000',
    surface: '#15151A',
    text: '#F5F5F7',
    textMuted: '#9A9AA5',
    border: '#2A2A31',
    primary: '#9B6BFF',
    onPrimary: '#000000',
    danger: '#FF6369',
  },
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;
export const fontSize = { caption: 12, body: 15, title: 20, headline: 28 } as const;

export type ColorScheme = keyof typeof colors;
export type ColorToken = keyof (typeof colors)['light'];
