import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../apps/portal-publico");
const serverSource = fs.readFileSync(path.join(root, "server.js"), "utf8");
const pageSource = fs.readFileSync(path.join(root, "public/feirantes/index.html"), "utf8");
const scriptSource = fs.readFileSync(path.join(root, "public/feirantes/feirantes.js"), "utf8");

test("endpoint público consulta somente bancas aprovadas", () => {
  assert.match(serverSource, /stall_registrations\?select=/);
  assert.match(serverSource, /status=eq\.approved/);
  assert.match(serverSource, /getActiveFeirantes/);
});

test("página pública de Feirantes não contém campos privados", () => {
  const publicSource = `${pageSource}\n${scriptSource}`.toLowerCase();
  assert.doesNotMatch(publicSource, /cpf_cnpj|cpf\/cnpj|telefone|phone|e-mail|email/);
  assert.match(publicSource, /businessname|categoria|regi[aã]o/);
});
