import type { Messages } from "../domain/translate.ts";
import { assessUr } from "./assess-ur.ts";

/**
 * Urdu (Phase 62). A PARTIAL catalogue on purpose: the screens a field assessor uses (filling a form, choosing a facility, drafts, the field page
 * basics and the answer problems) are translated; every other message falls back to English until it is. A draft without a native reviewer.
 */
export const ur: Messages = {
  "common.loading": "لوڈ ہو رہا ہے…", "common.choose": "منتخب کریں…", "common.yes": "ہاں", "common.no": "نہیں", "common.send": "بھیجیں", "common.saveOnPhone": "اس فون پر محفوظ کریں", "common.optional": "{label} (اختیاری)",
  "field.title": "فیلڈ فارم", "field.online": "آپ آن لائن ہیں۔",
  "field.offline": "آپ آف لائن ہیں۔ آپ کے بھرے ہوئے فارم اس فون پر محفوظ رہتے ہیں اور آن لائن ہوتے ہی بھیج دیے جاتے ہیں۔",
  "field.allForms": "← تمام فارم", "field.onThisPhone": "اس فون پر", "field.noFormOpen": "کوئی فارم جوابات کے لیے کھلا نہیں۔", "field.remove": "اس فون سے ہٹائیں",
  "field.downloadTitle": "آف لائن کے لیے ڈاؤن لوڈ کریں", "field.project": "منصوبہ", "field.chooseProject": "منصوبہ منتخب کریں…", "field.downloadButton": "ڈاؤن لوڈ یا تازہ کریں",
  "form.nameLabel": "آپ کا نام (اختیاری)", "form.nameHelp": "تاکہ ٹیم کو معلوم ہو کہ یہ کس نے بھیجا۔", "form.useLocation": "میری جگہ استعمال کریں", "form.latitude": "عرض بلد", "form.longitude": "طول بلد",
  "form.sending": "بھیجا جا رہا ہے…", "form.attached": "منسلک: {name}", "form.fileHelp": "ایک تصویر (JPEG, PNG, WebP) یا PDF، زیادہ سے زیادہ 5 MB۔", "form.fileTooBig": "یہ فائل 5 MB سے بڑی ہے۔",
  "form.sent": "بھیج دیا گیا۔ شکریہ۔", "form.send": "بھیجیں", "form.sendMyAnswers": "میرے جوابات بھیجیں",
  "form.gpsUnsupported": "یہ آلہ اپنی جگہ نہیں بتا سکتا۔", "form.gpsDenied": "اس صفحے کے لیے مقام بند ہے۔ اعداد خود لکھیں۔", "form.gpsNone": "ابھی جگہ معلوم نہیں ہوئی۔ کھلی جگہ آزمائیں یا اعداد خود لکھیں۔",
  "problem.REQUIRED": "{label} ضروری ہے۔", "problem.NUMBER": "{label} ایک عدد ہونا چاہیے۔", "problem.MIN": "{label} {min} سے کم نہیں ہو سکتا۔", "problem.MAX": "{label} {max} سے زیادہ نہیں ہو سکتا۔",
  "problem.DATE": "{label} ایک حقیقی تاریخ ہونی چاہیے جو YYYY-MM-DD میں لکھی ہو۔", "problem.OPTION": "{label}: یہ دیے گئے انتخابات میں سے نہیں۔", "problem.YES_NO": "{label} ہاں یا نہیں ہونا چاہیے۔",
  "problem.GPS": "{label} عرض بلد (−90 سے 90) اور طول بلد (−180 سے 180) ہونا چاہیے۔", "problem.TOO_LONG": "{label} {max} حروف سے لمبا ہے۔", "problem.FILE": "{label}: پہلے تصویر یا دستاویز منسلک کریں۔",
  ...assessUr,
};
