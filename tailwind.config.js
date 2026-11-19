/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0f172a', // slate-900 (luxury feel)
          light: '#334155',
        },
        accent: {
          DEFAULT: '#d4af37', // metallic gold
          light: '#fde047',
        }
      }
    },
  },
  plugins: [],
}
