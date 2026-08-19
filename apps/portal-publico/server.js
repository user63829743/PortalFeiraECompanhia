const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

function loadRootEnv() {
  try {
    const envText = require('node:fs').readFileSync(path.join(__dirname, '..', '..', '.env'), 'utf8');
    for (const line of envText.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch {}
}

loadRootEnv();
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, 'public');
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';
const FEED_URL = 'https://www.youtube.com/feeds/videos.xml?channel_id=UCNXn6LdIzQZ3YHRKZYEs-aw';
const CLDF_SEARCH_URL = 'https://www.cl.df.gov.br/busca?q=feira';
const CLDF_BASE_URL = 'https://www.cl.df.gov.br';
const CLDF_KEYWORDS = /\b(feira|feiras|feirante|feirantes|banca|bancas|expositor|expositores|comércio popular|mercado popular)\b/i;
const FAIR_FIELDS = 'id,name,description,region,address,cep,days_hours,status,photo_url,created_at';
const FEATURED_FAIR_FIELDS = `${FAIR_FIELDS},is_featured`;

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

function decodeXml(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(x?[0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code.replace(/^x/i, ''), code[0].toLowerCase() === 'x' ? 16 : 10)))
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(value = '') {
  return decodeXml(value.replace(/<[^>]*>/g, ' '));
}

function resumoCldf(rawText, title) {
  const text = stripHtml(rawText);
  const pareceTecnico = /\bnull\b|\b(?:type|url)\b|documents?\b|\\\/?documents\\?\/|[{}\[\]]|\\["']|(?:^|\s)[0-9a-f]{4,}(?:-[0-9a-f-]{3,})+/i.test(text);
  if (!text || pareceTecnico) return `Acompanhe esta publicação da CLDF sobre ${title.toLowerCase()}.`;
  return resumir(text);
}

function getTag(entry, tag) {
  const match = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

function getAttribute(entry, tag, attribute) {
  const match = entry.match(new RegExp(`<${tag}[^>]*\\s${attribute}="([^"]+)"[^>]*>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

function resumir(texto) {
  if (!texto) return 'Confira o novo vídeo da TVegNews.';
  return texto.length > 180 ? `${texto.slice(0, 177).trim()}...` : texto;
}

function parseFeed(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
    .map((match) => {
      const entry = match[1];
      const id = getTag(entry, 'yt:videoId');
      const title = getTag(entry, 'title');
      const publishedAt = getTag(entry, 'published');
      const description = getTag(entry, 'media:description');
      const thumbnail = getAttribute(entry, 'media:thumbnail', 'url') || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      const url = getAttribute(entry, 'link', 'href') || `https://www.youtube.com/watch?v=${id}`;

      if (!id || !title || !publishedAt) return null;

      return {
        id,
        title,
        description: resumir(description),
        thumbnail,
        publishedAt,
        url,
      };
    })
    .filter((video) => video && /youtube\.com\/watch\?v=/i.test(video.url))
    .slice(0, 3);
}

async function getActiveFairs() {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) return [];
  const url = `${SUPABASE_URL}/rest/v1/fairs?select=${FAIR_FIELDS}&status=eq.active&order=name.asc`;
  const response = await fetch(url, { headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}` }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Supabase Feiras indisponível (${response.status}).`);
  return (await response.json()).map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description || '',
    region: item.region || '',
    address: item.address || '',
    cep: item.cep || '',
    daysHours: item.days_hours || '',
    status: item.status,
    photoUrl: item.photo_url || '',
    createdAt: item.created_at,
  }));
}

