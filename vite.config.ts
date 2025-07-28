import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/sb1-4putolyz-main/', // Add base URL for GitHub Pages
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
