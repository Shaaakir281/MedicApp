/**
 * Tailwind CSS configuration (CommonJS format) for the MedScript Sprint 0+ demo.
 *
 * The `content` array lists all files where Tailwind should scan for class names.
 * DaisyUI is included to provide ready‑made UI components and themes. We keep
 * the light theme by default.
 */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: ['light'],
  },
};