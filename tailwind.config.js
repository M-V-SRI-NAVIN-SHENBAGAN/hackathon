/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          700: '#16324f',
          800: '#102a43',
          900: '#0b1f33',
        },
        teal: {
          500: '#0d9488',
          600: '#0f766e',
        },
      },
    },
  },
  plugins: [],
}
