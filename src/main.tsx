import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import logo from "@/assets/MIG-Logo2.jpg";

// Ensure favicon uses the company logo (works in dev and build)
(() => {
  try {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/jpeg';
    link.href = logo;
  } catch {}
})();

createRoot(document.getElementById("root")!).render(<App />);
