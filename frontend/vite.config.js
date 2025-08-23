import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration for the MedScript Sprint 0+ demo.
// This enables the React plugin to provide JSX support and fast refresh.
export default defineConfig({
  plugins: [react()],
});