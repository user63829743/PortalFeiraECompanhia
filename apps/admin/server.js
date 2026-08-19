import dotenv from "dotenv";
import crypto from "node:crypto";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });
const app = express();
const PORT = Number(process.env.PORT || 3002);
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "";
const SESSION_COOKIE = "portal_admin_session";
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || SUPABASE_SECRET_KEY;
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const SERVER_BUILD = "news-schema-real-2026-08-18";

app.use(express.json({ limit: "16mb" }));
app.use(express.static(path.join(__dirname, "public")));

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);
}

function getSessionToken(req) {
  const raw = req.headers.cookie || "";
  const item = raw.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return item ? decodeURIComponent(item.slice(SESSION_COOKIE.length + 1)) : "";
}

function readSession(token) {
  if (!token || !SESSION_SECRET) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.exp > Math.floor(Date.now() / 1000) ? data : null;
  } catch {
    return null;
  }
}

function createSession(username) {
  const payload = Buffer.from(JSON.stringify({ username, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function requireAuth(req, res, next) {
  const admin = readSession(getSessionToken(req));
  if (!admin) return sendError(res, 401, "Faça login para acessar o painel.");
  req.admin = admin;
  next();
}

function verifyPassword(password, storedHash) {
  const [algorithm, salt, expectedHex] = String(storedHash || "").split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex || !/^[0-9a-f]+$/i.test(expectedHex)) return false;
  try {
    const expected = Buffer.from(expectedHex, "hex");
    const received = crypto.scryptSync(password, salt, expected.length);
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

function toUiStatus(status, publicReady = false) {
  if (status === "approved") return publicReady ? "active" : "approved";
  if (status === "rejected") return "rejected";
  return "analyzing";
}

function toDbStatus(status) {
  if (status === "approved" || status === "active") return "approved";
  if (status === "rejected") return "rejected";
  return "reviewing";
}

function mapRegistration(row) {
  return {
    id: row.id,
    name: row.full_name,
    document: row.cpf_cnpj,
    email: row.email,
    phone: row.phone,
    businessName: row.business_name,
    region: row.region,
    category: row.category,
    boothLocation: row.booth_location,
    cep: row.cep || "",
    description: row.description,
    daysHours: row.days_hours,
    consentGiven: row.consent_given,
    status: toUiStatus(row.status, row.public_ready === true),
    databaseStatus: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    photoUrl: row.photo_url || "",
    logoUrl: row.logo_url || "",
    publicDescription: row.public_description || "",
    publicReady: row.public_ready === true
  };
}

function normalizeSponsorUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try { const url = new URL(raw); return ["http:", "https:"].includes(url.protocol) ? url.toString() : null; } catch { return null; }
}

function mapSponsor(row) {
  return {
    id: row.id,
    name: row.name || "",
    imageUrl: row.image_url || "",
    targetUrl: row.target_url || "",
    status: row.status === "active" ? "active" : "inactive",
    displayOrder: Number(row.display_order || 0),
    startsAt: row.starts_at || "",
    endsAt: row.ends_at || "",
    placement: row.placement || "home_bottom",
    campaignGroup: row.campaign_group || "default",
    displayMode: row.display_mode === "rotate" ? "rotate" : row.display_mode === "divided" ? "divided" : "fixed",
    rotationSeconds: Math.max(5, Math.min(60, Number(row.rotation_seconds || 8))),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function slugify(value) {
  return String(value || "noticia").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "noticia";
}

function mapNews(row) {
  return {
    id: row.id,
    title: row.title || "",
    slug: row.slug || "",
    category: row.category || "Portal das Feiras",
    author: row.author || "Redação",
    location: row.location || "Distrito Federal",
    content: row.content || "",
    imageUrl: row.image_url || "",
    status: row.status === "published" ? "published" : "draft",
    publishedAt: row.published_at || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapFair(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    region: row.region || "",
    address: row.address || "",
    cep: row.cep || "",
    daysHours: row.days_hours || "",
    photoUrl: row.photo_url || "",
    status: row.status === "inactive" ? "inactive" : "active",
    isFeatured: row.is_featured === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const MAX_FAIR_PHOTO_BYTES = 5 * 1024 * 1024;
const FAIR_PHOTO_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

async function uploadSponsorBanner(dataUrl) {
  if (!dataUrl) return null;
  const match = String(dataUrl).match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) throw new Error("O banner deve ser JPG, PNG ou WEBP.");
  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_FAIR_PHOTO_BYTES) throw new Error("O banner deve ter no máximo 5 MB.");
  const fileName = `sponsor-${crypto.randomUUID()}.${FAIR_PHOTO_TYPES[mimeType]}`;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/sponsors/${fileName}`, { method: "POST", headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}`, "Content-Type": mimeType, "x-upsert": "true" }, body: buffer });
  if (!response.ok) throw new Error(`Supabase Storage ${response.status}: ${(await response.text()).slice(0, 240)}`);
  return `${SUPABASE_URL}/storage/v1/object/public/sponsors/${fileName}`;
}

async function uploadNewsImage(dataUrl) {
  if (!dataUrl) return null;
  const match = String(dataUrl).match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) throw new Error("A imagem deve ser JPG, PNG ou WEBP.");
  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_FAIR_PHOTO_BYTES) throw new Error("A imagem deve ter no máximo 5 MB.");
  const fileName = `news-${crypto.randomUUID()}.${FAIR_PHOTO_TYPES[mimeType]}`;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/news/${fileName}`, { method: "POST", headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}`, "Content-Type": mimeType, "x-upsert": "true" }, body: buffer });
  if (!response.ok) throw new Error(`Supabase Storage ${response.status}: ${(await response.text()).slice(0, 240)}`);
  return `${SUPABASE_URL}/storage/v1/object/public/news/${fileName}`;
}

