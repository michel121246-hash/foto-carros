import type { NextConfig } from 'next';
const config: NextConfig = { output: 'standalone', poweredByHeader: false, serverExternalPackages: ['sharp'] };
export default config;
