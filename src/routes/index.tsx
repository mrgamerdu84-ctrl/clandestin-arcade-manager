import { createFileRoute } from "@tanstack/react-router";
import GameShell from "../game/GameShell";

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
  return <GameShell />;
}
