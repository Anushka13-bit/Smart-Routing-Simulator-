/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        network: {
          bg: '#0A0E1A',
          card: '#111827',
          panel: '#151D30',
          border: '#1F293D',
          hover: '#1E293B',
          cyan: '#06B6D4',
          cyanGlow: '#22D3EE',
          blue: '#3B82F6',
          violet: '#8B5CF6',
          emerald: '#10B981',
          rose: '#F43F5E',
          amber: '#F59E0B',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'glow-cyan': '0 0 25px -3px rgba(6, 182, 212, 0.45)',
        'glow-blue': '0 0 25px -3px rgba(59, 130, 246, 0.45)',
        'glow-violet': '0 0 25px -3px rgba(139, 92, 246, 0.45)',
        'glow-rose': '0 0 25px -3px rgba(244, 63, 94, 0.45)',
        'glow-emerald': '0 0 25px -3px rgba(16, 185, 129, 0.45)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite',
      }
    },
  },
  plugins: [],
}
