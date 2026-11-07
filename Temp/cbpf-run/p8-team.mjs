import { attach } from "./lib.mjs";
const { page, step, type, shot, browser } = await attach("team");
const slide = page.locator("section[aria-roledescription='slide']");
await page.getByRole("navigation", { name: "Create a project" }).getByRole("button", { name: /Project and team/ }).click(); await page.waitForTimeout(700);
for (const l of ["Project name","Project code","Start date","End date","Currency (for example USD)","Short summary"]) console.log("prefill", l, "=", JSON.stringify(await page.getByLabel(l,{exact:true}).inputValue()));
await step("project facts", async () => {
  await type("Project name", "Life-Saving Flagship WASH Response: Community-Driven Water, Sanitation, and Hygiene Services for Crisis-Affected Populations");
  await type("Project code", "CBPF-SOM-25-S-NGO-37159");
  await type("Start date", "2025-09-01");
  await type("End date", "2026-02-28");
  await type("Currency (for example USD)", "usd");
  await type("Short summary", "Urgent, community-driven water, sanitation and hygiene services for IDP and host communities in Baidoa District, Somalia: water trucking, borehole rehabilitation, gender-segregated emergency latrines, hygiene kits and cholera-prevention hygiene promotion. Implemented by Youth In Action Baidoa under the SHF Standard Allocation 2 2025.");
});
const add = async (name, email, role, inv) => step("add " + name, async () => {
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Email (needed to invite)").fill(email);
  await page.getByLabel("Role", { exact: true }).selectOption(role);
  if (inv) await page.getByLabel("Invitation").selectOption(inv).catch(e=>console.log("inv fail"));
  await page.getByRole("button", { name: "Add to team" }).click(); await page.waitForTimeout(700);
});
await add("Abdullahi Hudow Osman", "youthinactionbaidoa@gmail.com", "PROJECT_MANAGER", { label: "Invite later" });
await add("M&E Officer (to be named)", "mnpiracha+yia-me@gmail.com", "ME_OFFICER", { label: "Invite later" });
await step("no outside partners", async () => { await page.getByRole("checkbox", { name: "There are no outside partners" }).check(); await page.waitForTimeout(500); });
console.log((await page.getByRole("navigation", { name: "Create a project" }).innerText()).replace(/\n/g," | "));
console.log((await slide.innerText()).slice(0,1200));
await browser.close();
