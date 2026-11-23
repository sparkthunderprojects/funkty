/**
 * Funkty design tokens. DRAFT: placeholder values until the Phase 0 design system
 * is approved. Every colour, size and radius in web and native comes from here.
 */
export const colors = {
  light: {
    background: '#FFFFFF',
    surface: '#EFEFEF',
    text: '#000000',
    textMuted: '#737373',
    border: '#DBDBDB',
    primary: '#0095F6',
    onPrimary: '#FFFFFF',
    danger: '#ED4956',
  },
  dark: {
    background: '#000000',
    surface: '#262626',
    text: '#F5F5F5',
    textMuted: '#A8A8A8',
    border: '#363636',
    primary: '#0095F6',
    onPrimary: '#FFFFFF',
    danger: '#FF4D5A',
  },
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;
export const fontSize = { caption: 12, body: 15, title: 20, headline: 28 } as const;

export type ColorScheme = keyof typeof colors;
export type ColorToken = keyof (typeof colors)['light'];
