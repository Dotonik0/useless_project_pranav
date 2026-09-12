/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
      extend: {
        colors: {
          bat: {
            black: "#0A0A0C",
            charcoal: "#121418",
            dark: "#1A1D24",
            red: "#FF1E27",
            redDark: "#800F13",
            cyan: "#00E5FF",
            gold: "#E5A93C",
            text: "#D0D4DC"
          }
        },
        fontFamily: {
          mono: ['"Courier New"', 'Courier', 'monospace'],
          sans: ['"Inter"', 'sans-serif']
        },
        keyframes: {
          scanline: {
            '0%': { transform: 'translateY(-100%)' },
            '100%': { transform: 'translateY(1000%)' }
          },
          radar: {
            '0%': { transform: 'rotate(0deg)' },
            '100%': { transform: 'rotate(360deg)' }
          },
          hullLeft: {
            '0%': { transform: 'translateX(0)' },
            '100%': { transform: 'translateX(-100%)' }
          },
          hullRight: {
            '0%': { transform: 'translateX(0)' },
            '100%': { transform: 'translateX(100%)' }
          }
        },
        animation: {
          scanline: 'scanline 8s linear infinite',
          radar: 'radar 4s linear infinite',
          hullLeft: 'hullLeft 1.2s cubic-bezier(0.77, 0, 0.175, 1) forwards',
          hullRight: 'hullRight 1.2s cubic-bezier(0.77, 0, 0.175, 1) forwards'
        }
      },
    },
    plugins: [],
  }