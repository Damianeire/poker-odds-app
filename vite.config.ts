import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: './',
  plugins: [preact()],
  server: { port: Number(process.env.PORT) || 5173 },
  build: { target: 'es2022' },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000,
  },
});
