import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { supabaseConfigured } from "./lib/supabase";

function ConfigError() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, sans-serif", background: "#fafaf7", padding: "2rem",
    }}>
      <div style={{
        maxWidth: 540, background: "white", borderRadius: 16, padding: "2rem",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)", border: "1px solid #eee",
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#dc2626" }}>
          Setup required
        </h1>
        <p style={{ color: "#52525b", marginTop: 12, lineHeight: 1.55, fontSize: 14 }}>
          Supabase environment variables are missing. The app cannot connect to the database.
        </p>
        <p style={{ color: "#27272a", marginTop: 16, fontSize: 13, fontWeight: 600 }}>
          On Vercel: Project → Settings → Environment Variables, add:
        </p>
        <ul style={{ color: "#27272a", marginTop: 8, fontSize: 13, lineHeight: 1.7 }}>
          <li><code>VITE_SUPABASE_URL</code></li>
          <li><code>VITE_SUPABASE_ANON_KEY</code></li>
        </ul>
        <p style={{ color: "#71717a", marginTop: 16, fontSize: 12 }}>
          Apply to Production, Preview, and Development → then Redeploy.
        </p>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  supabaseConfigured ? <App /> : <ConfigError />
);