async function getFeaturedFairs() {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) return [];
  const url = `${SUPABASE_URL}/rest/v1/fairs?select=${FEATURED_FAIR_FIELDS}&status=eq.active&is_featured=eq.true&order=updated_at.desc&limit=3`;
  const response = await fetch(url, { headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}` }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    if (response.status === 400) return [];
    throw new Error(`Supabase Feiras em destaque indisponível (${response.status}).`);
  }
  return (await response.json()).map((item) => ({
    id: item.id,
    name: item.name || '',
    description: item.description || '',
    region: item.region || '',
    address: item.address || '',
    cep: item.cep || '',
    daysHours: item.days_hours || '',
    status: item.status,
    photoUrl: item.photo_url || '',
    createdAt: item.created_at,
  }));
}

async function getActiveFeirantes() {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) return [];
  const headers = { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}` };
  const baseFields = 'id,business_name,region,category,description,public_description,days_hours,booth_location,photo_url,logo_url,public_ready,created_at,status';
  const withCep = `${baseFields},cep`;
  const query = 'status=eq.approved&public_ready=eq.true&order=business_name.asc,full_name.asc';
  let response = await fetch(`${SUPABASE_URL}/rest/v1/stall_registrations?select=${withCep}&${query}`, { headers, signal: AbortSignal.timeout(8000) });
  if (!response.ok) response = await fetch(`${SUPABASE_URL}/rest/v1/stall_registrations?select=${baseFields}&${query}`, { headers, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Supabase Feirantes indisponível (${response.status}).`);
  return (await response.json()).map((item) => ({
    id: item.id,
    businessName: item.business_name || '',
    region: item.region || '',
    cep: item.cep || '',
    category: item.category || '',
    description: item.public_description || item.description || '',
    daysHours: item.days_hours || '',
    boothLocation: item.booth_location || '',
    photoUrl: item.photo_url || '',
    logoUrl: item.logo_url || '',
    createdAt: item.created_at || ''
  }));
}

function mapCldfArticle(item, index) {
  return { id: `cldf-${index}`, title: item.title || 'Notícia', slug: `cldf-${index}`, category: 'CLDF', author: 'CLDF', location: '', excerpt: item.description || '', content: item.description || '', imageUrl: item.imageUrl || '', publishedAt: item.publishedAt || '', createdAt: item.publishedAt || '', updatedAt: null, externalUrl: item.url || '' };
}

async function getPublishedNews(slug = '') {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) return [];
  const headers = { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}` };
  const query = 'status=eq.published&order=published_at.desc,created_at.desc';
  const response = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?select=id,title,slug,category,author,location,excerpt,content,image_url,status,published_at,created_at,updated_at&${query}`, { headers, signal: AbortSignal.timeout(8000) });
  let items;
  if (response.ok) items = await response.json();
  else {
    const locationOnly = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?select=id,title,slug,category,location,excerpt,content,image_url,status,published_at,created_at,updated_at&${query}`, { headers, signal: AbortSignal.timeout(8000) });
    if (locationOnly.ok) items = await locationOnly.json();
    else {
      const fallback = await fetch(`${SUPABASE_URL}/rest/v1/news_articles?select=id,title,slug,category,excerpt,content,image_url,status,published_at,created_at,updated_at&${query}`, { headers, signal: AbortSignal.timeout(8000) });
      if (!fallback.ok) {
        const cldfNews = await getCldfNews();
        const mapped = cldfNews.map(mapCldfArticle);
        return slug ? mapped.filter((item) => item.slug === slug) : mapped;
      }
      items = await fallback.json();
    }
  }
  const now = Date.now();
  return items.filter((item) => (!item.published_at || new Date(item.published_at).getTime() <= now) && (!slug || item.slug === slug)).map((item) => {
    const createdAt = item.created_at;
    const updatedAt = item.updated_at && createdAt && new Date(item.updated_at).getTime() > new Date(createdAt).getTime() + 1000 ? item.updated_at : null;
    const content = item.content || '';
    return { id: item.id, title: item.title, slug: item.slug, category: item.category || '', author: item.author || 'Redação', location: item.location || '', excerpt: resumir(content), content, imageUrl: item.image_url || '', publishedAt: item.published_at || createdAt, createdAt, updatedAt };
  });
}

