import { defineConfig } from 'vite';
export default defineConfig({
  root: 'src/renderer', base: './', publicDir: '../../assets',
  server: { host: '127.0.0.1', port: 5173, strictPort: true, cors: false, fs: { strict: true } },
  build: { outDir: '../../dist/renderer', emptyOutDir: true, target: 'es2022', sourcemap: false }
});
