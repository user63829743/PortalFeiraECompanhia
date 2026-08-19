const state = { fairs: [], query: '', region: '' };
const $ = (selector) => document.querySelector(selector);

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function formatCep(value = '') {
  const digits = String(value).replace(/\D/g, '').slice(0, 8);
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : value || '';
}

function parseSchedule(value = '') {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    const labels = { segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado', domingo: 'Domingo' };
    return Object.entries(parsed).map(([day, item]) => {
      const closed = item?.closed === true || item?.fechado === true;
      const open = item?.open || item?.abertura || '';
      const close = item?.close || item?.fechamento || '';
      return `${labels[day] || day}: ${closed ? 'Fechado' : `${open}${open && close ? ' às ' : ''}${close}`.trim()}`;
    });
  } catch {
    return String(value).split(/\n|;/).map((item) => item.trim()).filter(Boolean);
  }
}

function scheduleHtml(daysHours) {
  const rows = parseSchedule(daysHours);
  if (!rows.length) return '<span class="feira-sem-dado">Horário não informado</span>';
  return rows.map((row) => `<li>${escapeHtml(row)}</li>`).join('');
}

function cardHtml(fair) {
  const image = fair.photoUrl || '../images/foto.avif';
  const location = [fair.address, fair.region].filter(Boolean).join(' · ');
  const rawDescription = String(fair.description || 'Conheça esta feira e programe sua visita.').replace(/\s+/g, ' ').trim();
  const hasMore = rawDescription.length > 125;
  const shortDescription = hasMore ? `${rawDescription.slice(0, 122).trimEnd()}…` : rawDescription;
  const fullDescriptionHtml = hasMore ? `<p class="feira-publica-descricao feira-descricao-completa hidden">${escapeHtml(rawDescription)}</p><button type="button" class="feira-ler-mais" aria-expanded="false">Ler mais</button>` : '';
  return `<article class="feira-publica-card">
    <div class="feira-publica-imagem">
      <img src="${escapeHtml(image)}" alt="${escapeHtml(fair.name)}" loading="lazy" onerror="this.onerror=null;this.src='../images/foto.avif';">
      <span class="selo-feira">FEIRA ATIVA</span>
    </div>
    <div class="feira-publica-conteudo">
      <h3>${escapeHtml(fair.name)}</h3>
      <p class="feira-publica-descricao feira-descricao-resumo">${escapeHtml(shortDescription)}</p>
      ${fullDescriptionHtml}
      <dl class="feira-publica-dados">
        ${location ? `<div><dt>Local</dt><dd>⌖ ${escapeHtml(location)}</dd></div>` : ''}
        ${fair.cep ? `<div><dt>CEP</dt><dd>${escapeHtml(formatCep(fair.cep))}</dd></div>` : ''}
      </dl>
      <details class="feira-publica-horarios">
        <summary>Ver horários</summary>
        <ul>${scheduleHtml(fair.daysHours)}</ul>
      </details>
    </div>
  </article>`;
}

function populateRegions() {
  const select = $('#feirasRegiao');
  const regions = [...new Set(state.fairs.map((fair) => fair.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  select.innerHTML = '<option value="">Todas as regiões</option>' + regions.map((region) => `<option value="${escapeHtml(region)}">${escapeHtml(region)}</option>`).join('');
}

function render() {
  const normalizedQuery = state.query.toLocaleLowerCase('pt-BR');
  const visible = state.fairs.filter((fair) => {
    const haystack = [fair.name, fair.description, fair.region, fair.address, fair.cep].join(' ').toLocaleLowerCase('pt-BR');
    return (!normalizedQuery || haystack.includes(normalizedQuery)) && (!state.region || fair.region === state.region);
  });
  $('#feirasResumo').textContent = `${visible.length} feira${visible.length === 1 ? '' : 's'} encontrada${visible.length === 1 ? '' : 's'}`;
  $('#feirasGrid').innerHTML = visible.map(cardHtml).join('');
  $('#feirasGrid').querySelectorAll('.feira-ler-mais').forEach((button) => {
    button.addEventListener('click', () => {
      const currentCard = button.closest('.feira-publica-card');
      const isOpening = !currentCard.classList.contains('is-description-open');
      $('#feirasGrid').querySelectorAll('.feira-publica-card.is-description-open').forEach((card) => {
        card.classList.remove('is-description-open');
        const otherButton = card.querySelector('.feira-ler-mais');
        if (otherButton) {
          otherButton.textContent = 'Ler mais';
          otherButton.setAttribute('aria-expanded', 'false');
        }
      });
      if (isOpening) {
        currentCard.classList.add('is-description-open');
        button.textContent = 'Ler menos';
        button.setAttribute('aria-expanded', 'true');
      }
    });
  });
  $('#feirasVazio').classList.toggle('hidden', visible.length > 0);
}

async function loadFairs() {
  try {
    const response = await fetch('/api/feiras', { cache: 'no-store' });
    if (!response.ok) throw new Error('Feiras indisponíveis');
    const data = await response.json();
    state.fairs = Array.isArray(data.fairs) ? data.fairs : [];
    populateRegions();
    render();
  } catch (error) {
    console.warn('Feiras públicas:', error);
    $('#feirasResumo').textContent = 'Não foi possível atualizar agora';
    $('#feirasErro').classList.remove('hidden');
  }
}

$('#feirasBusca').addEventListener('input', (event) => { state.query = event.target.value; render(); });
$('#feirasRegiao').addEventListener('change', (event) => { state.region = event.target.value; render(); });
loadFairs();
