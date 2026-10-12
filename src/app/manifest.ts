import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Paperback Library',
        short_name: 'Paperback',
        description: 'Personal offline e-reader library and character map',
        start_url: '/',
        display: 'standalone',
        background_color: '#111214',
        theme_color: '#f8f6f0',
        orientation: 'portrait-primary',
        icons: [
            {
                src: '/icon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'any',
            },
            {
                src: '/icon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'maskable',
            },
        ],
    };
}