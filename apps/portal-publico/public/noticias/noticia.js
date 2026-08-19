const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const formatDate = (value) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '';
const fallbackImage = '../images/foto.avif';
const ITEMS_PER_PAGE = 5;
let allArticles = [];
let currentPage = 1;

function articleRow(article) {
  const href = `index.html?slug=${encodeURIComponent(article.slug)}`;
  const image = escapeHtml(article.imageUrl || fallbackImage);
  const title = escapeHtml(article.title || 'Notícia');
  const postedValue = article.publishedAt || article.createdAt;
  const postedAt = escapeHtml(formatDate(postedValue));
  const updatedValue = article.updatedAt && postedValue && new Date(article.updatedAt).getTime() > new Date(postedValue).getTime() + 1000 ? article.updatedAt : '';
  const dates = updatedValue ? `Postado em ${postedAt} • Atualizado em ${escapeHtml(formatDate(updatedValue))}` : `Postado em ${postedAt}`;
  return `<article class="noticia-linha"><img class="noticia-miniatura" src="${image}" alt="${title}" onerror="this.onerror=null;this.src='${fallbackImage}'"><div class="noticia-linha-conteudo"><h2>${title}</h2><p class="noticia-linha-data">${dates}</p><a class="noticia-linha-botao" href="${href}">Ler mais...</a></div></article>`;
}

