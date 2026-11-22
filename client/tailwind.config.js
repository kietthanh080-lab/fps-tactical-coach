/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './background.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Chakra Petch"', 'system-ui', 'sans-serif'],
        sans: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        obsidian: '#0A0D12',
        panel: '#10141C',
        elevated: '#171D28',
        hairline: '#232B3B',
        valorant: '#FF4655',
        pubg: '#E59A23',
      },
    },
  },
  plugins: [],
};
