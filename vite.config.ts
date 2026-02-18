import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    root: 'webview',
    build: {
        outDir: path.resolve(__dirname, 'dist'),
        emptyOutDir: false,
        rollupOptions: {
            output: {
                entryFileNames: `webview.js`,
                chunkFileNames: `[name].js`,
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name === 'style.css' || assetInfo.name?.endsWith('.css')) {
                        return 'webview.css';
                    }
                    return '[name].[ext]';
                },
            },
        },
    },
});
