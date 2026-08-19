document.addEventListener('DOMContentLoaded', () => {
  const grid = document.querySelector('#tvegnews .grid-videos');
  const principal = grid?.querySelector('.card-video.principal');
  const secundarios = grid ? [...grid.querySelectorAll('.card-video.secundario')].slice(0, 2) : [];

  if (!grid || !principal || secundarios.length < 2) return;

  const lerVideoInicial = (card) => ({
    url: card.querySelector('a.link-video')?.getAttribute('href') || '#',
    thumbnail: card.querySelector('img')?.getAttribute('src') || '',
    title: card.querySelector('h3, h4')?.textContent?.trim() || 'Vídeo TVegNews',
    description: card.querySelector('.descricao-video, .descricao-pequena')?.textContent?.trim() || '',
    publishedAt: new Date().toISOString(),
  });

  let videos = [lerVideoInicial(principal), ...secundarios.map(lerVideoInicial)].slice(0, 3);
  let inicio = 0;
  let emTransicao = false;
  let ciclo = null;

  const formatarDataHora = (publishedAt) => {
    const data = new Date(publishedAt);
    if (Number.isNaN(data.getTime())) return '📅 Data não informada';
    return `📅 ${new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo',
    }).format(data)}`;
  };

  const definirLink = (elemento, video) => {
    if (!elemento) return;
    elemento.href = video.url;
    elemento.target = '_blank';
    elemento.rel = 'noopener noreferrer';
  };

  const preencherPrincipal = (video) => {
    definirLink(principal.querySelector('a.link-video'), video);
    definirLink(principal.querySelector('.btn'), video);

    const imagem = principal.querySelector('img');
    if (imagem) {
      imagem.src = video.thumbnail;
      imagem.alt = video.title;
    }
    principal.querySelector('h3').textContent = video.title;
    principal.querySelector('.descricao-video').textContent = video.description;
    principal.querySelector('.duracao').textContent = formatarDataHora(video.publishedAt);
  };

  const preencherSecundario = (card, video) => {
    definirLink(card.querySelector('a.link-video'), video);

    const imagem = card.querySelector('img');
    if (imagem) {
      imagem.src = video.thumbnail;
      imagem.alt = video.title;
    }
    card.querySelector('h4').textContent = video.title;
    card.querySelector('.descricao-pequena').textContent = video.description;
    card.querySelector('.duracao').textContent = formatarDataHora(video.publishedAt);
  };

  const mostrarGrupo = () => {
    preencherPrincipal(videos[inicio]);
    preencherSecundario(secundarios[0], videos[(inicio + 1) % 3]);
    preencherSecundario(secundarios[1], videos[(inicio + 2) % 3]);
  };

  const trocarVideos = () => {
    if (emTransicao || videos.length !== 3) return;
    emTransicao = true;
    grid.classList.add('tveg-sair-esquerda');

    window.setTimeout(() => {
      inicio = (inicio + 1) % 3;
      mostrarGrupo();
      grid.classList.remove('tveg-sair-esquerda');
      void grid.offsetWidth;
      grid.classList.add('tveg-entrar-direita');

      window.setTimeout(() => {
        grid.classList.remove('tveg-entrar-direita');
        emTransicao = false;
      }, 500);
    }, 320);
  };

  const iniciarCiclo = () => {
    window.clearInterval(ciclo);
    ciclo = window.setInterval(trocarVideos, 8000);
  };

  const atualizarFeed = async () => {
    try {
      const response = await fetch('/api/tvegnews', { cache: 'no-store' });
      if (!response.ok) throw new Error('Feed indisponível.');

      const dados = await response.json();
      if (!Array.isArray(dados.videos) || dados.videos.length < 3) throw new Error('Menos de três vídeos recebidos.');

      videos = dados.videos.slice(0, 3);
      inicio = 0;
      mostrarGrupo();
      iniciarCiclo();
    } catch (error) {
      console.warn('TVegNews: usando os três vídeos atuais até a próxima atualização.', error);
      mostrarGrupo();
      iniciarCiclo();
    }
  };

  atualizarFeed();
  window.setInterval(atualizarFeed, 5 * 60 * 1000);
});

