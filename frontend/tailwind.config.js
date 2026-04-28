/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#C4A06A',
          light:   '#D9BF8C',
          dark:    '#9C7A45',
        },
        bg:       '#F5F3EF',
        dark:     '#1A1714',
        charcoal: '#3A3530',
        muted:    '#7A7068',
        border:   'rgba(0,0,0,0.09)',
        green:    '#3A8A55',
        red:      '#B84040',
        // Keep white explicit for Tailwind utility use
        white:    '#FFFFFF',
      },
      fontFamily: {
        sans:  ['Montserrat', 'sans-serif'],
        serif: ['Cormorant Garamond', 'serif'],
      },
      borderRadius: {
        card: '16px',
      },
      animation: {
        'fade-in':       'fadeIn 0.5s ease-out',
        'slide-up':      'slideUp 0.5s ease-out',
        'slide-in-right':'slideInRight 0.3s ease-out',
        'pulse-soft':    'pulseSoft 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%':   { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}