async function getActiveSponsors() {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) return [];
  const headers = { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}` };
  const advancedSelect = 'id,name,image_url,target_url,display_order,status,starts_at,ends_at,placement,campaign_group,display_mode,rotation_seconds';
  let response = await fetch(`${SUPABASE_URL}/rest/v1/sponsor_banners?select=${advancedSelect}&order=display_order.asc,created_at.desc`, { headers, signal: AbortSignal.timeout(8000) });
  if (!response.ok && response.status === 400) response = await fetch(`${SUPABASE_URL}/rest/v1/sponsor_banners?select=id,name,image_url,target_url,display_order,status,starts_at,ends_at&order=display_order.asc,created_at.desc`, { headers, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Supabase patrocinadores indisponível (${response.status}).`);
  const now = Date.now();
  return (await response.json()).filter((item) => item.status === 'active' && (!item.starts_at || new Date(item.starts_at).getTime() <= now) && (!item.ends_at || new Date(item.ends_at).getTime() >= now)).slice(0, 16).map((item) => ({ id: item.id, name: item.name, imageUrl: item.image_url, targetUrl: item.target_url || '', displayOrder: Number(item.display_order || 0), placement: item.placement || 'home_bottom', campaignGroup: item.campaign_group || 'default', displayMode: item.display_mode === 'rotate' ? 'rotate' : item.display_mode === 'divided' ? 'divided' : 'fixed', rotationSeconds: Math.max(5, Math.min(60, Number(item.rotation_seconds || 8))) }));
}

function parseCldfResults(html) {
  const articles = [];
  const otherResults = [];
  const itemPattern = /<a\b[^>]*href="([^"]+)"[^>]*class="[^"]*list-group-item[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(itemPattern)) {
    const href = match[1];
    const block = match[2];
    const titleMatch = block.match(/<h5\b[^>]*>([\s\S]*?)<\/h5>/i);
    const dateMatch = block.match(/<small\b[^>]*>([\s\S]*?)<\/small>/i);
    const descriptionMatch = block.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    const imageMatch = block.match(/<img\b[^>]*src="([^"]+)"[^>]*>/i);
    const title = stripHtml(titleMatch?.[1] || '');
    const description = resumoCldf(descriptionMatch?.[1] || '', title);
    if (!title || !CLDF_KEYWORDS.test(`${title} ${description}`)) continue;
    let url;
    try { url = new URL(href, CLDF_BASE_URL).toString(); } catch { continue; }
    if (!url.startsWith(`${CLDF_BASE_URL}/`)) continue;
    let imageUrl = '';
    try {
      const candidate = imageMatch?.[1] ? new URL(imageMatch[1], CLDF_BASE_URL).toString() : '';
      if (candidate.startsWith(`${CLDF_BASE_URL}/`)) imageUrl = candidate;
    } catch {}
    const item = { title, description, imageUrl, publishedAt: stripHtml(dateMatch?.[1] || ''), url };
    if (/\/ -\//.test(url) || /\/-\//.test(url)) articles.push(item);
    else otherResults.push(item);
  }
  return [...articles, ...otherResults].slice(0, 3);
}

function normalizarImagemCldf(value) {
  if (!value) return '';
  try {
    const url = new URL(value, CLDF_BASE_URL).toString();
    return url.startsWith(`${CLDF_BASE_URL}/`) ? url : '';
  } catch {
    return '';
  }
}

async function getCldfPageImage(url) {
  try {
    const response = await fetch(url, { headers: { 'user-agent': 'Portal-das-Feiras/1.0' }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return '';
    const html = await response.text();
    const candidates = [
      html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1],
      html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i)?.[1],
      html.match(/<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"/i)?.[1],
      html.match(/<img[^>]+src="([^"]+)"/i)?.[1],
    ];
    return candidates.map(normalizarImagemCldf).find(Boolean) || '';
  } catch {
    return '';
  }
}