function formatarCepHome(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function renderFeirasDestaque(fairs) {
  const grid = document.querySelector('#feirasDestaqueGrid');
  if (!grid) return;
  if (!Array.isArray(fairs) || !fairs.length) {
    grid.innerHTML = '<p class="feiras-destaque-estado">Nenhuma feira em destaque no momento.</p>';
    return;
  }
  grid.innerHTML = fairs.slice(0, 3).map((fair) => {
    const image = escapeHtml(fair.photoUrl || 'images/foto.avif');
    const name = escapeHtml(fair.name || 'Feira em destaque');
    const description = escapeHtml(fair.description || 'Confira informações, localização e horários desta feira.');
    const place = [fair.region, fair.cep ? `CEP ${formatarCepHome(fair.cep)}` : ''].filter(Boolean).join(' · ');
    const target = `feiras/index.html#feira-${encodeURIComponent(fair.id)}`;
    return `<a class="card-destaque card-clicavel" href="${target}" aria-label="Ver detalhes de ${name}"><div class="img-destaque"><img src="${image}" alt="${name}" loading="lazy"><span class="selo-feira">FEIRA EM DESTAQUE</span></div><div class="conteudo-destaque"><h3>${name}</h3><p class="descricao-feira">${description}</p><p class="localizacao-feira">⌖ ${escapeHtml(place || 'Distrito Federal')}</p></div></a>`;
  }).join('');
}

async function atualizarFeirasDestaque() {
  const grid = document.querySelector('#feirasDestaqueGrid');
  if (!grid) return;
  try {
    const response = await fetch('/api/feiras-destaque', { cache: 'no-store' });
    if (!response.ok) throw new Error('Feiras em destaque indisponíveis.');
    const { fairs = [] } = await response.json();
    renderFeirasDestaque(fairs);
  } catch (error) {
    console.warn('Feiras em destaque: não foi possível carregar os dados.', error);
    renderFeirasDestaque([]);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  atualizarFeirasDestaque();
  const grupos = [
    { seletor: '#feiraDestaque .card-destaque', prefixo: 'feira' },
    { seletor: '#noticias .card-noticia', prefixo: 'noticia' },
  ];

  grupos.forEach(({ seletor, prefixo }) => {
    document.querySelectorAll(seletor).forEach((card, indice) => {
      const destinoPadrao = `#${prefixo}-${indice + 1}`;
      const destino = card.dataset.url && card.dataset.url !== '#' ? card.dataset.url : destinoPadrao;
      card.dataset.url = destino;
      card.classList.add('card-clicavel');
      card.setAttribute('role', 'link');
      card.tabIndex = 0;

      const linkInterno = card.querySelector('.link-noticia');
      if (linkInterno && (!linkInterno.getAttribute('href') || linkInterno.getAttribute('href') === '#')) {
        linkInterno.setAttribute('href', destino);
      }

      const redirecionar = () => { window.location.href = card.dataset.url; };
      card.addEventListener('pointerenter', () => card.classList.add('card-elevado'));
      card.addEventListener('pointerleave', () => card.classList.remove('card-elevado'));
      card.addEventListener('focus', () => card.classList.add('card-elevado'));
      card.addEventListener('blur', () => card.classList.remove('card-elevado'));
      card.addEventListener('click', (evento) => {
        if (!evento.target.closest('a')) redirecionar();
      });
      card.addEventListener('keydown', (evento) => {
        if (evento.key === 'Enter' || evento.key === ' ') {
          evento.preventDefault();
          redirecionar();
        }
      });
    });
  });
});


function aplicarNoticiaCldf(card, noticia) {
  if (!card || !noticia) return;
  card.dataset.url = noticia.url;
  const titulo = card.querySelector('h3');
  const descricao = card.querySelector('.noticia-conteudo p');
  const imagem = card.querySelector('.noticia-imagem img');
  const link = card.querySelector('.link-noticia');
  const selo = card.querySelector('.selo-feira');
  if (titulo) titulo.textContent = noticia.title;
  if (descricao) descricao.textContent = noticia.description || 'Leia a notícia completa no portal da CLDF.';
  if (imagem) {
    const imagemPadrao = 'images/foto.avif';
    imagem.onerror = () => { if (!imagem.src.endsWith(imagemPadrao)) imagem.src = imagemPadrao; };
    imagem.src = noticia.imageUrl || imagemPadrao;
    imagem.alt = noticia.title;
  }
  if (selo) selo.textContent = 'CLDF · FEIRAS';
  if (link) { link.href = noticia.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Leia na CLDF →'; }
}

async function atualizarNoticiasCldf() {
  const cards = [...document.querySelectorAll('#noticias .card-noticia')].slice(0, 3);
  if (!cards.length) return;
  try {
    const response = await fetch('/api/cldf-news', { cache: 'no-store' });
    if (!response.ok) throw new Error('Notícias da CLDF indisponíveis.');
    const { news = [] } = await response.json();
    news.slice(0, cards.length).forEach((noticia, index) => aplicarNoticiaCldf(cards[index], noticia));
  } catch (error) { console.warn('CLDF: mantendo as notícias atuais.', error); }
}

document.addEventListener('DOMContentLoaded', () => {
  atualizarNoticiasCldf();
  window.setInterval(atualizarNoticiasCldf, 15 * 60 * 1000);
});

const sponsorTimers = {};

function sponsorsForPlacement(sponsors, placement, fallbackPlacement = '') {
  const eligible = sponsors.filter((sponsor) => sponsor.placement === placement || sponsor.placement === 'all' || (fallbackPlacement && sponsor.placement === fallbackPlacement));
  const groups = new Map();
  eligible.forEach((sponsor) => {
    const key = sponsor.campaignGroup || 'default';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(sponsor);
  });
  return groups.values().next().value || [];
}

function renderSponsorItems(items, grid, section, limit = 4) {
  section.classList.remove('sponsors-home--single', 'sem-patrocinadores');
  const visible = items.slice(0, limit);
  if (!visible.length) { section.classList.add('sem-patrocinadores'); grid.innerHTML = ''; return; }
  grid.style.setProperty('--sponsor-count', String(visible.length));
  if (visible.length === 1) section.classList.add('sponsors-home--single');
  grid.innerHTML = visible.map((sponsor) => {
    const image = `<img src="${escapeHtml(sponsor.imageUrl)}" alt="Patrocinador: ${escapeHtml(sponsor.name)}" loading="lazy">`;
    return sponsor.targetUrl ? `<a class="sponsor-banner" href="${escapeHtml(sponsor.targetUrl)}" target="_blank" rel="noopener sponsored">${image}</a>` : `<div class="sponsor-banner">${image}</div>`;
  }).join('');
}

function renderSponsors(sponsors, grid, section) {
  const splitGroup = sponsorsForPlacement(sponsors, 'home_split');
  const group = splitGroup.length ? splitGroup : sponsorsForPlacement(sponsors, 'home_bottom');
  const mode = group[0]?.displayMode || 'fixed';
  window.clearInterval(sponsorTimers.homeBottom);
  if (mode === 'divided') return renderSponsorItems(group, grid, section, 4);
  if (mode !== 'rotate' || group.length < 2) return renderSponsorItems(group.slice(0, 1), grid, section, 1);
  let index = 0;
  const paint = () => renderSponsorItems([group[index % group.length]], grid, section, 1);
  paint();
  sponsorTimers.homeBottom = window.setInterval(() => { index += 1; paint(); }, (group[0].rotationSeconds || 8) * 1000);
}

if (typeof window !== 'undefined') window.renderSponsors = renderSponsors;

function renderTopHomeBanner(sponsors) {
  const section = document.querySelector('#bannerTopoHome');
  const container = document.querySelector('#bannerTopoHomeConteudo');
  if (!section || !container) return;
  const group = sponsorsForPlacement(sponsors, 'home_top', 'home_bottom');
  window.clearInterval(sponsorTimers.homeTop);
  const paint = (sponsor) => {
    section.classList.remove('sem-banner-topo');
    if (!sponsor?.imageUrl) { container.innerHTML = '<span>Espaço para anúncio</span>'; return; }
    const image = `<img src="${escapeHtml(sponsor.imageUrl)}" alt="Publicidade: ${escapeHtml(sponsor.name || 'Anúncio')}" loading="lazy">`;
    container.innerHTML = sponsor.targetUrl ? `<a href="${escapeHtml(sponsor.targetUrl)}" target="_blank" rel="noopener sponsored">${image}</a>` : image;
  };
  if (group[0]?.displayMode !== 'rotate' || group.length < 2) return paint(group[0]);
  let index = 0;
  paint(group[0]);
  sponsorTimers.homeTop = window.setInterval(() => { index += 1; paint(group[index % group.length]); }, (group[0].rotationSeconds || 8) * 1000);
}

document.addEventListener('DOMContentLoaded', () => {
  const section = document.querySelector('#patrocinadores');
  const grid = document.querySelector('#sponsorsHomeGrid');
  fetch('/api/sponsors', { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : Promise.reject(new Error('Patrocinadores indisponíveis.')))
    .then(({ sponsors = [] }) => {
      if (section && grid) renderSponsors(sponsors, grid, section);
      renderTopHomeBanner(sponsors);
    })
    .catch(() => {
      if (section) section.classList.add('sem-patrocinadores');
      renderTopHomeBanner([]);
    });
});

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
