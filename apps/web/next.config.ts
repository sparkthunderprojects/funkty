import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Internal packages ship as TypeScript source and are compiled by the app.
  transpilePackages: ['@funkty/core', '@funkty/validation', '@funkty/tokens'],
};

export default config;
