import { attach, BASE } from "../demo-ui/lib.mjs";
const A = [
 "Over seven months the project rehabilitated 40 water points, installed 8 solar-powered systems, built 900 latrine stances, triggered 60 villages through CLTS and reached 90,000 people with hygiene promotion; 25 villages are verified free from open defecation and 60,000 people gained access to improved water.",
 "Fuel and spare-part shortages delayed some borehole work, localized insecurity limited access to a few kebeles, and flooding damaged some latrines in May; the project used solar systems, flexible scheduling and raised platforms to keep delivery on track.",
 "Water, sanitation and hygiene outputs reached their targets; household outcomes moved from baseline (15-litre access 42% to 74%, safe water at point of use 38% to 69%, latrine access 20% to 48%) but remain just below the final-year targets, as expected for a seven-month project.",
 "Work was front-loaded on water points because the dry season (jilaal) raised the risk of diarrhoeal disease, then shifted to latrines, CLTS and hygiene as water access improved; cholera rapid response kits were pre-positioned ahead of the gu rains.",
 "A water committee in Mustahil that was trained and equipped with spare parts now collects small user fees and repaired its pump within two days when it broke down, showing how community management sustains the water point."
];
const { page, browser } = await attach("st4");
await page.goto(`${BASE}/projects/cd291c72-ebc9-4f16-8633-b7c9007507ed/reports/fdaa85df-0241-493a-a718-eb0e9f00bac5/inputs?tab=story`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
const t = page.locator("main textarea"); for (let i=0;i<5;i++) { await t.nth(i).fill(A[i]); await page.waitForTimeout(300); }
await page.waitForTimeout(3000); console.log("filled", await t.evaluateAll(a=>a.map(x=>x.value.length)));
await browser.close(); process.exit(0);
