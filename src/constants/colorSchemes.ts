export const COLOR_SCHEMES = {
  ember: {
    name: 'Тёплый янтарь',
    colors: ['#1F1D20', '#4A292A', '#803E2F', '#A79986', '#292522', '#3E3D38'],
    variables: {
      '--app-bg': 'linear-gradient(155deg, #1f1d20 0%, #4a292a 56%, #803e2f 100%)',
      '--sidebar-bg': '#282322',
      '--card-bg': 'rgba(62, 61, 56, 0.72)',
      '--card-fg': '#f5eee4',
      '--card-bg-active': '#3e3d38',
      '--card-fg-active': '#f5eee4',
      '--group-bg': 'rgba(62, 61, 56, 0.72)',
      '--accent': '#a75942',
      '--accent-hover': '#914633',
      '--accent-active': '#803e2f',
      '--bg': '#1f1d20',
      '--surface': '#292522',
      '--surface-warm': '#3e3d38',
      '--fg': '#f5eee4',
      '--fg-2': '#d3c4b2',
      '--muted': '#b4a99b',
      '--meta': '#a79986',
      '--border': '#4a292a',
      '--border-soft': '#49413c',
      '--success': '#8bc59b',
      '--warn': '#c69b76',
      '--danger': '#dd786b',
      '--toggle-on': '#8bc59b',
      '--fav-star': '#d3a66f',
    },
  },
} as const;

export type ColorSchemeId = keyof typeof COLOR_SCHEMES;

export const COLOR_SCHEME_IDS = Object.keys(COLOR_SCHEMES) as ColorSchemeId[];
