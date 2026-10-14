/** Reference lists behind the project form's suggestions. Suggestions only: every field still accepts free text. */

export const COUNTRIES: readonly string[] = [
  "Afghanistan", "Bangladesh", "Benin", "Burkina Faso", "Burundi", "Cameroon", "Central African Republic", "Chad",
  "Colombia", "Democratic Republic of the Congo", "Djibouti", "Ecuador", "Egypt", "El Salvador", "Eritrea", "Ethiopia",
  "Gambia", "Ghana", "Guatemala", "Guinea", "Haiti", "Honduras", "India", "Indonesia", "Iraq", "Jordan", "Kenya",
  "Lebanon", "Lesotho", "Liberia", "Libya", "Madagascar", "Malawi", "Mali", "Mauritania", "Mozambique", "Myanmar",
  "Nepal", "Niger", "Nigeria", "Pakistan", "Palestine", "Philippines", "Rwanda", "Senegal", "Sierra Leone", "Somalia",
  "South Sudan", "Sri Lanka", "Sudan", "Syria", "Tanzania", "Togo", "Uganda", "Ukraine", "Venezuela", "Yemen", "Zambia", "Zimbabwe",
];

/** The currencies a grant budget is usually written in; the local one is suggested from the country. */
export const CURRENCIES: readonly string[] = ["USD", "EUR", "GBP", "CHF", "CAD", "AUD", "KES", "UGX", "TZS", "ETB", "NGN", "GHS", "ZAR", "PKR", "BDT", "INR", "NPR", "PHP", "IDR", "XOF", "XAF", "SSP", "SDG", "SOS", "UAH", "JOD", "LBP", "IQD", "AFN", "MWK", "ZMW", "RWF", "BIF", "MZN", "MGA"];

const CURRENCY_BY_COUNTRY: Readonly<Record<string, string>> = {
  kenya: "KES", uganda: "UGX", tanzania: "TZS", ethiopia: "ETB", nigeria: "NGN", ghana: "GHS", pakistan: "PKR",
  bangladesh: "BDT", india: "INR", nepal: "NPR", philippines: "PHP", indonesia: "IDR", "south sudan": "SSP", sudan: "SDG",
  somalia: "SOS", ukraine: "UAH", jordan: "JOD", lebanon: "LBP", iraq: "IQD", afghanistan: "AFN", malawi: "MWK",
  zambia: "ZMW", rwanda: "RWF", burundi: "BIF", mozambique: "MZN", madagascar: "MGA", "south africa": "ZAR",
  senegal: "XOF", mali: "XOF", niger: "XOF", "burkina faso": "XOF", benin: "XOF", togo: "XOF",
  cameroon: "XAF", chad: "XAF", "central african republic": "XAF",
};

/** The local currency of a well-known country; undefined when unsure (the person types it, or keeps the usual USD). */
export function currencyForCountry(country: string): string | undefined {
  return CURRENCY_BY_COUNTRY[country.trim().toLowerCase()];
}

/** Donors people name most often, offered beside the ones this workspace has already used. */
export const COMMON_DONORS: readonly string[] = [
  "USAID", "European Union (ECHO)", "European Union (INTPA)", "FCDO", "GIZ", "UNICEF", "WFP", "UNHCR", "UNDP",
  "Global Fund", "World Bank", "Gates Foundation", "Sida", "Norad", "Danida", "Global Affairs Canada", "DFAT", "SDC",
];
