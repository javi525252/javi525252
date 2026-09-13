import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En desarrollo (npm run dev, puerto 5173) el panel habla con el backend en
// 127.0.0.1:8000. Al compilar (npm run build) lo sirve el propio backend y se
// usa el mismo origen automáticamente.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: { outDir: "dist" },
});
