import type { MetadataRoute } from 'next';

// Lets phones add the app to the home screen and open it full screen, without the browser bar.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'My Expenses',
    short_name: 'My Expenses',
    description: 'Household expense tracker',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f5f4f0',
    theme_color: '#f5f4f0',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
