import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import GameShell from "../src/game/GameShell";
import "../src/styles.css";

try {
  localStorage.setItem("cc_lightrender", "0");
} catch {}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GameShell />
  </StrictMode>,
);

function install3DButton() {
  const button = document.getElementById("lightRenderBtn");
  if (!button || button.dataset.pc3dFixed === "1") return false;

  button.dataset.pc3dFixed = "1";
  button.textContent = "⚡ 3D";
  button.title = "Afficher les vrais modèles 3D";
  button.setAttribute("aria-label", "Afficher les vrais modèles 3D");

  const keepLabel = new MutationObserver(() => {
    if (button.textContent !== "⚡ 3D") button.textContent = "⚡ 3D";
  });
  keepLabel.observe(button, { childList: true, characterData: true, subtree: true });

  button.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        localStorage.setItem("cc_lightrender", "0");
      } catch {}
      window.location.reload();
    },
    true,
  );

  return true;
}

const waitForGameUi = window.setInterval(() => {
  if (install3DButton()) window.clearInterval(waitForGameUi);
}, 100);
