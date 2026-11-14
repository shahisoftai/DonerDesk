/**
 * Deterministic synthetic tables for the Phase 54 dataset tests (§6, 54.0). No real data and no real place names: three shapes a
 * national export takes. `wide` = one row per district × month × partner with a column per figure (CamelCase headers, a title row);
 * `county` = different headers and county/sub-county places; `monthsAsColumns` = months across the top.
 */
const PROVINCES = [["Northern", ["Alder", "Birch", "Cedar"]], ["Southern", ["Dune", "Elm", "Fern"]], ["Eastern", ["Gale", "Heath"]]];
const MONTHS = ["Jan-26", "Feb-26", "Mar-26", "Apr-26"];
const PARTNERS = ["Partner A", "Partner B"];

export function wide() {
  const headers = ["Province", "District", "Month", "Partner", "Donor", "TotalChildScreen", "TotalWomeScreen", "SAM", "MAM", "NewAdminOTP", "NewAdminOTPB", "NewAdminOTPG", "TotalExitOTP", "DisCuredOTP", "DisDeathOTP", "DisDefaultOTP", "DisNonResponseOTP", "DisTransferOTP", "RUTFr", "RUTFu"];
  const rows = [];
  let n = 0;
  for (const [province, districts] of PROVINCES) for (const district of districts) for (const month of MONTHS) {
    n += 1;
    const partner = PARTNERS[n % 2];
    const screened = 800 + n * 13;
    const sam = 20 + (n % 7);
    const adm = sam - 2;
    const exits = 40 + (n % 11);
    const cured = Math.round(exits * (n % 3 === 0 ? 0.7 : 0.82));
    const died = 1, defaulted = Math.max(0, exits - cured - 3), nonresp = 1, moved = exits - cured - died - defaulted - nonresp;
    rows.push([province, district, month, partner, n % 4 === 0 ? "Donor Y" : "Donor X", screened, 300 + n, sam, 40 + (n % 9), adm, Math.floor(adm / 2), adm - Math.floor(adm / 2), exits, cured, died, defaulted, nonresp, moved, 30 + n, 25 + n]);
  }
  return { sheets: [{ name: "Data", cells: [["National programme report"], [], headers, ...rows] }] };
}

export function county() {
  const headers = ["County", "Sub County", "Reporting month", "Implementing partner", "Children screened", "Admissions SAM", "Recovered", "Total exits"];
  const rows = [];
  for (const [c, subs] of PROVINCES) for (const s of subs) for (const [i, m] of ["2026-01", "2026-02"].entries()) rows.push([c, s, m, PARTNERS[i], 500 + i, 12 + i, 30, 36]);
  return { sheets: [{ name: "Sheet1", cells: [headers, ...rows] }] };
}

export function monthsAsColumns() {
  const headers = ["District", "Indicator", "January", "February", "March"];
  const rows = [["Alder", "Screened", 100, 110, 120], ["Birch", "Screened", 90, null, 95]];
  return { sheets: [{ name: "Report", cells: [headers, ...rows] }] };
}
