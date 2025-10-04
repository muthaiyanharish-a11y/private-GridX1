/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  // Enable JIT mode for better performance
  mode: 'jit',
  // Purge unused styles in production
  purge: {
    enabled: process.env.NODE_ENV === 'production',
    content: [
      './src/**/*.{js,jsx,ts,tsx}',
      './index.html',
    ],
    options: {
      safelist: [
        /^ant-/,  // Keep Ant Design classes
        /^status-/,  // Keep status classes
        /^glass-/,  // Keep glass effect classes
      ]
    }
  }
}