/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefaff",
          100: "#d9f2ff",
          200: "#b8e9ff",
          300: "#86dcff",
          400: "#4dc7ff",
          500: "#22aef5",
          600: "#0f8dd6",
          700: "#0f70ac",
          800: "#135e8c",
          900: "#154f74",
          950: "#0d324c",
        },
        ink: {
          50: "#f5f6f8",
          100: "#e7e9ee",
          200: "#cfd3dc",
          300: "#a9b0bf",
          400: "#7c869c",
          500: "#5c6680",
          600: "#48506a",
          700: "#3b4257",
          800: "#2c3142",
          900: "#1f232f",
          950: "#141620",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(20,22,32,0.04), 0 4px 12px rgba(20,22,32,0.06)",
        pop: "0 8px 24px rgba(20,22,32,0.12)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
}

