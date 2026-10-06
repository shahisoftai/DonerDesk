import { attach, BASE } from "./lib.mjs";
const people = [
 ["Amara Okafor","Project Manager"],["Lukas Bergmann","Project Manager"],["Zanele Dlamini","Project Manager"],
 ["Elena Marchetti","M&E Officer"],["Kwame Mensah","M&E Officer"],
 ["Ingrid Solberg","Grants Officer"],["Fatou Diallo","Compliance Officer"],
 ["Pieter van Leeuwen","Viewer"],["Chiara Rossi","Viewer"],["Tendai Moyo","Viewer"]];
const { page, browser } = await attach();
for (const [name, role] of people) {
  const [f,...l] = name.toLowerCase().replace(/[^a-z ]/g,"").split(" ");
  const email = `${f}.${l.join("")}.demo@example.org`;
  await page.goto(`${BASE}/onboarding/team`); await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Invite member" }).click(); await page.waitForTimeout(800);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Role").last().selectOption({ label: role });
  const nm = page.getByLabel(/name/i); if (await nm.count()) await nm.first().fill(name);
  await page.getByRole("button", { name: /send invite/i }).click(); await page.waitForTimeout(3000);
  console.log("invited", name, role, email);
}
await page.goto(`${BASE}/onboarding/team`); await page.waitForLoadState("networkidle");
console.log((await page.locator("main").innerText()).split("Name\tEmail")[1]);
await browser.close(); process.exit(0);
