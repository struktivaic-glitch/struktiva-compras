/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#123B54', light: '#1C5478' },
        halo: '#2563EB',
        accent: '#48B3AC',
        brand: { red: '#E2432F' },
        success: '#1E7E34',
        warning: '#D97706',
        danger: '#C00000',
      },
      fontFamily: {
        display: ['Bahnschrift', '"Segoe UI Semibold"', '-apple-system', 'system-ui', 'sans-serif'],
        body: ['-apple-system', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
