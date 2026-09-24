// Ejecuta runJobInOrg en un proceso aparte, con el TENANCY_MODE que le pase
// el test. El modo se lee al importar el módulo y no cambia en caliente, así
// que probar los dos modos en un mismo proceso no es posible sin trampas.
import { runJobInOrg } from "../../src/infra/tenant/job-org";
import { currentOrgId } from "../../src/infra/tenant/tenant.context";

const arg = process.argv[2];
const orgId = arg === "null" ? null : arg;

runJobInOrg("envío", orgId, async () => currentOrgId()).then(
  (v) => console.log(JSON.stringify({ ok: true, v })),
  (e: Error) => console.log(JSON.stringify({ ok: false, msg: e.message })),
);