async function uploadStallAsset(dataUrl, kind) {
  if (!dataUrl) return null;
  const match = String(dataUrl).match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) throw new Error("A foto e o logo devem ser JPG, PNG ou WEBP.");
  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_FAIR_PHOTO_BYTES) throw new Error("Cada imagem deve ter no máximo 5 MB.");
  const fileName = `stall-${kind}-${crypto.randomUUID()}.${FAIR_PHOTO_TYPES[mimeType]}`;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/stall-assets/${fileName}`, { method: "POST", headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}`, "Content-Type": mimeType, "x-upsert": "true" }, body: buffer });
  if (!response.ok) throw new Error(`Supabase Storage ${response.status}: ${(await response.text()).slice(0, 240)}`);
  return `${SUPABASE_URL}/storage/v1/object/public/stall-assets/${fileName}`;
}

async function uploadFairPhoto(dataUrl) {
  if (!dataUrl) return null;
  const match = String(dataUrl).match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) throw new Error("A foto deve ser JPG, PNG ou WEBP.");
  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_FAIR_PHOTO_BYTES) throw new Error("A foto deve ter no máximo 5 MB.");
  const fileName = `fair-${crypto.randomUUID()}.${FAIR_PHOTO_TYPES[mimeType]}`;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/fairs/${fileName}`, {
    method: "POST",
    headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}`, "Content-Type": mimeType, "x-upsert": "true" },
    body: buffer
  });
  if (!response.ok) throw new Error(`Supabase Storage ${response.status}: ${(await response.text()).slice(0, 240)}`);
  return `${SUPABASE_URL}/storage/v1/object/public/fairs/${fileName}`;
}

function validateFair(data) {
  const name = String(data?.name || "").trim();
  const region = String(data?.region || "").trim();
  const cep = String(data?.cep || "").replace(/\D/g, "");
  if (name.length < 2) return "Informe o nome da feira.";
  if (region.length < 2) return "Informe a região da feira.";
  return null;
}

function filterFairs(fairs, { query = "", status = "all" } = {}) {
  const normalizedQuery = String(query).trim().toLowerCase();
  return fairs.filter((fair) => {
    const searchable = [fair.name, fair.region, fair.cep, fair.address].join(" ").toLowerCase();
    return (status === "all" || fair.status === status) && (!normalizedQuery || searchable.includes(normalizedQuery));
  });
}

