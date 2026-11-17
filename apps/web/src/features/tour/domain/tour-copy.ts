import type { TourStep } from "./tour-steps.ts";

/**
 * The words around the in-app Academy tour in the interface languages. English lives in `tour-steps.ts` (the step copy) and in
 * `TOUR_CHROME.en`; French, Spanish and Arabic are drafts without a native reviewer. The "Good to know" rule text stays English: it
 * is shared with the "How it works" page (`workflow-rules.ts`), which is English only. Arabic avoids number agreement.
 */
export interface TourChrome {
  dialog: string; step: string; goodToKnow: string; end: string; skip: string; next: string; finish: string;
  startTitle: string; resumeTitle: string; settingUp: string; startLine: string; resumeLine: string;
}

export const TOUR_CHROME: Record<string, TourChrome> = {
  en: {
    dialog: "DonorDesk Academy guided tour", step: "Step {n} of {total}", goodToKnow: "Good to know: {title}", end: "End tour", skip: "Skip", next: "Next", finish: "Finish",
    startTitle: "Take the product tour", resumeTitle: "Resume the product tour", settingUp: "Setting up...",
    startLine: "A 10–15 minute guided tour through a sample project, from setup to export.", resumeLine: "Pick up your guided tour of the sample project where you left off.",
  },
  fr: {
    dialog: "Visite guidée DonorDesk Academy", step: "Étape {n} sur {total}", goodToKnow: "Bon à savoir : {title}", end: "Terminer la visite", skip: "Passer", next: "Suivant", finish: "Terminer",
    startTitle: "Faire la visite du produit", resumeTitle: "Reprendre la visite du produit", settingUp: "Préparation...",
    startLine: "Une visite guidée de 10 à 15 minutes dans un projet d'exemple, de la configuration à l'export.", resumeLine: "Reprenez la visite guidée du projet d'exemple là où vous l'aviez laissée.",
  },
  es: {
    dialog: "Recorrido guiado de DonorDesk Academy", step: "Paso {n} de {total}", goodToKnow: "Conviene saber: {title}", end: "Terminar recorrido", skip: "Omitir", next: "Siguiente", finish: "Finalizar",
    startTitle: "Hacer el recorrido del producto", resumeTitle: "Retomar el recorrido del producto", settingUp: "Preparando...",
    startLine: "Un recorrido guiado de 10 a 15 minutos por un proyecto de muestra, de la configuración a la exportación.", resumeLine: "Retome el recorrido guiado del proyecto de muestra donde lo dejó.",
  },
  ar: {
    dialog: "الجولة الإرشادية في DonorDesk Academy", step: "الخطوة {n} من {total}", goodToKnow: "من المفيد معرفته: {title}", end: "إنهاء الجولة", skip: "تخطّي", next: "التالي", finish: "إنهاء",
    startTitle: "ابدأ جولة المنتج", resumeTitle: "تابع جولة المنتج", settingUp: "جارٍ الإعداد...",
    startLine: "جولة إرشادية من عشر إلى خمس عشرة دقيقة في مشروع تجريبي، من الإعداد إلى التصدير.", resumeLine: "تابع الجولة الإرشادية في المشروع التجريبي من حيث توقفت.",
  },
};

export type StepWords = { title: string; body: string };

