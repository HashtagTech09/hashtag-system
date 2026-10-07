import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const projectId = "cughejedfefvblxyodtm";
  if (env.VITE_SUPABASE_URL !== `https://${projectId}.supabase.co`
    || env.VITE_SUPABASE_PROJECT_ID !== projectId) {
    throw new Error("Configure the company Supabase URL and project ID for this environment.");
  }
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  let validKey = key.startsWith("sb_publishable_");
  if (key.split(".").length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString());
      validKey = payload.role === "anon" && payload.ref === projectId;
    } catch { validKey = false; }
  }
  if (!validKey) throw new Error("Configure the company's public Supabase key, never a service-role or secret key.");
  return {
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  };
});
