import type { studioEn } from "./studio-en.ts";

/** ES text for the Visual Studio. A draft with no native reviewer: it follows the glossary and is checked by tests, not signed off. */
export const studioEs: Record<keyof typeof studioEn, string> = {
  "studio.data.title": "Datos",
  "studio.data.search": "Buscar un campo, por ejemplo «niñas matriculadas»",
  "studio.data.empty": "Ningún campo coincide. Pruebe con menos palabras o con otras.",
  "studio.data.notConnected": "En proceso de conexión",
  "studio.data.fieldComing": "Aún no disponible",
  "studio.data.noAccess": "Su rol no puede abrirlo",
  "studio.data.guestOk": "Se muestra en los enlaces compartidos",
  "studio.data.guestNo": "No se muestra en los enlaces compartidos",
  "studio.data.measure": "Cifra",
  "studio.data.dimension": "Agrupar por",
  "studio.data.perRow": "Una fila es {grain}",
  "studio.data.preview": "Ver los datos",
  "studio.data.unavailable": "No se puede mostrar: {reason}",
  "studio.live.updatedSeconds": "Actualizado hace {value} s",
  "studio.live.updatedMinutes": "Actualizado hace {value} min",
  "studio.live.updatedHours": "Actualizado hace {value} h",
  "studio.live.updatedDays": "Actualizado hace {value} d",
  "studio.live.refresh": "Actualizar",
  "studio.live.offline": "Sin conexión: se muestran las últimas cifras",
  "studio.live.changed": "Cifras modificadas",
};