/** Step title and body by language (English is the step itself). Keyed by step id; a test pins that every id is covered. */
export const TOUR_STEP_WORDS: Record<"fr" | "es" | "ar", Record<string, StepWords>> = {
  fr: {
    "dashboard-demo-project": { title: "Votre projet d'exemple", body: "Un projet d'exemple autonome : sans risque à explorer, modifier ou supprimer. Il ne compte jamais dans les limites de votre offre. Nous le parcourons de la configuration à l'export." },
    "project-setup": { title: "Configuration : ce dont un projet a besoin", body: "La configuration (sous Paramètres) liste ce qu'il faut avant qu'un projet puisse rapporter : un cadre de résultats avec indicateurs, un modèle de bailleur, un profil de rapport et une équipe. Les nouveaux projets partent de l'assistant, qui lit vos propres documents." },
    "logframe-indicators": { title: "Cadre de résultats et indicateurs", body: "Objectifs, effets, produits et activités avec les indicateurs qui les mesurent. Lisez-le comme cadre de résultats ou cadre logique, avec les mots de votre bailleur." },
    "work-plan": { title: "Plan de travail", body: "Planifiez le travail en liste, en calendrier ou sur une carte, avec responsables, lieux et dates. Les retards se signalent d'eux-mêmes et les activités réalisées renvoient au plan." },
    "donor-template": { title: "Modèle du bailleur", body: "DonorDesk extrait la structure du rapport de votre bailleur pour que vous la relisiez. Approuvez chaque section ici : elle devient le squelette de chaque rapport généré." },
    "reporting-period": { title: "Périodes de rapport", body: "Ouvrez une période pour saisir ses chiffres, raconter l'histoire et générer son rapport. Chaque période passe par Données, Récit, Brouillon et Relecture." },
    "entry-sheet": { title: "Saisir les chiffres de la période", body: "Tapez ou collez depuis Excel dans une grille unique, avec la valeur de la période précédente à côté de chaque case. Un relecteur valide chaque valeur ; une valeur validée est verrouillée." },
    evidence: { title: "Bibliothèque de preuves", body: "Téléversez photos, reçus et documents pour une activité ou une valeur d'indicateur, afin que les rapports les citent comme preuve." },
    "data-center": { title: "Data Center", body: "Tous les indicateurs, périodes, cibles et valeurs sur une feuille. Importez, exportez ou représentez toute mesure ; un écart s'affiche « Non mesuré », jamais zéro." },
    "ai-draft": { title: "Brouillon assisté par l'IA", body: "Générez un premier brouillon à partir de vos données validées. Chaque chiffre est vérifié par rapport à ce que vous avez saisi : un chiffre absent de vos données est rejeté." },
    "report-editor": { title: "Relire et affiner", body: "Modifiez le brouillon, voyez la source de chaque énoncé, tranchez les affirmations qui demandent une décision et écartez ce qui ne s'applique pas avant l'export." },
    compliance: { title: "Liste de conformité", body: "DonorDesk signale les preuves manquantes ou les questions du bailleur sans réponse avant la soumission." },
    export: { title: "Export", body: "Exportez à tout moment une copie interne filigranée, ou une soumission scellée au bailleur une fois le rapport approuvé." },
  },
  es: {
    "dashboard-demo-project": { title: "Su proyecto de muestra", body: "Un proyecto de muestra independiente: seguro para explorar, editar o eliminar. Nunca cuenta contra los límites de su plan. Lo recorremos de la configuración a la exportación." },
    "project-setup": { title: "Configuración: lo que necesita un proyecto", body: "La configuración (en Ajustes) enumera lo que un proyecto necesita para informar: un marco de resultados con indicadores, una plantilla de donante, un perfil de informes y un equipo. Los proyectos nuevos parten del asistente, que lee sus propios documentos." },
    "logframe-indicators": { title: "Marco de resultados e indicadores", body: "Objetivos, efectos, productos y actividades con los indicadores que los miden. Léalo como marco de resultados o marco lógico, con las palabras de su donante." },
    "work-plan": { title: "Plan de trabajo", body: "Planifique el trabajo como lista, cronograma o mapa, con responsables, lugares y fechas. Las actividades atrasadas se marcan solas y las realizadas enlazan con el plan." },
    "donor-template": { title: "Plantilla del donante", body: "DonorDesk extrae la estructura del informe de su donante para que la revise. Apruebe cada sección aquí: será el esqueleto de cada informe que genere." },
    "reporting-period": { title: "Períodos de informe", body: "Abra un período para introducir sus cifras, contar la historia y generar su informe. Cada período pasa por Datos, Historia, Borrador y Revisión." },
    "entry-sheet": { title: "Introducir las cifras del período", body: "Escriba o pegue desde Excel en una sola cuadrícula, con el valor del período anterior junto a cada casilla. Un revisor verifica cada valor; un valor verificado queda bloqueado." },
    evidence: { title: "Biblioteca de pruebas", body: "Suba fotos, recibos y documentos a una actividad o a un valor de indicador, para que los informes los citen como prueba." },
    "data-center": { title: "Data Center", body: "Todos los indicadores, períodos, metas y valores en una hoja. Importe, exporte o grafique cualquier medida; una brecha aparece como «No medido», nunca como cero." },
    "ai-draft": { title: "Borrador asistido por IA", body: "Genere un primer borrador desde sus datos verificados. Cada cifra se comprueba contra lo que introdujo: una cifra que no está en sus datos se rechaza." },
    "report-editor": { title: "Revisar y afinar", body: "Edite el borrador, vea la fuente de cada enunciado, resuelva las afirmaciones que piden una decisión y deje fuera lo que no aplica antes de exportar." },
    compliance: { title: "Lista de cumplimiento", body: "DonorDesk señala las pruebas que faltan o las preguntas del donante sin responder antes de enviar." },
    export: { title: "Exportar", body: "Exporte en cualquier momento una copia interna con marca de agua, o una entrega sellada al donante una vez aprobado el informe." },
  },
  ar: {
    "dashboard-demo-project": { title: "مشروعك التجريبي", body: "مشروع تجريبي قائم بذاته: آمن للاستكشاف أو التعديل أو الحذف، ولا يُحتسب أبدًا ضمن حدود خطتك. سنتجوّل فيه من الإعداد إلى التصدير." },
    "project-setup": { title: "الإعداد: ما يحتاجه المشروع", body: "يسرد الإعداد (ضمن الإعدادات) ما يحتاجه المشروع ليتمكن من رفع التقارير: إطار نتائج بمؤشراته، وقالب الجهة المانحة، وملف التقارير، وفريق. وتبدأ المشاريع الجديدة من معالج الإعداد الذي يقرأ وثائقك." },
    "logframe-indicators": { title: "إطار النتائج والمؤشرات", body: "الغايات والنتائج والمخرجات والأنشطة مع المؤشرات التي تقيسها. اقرأه إطار نتائج أو إطارًا منطقيًا، بكلمات الجهة المانحة." },
    "work-plan": { title: "خطة العمل", body: "خطط العمل قائمةً أو جدولًا زمنيًا أو خريطة، مع المسؤولين والأماكن والتواريخ. تُعلَّم الأنشطة المتأخرة تلقائيًا وترتبط المنجزة بالخطة." },
    "donor-template": { title: "قالب الجهة المانحة", body: "يستخرج DonorDesk هيكل تقرير جهتك المانحة لتراجعه. اعتمد كل قسم هنا: فيصبح هيكل كل تقرير تنشئه." },
    "reporting-period": { title: "فترات التقارير", body: "افتح فترة لإدخال أرقامها وسرد قصتها وإنشاء تقريرها. تمر كل فترة بالمدخلات ثم القصة ثم المسودة ثم المراجعة." },
    "entry-sheet": { title: "أدخل أرقام الفترة", body: "اكتب أو الصق من Excel في شبكة واحدة، وبجانب كل خانة قيمة الفترة السابقة. يتحقق المراجع من كل قيمة، والقيمة المتحقق منها مقفلة." },
    evidence: { title: "مكتبة الإثباتات", body: "ارفع صورًا وإيصالات ووثائق إلى نشاط أو قيمة مؤشر لتستشهد بها التقارير إثباتًا." },
    "data-center": { title: "Data Center", body: "كل المؤشرات والفترات والأهداف والقيم في ورقة واحدة. استورد وصدّر أو ارسم أي مقياس؛ وتظهر الفجوة «غير مقاسة» وليس صفرًا." },
    "ai-draft": { title: "مسودة بمساعدة الذكاء الاصطناعي", body: "أنشئ مسودة أولى من بياناتك المتحقق منها. يُفحص كل رقم على ما أدخلته: والرقم غير الموجود في بياناتك يُرفض." },
    "report-editor": { title: "راجع وحسّن", body: "حرّر المسودة، وانظر مصدر كل عبارة، وحسم العبارات التي تحتاج قرارًا، واترك ما لا ينطبق قبل التصدير." },
    compliance: { title: "قائمة الامتثال", body: "ينبّه DonorDesk إلى الإثباتات الناقصة أو أسئلة الجهة المانحة غير المجابة قبل التسليم." },
    export: { title: "التصدير", body: "صدّر في أي وقت نسخة داخلية بعلامة مائية، أو تسليمًا مختومًا للجهة المانحة بعد اعتماد التقرير." },
  },
};

/** The step as the person's language reads it; the rule block is not translated (see above). */
export function localizedStep(step: TourStep, locale: string): TourStep {
  const words = locale === "fr" || locale === "es" || locale === "ar" ? TOUR_STEP_WORDS[locale][step.id] : undefined;
  return words ? { ...step, title: words.title, body: words.body } : step;
}

export function tourChrome(locale: string): TourChrome {
  return TOUR_CHROME[locale] ?? TOUR_CHROME.en!;
}