function filterRegistrations(records, { query = "", status = "all", view = "all" } = {}) {
  const normalizedQuery = String(query).trim().toLowerCase();
  return records.filter((item) => {
    const searchable = [item.name, item.businessName, item.email, item.phone, item.category, item.region].join(" ").toLowerCase();
    const belongsToView = view === "feirantes"
      ? item.databaseStatus === "approved"
      : view === "registrations"
        ? item.databaseStatus !== "approved"
        : view === "stalls"
          ? item.status === "active"
          : true;
    return belongsToView && (!normalizedQuery || searchable.includes(normalizedQuery)) && (status === "all" || item.status === status);
  });
}

function isPublicProfileComplete(record) {
  return Boolean(
    String(record.business_name || "").trim() &&
    String(record.region || "").trim() &&
    String(record.category || "").trim() &&
    String(record.public_description || "").trim().length >= 10 &&
    String(record.photo_url || "").trim() &&
    String(record.logo_url || "").trim()
  );
}

async function supabaseRequest(endpoint, options = {}) {
  if (!isSupabaseConfigured()) throw new Error("Supabase não configurado. Preencha SUPABASE_URL e SUPABASE_SECRET_KEY.");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...(options.method === "PATCH" ? { Prefer: "return=representation" } : {}),
      ...(options.headers || {})
    }
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : [];
}

async function assertFeaturedCapacity({ id = null, status, isFeatured }) {
  if (status !== "active" || !isFeatured) return;
  let rows;
  try {
    rows = await supabaseRequest("fairs?select=id&status=eq.active&is_featured=eq.true");
  } catch (error) {
    if (/is_featured|column|42703/i.test(error.message || "")) return;
    throw error;
  }
  const occupied = rows.filter((row) => String(row.id) !== String(id)).length;
  if (occupied >= 3) throw new Error("Você pode manter no máximo três feiras ativas em destaque na Home.");
}

async function saveFairWithCompatibility(endpoint, options, payload) {
  try {
    return await supabaseRequest(endpoint, { ...options, body: JSON.stringify(payload) });
  } catch (error) {
    if (!/is_featured|featured|column/i.test(error.message || "")) throw error;
    const legacyPayload = { ...payload };
    delete legacyPayload.is_featured;
    return supabaseRequest(endpoint, { ...options, body: JSON.stringify(legacyPayload) });
  }
}

function isMissingCepError(error) {
  return /(?:cep|schema cache|PGRST204|column)/i.test(error?.message || "");
}

async function saveStallProfileWithCompatibility(endpoint, options, payload) {
  try {
    return await supabaseRequest(endpoint, { ...options, body: JSON.stringify(payload) });
  } catch (error) {
    if (!isMissingCepError(error) || !Object.prototype.hasOwnProperty.call(payload, "cep")) throw error;
    const legacyPayload = { ...payload };
    delete legacyPayload.cep;
    return supabaseRequest(endpoint, { ...options, body: JSON.stringify(legacyPayload) });
  }
}

async function saveNewsWithCompatibility(endpoint, options, payload) {
  try {
    return await supabaseRequest(endpoint, { ...options, body: JSON.stringify(payload) });
  } catch (error) {
    if (!/author|location|schema cache|PGRST204|column/i.test(error.message || "")) throw error;
    const legacyPayload = { ...payload };
    delete legacyPayload.author;
    delete legacyPayload.location;
    return supabaseRequest(endpoint, { ...options, body: JSON.stringify(legacyPayload) });
  }
}

async function saveSponsorWithCompatibility(endpoint, options, payload) {
  try {
    return await supabaseRequest(endpoint, { ...options, body: JSON.stringify(payload) });
  } catch (error) {
    if (!/placement|campaign_group|display_mode|rotation_seconds|schema cache|PGRST204|column/i.test(error.message || "")) throw error;
    const legacyPayload = { ...payload };
    delete legacyPayload.placement;
    delete legacyPayload.campaign_group;
    delete legacyPayload.display_mode;
    delete legacyPayload.rotation_seconds;
    return supabaseRequest(endpoint, { ...options, body: JSON.stringify(legacyPayload) });
  }
}

app.get("/api/health", (_req, res) => res.json({ ok: true, supabaseConfigured: isSupabaseConfigured(), port: PORT, build: SERVER_BUILD, newsPayload: "sem-author-location" }));

