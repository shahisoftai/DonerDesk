/**
 * Countries whose boundaries ship below admin 1: places where humanitarian and development programmes have run or run now
 * (OCHA-coordinated responses past and present, regional response countries, and the usual host and neighbouring states).
 * One editable list; the generator reads it (`--set humanitarian`), so adding a country is one line here and a re-run for that country.
 */
export const HUMANITARIAN_COUNTRIES: readonly string[] = [
  // East and Horn of Africa
  "SDN", "SSD", "ETH", "SOM", "KEN", "UGA", "TZA", "RWA", "BDI", "DJI", "ERI",
  // Central Africa and Great Lakes
  "COD", "CAF", "TCD", "CMR", "COG", "GAB", "GNQ", "STP",
  // West Africa and the Sahel
  "NGA", "NER", "MLI", "BFA", "MRT", "SEN", "GMB", "GNB", "GIN", "SLE", "LBR", "CIV", "GHA", "TGO", "BEN", "CPV",
  // Southern Africa and Indian Ocean
  "MOZ", "MWI", "ZMB", "ZWE", "MDG", "COM", "AGO", "NAM", "BWA", "LSO", "SWZ", "ZAF",
  // North Africa and Middle East
  "LBY", "EGY", "TUN", "DZA", "MAR", "YEM", "SYR", "IRQ", "LBN", "JOR", "PSE", "TUR", "IRN",
  // South and Southeast Asia
  "AFG", "PAK", "BGD", "NPL", "LKA", "BTN", "IND", "MMR", "THA", "LAO", "KHM", "VNM", "PHL", "IDN", "TLS", "MYS", "PNG",
  // Pacific
  "FJI", "VUT", "SLB", "TON", "WSM", "KIR", "TUV", "FSM", "MHL",
  // Central Asia, Caucasus and Eastern Europe
  "KGZ", "TJK", "UZB", "TKM", "KAZ", "MNG", "ARM", "AZE", "GEO", "UKR", "MDA", "BLR", "SRB", "BIH", "ALB", "MKD", "XKX",
  // Latin America and the Caribbean
  "COL", "VEN", "HTI", "DOM", "CUB", "JAM", "GTM", "HND", "SLV", "NIC", "CRI", "PAN", "MEX", "ECU", "PER", "BOL", "PRY", "BRA", "CHL", "ARG",
];

export const isHumanitarianCountry = (iso: string): boolean => HUMANITARIAN_COUNTRIES.includes(iso.toUpperCase());