async function apiNews(query = '') {
  const response = await fetch(`/api/news${query}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Não foi possível carregar as notícias.');
  return response.json();
}

function renderPagination(totalItems) {
  const pagination = $('#paginacaoNoticias');
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  if (totalPages <= 1) { pagination.innerHTML = ''; return; }
  const buttons = [];
  buttons.push(`<button type="button" class="pagina-botao anterior" data-page="${Math.max(1, currentPage - 1)}" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>`);
  for (let page = 1; page <= totalPages; page += 1) buttons.push(`<button type="button" class="pagina-botao ${page === currentPage ? 'ativo' : ''}" data-page="${page}" aria-label="Página ${page}" ${page === currentPage ? 'aria-current="page"' : ''}>${page}</button>`);
  buttons.push(`<button type="button" class="pagina-botao proxima" data-page="${Math.min(totalPages, currentPage + 1)}" ${currentPage === totalPages ? 'disabled' : ''}>Próxima</button>`);
  pagination.innerHTML = buttons.join('');
  pagination.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => { currentPage = Number(button.dataset.page); renderListPage(); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
}

function renderListPage() {
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  $('#noticiasGrid').innerHTML = allArticles.slice(start, start + ITEMS_PER_PAGE).map(articleRow).join('');
  renderPagination(allArticles.length);
}

function sponsorMarkup(sponsor) {
  if (!sponsor || !sponsor.imageUrl) return '';
  const image = `<img src="${escapeHtml(sponsor.imageUrl)}" alt="${escapeHtml(sponsor.name || 'Anúncio')}" onerror="this.parentElement.innerHTML='<span>Anúncio indisponível</span>'">`;
  return sponsor.targetUrl ? `<a href="${escapeHtml(sponsor.targetUrl)}" target="_blank" rel="noopener sponsored">${image}</a>` : image;
}

function newsSponsorSlots(sponsors = []) {
  const available = sponsors.filter((sponsor) => ['news_sidebar_top', 'news_sidebar_bottom', 'news_sidebar', 'all'].includes(sponsor.placement));
  const top = available.find((sponsor) => ['news_sidebar_top', 'news_sidebar', 'all'].includes(sponsor.placement));
  const bottom = available.find((sponsor) => ['news_sidebar_bottom', 'all'].includes(sponsor.placement) && String(sponsor.id) !== String(top?.id));
  return { top, bottom };
}

async function loadBanner() {
  const primary = $('#bannerNoticia');
  const secondary = $('#bannerNoticiaSecundario');
  try {
    const response = await fetch('/api/sponsors', { cache: 'no-store' });
    if (!response.ok) throw new Error('Anúncio indisponível.');
    const { sponsors = [] } = await response.json();
    const slots = newsSponsorSlots(sponsors);
    primary.innerHTML = sponsorMarkup(slots.top) || '<span>Espaço para anúncio</span>';
    const secondaryMarkup = sponsorMarkup(slots.bottom);
    if (secondaryMarkup) { secondary.innerHTML = secondaryMarkup; secondary.hidden = false; }
    else { secondary.hidden = true; secondary.innerHTML = ''; }
  } catch {
    primary.innerHTML = '<span>Espaço para anúncio</span>';
    secondary.hidden = true;
    secondary.innerHTML = '';
  }
}

async function loadArticleBanners() {
  const top = $('#bannerNoticiaTopo');
  const lateral = $('#bannerNoticiaLateral');
  const lateralSecondary = $('#bannerNoticiaLateralSecundario');
  try {
    const response = await fetch('/api/sponsors', { cache: 'no-store' });
    if (!response.ok) throw new Error('Anúncio indisponível.');
    const { sponsors = [] } = await response.json();
    const slots = newsSponsorSlots(sponsors);
    top.innerHTML = sponsorMarkup(slots.top) || '<span>Espaço para anúncio</span>';
    lateral.innerHTML = sponsorMarkup(slots.top) || '<span>Espaço para anúncio</span>';
    const secondaryMarkup = sponsorMarkup(slots.bottom);
    if (secondaryMarkup) { lateralSecondary.innerHTML = secondaryMarkup; lateralSecondary.hidden = false; }
    else { lateralSecondary.hidden = true; lateralSecondary.innerHTML = ''; }
  } catch {
    top.innerHTML = '<span>Espaço para anúncio</span>';
    lateral.innerHTML = '<span>Espaço para anúncio</span>';
    lateralSecondary.hidden = true;
    lateralSecondary.innerHTML = '';
  }
}

async function loadList() {
  try {
    const { news = [] } = await apiNews();
    allArticles = news;
    if (!allArticles.length) { $('#listaEstado').textContent = 'Nenhuma notícia publicada no momento.'; loadBanner(); return; }
    $('#listaEstado').remove();
    renderListPage();
    loadBanner();
  } catch (error) { $('#listaEstado').textContent = error.message; }
}

async function loadArticle(slug) {
  try {
    const { news = [] } = await apiNews(`?slug=${encodeURIComponent(slug)}`);
    const article = news[0];
    if (!article) throw new Error('Notícia não encontrada.');
    $('#listaNoticias').classList.add('hidden'); $('#noticiaEstado').classList.add('hidden'); $('#noticiaLeituraLayout').classList.remove('hidden');
    $('#noticiaCategoria').textContent = 'FEIRAS';
    $('#noticiaTitulo').textContent = article.title;
    const postedAt = formatDate(article.publishedAt || article.createdAt);
    const updatedAt = article.updatedAt && article.publishedAt && new Date(article.updatedAt).getTime() > new Date(article.publishedAt).getTime() + 1000 ? ` • Atualizado em ${formatDate(article.updatedAt)}` : '';
    $('#noticiaData').textContent = `Por ${article.author || 'Redação'} • ${postedAt}${updatedAt}`;
    $('#noticiaTexto').innerHTML = String(article.content || '').split(/\r?\n/).filter(Boolean).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
    loadArticleBanners();
    const image = $('#noticiaImagem'); image.src = article.imageUrl || fallbackImage; image.alt = article.title; image.onerror = () => { image.onerror = null; image.src = fallbackImage; }; document.title = `${article.title} | Portal das Feiras`;
  } catch (error) { $('#noticiaEstado').textContent = error.message; $('#noticiaEstado').classList.remove('hidden'); $('#listaNoticias').classList.add('hidden'); $('#noticiaLeituraLayout').classList.add('hidden'); }
}

document.addEventListener('DOMContentLoaded', () => { const slug = new URLSearchParams(location.search).get('slug'); if (slug) { $('#listaNoticias').classList.add('hidden'); loadArticle(slug); } else loadList(); });