app.post("/api/login", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  if (!username || !password) return sendError(res, 400, "Informe usuário e senha.");
  if (ADMIN_USERNAME && username !== ADMIN_USERNAME) return sendError(res, 401, "Usuário ou senha inválidos.");
  try {
    const rows = await supabaseRequest(`admin_users?select=username,password_hash,active&username=eq.${encodeURIComponent(username)}&limit=1`);
    const admin = rows[0];
    if (!admin || admin.active === false || !verifyPassword(password, admin.password_hash)) return sendError(res, 401, "Usuário ou senha inválidos.");
    if (!SESSION_SECRET) return sendError(res, 500, "SESSION_SECRET não configurado no ambiente.");
    const token = createSession(admin.username);
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}${secure}`);
    res.json({ ok: true, username: admin.username });
  } catch (error) {
    console.error(error);
    sendError(res, 502, error.message);
  }
});

app.post("/api/logout", (req, res) => {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  const admin = readSession(getSessionToken(req));
  res.json({ authenticated: Boolean(admin), username: admin?.username || null });
});

app.get("/api/registrations", requireAuth, async (req, res) => {
  try {
    const rows = await supabaseRequest("stall_registrations?select=*&order=created_at.desc");
    const records = filterRegistrations(rows.map(mapRegistration), {
      query: req.query.q,
      status: req.query.status,
      view: req.query.view
    });
    res.json({ records, total: records.length });
  } catch (error) {
    console.error(error);
    sendError(res, 502, error.message);
  }
});

app.get("/api/feirantes", requireAuth, async (req, res) => {
  try {
    const rows = await supabaseRequest("stall_registrations?select=*&order=full_name.asc,created_at.desc");
    const approved = rows.filter((row) => row.status === "approved").map(mapRegistration).map((record) => ({
      ...record,
      status: record.publicReady ? "active" : "inactive"
    }));
    const query = String(req.query.q || "").trim().toLowerCase();
    const status = String(req.query.status || "all");
    const feirantes = approved.filter((item) => {
      const searchable = [item.name, item.businessName, item.category, item.region].join(" ").toLowerCase();
      return (status === "all" || item.status === status) && (!query || searchable.includes(query));
    });
    res.json({ feirantes, total: feirantes.length });
  } catch (error) {
    console.error(error);
    sendError(res, 502, error.message);
  }
});

app.get("/api/sponsors", requireAuth, async (req, res) => {
  try {
    const rows = await supabaseRequest("sponsor_banners?select=*&order=display_order.asc,created_at.desc");
    const query = String(req.query.q || "").trim().toLowerCase();
    const status = String(req.query.status || "all");
    const sponsors = rows.map(mapSponsor).filter((item) => (status === "all" || item.status === status) && (!query || item.name.toLowerCase().includes(query)));
    res.json({ sponsors, total: sponsors.length });
  } catch (error) { console.error(error); sendError(res, 502, error.message); }
});

app.post("/api/sponsors", requireAuth, async (req, res) => {
  const data = req.body || {};
  if (String(data.name || "").trim().length < 2) return sendError(res, 400, "Informe o nome do patrocinador.");
  if (!data.imageDataUrl && !data.imageUrl) return sendError(res, 400, "Envie o banner do patrocinador.");
  try {
    const imageUrl = await uploadSponsorBanner(data.imageDataUrl) || String(data.imageUrl || "").trim();
    const targetUrl = normalizeSponsorUrl(data.targetUrl);
    if (data.targetUrl && !targetUrl) return sendError(res, 400, "O link deve começar com http:// ou https://.");
    const payload = { name: String(data.name).trim(), image_url: imageUrl, target_url: targetUrl, status: data.status === "active" ? "active" : "inactive", display_order: Number(data.displayOrder || 0), starts_at: data.startsAt ? new Date(data.startsAt).toISOString() : null, ends_at: data.endsAt ? new Date(data.endsAt).toISOString() : null, placement: String(data.placement || "home_bottom"), campaign_group: String(data.campaignGroup || "default").trim() || "default", display_mode: ["rotate", "divided"].includes(data.displayMode) ? data.displayMode : "fixed", rotation_seconds: Math.max(5, Math.min(60, Number(data.rotationSeconds || 8))) };
    const rows = await saveSponsorWithCompatibility("sponsor_banners", { method: "POST", headers: { Prefer: "return=representation" } }, payload);
    res.status(201).json({ sponsor: mapSponsor(rows[0]) });
  } catch (error) { console.error(error); sendError(res, 502, error.message); }
});

app.patch("/api/sponsors/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) return sendError(res, 400, "ID do patrocinador inválido.");
  const data = req.body || {};
  if (String(data.name || "").trim().length < 2) return sendError(res, 400, "Informe o nome do patrocinador.");
  try {
    const targetUrl = normalizeSponsorUrl(data.targetUrl);
    if (data.targetUrl && !targetUrl) return sendError(res, 400, "O link deve começar com http:// ou https://.");
    const payload = { name: String(data.name).trim(), target_url: targetUrl, status: data.status === "active" ? "active" : "inactive", display_order: Number(data.displayOrder || 0), starts_at: data.startsAt ? new Date(data.startsAt).toISOString() : null, ends_at: data.endsAt ? new Date(data.endsAt).toISOString() : null, placement: String(data.placement || "home_bottom"), campaign_group: String(data.campaignGroup || "default").trim() || "default", display_mode: ["rotate", "divided"].includes(data.displayMode) ? data.displayMode : "fixed", rotation_seconds: Math.max(5, Math.min(60, Number(data.rotationSeconds || 8))), updated_at: new Date().toISOString() };
    if (data.imageDataUrl) payload.image_url = await uploadSponsorBanner(data.imageDataUrl);
    const rows = await saveSponsorWithCompatibility(`sponsor_banners?id=eq.${id}`, { method: "PATCH" }, payload);
    if (!rows.length) return sendError(res, 404, "Patrocinador não encontrado.");
    res.json({ sponsor: mapSponsor(rows[0]) });
  } catch (error) { console.error(error); sendError(res, 502, error.message); }
});

app.patch("/api/sponsors/:id/status", requireAuth, async (req, res) => {
  const id = Number(req.params.id); const status = String(req.body?.status || "");
  if (!Number.isSafeInteger(id) || !["active", "inactive"].includes(status)) return sendError(res, 400, "ID ou status inválido.");
  try { const rows = await supabaseRequest(`sponsor_banners?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status, updated_at: new Date().toISOString() }) }); if (!rows.length) return sendError(res, 404, "Patrocinador não encontrado."); res.json({ sponsor: mapSponsor(rows[0]) }); } catch (error) { console.error(error); sendError(res, 502, error.message); }
});

