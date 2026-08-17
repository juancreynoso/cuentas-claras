import { fileURLToPath } from 'node:url';
// `vitest/config` extiende el tipo de configuración de Vite con el bloque
// `test`, que el `defineConfig` de 'vite' no conoce.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

// En producción el Worker sirve la API y los assets desde el mismo origen, así
// que no hay CORS. En desarrollo replicamos ese origen único con un proxy de
// /api hacia `wrangler dev`.
export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      // El contrato con el backend vive fuera de web/: un solo lugar donde se
      // definen los tipos y la lógica de dominio que ambos lados comparten.
      '@shared': resolvePath('../shared'),
      '@': resolvePath('./src'),
    },
  },

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Los tests de la lógica de dominio viven junto al código en shared/.
    include: ['src/**/*.{test,spec}.{ts,tsx}', '../shared/**/*.{test,spec}.ts'],
  },
});
