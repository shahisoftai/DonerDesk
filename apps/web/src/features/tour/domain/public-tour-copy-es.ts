import type { PublicTourBundle } from "./public-tour-copy.ts";

/** Español. Borrador sin revisión de un hablante nativo: conviene revisarlo antes de anunciarlo. Las capturas siguen en inglés. */
export const PUBLIC_TOUR_ES: PublicTourBundle = {
  heading: "Recorrido por DonorDesk",
  lede: "Un solo registro, desde la primera meta hasta el informe final, en seis pasos. Elija su rol para ver su parte, o recorra todo. No hace falta cuenta.",
  chapters: {
    plan: { name: "Planificar", promise: "Fije las metas y el trabajo una vez; cada período parte de ahí." },
    collect: { name: "Recopilar", promise: "Los equipos de campo registran una vez, con o sin señal." },
    track: { name: "Seguir", promise: "Vea las brechas cuando aún hay tiempo de actuar." },
    see: { name: "Ver", promise: "El gráfico, el mapa o la página que su junta o donante pidió." },
    prove: { name: "Probar", promise: "Cada cifra se puede rastrear y cada cambio queda registrado." },
    report: { name: "Informar", promise: "Borradores que citan sus fuentes, revisados y aprobados por una persona." },
  },
  roles: {
    director: { name: "Dirección", line: "Toda la cartera, dónde trabaja y las pruebas." },
    manager: { name: "Gerente de programa", line: "Planificar, recopilar, revisar e informar de sus proyectos." },
    me: { name: "Responsable de M&E", line: "Indicadores, formularios, valores y cómo se leen." },
    field: { name: "Personal de campo", line: "Registrar en el teléfono, sin conexión, y ver lo que le toca." },
    grants: { name: "Responsable de subvenciones", line: "Plantillas de donantes, informes y plazos." },
  },
  ui: {
    allRoles: "Todo", rolePrompt: "Muéstrame las partes de", chapterNav: "Capítulos del recorrido", sceneOf: "Escena {n} de {total}",
    back: "Atrás", next: "Siguiente", start: "Empezar gratis", goodToKnow: "Conviene saber", seeFeature: "Más sobre esta función", tryIt: "Crear un espacio gratuito",
    phoneNote: "Se muestra en un teléfono, como lo ve el personal de campo.", sampleNote: "Un proyecto de muestra con nombres y cifras inventados. Las capturas están en inglés.",
    finalTitle: "Véalo con su propio programa.",
    finalBody: "Cree un espacio gratuito y configure un proyecto a partir de sus propios documentos, o compare DonorDesk con las herramientas que usa hoy.",
    compare: "Ver la comparación", screenAlt: "Pantalla de DonorDesk: {title}",
  },
  scenes: {
    wizard: {
      title: "Empiece con los documentos que ya tiene",
      body: "Suba la propuesta y el marco lógico. DonorDesk los lee y propone resultados, indicadores, lugares, plan de trabajo, líneas de presupuesto y riesgos, cada uno con el pasaje del que salió. Usted acepta, edita o rechaza; no se crea nada hasta que lo lance.",
      note: "El asistente está apagado hasta que un administrador lo active, y cada elemento propuesto debe citar el documento o se descarta. Un valor que el documento no indica aparece como «No indicado», nunca como cero.",
    },
    "sector-library": {
      title: "Empiece con buenos indicadores, no con una página en blanco",
      body: "Una biblioteca de 34 sectores sugiere resultados, indicadores y supuestos del sector. Adopte los que encajen; el proyecto queda con su copia, y una actualización llega como una comparación que acepta campo por campo.",
      note: "Las entradas de la biblioteca son puntos de partida sin revisar: pida a un especialista del sector que las compruebe. Una norma, como una cifra Sphere, se muestra junto a su meta como referencia y nunca la sustituye.",
    },
    framework: {
      title: "Un solo conjunto de resultados, leído como marco de resultados o marco lógico",
      body: "Objetivos, efectos, productos y actividades con sus indicadores, líneas de base y metas. Cambie entre las dos lecturas y nombre los niveles con las palabras de su donante.",
      note: "Tras aprobar una versión, una línea de base o meta que un informe usó no cambia en silencio: exige un motivo, que se conserva con la versión.",
    },
    "work-plan": {
      title: "Planifique el trabajo como lista, cronograma o mapa",
      body: "Actividades planificadas con responsables, lugares y fechas. Las atrasadas se marcan solas, las fechas se mueven arrastrando, y cada actividad realizada enlaza con lo que entregó.",
      note: "Un estado solo cambia por los pasos permitidos, y mover una fecha ya pasada pide el motivo. Esos motivos forman el historial de decisiones del proyecto.",
    },
    "record-activity": {
      title: "Registre lo ocurrido en un minuto",
      body: "Escriba o dicte lo que pasó. DonorDesk completa la fecha, el lugar y las personas que encuentra en sus palabras y deduce el período del informe. Nunca inventa un detalle.",
      note: "Una fecha que ningún período cubre nunca se asigna a uno vecino; se le pregunta, con un enlace para crearlo.",
    },
    forms: {
      title: "Formularios que alimentan sus indicadores",
      body: "Cree preguntas con reglas, fotos y GPS, vincule cada una a un indicador y comparta un enlace público o envíelo al equipo de campo. Los registros aceptados pasan a ser valores provisionales de indicador para revisar.",
      note: "Un formulario publicado queda congelado para que los registros conserven las preguntas con que se respondieron. Ciérrelo y cree uno nuevo para cambiarlo.",
    },
    "field-app": {
      title: "Una app de campo que funciona sin señal",
      body: "Descargue una vez los formularios y lugares de un proyecto. Rellénelos sin conexión, con fotos, y se envían solos al volver la señal, una sola vez cada uno aunque la conexión caiga a mitad del envío.",
      note: "Los datos sin conexión viven en el teléfono hasta enviarse y se borran al cerrar sesión. Un registro que el servidor rechaza se aparta con el motivo, nunca se reintenta en silencio.",
    },
    "field-home": {
      title: "El personal de campo ve solo lo suyo",
      body: "El inicio abre con el trabajo planificado de la semana y lo que vence, con el botón Registrar a un toque. Los menús que un rol de campo no necesita no se muestran en absoluto.",
      note: "Lo que ve cada rol sale de una sola tabla. Ocultar un botón nunca sustituye la comprobación de permisos del servidor.",
    },
    "entry-sheet": {
      title: "Introduzca los resultados de un período como en una hoja de cálculo",
      body: "Escriba o pegue desde Excel en una sola cuadrícula, con el valor del período anterior y el acumulado junto a cada casilla. Adjunte la prueba donde escribe la cifra y envíe; un revisor verifica o devuelve con un motivo.",
      note: "Un valor verificado queda bloqueado y no lo sobrescribe un pegado ni una importación. Escribir no envía nada por sí solo, salvo que el proyecto use revisión simple.",
    },
    "data-center": {
      title: "Todas las cifras en una sola hoja",
      body: "Todos los indicadores, períodos, metas y valores en una tabla. Importe, exporte, pivote o grafique cualquier medida, y vea el estado de cada valor, de borrador a verificado.",
      note: "Una brecha aparece como «No medido», nunca como cero, y una tasa nunca se suma ni se muestra como porcentaje de la meta.",
    },
    "where-we-work": {
      title: "Resultados por lugar, desde una sola lista de lugares",
      body: "Una lista de lugares compartida por la organización. Los resultados se acumulan de sitios a distritos y provincias, y cada mapa tiene su tabla al lado.",
      note: "Un lugar sin cifra registrada es gris, no cero. Los límites por debajo de provincia existen solo para países con archivos oficiales; en otros el mapa llega hasta provincias.",
    },
    "chart-studio": {
      title: "Chart Studio: 50 tipos de gráfico, honestos por defecto",
      body: "Elija un indicador y una forma, y luego dele estilo con temas y opciones. El estudio rechaza gráficos engañosos y dice por qué, con una corrección en un clic.",
      note: "Unidades distintas nunca comparten un eje bruto, un valor ausente es un hueco y no un cero, y los valores sin verificar solo se dibujan si lo pide y se cuentan.",
    },
    dashboard: {
      title: "Un panel que se mantiene al día",
      body: "Gráficos, cifras clave, mapas y notas en una cuadrícula que usted organiza. Ábralo a pantalla completa para la pared, imprímalo o comparta un enlace que caduca.",
      note: "Un enlace compartido muestra las cifras tal como están al abrirlo y nunca incluye finanzas. Pruebe un enlace en un navegador sin sesión antes de enviarlo.",
    },
    "dashboard-templates": {
      title: "Empiece con una plantilla de su sector",
      body: "Elija una plantilla para su sector, asocie sus roles a sus indicadores y obtenga un panel funcional con una fila de titulares. Las copias son suyas.",
      note: "Una plantilla nombra roles, nunca cifras. Un rol sin asociar se deja fuera, no se dibuja con un valor inventado.",
    },
    portfolio: {
      title: "Cada proyecto de un vistazo",
      body: "Avance, problemas y riesgos, y el próximo informe de cada proyecto activo, lo más urgente primero, para los proyectos que puede ver.",
      note: "La salud de la ejecución sale del trabajo atrasado y los valores vencidos; no es una nota combinada, y los indicadores contados en otro lugar nunca se suman dos veces.",
    },
    evidence: {
      title: "Pruebas vinculadas a la cifra que respaldan",
      body: "Suba fotos, recibos y documentos a una actividad o a un valor de indicador. Cada archivo muestra las afirmaciones de informe que lo citan, y los niveles de confidencialidad deciden quién puede abrirlo.",
      note: "Un archivo cuenta como prueba solo una vez adjuntado. Los archivos restringidos siguen cerrados para los roles sin el permiso, en listas y descargas.",
    },
    team: {
      title: "Las personas adecuadas, el acceso adecuado",
      body: "Invite a colegas, socios y lectores por proyecto. Los roles deciden quién puede escribir, revisar, aprobar y exportar, y puede exigirse un segundo aprobador. Cada cambio queda en un registro de auditoría de solo añadir.",
      note: "Los socios externos solo acceden a los proyectos y funciones que usted indique. La verificación en dos pasos puede exigirse a toda la organización. DonorDesk no afirma tener ninguna certificación de seguridad externa.",
    },
    "donor-template": {
      title: "Enséñele una vez el informe de su donante",
      body: "Suba la plantilla del donante. DonorDesk extrae secciones, preguntas, tablas y límites de palabras para que las revise y apruebe; eso se convierte en el esqueleto de cada informe.",
      note: "La extracción se comprueba contra el documento y se marca donde duda. Usted la aprueba antes de redactar nada.",
    },
    "report-editor": {
      title: "Un borrador escrito desde su registro, y revisado afirmación por afirmación",
      body: "Genere un primer borrador desde resultados verificados, actividades y pruebas: las tablas y gráficos salen de los datos y el redactor solo escribe la prosa alrededor. Luego edite, vea la fuente de cada enunciado, resuelva los que piden una decisión y deje fuera lo que no aplica.",
      note: "Una cifra que no está en sus datos se rechaza, y una sección que no puede escribirse con seguridad recibe la versión simple con un motivo. Una persona aprueba; el autor no puede aprobar solo cuando se exige un segundo aprobador. Cualquier cambio posterior devuelve el informe a revisión.",
    },
    export: {
      title: "Exporte para revisión o para el donante",
      body: "Descargue en cualquier momento una copia interna de cualquier borrador, con marca de agua. Una entrega al donante se sella solo tras aprobar el informe y despejar sus comprobaciones.",
      note: "Un informe aprobado se exporta contra el marco con el que se aprobó, así que cambios posteriores en las metas no lo reescriben.",
    },
    "closing-report": {
      title: "Cierre el proyecto con confianza",
      body: "Un plan paso a paso para el informe final: qué falta, qué está listo y quién debe aún firmar.",
      note: "Un informe final cierra la serie de períodos; el plan solo muestra los pasos que aplican a su proyecto.",
    },
    ask: {
      title: "Pregunte a sus propios registros",
      body: "Haga una pregunta con palabras sencillas y obtenga una respuesta construida solo con sus valores de indicadores, actividades aceptadas y archivos que puede abrir, con la fuente tras cada frase.",
      note: "Apagado hasta que un administrador lo active. Las frases que no se pueden atar a una fuente o a una cifra de ella se descartan: una respuesta puede quedar incompleta, nunca inventada. Las finanzas nunca se leen.",
    },
  },
};