app.delete("/api/sponsors/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) return sendError(res, 400, "ID do patrocinador inválido.");
  try {
    await supabaseRequest(`sponsor_banners?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    res.json({ ok: true, id });
  } catch (error) { console.error(error); sendError(res, 502, error.message); }
});

app.get("/api/news", requireAuth, async (req, res) => {
  try {
    const rows = await supabaseRequest("news_articles?select=*&order=updated_at.desc,created_at.desc");
    const query = String(req.query.q || "").trim().toLowerCase();
    const status = String(req.query.status || "all");
    const articles = rows.map(mapNews).filter((item) => (status === "all" || item.status === status) && (!query || [item.title, item.category, item.content].join(" ").toLowerCase().includes(query)));
    res.json({ articles, total: articles.length });
  } catch (error) { console.error(error); sendError(res, 502, error.message); }
});

app.post("/api/news", requireAuth, async (req, res) => {
  const data = req.body || {};
  const title = String(data.title || "").trim();
  const content = String(data.content || "").trim();
  if (title.length < 3) return sendError(res, 400, "Informe um título com pelo menos 3 caracteres.");
  if (content.length < 10) return sendError(res, 400, "Informe o texto completo da notícia.");
  try {
    const status = data.status === "published" ? "published" : "draft";
    const imageUrl = await uploadNewsImage(data.imageDataUrl) || String(data.imageUrl || "").trim() || null;
    const payload = { title, slug: `${slugify(title)}-${Date.now()}`, category: String(data.category || "Portal das Feiras").trim(), location: String(data.location || "").trim() || null, content, image_url: imageUrl, status, published_at: status === "published" ? (data.publishedAt ? new Date(data.publishedAt).toISOString() : new Date().toISOString()) : null };
    const rows = await saveNewsWithCompatibility("news_articles", { method: "POST", headers: { Prefer: "return=representation" } }, payload);
    res.status(201).json({ article: mapNews(rows[0]) });
  } catch (error) { console.error(error); sendError(res, 502, error.message); }
});

app.patch("/api/news/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) return sendError(res, 400, "ID da notícia inválido.");
  const data = req.body || {};
  const title = String(data.title || "").trim();
  const content = String(data.content || "").trim();
  if (title.length < 3) return sendError(res, 400, "Informe um título com pelo menos 3 caracteres.");
  if (content.length < 10) return sendError(res, 400, "Informe o texto completo da notícia.");
  try {
    const status = data.status === "published" ? "published" : "draft";
    const payload = { title, category: String(data.category || "Portal das Feiras").trim(), location: String(data.location || "").trim() || null, content, status, published_at: status === "published" ? (data.publishedAt ? new Date(data.publishedAt).toISOString() : new Date().toISOString()) : null, updated_at: new Date().toISOString() };
    if (data.imageDataUrl) payload.image_url = await uploadNewsImage(data.imageDataUrl);
    else if (Object.hasOwn(data, "imageUrl")) payload.image_url = String(data.imageUrl || "").trim() || null;
    const rows = await saveNewsWithCompatibility(`news_articles?id=eq.${id}`, { method: "PATCH" }, payload);
    if (!rows.length) return sendError(res, 404, "Notícia não encontrada.");
    res.json({ article: mapNews(rows[0]) });
  } catch (error) { console.error(error); sendError(res, 502, error.message); }
});

app.patch("/api/news/:id/status", requireAuth, async (req, res) => {
  const id = Number(req.params.id); const status = String(req.body?.status || "");
  if (!Number.isSafeInteger(id) || !["draft", "published"].includes(status)) return sendError(res, 400, "ID ou status da notícia inválido.");
  try { const rows = await supabaseRequest(`news_articles?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status, published_at: status === "published" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }) }); if (!rows.length) return sendError(res, 404, "Notícia não encontrada."); res.json({ article: mapNews(rows[0]) }); } catch (error) { console.error(error); sendError(res, 502, error.message); }
});

