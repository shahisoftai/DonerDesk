import type { studioEn } from "./studio-en.ts";

/** AR text for the Visual Studio. A draft with no native reviewer: it follows the glossary and is checked by tests, not signed off. */
export const studioAr: Record<keyof typeof studioEn, string> = {
  "studio.data.title": "البيانات",
  "studio.data.search": "ابحث عن حقل، مثل «الفتيات الملتحقات»",
  "studio.data.empty": "لا يوجد حقل مطابق. جرّب كلمات أقل أو مختلفة.",
  "studio.data.notConnected": "قيد الربط",
  "studio.data.fieldComing": "غير متاح بعد",
  "studio.data.noAccess": "لا يستطيع دورك فتحه",
  "studio.data.guestOk": "يظهر على روابط المشاركة",
  "studio.data.guestNo": "لا يظهر على روابط المشاركة",
  "studio.data.measure": "رقم",
  "studio.data.dimension": "التجميع حسب",
  "studio.data.perRow": "كل صف يمثل {grain}",
  "studio.data.preview": "عرض البيانات",
  "studio.data.unavailable": "تعذّر العرض: {reason}",
  "studio.live.updatedSeconds": "حُدّث قبل {value} ث",
  "studio.live.updatedMinutes": "حُدّث قبل {value} د",
  "studio.live.updatedHours": "حُدّث قبل {value} س",
  "studio.live.updatedDays": "حُدّث قبل {value} ي",
  "studio.live.refresh": "تحديث",
  "studio.live.offline": "غير متصل: تُعرض آخر الأرقام",
  "studio.live.changed": "تغيّرت الأرقام",
};
