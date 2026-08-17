import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import "../game/cosmic-coin.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cosmic Coin — salle d'arcade clandestine 3D" },
      {
        name: "description",
        content:
          "Été 1988 : gère le Cosmic Coin, une arcade néon et son arrière-salle clandestine. Pose des bornes, planque les machines et survis aux descentes de police.",
      },
      { property: "og:title", content: "Cosmic Coin — salle d'arcade clandestine 3D" },
      {
        property: "og:description",
        content:
          "Jeu de gestion 3D : arcade rétro le jour, salle de jeu illégale la nuit. Fais monter les jetons sans faire monter la suspicion.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GamePage,
});

function GamePage() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    import("../game/cosmicCoin").then((mod) => {
      if (cancelled) return;
      cleanup = mod.startCosmicCoin();
    });

    return () => {
      cancelled = true;
      cleanup?.();
      started.current = false;
    };
  }, []);

  return (
    <div id="app">
      <h1 className="sr-only-title">Cosmic Coin — salle d'arcade clandestine</h1>
      <div id="viewport">
        <div id="title">
          COSMIC COIN<span id="stageLabel">SALLE D'ARCADE</span>
        </div>
        <div id="hud">
          <div className="stat">
            💰 <b id="money">0</b>¢
          </div>
          <div className="stat">
            ⭐ <b id="rep">0</b>
          </div>
          <div className="stat">
            📅 J<b id="day">1</b>
          </div>
          <div className="stat">
            🎯 Dette <b id="debt">400</b>¢
          </div>
          <div className="stat" id="scoreStat">
            🏆 <b id="score">0</b>
          </div>
          <div className="stat" id="dangerStat">
            ☠️ <b id="danger">0% CALME</b>
          </div>
          <div className="stat" id="suspStat">
            🚨 <b id="susp">0</b>%
          </div>
        </div>
        <div id="suspWrap">
          <div id="suspFill" />
        </div>
        <div id="lightBar">
          <button id="light-day" type="button" title="Plein jour">
            ☀️
          </button>
          <button id="light-night" type="button" title="Nuit néon">
            🌙
          </button>
          <button id="light-auto" type="button" title="Cycle automatique">
            AUTO
          </button>
          <input id="brightness" type="range" min="60" max="220" step="5" aria-label="Luminosité" />
          <span id="brightVal">125%</span>
          <button id="musicBtn" type="button" title="Musique disco">
            🔈
          </button>
          <button id="lightRenderBtn" type="button" title="Rendu léger (placeholders)">
            ⚡
          </button>
          <button id="bigScreenBtn" type="button" title="Grand écran">
            🗖
          </button>
          <button id="tapPlaceBtn" type="button" title="Tap pour placer (mobile)">
            👆
          </button>




        </div>
        <canvas id="three" />
        <div id="raidBanner">
          <div id="raidText">DESCENTE !</div>
        </div>
        <div id="cinema">
          <div className="cineBar top" />
          <div className="cineBar bottom" />
          <div id="cineBox">
            <div id="cineWho" />
            <div id="cineText" />
            <div id="cineActions">
              <button id="cineSkip" type="button">Passer</button>
              <button id="cineNext" type="button">SUITE ▶</button>
            </div>
          </div>
        </div>
        <div id="doorPanel">
          <div id="doorWho">Quelqu'un frappe à la porte du fond</div>
          <div id="doorTell" />
          <div id="doorTimerWrap">
            <div id="doorFill" />
          </div>
          <div id="doorBtns">
            <button id="doorSearch" type="button">🔦 Fouiller</button>
            <button id="doorPass" type="button">🚪 Laisser passer</button>
            <button id="doorRefuse" type="button">✋ Refuser</button>
          </div>
        </div>
        <div id="hint">
          🖱️ glisser: tourner &nbsp; molette: zoom &nbsp; clic sur une case: poser &nbsp; clic sur une
          machine: pivoter/vendre
        </div>
        <button id="menuToggle" type="button">
          🕹️ BOUTIQUE
        </button>
        <button id="exteriorBtn" type="button">
          🏙️ EXTÉRIEUR
        </button>
        <button id="styleToggle" type="button">
          🎨 DÉCO DE LA SALLE
        </button>

        <div id="hoodBar" style={{ display: "none" }}>
          <button id="hoodToggle" type="button">🏗️ ÉDITER LE QUARTIER</button>
          <button id="hoodRotate" type="button" title="Pivoter">
            🔄 <span id="hoodRotVal">0°</span>
          </button>
          <button id="hoodMove" type="button" title="Déplacer un objet posé">✋ Déplacer</button>
          <button id="hoodErase" type="button" title="Supprimer">🧨 Retirer</button>
          <button id="hoodUndo" type="button" title="Annuler le dernier">↩︎</button>
          <button id="hoodClear" type="button" title="Tout effacer">🗑️</button>
          <button id="hoodWipe" type="button" title="Raser tout le quartier">🧹 Tout raser</button>
          <button id="hoodRestore" type="button" title="Remettre le décor d'origine">↺ Tout remettre</button>

        </div>
        <div id="hoodArrows" style={{ display: "none" }}>
          <button id="hoodUp" type="button" title="Décaler vers le haut">▲</button>
          <button id="hoodLeft" type="button" title="Décaler à gauche">◀</button>
          <button id="hoodRight" type="button" title="Décaler à droite">▶</button>
          <button id="hoodDown" type="button" title="Décaler vers le bas">▼</button>
        </div>
        <div id="camPad">
          <button id="camUp" type="button" title="Caméra vers le haut">▲</button>
          <button id="camLeft" type="button" title="Caméra à gauche">◀</button>
          <button id="camCenter" type="button" title="Recentrer la caméra">◎</button>
          <button id="camRight" type="button" title="Caméra à droite">▶</button>
          <button id="camDown" type="button" title="Caméra vers le bas">▼</button>
        </div>
        <div id="hoodPanel" style={{ display: "none" }}>
          <div className="hoodHead">Pose ce que tu veux : clique une case au sol. ✋ Déplacer et 🧨 Retirer marchent aussi sur le décor d'origine.</div>
          <div id="hoodMoney" className="costLine" />
          <div id="hoodList" />
        </div>

        <nav id="dock" aria-label="Menu principal">
          <button id="dockShop" type="button"><i>🕹️</i><span>Boutique</span></button>
          <button id="dockDeco" type="button"><i>🎨</i><span>Déco</span></button>
          <button id="dockHood" type="button"><i>🏙️</i><span>Quartier</span></button>
          <button id="dockCam" type="button"><i>🎮</i><span>Caméra</span></button>
          <button id="dockOpts" type="button"><i>⚙️</i><span>Options</span></button>
        </nav>

      </div>


      <div id="sidebar">
        <div id="dragHandle">▲ BOUTIQUE ▲</div>
        <h3>🕹️ Boutique intérieur — machines</h3>
        <div id="itemList" />
        <h3>🛋️ Boutique déco de la boîte</h3>
        <div id="decorList" />
        <h3>Arrière-salle</h3>
        <div id="backroomList" />
        <h3>Personnel</h3>
        <div id="staffList" />
        <h3>Mission</h3>
        <div id="questBox" />
        <h3>🧹 Remise en état</h3>
        <div id="cleanBox" />
        <h3>🏦 Banque</h3>
        <div id="bankBox" />
        <div id="expandBox">
          <div id="expandText">Chargement...</div>
          <button className="btn pink" id="expandBtn" type="button">
            AGRANDIR
          </button>
          <div className="hoodHead">Murs de la salle</div>
          <div id="wallGrid">
            <button id="wallColMinus" type="button" title="Enlever un mur (largeur)">◀−</button>
            <span id="wallColVal">6</span>
            <button id="wallColPlus" type="button" title="Pousser le mur (largeur)">+▶</button>
            <button id="wallRowMinus" type="button" title="Enlever un mur (profondeur)">▲−</button>
            <span id="wallRowVal">5</span>
            <button id="wallRowPlus" type="button" title="Pousser le mur (profondeur)">+▼</button>
          </div>
          <div id="wallInfo" />
        </div>

        <div id="log" />
        <div id="controlsRow">
          <button className="btn" id="pauseBtn" type="button">
            ⏸ Pause
          </button>
          <button className="btn" id="closedBtn" type="button">
            🚪 Fermer le club
          </button>
          <button className="btn" id="scoreBtn" type="button">
            🏆 Score
          </button>
          <button className="btn pink" id="resetBtn" type="button">
            ↺ Reset
          </button>
        </div>
      </div>

      <div id="machineMenu">
        <div className="mTitle" id="mmTitle">
          Machine
        </div>
        <button id="mmRotate" type="button">
          🔄 Pivoter
        </button>
        <button id="mmMove" type="button">
          ✋ Déplacer
        </button>

        <button id="mmSell" className="sell" type="button">
          💰 Vendre
        </button>
        <button id="mmClose" className="close" type="button">
          ✕ Fermer
        </button>
      </div>

      <div id="loadModal">
        <div className="card">
          <div id="loadBar"><i /></div>
          <h2>Chargement du Cosmic Coin…</h2>
          <p id="loadText">On rallume les néons et on dépoussière la porte du fond…</p>
        </div>
      </div>

      <div id="storyModal" style={{ display: "none" }}>
        <div className="card">
          <h2>COSMIC COIN — 1988</h2>
          <p>
            <b>Été 1988.</b> Ta grand-tante Rosa te lègue le <i>Cosmic Coin</i>, une arcade fermée
            depuis trois ans — et une dette de 400¢ que la banque réclame déjà.
          </p>
          <p>
            Les jetons honnêtes ne suffiront jamais à temps. Derrière le mur du fond, Rosa a laissé
            une porte : l'ancienne <b>salle clandestine</b> du quartier. Arcade le jour, mises
            interdites la nuit.
          </p>
          <ul>
            <li>🕹️ Choisis une machine dans la boutique puis clique une case au sol.</li>
            <li>🚪 Rouvre l'arrière-salle : les machines clandestines rapportent x2,3.</li>
            <li>🚨 Chaque mise fait monter la <b>suspicion</b>. Blanchis, arrose l'inspecteur.</li>
            <li>🚪 Trie les clandestins à la porte : fouille, laisse passer ou refuse — les indics et les flics infiltrés font grimper le <b>danger</b> ☠️.</li>
            <li>👮 En pleine descente, planque tout avant la fin du compte à rebours.</li>
            <li>⚖️ Trois descentes ratées et le juge met les scellés.</li>
          </ul>
          <button className="btn pink" id="closeStoryBtn" type="button">
            OUVRIR LA SALLE ▶
          </button>
        </div>
      </div>

      <div id="scoreModal" style={{ display: "none" }}>
        <div className="card">
          <h2>SCORE & CLASSEMENT</h2>
          <p>
            Score de la partie en cours : <b id="scoreNow">0</b> points
          </p>
          <h3 className="scoreHead">Statistiques</h3>
          <div id="statList" />
          <h3 className="scoreHead">Meilleures parties (top 10)</h3>
          <div id="scoreBoard" />
          <div id="scoreActions">
            <button className="btn" id="clearScoreBtn" type="button">
              Effacer
            </button>
            <button className="btn pink" id="closeScoreBtn" type="button">
              FERMER
            </button>
          </div>
        </div>
      </div>

      <div id="eventModal" style={{ display: "none" }}>
        <div className="card">
          <h2 id="eventTitle" />
          <p id="eventText" />
          <button className="btn" id="closeEventBtn" type="button">
            CONTINUER
          </button>
        </div>
      </div>
    </div>
  );
}