app.delete("/api/news/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) return sendError(res, 400, "ID da notícia inválido.");
  try { const rows = await supabaseRequest(`news_articles?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=representation" } }); if (!rows.length) return sendError(res, 404, "Notícia não encontrada."); res.json({ ok: true }); } catch (error) { console.error(error); sendError(res, 502, error.message); }
});

app.get("/api/fairs", requireAuth, async (req, res) => {
  try {
    const rows = await supabaseRequest("fairs?select=*&order=created_at.desc");
    const fairs = filterFairs(rows.map(mapFair), { query: req.query.q, status: req.query.status });
    res.json({ fairs, total: fairs.length });
  } catch (error) {
    console.error(error);
    sendError(res, 502, error.message);
  }
});

app.post("/api/fairs", requireAuth, async (req, res) => {
  const data = req.body || {};
  const validationError = validateFair(data);
  if (validationError) return sendError(res, 400, validationError);
  try {
    const payload = {
      name: String(data.name).trim(), description: String(data.description || "").trim() || null,
      region: String(data.region).trim(), cep: String(data.cep || "").replace(/\D/g, "") || null,
      address: String(data.address || "").trim() || null,
      days_hours: String(data.daysHours || "").trim() || null,
      photo_url: await uploadFairPhoto(data.photoDataUrl) || String(data.photoUrl || "").trim() || null,
      status: data.status === "inactive" ? "inactive" : "active",
      is_featured: data.isFeatured === true || data.isFeatured === "true"
    };
    await assertFeaturedCapacity({ status: payload.status, isFeatured: payload.is_featured });
    const rows = await saveFairWithCompatibility("fairs", { method: "POST", headers: { Prefer: "return=representation" } }, payload);
    res.status(201).json({ fair: mapFair(rows[0]) });
  } catch (error) {
    console.error(error);
    sendError(res, 502, error.message);
  }
});

app.patch("/api/fairs/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) return sendError(res, 400, "ID da feira inválido.");
  const validationError = validateFair(req.body || {});
  if (validationError) return sendError(res, 400, validationError);
  const data = req.body;
  try {
    const payload = {
      name: String(data.name).trim(), description: String(data.description || "").trim() || null,
      region: String(data.region).trim(), cep: String(data.cep || "").replace(/\D/g, "") || null,
      address: String(data.address || "").trim() || null,
      days_hours: String(data.daysHours || "").trim() || null,
      status: data.status === "inactive" ? "inactive" : "active",
      is_featured: data.isFeatured === true || data.isFeatured === "true",
      updated_at: new Date().toISOString()
    };
    await assertFeaturedCapacity({ id, status: payload.status, isFeatured: payload.is_featured });
    if (data.photoDataUrl) payload.photo_url = await uploadFairPhoto(data.photoDataUrl);
    else if (Object.hasOwn(data, "photoUrl")) payload.photo_url = String(data.photoUrl || "").trim() || null;
    const rows = await saveFairWithCompatibility(`fairs?id=eq.${id}`, { method: "PATCH" }, payload);
    if (!rows.length) return sendError(res, 404, "Feira não encontrada.");
    res.json({ fair: mapFair(rows[0]) });
  } catch (error) {
    console.error(error);
    sendError(res, 502, error.message);
  }
});

app.patch("/api/fairs/:id/status", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || "");
  if (!Number.isSafeInteger(id) || !["active", "inactive"].includes(status)) return sendError(res, 400, "ID ou status da feira inválido.");
  try {
    let currentRows;
    try {
      currentRows = await supabaseRequest(`fairs?id=eq.${id}&select=id,is_featured`);
    } catch (error) {
      if (/is_featured|column|42703/i.test(error.message || "")) currentRows = await supabaseRequest(`fairs?id=eq.${id}&select=id`);
      else throw error;
    }
    if (!currentRows.length) return sendError(res, 404, "Feira não encontrada.");
    await assertFeaturedCapacity({ id, status, isFeatured: currentRows[0].is_featured === true });
    const rows = await supabaseRequest(`fairs?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status, updated_at: new Date().toISOString() }) });
    if (!rows.length) return sendError(res, 404, "Feira não encontrada.");
    res.json({ fair: mapFair(rows[0]) });
  } catch (error) {
    console.error(error);
    sendError(res, 502, error.message);
  }
});

