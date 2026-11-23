import type { Messages } from "../domain/translate.ts";
import { assessPs } from "./assess-ps.ts";

/**
 * Pashto (Phase 62). A PARTIAL catalogue on purpose: the screens a field assessor uses are translated; every other message falls back to English
 * until it is. A draft without a native reviewer.
 */
export const ps: Messages = {
  "common.loading": "پورته کېږي…", "common.choose": "غوره کړئ…", "common.yes": "هو", "common.no": "نه", "common.send": "ولېږئ", "common.saveOnPhone": "پر دې موبایل خوندي کړئ", "common.optional": "{label} (اختیاري)",
  "field.title": "ساحوي فورمې", "field.online": "تاسو آنلاین یاست.",
  "field.offline": "تاسو آفلاین یاست. ستاسو ډک شوې فورمې پر دې موبایل پاتې کېږي او کله چې آنلاین شئ لېږل کېږي.",
  "field.allForms": "← ټولې فورمې", "field.onThisPhone": "پر دې موبایل", "field.noFormOpen": "هېڅ فورمه د ځوابونو لپاره خلاصه نه ده.", "field.remove": "له دې موبایل لرې کړئ",
  "field.downloadTitle": "د آفلاین لپاره ډاونلوډ کړئ", "field.project": "پروژه", "field.chooseProject": "پروژه غوره کړئ…", "field.downloadButton": "ډاونلوډ یا تازه کړئ",
  "form.nameLabel": "ستاسو نوم (اختیاري)", "form.nameHelp": "ترڅو ډله پوه شي چې دا چا لېږلی دی.", "form.useLocation": "زما ځای وکاروئ", "form.latitude": "عرض البلد", "form.longitude": "طول البلد",
  "form.sending": "لېږل کېږي…", "form.attached": "ضمیمه شوی: {name}", "form.fileHelp": "یو انځور (JPEG, PNG, WebP) یا PDF، تر 5 MB پورې.", "form.fileTooBig": "دا فایل له 5 MB لوی دی.",
  "form.sent": "ولېږل شو. مننه.", "form.send": "ولېږئ", "form.sendMyAnswers": "زما ځوابونه ولېږئ",
  "form.gpsUnsupported": "دا وسیله خپل ځای نه شي ورکولای.", "form.gpsDenied": "د دې پاڼې لپاره ځای بند دی. شمېرې پخپله ولیکئ.", "form.gpsNone": "تر اوسه ځای نه دی موندل شوی. په خلاص ځای کې هڅه وکړئ یا شمېرې پخپله ولیکئ.",
  "problem.REQUIRED": "{label} اړین دی.", "problem.NUMBER": "{label} باید یو شمېره وي.", "problem.MIN": "{label} له {min} څخه کم نشي کېدای.", "problem.MAX": "{label} له {max} څخه ډېر نشي کېدای.",
  "problem.DATE": "{label} باید رښتینې نېټه وي چې په YYYY-MM-DD بڼه لیکل شوې وي.", "problem.OPTION": "{label}: دا له ورکړل شویو انتخابونو څخه نه دی.", "problem.YES_NO": "{label} باید هو یا نه وي.",
  "problem.GPS": "{label} باید عرض البلد (−90 تر 90) او طول البلد (−180 تر 180) وي.", "problem.TOO_LONG": "{label} له {max} توري څخه اوږد دی.", "problem.FILE": "{label}: لومړی انځور یا سند ضمیمه کړئ.",
  ...assessPs,
};
