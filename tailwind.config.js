/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        veo: {
          green: '#30FF51',
          red: '#FF3030',
          bg: '#000000',
          surface: '#0b0e11',
          border: '#1a1f26',
          muted: '#2a3040',
          text: '#e0e8f0',
          dim: '#6b7a8d',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'monospace'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      animation: {
        'pulse-green': 'pulse-green 2s ease-in-out infinite',
        'slide-in': 'slide-in 0.3s ease-out',
        'fade-in': 'fade-in 0.4s ease-out',
        'scan': 'scan 3s linear infinite',
        'ticker': 'ticker 20s linear infinite',
        'neon-pulse-green': 'neon-pulse-green 1.5s ease-in-out infinite',
        'neon-pulse-red': 'neon-pulse-red 1.5s ease-in-out infinite',
      },
      keyframes: {
        'pulse-green': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(48, 255, 81, 0)' },
          '50%': { boxShadow: '0 0 20px 4px rgba(48, 255, 81, 0.3)' },
        },
        'slide-in': {
          from: { transform: 'translateY(10px)', opacity: 0 },
          to: { transform: 'translateY(0)', opacity: 1 },
        },
        'fade-in': {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        'scan': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'ticker': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'neon-pulse-green': {
          '0%, 100%': { textShadow: '0 0 8px rgba(48,255,81,0.6)' },
          '50%': { textShadow: '0 0 20px rgba(48,255,81,1), 0 0 40px rgba(48,255,81,0.4)' },
        },
        'neon-pulse-red': {
          '0%, 100%': { textShadow: '0 0 8px rgba(255,48,48,0.6)' },
          '50%': { textShadow: '0 0 20px rgba(255,48,48,1), 0 0 40px rgba(255,48,48,0.4)' },
        },
      },
    },
  },
  plugins: [],
}