app.delete("/api/fairs/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) return sendError(res, 400, "ID da feira inválido.");
  try {
    const rows = await supabaseRequest(`fairs?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=representation" } });
    if (!rows.length) return sendError(res, 404, "Feira não encontrada.");
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    sendError(res, 502, error.message);
  }
});

app.get("/api/stats", requireAuth, async (_req, res) => {
  try {
    const rows = await supabaseRequest("stall_registrations?select=status,public_ready");
    const stats = { total: rows.length, analyzing: 0, approved: 0, rejected: 0, active: 0 };
    for (const row of rows) stats[toUiStatus(row.status, row.public_ready === true)] += 1;
    res.json(stats);
  } catch (error) {
    console.error(error);
    sendError(res, 502, error.message);
  }
});

app.patch("/api/registrations/:id/profile", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) return sendError(res, 400, "ID do cadastro inválido.");
  const data = req.body || {};
  try {
    const currentRows = await supabaseRequest(`stall_registrations?id=eq.${id}&select=*`);
    const current = currentRows[0];
    if (!current) return sendError(res, 404, "Cadastro não encontrado.");
    const requestedPublicReady = data.publicReady === true || data.publicReady === "true";
    if (requestedPublicReady && current.status !== "approved") return sendError(res, 400, "A banca precisa estar aprovada antes de ser liberada no portal.");
    const businessName = String(data.businessName ?? current.business_name ?? "").trim();
    const region = String(data.region ?? current.region ?? "").trim();
    const category = String(data.category ?? current.category ?? "").trim();
    const publicDescription = String(data.publicDescription ?? current.public_description ?? "").trim();
    let photoUrl = String(data.photoUrl ?? current.photo_url ?? "").trim();
    let logoUrl = String(data.logoUrl ?? current.logo_url ?? "").trim();
    if (data.photoDataUrl) photoUrl = await uploadStallAsset(data.photoDataUrl, "photo");
    if (data.logoDataUrl) logoUrl = await uploadStallAsset(data.logoDataUrl, "logo");
    const complete = Boolean(businessName && region && category && publicDescription.length >= 10 && photoUrl && logoUrl);
    const publicReady = current.status === "approved" && complete;
    const payload = { business_name: businessName, region, category, booth_location: String(data.boothLocation ?? current.booth_location ?? "").trim() || null, days_hours: String(data.daysHours ?? current.days_hours ?? "").trim() || null, description: String(data.description ?? current.description ?? "").trim() || publicDescription, public_description: publicDescription || null, photo_url: photoUrl || null, logo_url: logoUrl || null, public_ready: publicReady, updated_at: new Date().toISOString() };
    const rows = await saveStallProfileWithCompatibility(`stall_registrations?id=eq.${id}`, { method: "PATCH" }, payload);
    if (!rows.length) return sendError(res, 404, "Cadastro não encontrado.");
    res.json({ record: mapRegistration(rows[0]) });
  } catch (error) { console.error(error); sendError(res, 502, error.message); }
});

app.patch("/api/feirantes/:id/status", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || "");
  if (!Number.isSafeInteger(id) || !["active", "inactive"].includes(status)) return sendError(res, 400, "ID ou status do feirante inválido.");
  try {
    const currentRows = await supabaseRequest(`stall_registrations?id=eq.${id}&select=*`);
    const current = currentRows[0];
    if (!current || current.status !== "approved") return sendError(res, 404, "Feirante aprovado não encontrado.");
    if (status === "active" && !isPublicProfileComplete(current)) return sendError(res, 400, "Complete negócio, região, categoria, descrição, foto e logo antes de ativar.");
    const rows = await supabaseRequest(`stall_registrations?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ public_ready: status === "active", updated_at: new Date().toISOString() }) });
    if (!rows.length) return sendError(res, 404, "Feirante não encontrado.");
    res.json({ record: { ...mapRegistration(rows[0]), status } });
  } catch (error) { console.error(error); sendError(res, 502, error.message); }
});

