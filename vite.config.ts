import { defineConfig } from "vite";
import react from "@vitejs/plugin-react"; // if you use React

export default defineConfig({
  plugins: [react()],
  base: "/uno-1.1/",
});