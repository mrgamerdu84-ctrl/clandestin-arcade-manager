import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import GameShell from "../src/game/GameShell";
import "../src/styles.css";

// Toujours démarrer avec les vrais modèles 3D. L'ancien mode léger pouvait rester
// mémorisé et remplacer les GLB/Kenney par des placeholders sans que le joueur
// comprenne pourquoi les assets avaient disparu.
try {
  localStorage.setItem("cc_lightrender", "0");

  // Sécurité pour les anciennes parties bloquées dès le départ : si aucune
  // machine n'est encore posée et que la caisse est tombée sous le prix de la
  // première borne, on remet simplement la caisse de départ normale.
  const raw = localStorage.getItem("cc_save_v1");
  if (raw) {
    const save = JSON.parse(raw);
    if (save && Array.isArray(save.machines) && save.machines.length === 0 && Number(save.money) < 60) {
      save.money = 140;
      localStorage.setItem("cc_save_v1", JSON.stringify(save));
    }
  }
} catch {
  // Le jeu doit quand même démarrer si le stockage local est indisponible.
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GameShell />
  </StrictMode>,
);