app.delete("/api/feirantes/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) return sendError(res, 400, "ID do feirante inválido.");
  try {
    const currentRows = await supabaseRequest(`stall_registrations?id=eq.${id}&select=status`);
    const current = currentRows[0];
    if (!current || current.status !== "approved") return sendError(res, 400, "Somente feirantes aprovados podem ser excluídos nesta área.");
    await supabaseRequest(`stall_registrations?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    res.json({ ok: true });
  } catch (error) { console.error(error); sendError(res, 502, error.message); }
});

app.delete("/api/registrations/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) return sendError(res, 400, "ID do cadastro inválido.");
  try {
    const currentRows = await supabaseRequest(`stall_registrations?id=eq.${id}&select=status`);
    const current = currentRows[0];
    if (!current || current.status === "approved") return sendError(res, 400, "Somente cadastros recebidos podem ser excluídos.");
    const rows = await supabaseRequest(`stall_registrations?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=representation" } });
    if (!rows.length) return sendError(res, 404, "Cadastro não encontrado.");
    res.json({ ok: true });
  } catch (error) { console.error(error); sendError(res, 502, error.message); }
});

app.patch("/api/registrations/:id/status", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || "");
  if (!Number.isSafeInteger(id) || !["analyzing", "approved", "rejected"].includes(status)) return sendError(res, 400, "ID ou status inválido.");
  try {
    const rows = await supabaseRequest(`stall_registrations?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: toDbStatus(status), public_ready: false, updated_at: new Date().toISOString() })
    });
    if (!rows.length) return sendError(res, 404, "Cadastro não encontrado.");
    res.json({ record: mapRegistration(rows[0]) });
  } catch (error) {
    console.error(error);
    sendError(res, 502, error.message);
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  app.listen(PORT, () => console.log(`Painel admin em http://localhost:${PORT}`));
}

export default app;
export { app, toUiStatus, toDbStatus, mapRegistration, verifyPassword, filterRegistrations, isPublicProfileComplete, mapFair, validateFair, filterFairs };
