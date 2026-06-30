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
        'primary-hover': 'var(--accent-hover)',
        'primary-active': 'var(--accent-active)',
        secondary: 'var(--fg-2)',
        accent: 'var(--fav-star)',
        muted: 'var(--muted)',
        border: 'var(--border)',
        'border-soft': 'var(--border-soft)',
        'toggle-on': 'var(--toggle-on)',
        'app-bg': 'var(--app-bg)',
        'sidebar-bg': 'var(--sidebar-bg)',
        'card-bg': 'var(--card-bg)',
        'card-fg': 'var(--card-fg)',
        'card-bg-active': 'var(--card-bg-active)',
        'card-fg-active': 'var(--card-fg-active)',
        'group-bg': 'var(--group-bg)',
      }
    }
  },
  plugins: [],
}
