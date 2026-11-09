import type { studioEn } from "./studio-en.ts";

/** FR text for the Visual Studio. A draft with no native reviewer: it follows the glossary and is checked by tests, not signed off. */
export const studioFr: Record<keyof typeof studioEn, string> = {
  "studio.data.title": "Données",
  "studio.data.search": "Chercher un champ, par exemple « filles scolarisées »",
  "studio.data.empty": "Aucun champ ne correspond. Essayez moins de mots ou d’autres mots.",
  "studio.data.notConnected": "En cours de raccordement",
  "studio.data.fieldComing": "Pas encore disponible",
  "studio.data.noAccess": "Votre rôle ne peut pas l’ouvrir",
  "studio.data.guestOk": "Affiché sur les liens de partage",
  "studio.data.guestNo": "Non affiché sur les liens de partage",
  "studio.data.measure": "Chiffre",
  "studio.data.dimension": "Regrouper par",
  "studio.data.perRow": "Une ligne correspond à {grain}",
  "studio.data.preview": "Voir les données",
  "studio.data.unavailable": "Impossible à afficher : {reason}",
  "studio.live.updatedSeconds": "Mis à jour il y a {value} s",
  "studio.live.updatedMinutes": "Mis à jour il y a {value} min",
  "studio.live.updatedHours": "Mis à jour il y a {value} h",
  "studio.live.updatedDays": "Mis à jour il y a {value} j",
  "studio.live.refresh": "Actualiser",
  "studio.live.offline": "Hors ligne : derniers chiffres affichés",
  "studio.live.changed": "Chiffres modifiés",
};
