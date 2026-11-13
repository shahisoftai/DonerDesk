import { attach } from "./lib.mjs";
import { execFileSync } from "node:child_process";
const { ctx } = await attach("v52-discard");
const cookies = await ctx.cookies("https://donordesk.online");
const token = cookies.find((c) => /session|token|dd_/i.test(c.name) && c.value.split(".").length === 3)?.value;
if (!token) { console.log("no session token cookie:", cookies.map((c) => c.name).join(",")); process.exit(1); }
for (const id of ["cff39ad8-7b12-4231-894b-901649837870", "3c1c7176-49f8-4b8d-8739-a2bde80fbacd"]) {
  const out = execFileSync("ssh", ["-o", "ConnectTimeout=20", "contabo", `curl -s -X DELETE -H 'authorization: Bearer ${token}' http://127.0.0.1:4001/v1/project-setup/proposals/${id}`]).toString();
  console.log(id.slice(0, 8), out.slice(0, 120));
}
process.exit(0);