async function getCldfNews() {
  const response = await fetch(CLDF_SEARCH_URL, { headers: { 'user-agent': 'Portal-das-Feiras/1.0' }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Busca da CLDF indisponível (${response.status}).`);
  const results = parseCldfResults(await response.text());
  return Promise.all(results.map(async (item) => ({ ...item, imageUrl: item.imageUrl || await getCldfPageImage(item.url) })));
}

async function getLatestVideos() {

  const response = await fetch(FEED_URL, {
    headers: { 'user-agent': 'Portal-das-Feiras-TVegNews/1.0' },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) throw new Error(`Feed do YouTube indisponível (${response.status}).`);

  const videos = parseFeed(await response.text());
  if (videos.length < 3) throw new Error('O feed do canal não retornou três vídeos válidos.');
  return videos;
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(data));
}

async function serveStatic(request, response) {
  const requestedPath = request.url === '/' ? '/index.html' : decodeURIComponent(request.url.split('?')[0]);
  const filePath = path.resolve(ROOT, `.${requestedPath}`);

  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end('Acesso negado.');
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    response.end(data);
  } catch {
    response.writeHead(404);
    response.end('Arquivo não encontrado.');
  }
}

async function handler(request, response) {
    if (request.url?.startsWith('/api/feirantes')) {
    try {
      sendJson(response, 200, { feirantes: await getActiveFeirantes() });
    } catch (error) {
      sendJson(response, 502, { error: 'Não foi possível atualizar os feirantes.', details: error.message });
    }
    return;
  }

  if (request.url?.startsWith('/api/feiras-destaque')) {
    try {
      sendJson(response, 200, { fairs: await getFeaturedFairs() });
    } catch (error) {
      sendJson(response, 502, { error: 'Não foi possível atualizar as Feiras em destaque.', details: error.message });
    }
    return;
  }

  if (request.url?.startsWith('/api/feiras')) {
    try {
      sendJson(response, 200, { fairs: await getActiveFairs() });
    } catch (error) {
      sendJson(response, 502, { error: 'Não foi possível atualizar as Feiras.', details: error.message });
    }
    return;
  }

  if (request.url?.startsWith('/api/news')) {
    const parsedUrl = new URL(request.url, `http://localhost:${PORT}`);
    const slug = parsedUrl.searchParams.get('slug') || '';
    try {
      sendJson(response, 200, { news: await getPublishedNews(slug) });
    } catch {
      try {
        const fallback = (await getCldfNews()).map(mapCldfArticle);
        sendJson(response, 200, { news: slug ? fallback.filter((item) => item.slug === slug) : fallback });
      } catch {
        sendJson(response, 200, { news: [] });
      }
    }
    return;
  }

  if (request.url?.startsWith('/api/sponsors')) {
    try { sendJson(response, 200, { sponsors: await getActiveSponsors() }); } catch (error) { sendJson(response, 502, { error: 'Não foi possível atualizar os patrocinadores.', details: error.message }); }
    return;
  }

  if (request.url?.startsWith('/api/cldf-news')) {
    try {
      sendJson(response, 200, { news: await getCldfNews() });
    } catch (error) {
      sendJson(response, 502, { error: 'Não foi possível atualizar as notícias da CLDF.', details: error.message });
    }
    return;
  }

  if (request.url?.startsWith('/api/tvegnews')) {

    try {
      sendJson(response, 200, { videos: await getLatestVideos() });
    } catch (error) {
      sendJson(response, 502, { error: 'Não foi possível atualizar os vídeos da TVegNews.', details: error.message });
    }
    return;
  }

  await serveStatic(request, response);
}

if (require.main === module) {
  http.createServer(handler).listen(PORT, () => {
    console.log(`Portal disponível em http://localhost:${PORT}`);
  });
}

module.exports = handler;
