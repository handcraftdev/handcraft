/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      keyframes: {
        appear: {
          '0%': {
            opacity: '0',
            transform: 'scale(0.8)'
          },
          '50%': {
            opacity: '1',
            transform: 'scale(1.2)'
          },
          '100%': {
            transform: 'scale(1.1)'
          }
        },
        fadeIn: {
          '0%': {
            opacity: '0',
            transform: 'translateY(-10px)'
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)'
          }
        }
      },
      animation: {
        appear: 'appear 0.4s ease-out forwards',
        fadeIn: 'fadeIn 0.3s ease-out forwards'
      },
    },
  },
  plugins: [],
};