/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          500: '#25D366',
          600: '#128C7E',
          700: '#075E54'
        }
      }
    }
  },
  plugins: []
};