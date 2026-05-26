import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Загрузка переменных окружения
    const env = loadEnv(mode, '.', '');
    
    return {
        root: 'src',
        base: './',
        
        server: {
            port: 3000,
            host: '0.0.0.0',
        },

        build: {
            outDir: '../dist',
            emptyOutDir: true,
        },

        plugins: [react()],
        
        define: {
            'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
        },
        
        resolve: {
            alias: {
                '@': path.resolve(__dirname, 'src'),
            }
        }
    };
});