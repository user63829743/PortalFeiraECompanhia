import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(APP_ROOT, "public");
function loadEnv() {
  const values = {};
  const envPath = join(APP_ROOT, ".env");
  if (!existsSync(envPath)) return values;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || line.trimStart().startsWith("#")) continue;
    values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  return values;
}
const ENV = loadEnv();

const PORT = Number(ENV.PORT || process.env.PORT || 3001);
const SUPABASE_URL = (ENV.SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SECRET_KEY = ENV.SUPABASE_SECRET_KEY || ENV.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };

function sendJson(response, status, data) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(data));
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 30_000) request.destroy();
    });
    request.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); } catch { reject(new Error("JSON inválido.")); }
    });
    request.on("error", reject);
  });
}

function validate(data) {
  const fields = ["fullName", "cpfCnpj", "email", "phone", "businessName", "region", "category", "description"];
  for (const field of fields) if (!String(data[field] || "").trim()) return "Preencha todos os campos obrigatórios.";
  if (!/^\S+@\S+\.\S+$/.test(String(data.email))) return "Informe um e-mail válido.";
  if (String(data.cpfCnpj).replace(/\D/g, "").length < 11) return "Informe CPF ou CNPJ válido.";
  if (String(data.phone).replace(/\D/g, "").length < 10) return "Informe telefone ou WhatsApp válido.";
  if (String(data.description).trim().length < 10) return "Descreva brevemente os produtos da banca.";
  if (data.consentGiven !== true) return "É necessário aceitar o uso dos dados para análise da inscrição.";
  return null;
}

async function saveRegistration(data) {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw new Error("Supabase não configurado. Preencha o arquivo .env.");
  const payload = {
    full_name: data.fullName.trim(), cpf_cnpj: data.cpfCnpj.trim(), email: data.email.trim(), phone: data.phone.trim(),
    business_name: data.businessName.trim(), region: data.region.trim(), category: data.category.trim(),
    booth_location: data.boothLocation?.trim() || null, cep: data.cep?.replace(/\D/g, '').slice(0, 8) || null, description: data.description.trim(), days_hours: data.daysHours?.trim() || null,
    consent_given: 1, status: "received",
  };
  const headers = { apikey: SUPABASE_SECRET_KEY, "content-type": "application/json", prefer: "return=representation" };
  if (!SUPABASE_SECRET_KEY.startsWith("sb_secret_")) headers.authorization = `Bearer ${SUPABASE_SECRET_KEY}`;
  let result = await fetch(`${SUPABASE_URL}/rest/v1/stall_registrations`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!result.ok && payload.cep) {
    const fallbackPayload = { ...payload };
    delete fallbackPayload.cep;
    result = await fetch(`${SUPABASE_URL}/rest/v1/stall_registrations`, {
      method: "POST",
      headers,
      body: JSON.stringify(fallbackPayload),
    });
  }
  if (!result.ok) throw new Error(`Supabase respondeu ${result.status}: ${await result.text()}`);
  const saved = await result.json();
  if (!Array.isArray(saved) || !saved[0]?.id) throw new Error("O Supabase não retornou o comprovante da inscrição.");
  return { id: saved[0].id, createdAt: saved[0].created_at, status: saved[0].status };
}

async function handler(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (request.method === "POST" && url.pathname === "/api/cadastros") {
    try {
      const data = await parseBody(request);
      const error = validate(data);
      if (error) return sendJson(response, 400, { error });
      const registration = await saveRegistration(data);
      return sendJson(response, 201, { success: true, registration });
    } catch (error) {
      console.error("[Cadastro]", error.message);
      return sendJson(response, 500, { error: "Não foi possível salvar a inscrição agora. Tente novamente." });
    }
  }
  if (request.method !== "GET") return sendJson(response, 405, { error: "Método não permitido." });
  const fileName = url.pathname === "/" ? "index.html" : normalize(url.pathname).replace(/^([/\\])+/, "");
  if (fileName.includes("..")) return sendJson(response, 403, { error: "Acesso negado." });
  try {
    const file = await readFile(join(ROOT, fileName));
    response.writeHead(200, { "content-type": MIME[extname(fileName)] || "application/octet-stream" });
    response.end(file);
  } catch { sendJson(response, 404, { error: "Arquivo não encontrado." }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer(handler).listen(PORT, () => console.log(`Cadastro disponível em http://localhost:${PORT}`));
}

export default handler;
