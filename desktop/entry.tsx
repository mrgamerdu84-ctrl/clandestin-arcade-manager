import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import GameShell from "../src/game/GameShell";
import "../src/styles.css";

try {
  localStorage.setItem("cc_lightrender", "0");
} catch {}

const ADULT_NOTICE_KEY = "cc_adult_notice_seen_v1";

function renderGame() {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <GameShell />
    </StrictMode>,
  );

  const waitForGameUi = window.setInterval(() => {
    if (install3DButton()) window.clearInterval(waitForGameUi);
  }, 100);
}

function showAdultNotice() {
  const root = document.getElementById("root");
  if (!root) return renderGame();

  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(circle at 20% 20%,rgba(255,0,127,.18),transparent 45%),radial-gradient(circle at 80% 80%,rgba(0,243,255,.16),transparent 45%),#07060f;color:#fff;font-family:Segoe UI,Arial,sans-serif;">
      <section role="dialog" aria-modal="true" aria-labelledby="adultNoticeTitle" style="width:min(720px,94vw);background:rgba(18,10,30,.96);border:1px solid rgba(255,255,255,.14);border-radius:20px;padding:28px;box-shadow:0 24px 70px rgba(0,0,0,.65),0 0 30px rgba(255,0,127,.16);text-align:center;">
        <div style="font-size:42px;line-height:1;margin-bottom:12px;">⚠️</div>
        <h1 id="adultNoticeTitle" style="margin:0 0 14px;font-size:clamp(24px,4vw,38px);letter-spacing:.04em;color:#ff4aa2;">JEU DESTINÉ À UN PUBLIC ADULTE</h1>
        <p style="margin:0 auto 12px;max-width:610px;line-height:1.65;color:#ece5ff;font-size:16px;">Clandestin Arcade Manager est une œuvre de fiction qui aborde la vie nocturne, les jeux d’argent et des activités clandestines.</p>
        <p style="margin:0 auto 20px;max-width:610px;line-height:1.65;color:#c9bddf;font-size:15px;"><strong style="color:#fff;">Ce contenu n’est pas destiné aux jeunes joueurs.</strong> Les situations présentées appartiennent uniquement à l’univers fictif du jeu et ne constituent pas une incitation à les reproduire.</p>
        <button id="adultNoticeContinue" type="button" style="border:0;border-radius:999px;padding:13px 24px;font-size:15px;font-weight:800;cursor:pointer;background:linear-gradient(135deg,#ff2e88,#7d35ff);color:white;box-shadow:0 0 22px rgba(255,46,136,.35);">J’AI COMPRIS — CONTINUER</button>
      </section>
    </div>
  `;

  document.getElementById("adultNoticeContinue")?.addEventListener("click", () => {
    try {
      localStorage.setItem(ADULT_NOTICE_KEY, "1");
    } catch {}
    root.innerHTML = "";
    renderGame();
  });
}

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

let noticeSeen = false;
try {
  noticeSeen = localStorage.getItem(ADULT_NOTICE_KEY) === "1";
} catch {}

if (noticeSeen) renderGame();
else showAdultNotice();
