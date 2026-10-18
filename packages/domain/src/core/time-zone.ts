/**
 * Time zones as the app uses them: an IANA name, valid or not, and a suggestion from the country (for new organisations only;
 * anything unknown stays UTC). Only countries with a single zone are suggested, so a suggestion is never a guess between zones.
 */
export function isValidTimeZone(timeZone: string): boolean {
  try { new Intl.DateTimeFormat("en-CA", { timeZone }); return true; } catch { return false; }
}

const BY_COUNTRY: ReadonlyArray<readonly [codes: readonly string[], zone: string]> = [
  [["ke", "kenya"], "Africa/Nairobi"], [["ug", "uganda"], "Africa/Kampala"], [["tz", "tanzania"], "Africa/Dar_es_Salaam"],
  [["et", "ethiopia"], "Africa/Addis_Ababa"], [["so", "somalia"], "Africa/Mogadishu"], [["ng", "nigeria"], "Africa/Lagos"],
  [["gh", "ghana"], "Africa/Accra"], [["sn", "senegal"], "Africa/Dakar"], [["ml", "mali"], "Africa/Bamako"], [["ne", "niger"], "Africa/Niamey"],
  [["sl", "sierra leone"], "Africa/Freetown"], [["lr", "liberia"], "Africa/Monrovia"], [["rw", "rwanda"], "Africa/Kigali"],
  [["bi", "burundi"], "Africa/Bujumbura"], [["mw", "malawi"], "Africa/Blantyre"], [["zm", "zambia"], "Africa/Lusaka"],
  [["zw", "zimbabwe"], "Africa/Harare"], [["sd", "sudan"], "Africa/Khartoum"], [["ss", "south sudan"], "Africa/Juba"],
  [["pk", "pakistan"], "Asia/Karachi"], [["af", "afghanistan"], "Asia/Kabul"], [["bd", "bangladesh"], "Asia/Dhaka"],
  [["in", "india"], "Asia/Kolkata"], [["np", "nepal"], "Asia/Kathmandu"], [["lk", "sri lanka"], "Asia/Colombo"],
  [["jo", "jordan"], "Asia/Amman"], [["lb", "lebanon"], "Asia/Beirut"], [["sy", "syria"], "Asia/Damascus"], [["iq", "iraq"], "Asia/Baghdad"],
  [["ye", "yemen"], "Asia/Aden"], [["tr", "turkey", "türkiye"], "Europe/Istanbul"], [["ua", "ukraine"], "Europe/Kyiv"],
  [["ph", "philippines"], "Asia/Manila"], [["mm", "myanmar"], "Asia/Yangon"], [["kh", "cambodia"], "Asia/Phnom_Penh"], [["vn", "vietnam"], "Asia/Ho_Chi_Minh"],
  [["ht", "haiti"], "America/Port-au-Prince"], [["gb", "uk", "united kingdom"], "Europe/London"],
];

const INDEX = new Map(BY_COUNTRY.flatMap(([codes, zone]) => codes.map((c) => [c, zone] as const)));

/** The organisation's likely time zone from its country (a code or a name), or UTC when we cannot say. */
export function suggestTimeZone(country: string): string {
  return INDEX.get(country.trim().toLowerCase()) ?? "UTC";
}
