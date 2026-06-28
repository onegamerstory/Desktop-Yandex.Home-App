/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/index.html",
    "./src/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/contexts/**/*.{js,ts,jsx,tsx}",
    "./src/services/**/*.{js,ts,jsx,tsx}",
    "./src/utils/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-warm': 'var(--surface-warm)',
        primary: 'var(--accent)',
        secondary: 'var(--fg-2)',
        accent: 'var(--fav-star)',
        muted: 'var(--muted)',
        border: 'var(--border)',
        'border-soft': 'var(--border-soft)',
        'toggle-on': 'var(--toggle-on)',
      }
    }
  },
  plugins: [],
}
