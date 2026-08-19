const state = { feirantes: [], query: '', region: '' };
const $ = (selector) => document.querySelector(selector);
let inlineSponsors = [];
let inlineSponsorPool = [];
let inlineSponsorRotationTimer = null;
let inlineSponsorRotationIndex = 0;

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function formatScheduleTime(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return text;
  const hour = Number(match[1]);
  return match[2] === '00' ? `${hour}h` : `${hour}h${match[2]}`;
}

function parseSchedule(value = '') {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    const labels = { segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado', domingo: 'Domingo' };
    return Object.entries(parsed).map(([day, item]) => {
      const closed = item?.status === 'closed' || item?.closed === true || item?.fechado === true;
      const open = item?.open || item?.abertura || '';
      const close = item?.close || item?.fechamento || '';
      const formattedOpen = formatScheduleTime(open);
      const formattedClose = formatScheduleTime(close);
      return `${labels[day] || day}: ${closed ? 'Fechado' : `${formattedOpen}${formattedOpen && formattedClose ? ' às ' : ''}${formattedClose}`.trim()}`;
    }).filter(Boolean);
  } catch {
    const labels = { segunda: 'Segunda', terca: 'Terça', terça: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado', sábado: 'Sábado', domingo: 'Domingo' };
    return String(value).split(/\n|;/).map((item) => item.trim()).filter(Boolean).map((item) => {
      const match = item.match(/^([^:]+):\s*(.+)$/);
      if (!match) return item;
      const key = match[1].trim().toLocaleLowerCase('pt-BR');
      return `${labels[key] || match[1].trim()}: ${match[2].trim()}`;
    });
  }
}

function scheduleHtml(value) {
  const rows = parseSchedule(value);
  if (!rows.length) return '<span class="feirante-sem-dado">Horário não informado</span>';
  return `<div class="feirante-horarios-list">${rows.map((row) => {
    const separator = row.indexOf(':');
    const day = separator >= 0 ? row.slice(0, separator).trim() : row;
    const detail = separator >= 0 ? row.slice(separator + 1).trim() : '';
    const closed = /fechado/i.test(detail);
    return `<div class="feirante-horario-item${closed ? ' is-closed' : ''}"><span class="feirante-horario-dia">${escapeHtml(day)}</span><strong class="feirante-horario-periodo">${escapeHtml(detail || 'Horário não informado')}</strong></div>`;
  }).join('')}</div>`;
}

function photoHtml(feirante, title) {
  return feirante.photoUrl
    ? `<img class="feirante-publico-foto" src="${escapeHtml(feirante.photoUrl)}" alt="Foto de ${escapeHtml(title)}" loading="lazy">`
    : '<div class="feirante-publico-foto-placeholder" aria-hidden="true"></div>';
}

function logoHtml(feirante, title) {
  return feirante.logoUrl ? `<img class="feirante-publico-logo" src="${escapeHtml(feirante.logoUrl)}" alt="Logo de ${escapeHtml(title)}" loading="lazy">` : '';
}

function cardHtml(feirante) {
  const title = feirante.businessName || 'Feirante';
  const description = feirante.description || 'Descrição pública não informada.';
  const href = `feirante.html?id=${encodeURIComponent(feirante.id)}`;
  return `<article class="feirante-publico-card">
    <a class="feirante-publico-link" href="${href}" aria-label="Ver perfil de ${escapeHtml(title)}">
      <div class="feirante-publico-visual">${photoHtml(feirante, title)}${logoHtml(feirante, title)}</div>
      <div class="feirante-publico-cabecalho"><div><h3>${escapeHtml(title)}</h3></div></div>
      <div class="feirante-publico-conteudo">
        <div class="feirante-tags"><span>${escapeHtml(feirante.category || 'Categoria não informada')}</span>${feirante.region ? `<span>${escapeHtml(feirante.region)}</span>` : ''}</div>
        <p class="feirante-publico-descricao">${escapeHtml(description)}</p>
        <div class="feirante-horarios-link"><span aria-hidden="true">▸</span> Ver horários</div>
      </div>
    </a>
  </article>`;
}

function inlineSponsorHtml(sponsors) {
  const visibleSponsors = Array.isArray(sponsors) ? sponsors.slice(0, 2).filter((sponsor) => sponsor?.imageUrl) : [];
  if (!visibleSponsors.length) return '';
  const count = visibleSponsors.length;
  const banners = visibleSponsors.map((sponsor) => {
    const image = `<img src="${escapeHtml(sponsor.imageUrl)}" alt="Publicidade: ${escapeHtml(sponsor.name || 'Anúncio')}" loading="lazy">`;
    return sponsor.targetUrl
      ? `<a class="feirantes-inline-banner" href="${escapeHtml(sponsor.targetUrl)}" target="_blank" rel="noopener sponsored">${image}</a>`
      : `<div class="feirantes-inline-banner">${image}</div>`;
  }).join('');
  return `<div class="feirantes-inline-publicidade" style="--inline-sponsor-count:${count}" aria-label="Publicidade">${banners}</div>`;
}

function recentPostsHtml(posts) {
  if (!posts.length) return '<p class="feirante-posts-vazio">Nenhum post recente.</p>';
  return posts.slice(0, 5).map((post) => `<a class="feirante-post-recente" href="../noticias/index.html?slug=${encodeURIComponent(post.slug || '')}">${escapeHtml(post.title || 'Notícia')}</a>`).join('');
}

async function loadRecentPosts() {
  const postsBox = $('#feirantePostsRecentes');
  const banner = $('#feiranteBannerPublicidade');
  try {
    const [newsResponse, sponsorsResponse] = await Promise.all([fetch('/api/news', { cache: 'no-store' }), fetch('/api/sponsors', { cache: 'no-store' })]);
    const newsData = newsResponse.ok ? await newsResponse.json() : { news: [] };
    postsBox.innerHTML = recentPostsHtml(Array.isArray(newsData.news) ? newsData.news : []);
    if (sponsorsResponse.ok) {
      const sponsorsData = await sponsorsResponse.json();
      const sponsor = sponsorsData.sponsors?.[0];
      if (sponsor?.imageUrl) {
        const image = `<img src="${escapeHtml(sponsor.imageUrl)}" alt="${escapeHtml(sponsor.name || 'Publicidade')}" onerror="this.parentElement.innerHTML='<span>Publicidade</span>'>`;
        banner.innerHTML = sponsor.targetUrl ? `<a href="${escapeHtml(sponsor.targetUrl)}" target="_blank" rel="noopener sponsored">${image}</a>` : image;
      }
    }
  } catch {
    postsBox.innerHTML = '<p class="feirante-posts-vazio">Posts recentes indisponíveis.</p>';
  }
}

async function renderDetail(feirante) {
  const title = feirante.businessName || 'Feirante';
  document.title = `${title} | Portal das Feiras`;
  $('#feirantesListaView')?.classList.add('hidden');
  $('#feiranteDetalheView')?.classList.remove('hidden');
  $('#feiranteDetalheLocal').textContent = feirante.region || 'Local não informado';
  $('#feiranteDetalheCategoria').textContent = feirante.category || 'Categoria não informada';
  $('#feiranteDetalheTitulo').textContent = title;
  $('#feiranteDetalheDescricao').textContent = feirante.description || 'Descrição pública não informada.';
  $('#feiranteDetalheImagem').src = feirante.photoUrl || '../images/foto.avif';
  $('#feiranteDetalheImagem').alt = `Foto de ${title}`;
  $('#feiranteDetalheImagem').onerror = () => { $('#feiranteDetalheImagem').src = '../images/foto.avif'; };
  $('#feiranteDetalheHorarios').innerHTML = scheduleHtml(feirante.daysHours);
  $('#feiranteDetalheLocalTexto').textContent = feirante.boothLocation || 'Localização não informada';
  $('#feiranteDetalheCep').textContent = feirante.cep ? `CEP: ${feirante.cep}` : 'CEP não informado';
  await loadRecentPosts();
}

function populateRegions() {
  const regions = [...new Set(state.feirantes.map((item) => item.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  $('#feirantesRegiao').innerHTML = '<option value="">Todas as regiões</option>' + regions.map((region) => `<option value="${escapeHtml(region)}">${escapeHtml(region)}</option>`).join('');
}

function render() {
  const query = state.query.toLocaleLowerCase('pt-BR');
  const visible = state.feirantes.filter((item) => {
    const searchable = [item.businessName, item.category, item.region, item.description, item.boothLocation].join(' ').toLocaleLowerCase('pt-BR');
    return (!query || searchable.includes(query)) && (!state.region || item.region === state.region);
  });
  $('#feirantesResumo').textContent = `${visible.length} feirante${visible.length === 1 ? '' : 's'} encontrado${visible.length === 1 ? '' : 's'}`;
  const parts = [];
  visible.forEach((item, index) => {
    parts.push(cardHtml(item));
    if ((index + 1) % 6 === 0 && index < visible.length - 1) parts.push(inlineSponsorHtml(inlineSponsors));
  });
  $('#feirantesGrid').innerHTML = parts.join('');
  $('#feirantesVazio').classList.toggle('hidden', visible.length > 0);
}

async function loadFeirantes() {
  try {
    const response = await fetch('/api/feirantes', { cache: 'no-store' });
    if (!response.ok) throw new Error('Feirantes indisponíveis');
    const data = await response.json();
    state.feirantes = Array.isArray(data.feirantes) ? data.feirantes : [];
    const id = new URLSearchParams(location.search).get('id');
    if (id) {
      const feirante = state.feirantes.find((item) => String(item.id) === String(id));
      if (!feirante) throw new Error('Feirante não encontrado.');
      await renderDetail(feirante);
      return;
    }
    try {
      const sponsorsResponse = await fetch('/api/sponsors', { cache: 'no-store' });
      const sponsorsData = sponsorsResponse.ok ? await sponsorsResponse.json() : { sponsors: [] };
      const candidates = Array.isArray(sponsorsData.sponsors) ? sponsorsData.sponsors.filter((sponsor) => sponsor.placement === 'feirantes_inline' || sponsor.placement === 'all') : [];
      const groups = new Map();
      candidates.forEach((sponsor) => { const key = sponsor.campaignGroup || 'default'; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(sponsor); });
      inlineSponsorPool = groups.values().next().value || [];
      inlineSponsors = inlineSponsorPool.slice(0, 2);
      window.clearInterval(inlineSponsorRotationTimer);
      inlineSponsorRotationTimer = null;
      inlineSponsorRotationIndex = 0;
      if (inlineSponsorPool[0]?.displayMode === 'rotate' && inlineSponsorPool.length > 1) {
        inlineSponsorRotationTimer = window.setInterval(() => {
          inlineSponsorRotationIndex = (inlineSponsorRotationIndex + 1) % inlineSponsorPool.length;
          inlineSponsors = [inlineSponsorPool[inlineSponsorRotationIndex]];
          render();
        }, (inlineSponsorPool[0].rotationSeconds || 8) * 1000);
      }
    } catch {
      inlineSponsors = [];
      inlineSponsorPool = [];
    }
    populateRegions();
    render();
  } catch (error) {
    console.warn('Feirantes públicos:', error);
    const detail = new URLSearchParams(location.search).has('id');
    if (detail) { $('#feirantesListaView')?.classList.add('hidden'); $('#feirantesErroDetalhe')?.classList.remove('hidden'); }
    else { $('#feirantesResumo').textContent = 'Não foi possível atualizar agora'; $('#feirantesErro').classList.remove('hidden'); }
  }
}

$('#feirantesBusca')?.addEventListener('input', (event) => { state.query = event.target.value; render(); });
$('#feirantesRegiao')?.addEventListener('change', (event) => { state.region = event.target.value; render(); });
loadFeirantes();
