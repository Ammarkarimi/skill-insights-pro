import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// Example plugin (only if needed)
// import checker from 'vite-plugin-checker';

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    // Add other plugins conditionally
    // mode === 'development' && checker({ typescript: true }),
  ].filter(Boolean), // Ensures falsy values are removed
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
