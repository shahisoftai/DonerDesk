import type { PublicTourBundle } from "./public-tour-copy.ts";

/** Français. Brouillon sans relecture par un locuteur natif : à faire relire avant de l'annoncer. Les captures d'écran restent en anglais. */
export const PUBLIC_TOUR_FR: PublicTourBundle = {
  heading: "Visite guidée de DonorDesk",
  lede: "Un seul dossier, du premier objectif au rapport final, en six étapes. Choisissez votre rôle pour voir votre part, ou parcourez tout. Aucun compte nécessaire.",
  chapters: {
    plan: { name: "Planifier", promise: "Fixez les cibles et le travail une fois ; chaque période part de là." },
    collect: { name: "Collecter", promise: "Les équipes de terrain saisissent une fois, avec ou sans réseau." },
    track: { name: "Suivre", promise: "Voyez les écarts quand il est encore temps d'agir." },
    see: { name: "Voir", promise: "Le graphique, la carte ou la page que votre conseil ou bailleur demande." },
    prove: { name: "Prouver", promise: "Chaque chiffre est traçable et chaque changement est consigné." },
    report: { name: "Rapporter", promise: "Des brouillons qui citent leurs sources, vérifiés et approuvés par une personne." },
  },
  roles: {
    director: { name: "Direction", line: "Tout le portefeuille, où vous travaillez, et les preuves." },
    manager: { name: "Responsable de programme", line: "Planifier, collecter, relire et rapporter pour vos projets." },
    me: { name: "Responsable S&E", line: "Indicateurs, formulaires, valeurs et leur lecture." },
    field: { name: "Agent de terrain", line: "Saisir sur téléphone, hors ligne, et voir ce qui vous revient." },
    grants: { name: "Responsable des subventions", line: "Modèles de bailleurs, rapports et échéances." },
  },
  ui: {
    allRoles: "Tout", rolePrompt: "Montrez-moi les parties pour", chapterNav: "Chapitres de la visite", sceneOf: "Scène {n} sur {total}",
    back: "Retour", next: "Suivant", start: "Commencer gratuitement", goodToKnow: "Bon à savoir", seeFeature: "En savoir plus sur cette fonction", tryIt: "Créer un espace gratuit",
    phoneNote: "Affiché sur un téléphone, comme le voit un agent de terrain.", sampleNote: "Un projet d'exemple aux noms et chiffres inventés. Les captures sont en anglais.",
    finalTitle: "Voyez-le sur votre propre programme.",
    finalBody: "Créez un espace gratuit et configurez un projet à partir de vos propres documents, ou comparez DonorDesk aux outils que vous utilisez aujourd'hui.",
    compare: "Voir la comparaison", screenAlt: "Écran DonorDesk : {title}",
  },
  scenes: {
    wizard: {
      title: "Partez des documents que vous avez déjà",
      body: "Téléversez la proposition et le cadre logique. DonorDesk les lit et propose les résultats, indicateurs, lieux, plan de travail, lignes budgétaires et risques, chacun avec le passage d'où il vient. Vous acceptez, modifiez ou rejetez ; rien n'est créé avant le lancement.",
      note: "L'assistant est désactivé tant qu'un administrateur ne l'active pas, et tout élément proposé doit citer le document, sinon il est écarté. Une valeur que le document n'indique pas s'affiche « Non indiqué », jamais zéro.",
    },
    "sector-library": {
      title: "Partez de bons indicateurs, pas d'une page blanche",
      body: "Une bibliothèque couvrant 34 secteurs suggère des résultats, des indicateurs et des hypothèses sectorielles. Adoptez ceux qui conviennent ; le projet possède alors sa copie, et une mise à jour arrive comme une comparaison que vous acceptez champ par champ.",
      note: "Les entrées de la bibliothèque sont des points de départ livrés sans relecture : faites-les vérifier par un spécialiste du secteur. Une norme comme un chiffre Sphere s'affiche à côté de votre cible comme référence, sans la remplacer.",
    },
    framework: {
      title: "Un seul ensemble de résultats, lu comme cadre de résultats ou cadre logique",
      body: "Objectifs, effets, produits et activités avec leurs indicateurs, valeurs de référence et cibles. Passez d'une lecture à l'autre et nommez les niveaux avec les mots de votre bailleur.",
      note: "Une fois une version approuvée, une valeur de référence ou une cible utilisée par un rapport ne change pas en silence : il faut un motif, conservé avec la version.",
    },
    "work-plan": {
      title: "Planifiez le travail en liste, en calendrier ou sur une carte",
      body: "Des activités planifiées avec responsables, lieux et dates. Les retards se signalent d'eux-mêmes, les dates se déplacent par glisser-déposer, et chaque activité réalisée renvoie à ce qu'elle a produit.",
      note: "Un statut ne change que par les étapes autorisées, et déplacer une date passée demande pourquoi. Ces motifs forment l'historique des décisions du projet.",
    },
    "record-activity": {
      title: "Saisissez ce qui s'est passé en une minute",
      body: "Tapez ou dictez ce qui s'est passé. DonorDesk renseigne la date, le lieu et les personnes qu'il trouve dans vos mots et déduit la période de rapport. Il n'invente jamais un détail.",
      note: "Une date qu'aucune période de rapport ne couvre n'est jamais donnée à une période voisine ; on vous le demande, avec un lien pour la créer.",
    },
    forms: {
      title: "Des formulaires qui alimentent vos indicateurs",
      body: "Construisez des questions avec règles, photos et GPS, rattachez chacune à un indicateur, puis partagez un lien public ou envoyez-le à l'équipe de terrain. Les fiches acceptées deviennent des valeurs d'indicateur provisoires à relire.",
      note: "Un formulaire publié est figé pour que les fiches gardent les questions auxquelles elles ont répondu. Fermez-le et créez-en un nouveau pour le modifier.",
    },
    "field-app": {
      title: "Une application de terrain qui marche sans réseau",
      body: "Téléchargez une fois les formulaires et lieux d'un projet. Remplissez-les hors ligne, avec photos ; ils partent seuls au retour du signal, une seule fois chacun même si la connexion coupe en cours d'envoi.",
      note: "Les données hors ligne restent sur le téléphone jusqu'à l'envoi et sont effacées à la déconnexion. Une fiche refusée par le serveur est mise de côté avec la raison, jamais renvoyée en silence.",
    },
    "field-home": {
      title: "Un agent de terrain ne voit que ce qui le concerne",
      body: "L'accueil s'ouvre sur le travail prévu cette semaine et les échéances, avec le bouton Saisir à un geste. Les menus inutiles à un rôle de terrain ne sont pas affichés du tout.",
      note: "Ce que voit chaque rôle vient d'une seule table. Masquer un bouton ne remplace jamais le contrôle d'autorisation du serveur.",
    },
    "entry-sheet": {
      title: "Saisissez les résultats d'une période comme dans un tableur",
      body: "Tapez ou collez depuis Excel dans une grille unique, avec la valeur de la période précédente et le cumul à côté de chaque case. Joignez la preuve là où vous saisissez le chiffre, puis soumettez ; un relecteur valide ou renvoie avec un motif.",
      note: "Une valeur validée est verrouillée et ne peut être écrasée par un collage ou un import. Saisir ne soumet rien tout seul, sauf si le projet utilise la relecture simple.",
    },
    "data-center": {
      title: "Tous les chiffres sur une seule feuille",
      body: "Tous les indicateurs, périodes, cibles et valeurs dans un seul tableau. Importez, exportez, croisez ou représentez toute mesure, et voyez le statut de chaque valeur, du brouillon à la validation.",
      note: "Un écart s'affiche « Non mesuré », jamais zéro, et un taux n'est jamais additionné ni présenté comme pourcentage de la cible.",
    },
    "where-we-work": {
      title: "Des résultats par lieu, à partir d'une seule liste de lieux",
      body: "Une liste de lieux partagée pour l'organisation. Les résultats se cumulent des sites aux districts puis aux provinces, et chaque carte a son tableau à côté.",
      note: "Un lieu sans chiffre enregistré est gris, pas zéro. Les limites sous le niveau province n'existent que pour les pays disposant de fichiers officiels ; ailleurs la carte s'arrête aux provinces.",
    },
    "chart-studio": {
      title: "Chart Studio : 50 types de graphiques, honnêtes par défaut",
      body: "Choisissez un indicateur et une forme, puis stylez-le avec des thèmes et des options. Le studio refuse les graphiques trompeurs et dit pourquoi, avec une correction en un clic.",
      note: "Des unités différentes ne partagent jamais un axe brut, une valeur manquante est un trou et non un zéro, et les valeurs non validées ne sont tracées que sur demande et sont comptées.",
    },
    dashboard: {
      title: "Un tableau de bord toujours à jour",
      body: "Graphiques, chiffres clés, cartes et notes sur une grille que vous organisez. Ouvrez-le en plein écran pour le mur, imprimez-le ou partagez un lien qui expire.",
      note: "Un lien de partage montre les chiffres tels qu'ils sont à l'ouverture et n'inclut jamais les finances. Testez un lien dans un navigateur déconnecté avant de l'envoyer.",
    },
    "dashboard-templates": {
      title: "Partez d'un modèle sectoriel",
      body: "Choisissez un modèle pour votre secteur, associez ses rôles à vos indicateurs et obtenez un tableau de bord prêt avec une ligne de chiffres clés. Les copies sont à vous.",
      note: "Un modèle nomme des rôles, jamais des chiffres. Un rôle non associé est laissé de côté, pas tracé avec une valeur inventée.",
    },
    portfolio: {
      title: "Chaque projet en un coup d'œil",
      body: "Avancement, problèmes et risques, et prochain rapport de chaque projet en cours, le plus urgent d'abord, pour les projets que vous pouvez voir.",
      note: "La santé de l'exécution vient du travail en retard et des valeurs en retard ; ce n'est pas une note combinée, et les indicateurs comptés ailleurs ne sont jamais additionnés deux fois.",
    },
    evidence: {
      title: "Des preuves liées au chiffre qu'elles justifient",
      body: "Téléversez photos, reçus et documents pour une activité ou une valeur d'indicateur. Chaque fichier montre les affirmations de rapport qui le citent, et les niveaux de confidentialité décident qui peut l'ouvrir.",
      note: "Un fichier ne vaut preuve qu'une fois rattaché. Les fichiers restreints restent fermés aux rôles sans l'autorisation, dans les listes comme au téléchargement.",
    },
    team: {
      title: "Les bonnes personnes, le bon accès",
      body: "Invitez collègues, partenaires et lecteurs par projet. Les rôles décident qui peut écrire, relire, approuver et exporter, et un second approbateur peut être exigé. Chaque changement est inscrit dans un journal d'audit en ajout seul.",
      note: "Les partenaires externes n'accèdent qu'aux projets et fonctions que vous nommez. La double authentification peut être exigée de toute l'organisation. DonorDesk ne prétend à aucune certification de sécurité externe.",
    },
    "donor-template": {
      title: "Apprenez-lui une fois le rapport de votre bailleur",
      body: "Téléversez le modèle du bailleur. DonorDesk en extrait sections, questions, tableaux et limites de mots pour que vous les relisiez et les approuviez ; cela devient le squelette de chaque rapport.",
      note: "L'extraction est vérifiée par rapport au document et signalée quand elle hésite. Vous l'approuvez avant toute rédaction.",
    },
    "report-editor": {
      title: "Un brouillon écrit d'après votre dossier, puis vérifié affirmation par affirmation",
      body: "Générez un premier brouillon à partir des résultats validés, des activités et des preuves : tableaux et graphiques viennent des données et le rédacteur n'écrit que la prose autour. Puis modifiez, voyez la source de chaque énoncé, tranchez ceux qui demandent une décision et écartez ce qui ne s'applique pas.",
      note: "Un chiffre absent de vos données est rejeté, et une section qui ne peut être rédigée sans risque reçoit la version simple avec une raison. Une personne approuve ; l'auteur ne peut approuver seul lorsqu'un second approbateur est exigé. Tout changement ultérieur remet le rapport en relecture.",
    },
    export: {
      title: "Exporter pour relecture ou pour le bailleur",
      body: "Téléchargez à tout moment une copie interne de n'importe quel brouillon, avec filigrane. Une soumission au bailleur n'est scellée qu'après approbation du rapport et levée de ses contrôles.",
      note: "Un rapport approuvé est exporté selon le cadre sur lequel il a été approuvé : les changements ultérieurs de cibles ne le réécrivent pas.",
    },
    "closing-report": {
      title: "Clôturez le projet en confiance",
      body: "Un plan pas à pas pour le rapport final : ce qui manque, ce qui est prêt et qui doit encore valider.",
      note: "Un rapport final ferme la série de périodes ; le plan n'affiche que les étapes qui s'appliquent à votre projet.",
    },
    ask: {
      title: "Interrogez vos propres données",
      body: "Posez une question en mots simples et obtenez une réponse construite uniquement à partir de vos valeurs d'indicateurs, activités acceptées et fichiers que vous pouvez ouvrir, avec la source après chaque phrase.",
      note: "Désactivé tant qu'un administrateur ne l'active pas. Les phrases qui ne se rattachent pas à une source ou à un chiffre qu'elle contient sont écartées : une réponse peut être incomplète, jamais inventée. Les finances ne sont jamais lues.",
    },
  },
};
