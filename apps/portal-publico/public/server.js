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

document.addEventListener('DOMContentLoaded', () => {
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


function aplicarNoticiaPublicada(card, noticia) {
  if (!card || !noticia) return;
  card.dataset.url = noticia.slug ? `noticias/index.html?slug=${encodeURIComponent(noticia.slug)}` : noticia.url;
  const titulo = card.querySelector('h3');
  const descricao = card.querySelector('.noticia-conteudo p');
  const imagem = card.querySelector('.noticia-imagem img');
  const link = card.querySelector('.link-noticia');
  const selo = card.querySelector('.selo-feira');
  if (titulo) titulo.textContent = noticia.title;
  if (descricao) {
    const textoCompleto = String(noticia.content || noticia.description || '').replace(/\s+/g, ' ').trim();
    descricao.textContent = textoCompleto.length > 180 ? `${textoCompleto.slice(0, 177).trim()}...` : (textoCompleto || 'Leia a notícia completa no portal da CLDF.');
  }
  if (imagem) {
    const imagemPadrao = 'images/foto.avif';
    imagem.onerror = () => {
      if (!imagem.src.endsWith(imagemPadrao)) imagem.src = imagemPadrao;
    };
    imagem.src = noticia.imageUrl || imagemPadrao;
    imagem.alt = noticia.title;
  }
  if (selo) selo.textContent = noticia.category || 'PORTAL DAS FEIRAS';
  if (link) {
    link.href = noticia.slug ? `noticias/index.html?slug=${encodeURIComponent(noticia.slug)}` : noticia.url;
    link.target = noticia.slug ? '_self' : '_blank';
    link.rel = noticia.slug ? '' : 'noopener noreferrer';
    link.textContent = noticia.slug ? 'Leia a notícia →' : 'Leia na CLDF →';
  }
}

async function atualizarNoticiasPublicadas() {
  const cards = [...document.querySelectorAll('#noticias .card-noticia')].slice(0, 3);
  if (!cards.length) return;
  try {
    const response = await fetch('/api/news', { cache: 'no-store' });
    if (!response.ok) throw new Error('Notícias publicadas indisponíveis.');
    const { news = [] } = await response.json();
    if (news.length) news.slice(0, cards.length).forEach((noticia, index) => aplicarNoticiaPublicada(cards[index], noticia));
    else {
      const fallback = await fetch('/api/cldf-news', { cache: 'no-store' });
      if (fallback.ok) { const data = await fallback.json(); data.news.slice(0, cards.length).forEach((noticia, index) => aplicarNoticiaPublicada(cards[index], noticia)); }
    }
  } catch (error) { console.warn('Notícias: mantendo os cards atuais.', error); }
}

document.addEventListener('DOMContentLoaded', () => {
  atualizarNoticiasPublicadas();
  window.setInterval(atualizarNoticiasPublicadas, 15 * 60 * 1000);
});

function renderSponsors(sponsors, grid, section) {
  section.classList.remove('sponsors-home--single');
  if (!sponsors.length) { section.classList.add('sem-patrocinadores'); return; }
  const count = Math.min(sponsors.length, 4);
  grid.style.setProperty('--sponsor-count', String(count));
  if (count === 1) section.classList.add('sponsors-home--single');
  grid.innerHTML = sponsors.map((sponsor) => {
    const image = `<img src="${escapeHtml(sponsor.imageUrl)}" alt="Patrocinador: ${escapeHtml(sponsor.name)}" loading="lazy">`;
    return sponsor.targetUrl ? `<a class="sponsor-banner" href="${escapeHtml(sponsor.targetUrl)}" target="_blank" rel="noopener sponsored">${image}</a>` : `<div class="sponsor-banner">${image}</div>`;
  }).join('');
}

if (typeof window !== 'undefined') window.renderSponsors = renderSponsors;

document.addEventListener('DOMContentLoaded', () => {
  const section = document.querySelector('#patrocinadores');
  const grid = document.querySelector('#sponsorsHomeGrid');
  if (!section || !grid) return;
  fetch('/api/sponsors', { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : Promise.reject(new Error('Patrocinadores indisponíveis.')))
    .then(({ sponsors = [] }) => renderSponsors(sponsors, grid, section))
    .catch(() => section.classList.add('sem-patrocinadores'));
});

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
