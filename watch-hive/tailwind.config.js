/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'futuristic-blue': {
          50: '#e8f0f8',
          100: '#c5d9f0',
          200: '#9fc0e8',
          300: '#7aa7e0',
          400: '#5d94d9',
          500: '#4081d2',
          600: '#3a73c0',
          700: '#3261a8',
          800: '#2b4f90',
          900: '#1f3569',
          950: '#0f1a33',
        },
        'futuristic-yellow': {
          50: '#fffef5',
          100: '#fffce0',
          200: '#fff8c2',
          300: '#fff4a3',
          400: '#fff085',
          500: '#ffec66',
          600: '#e6d45c',
          700: '#ccbc52',
          800: '#b3a448',
          900: '#998c3e',
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "gradient-futuristic": "linear-gradient(135deg, #001433 0%, #003d99 50%, #0066ff 100%)",
        "gradient-futuristic-yellow": "linear-gradient(135deg, #fff060 0%, #fff380 50%, #fff9c0 100%)",
      },
      boxShadow: {
        'glow-blue': '0 0 15px rgba(64, 129, 210, 0.3)',
        'glow-yellow': '0 0 15px rgba(255, 236, 102, 0.3)',
        'glow-blue-lg': '0 0 30px rgba(64, 129, 210, 0.4)',
        'glow-yellow-lg': '0 0 30px rgba(255, 236, 102, 0.4)',
      },
      animation: {
        'spin-slow': 'spin 1s linear infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.05)' },
        },
      },
    },
  },
  plugins: [
  ],
};
