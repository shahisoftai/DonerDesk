import { attach } from "../lib.mjs";
const { page, browser } = await attach("c3");
const g = (l,i)=>page.getByLabel(l,{exact:true}).nth(i);
for (const i of [10,11]) console.log(i, await Promise.all(["Kind of number","Unit","Starting value","Target","How often"].map(async l=>l+"="+JSON.stringify(await g(l,i).inputValue()))));
await browser.close();
