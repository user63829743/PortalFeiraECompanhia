(() => {
  const script = document.currentScript;
  const root = new URL('../', script?.src || `${window.location.origin}/shared/layout.js`).pathname;
  const link = (path) => `${root}${path}`;
  const current = window.location.pathname;

  const pageIs = (segment) => current.includes(`/${segment}/`);
  const active = (segment) => pageIs(segment) ? ' class="ativo"' : '';

  const header = `
    <header class="cabecalho-referencia">
      <div class="faixa-superior">
        <div class="faixa-superior-conteudo">
          <span data-current-datetime>Distrito Federal · Brasília · carregando data e hora...</span>
          <div class="indicadores-topo" aria-label="Informações do portal">
            <span aria-hidden="true">⌕</span>
            <span aria-hidden="true">◎</span>
            <strong data-current-weather>☁ Brasília · carregando clima...</strong>
          </div>
        </div>
      </div>
      <div class="container cabecalho-principal">
        <a href="${link('index.html#home')}" class="marca-portal" aria-label="Ir para a página inicial">
          <img src="${link('images/logo (2).png')}" alt="Logo Portal das Feiras">
        </a>
        <nav class="menu-principal" aria-label="Navegação principal">
          <ul>
            <li><a href="${link('feiras/index.html')}"${active('feiras')}>Feiras</a></li>
            <li><a href="${link('noticias/index.html')}"${active('noticias')}>Notícias</a></li>
            <li><a href="${link('feirantes/index.html')}"${active('feirantes')}>Feirantes</a></li>
            <li class="menu-solucoes">
              <a href="${link('index.html#solucoes-feira')}" aria-haspopup="true" aria-expanded="false">Soluções</a>
              <div class="menu-solucoes-dropdown" role="menu" aria-label="Soluções para sua feira">
                <h3 class="solucoes-menu-titulo">Soluções para sua feira</h3>
                <div class="solucao-menu-item" tabindex="0" role="menuitem">
                  <strong>🏗️ Estrutura</strong><span>Barracas, tendas, mesas, iluminação e geradores.</span>
                </div>
                <div class="solucao-menu-item" tabindex="0" role="menuitem">
                  <strong>🧹 Limpeza</strong><span>Coleta de lixo, banheiros químicos, dedetização e manutenção.</span>
                </div>
                <div class="solucao-menu-item" tabindex="0" role="menuitem">
                  <strong>🔒 Segurança</strong><span>Vigilância, câmeras, brigadistas e controle de acesso.</span>
                </div>
                <div class="solucao-menu-item" tabindex="0" role="menuitem">
                  <strong>🚚 Transporte</strong><span>Fretes, carretos, entregas e armazenamento.</span>
                </div>
                <div class="solucao-menu-item" tabindex="0" role="menuitem">
                  <strong>💳 Tecnologia</strong><span>Maquininhas, Pix, sistemas de vendas e internet.</span>
                </div>
                <div class="solucao-menu-item" tabindex="0" role="menuitem">
                  <strong>📢 Marketing</strong><span>Divulgação, redes sociais, fotos, vídeos e materiais gráficos.</span>
                </div>
                <div class="solucao-menu-item" tabindex="0" role="menuitem">
                  <strong>📦 Fornecedores</strong><span>Alimentos, embalagens, bebidas, gelo e produtos de limpeza.</span>
                </div>
                <div class="solucao-menu-item" tabindex="0" role="menuitem">
                  <strong>⚖️ Profissionais</strong><span>Contabilidade, documentação, licenças e consultorias.</span>
                </div>
                <p class="solucoes-menu-objetivo">Conectamos feirantes e organizadores a empresas que resolvem suas necessidades de forma rápida e prática.</p>
              </div>
            </li>
            <li><a href="/cadastro/">Anuncie</a></li>
            <li><a href="https://tvegnews-zccwximc.manus.space/" class="botao-tvegnews" target="_blank" rel="noopener"><span>▶</span> TVegNews</a></li>
          </ul>
        </nav>
      </div>
    </header>`;

  const footer = `
    <footer class="rodape">
      <div class="container footer-moderno">
        <p>© 2026 EG News · 04.058.259/0001-44 · Todos os direitos reservados.</p>
        <nav aria-label="Links legais">
          <a href="${link('index.html#privacidade')}">Privacidade</a>
          <span>·</span>
          <a href="${link('index.html#termos')}">Termos</a>
          <span>·</span>
          <a href="mailto:tvegnews@egnews.com.br">E-mail: tvegnews@egnews.com.br</a>
        </nav>
      </div>
    </footer>`;

  const headerSlot = document.querySelector('[data-site-header]');
  const footerSlot = document.querySelector('[data-site-footer]');
  if (headerSlot) headerSlot.outerHTML = header;
  if (footerSlot) footerSlot.outerHTML = footer;

  const dateTimeElement = document.querySelector('[data-current-datetime]');
  const weatherElement = document.querySelector('[data-current-weather]');
  const brasiliaTimeZone = 'America/Sao_Paulo';

  function updateDateTime() {
    if (!dateTimeElement) return;
    const formatted = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: brasiliaTimeZone
    }).format(new Date());
    dateTimeElement.textContent = `Distrito Federal · Brasília · ${formatted}`;
  }

  const weatherDescription = (code) => {
    const descriptions = {
      0: 'Céu limpo', 1: 'Poucas nuvens', 2: 'Parcialmente nublado', 3: 'Nublado',
      45: 'Neblina', 48: 'Neblina', 51: 'Garoa', 53: 'Garoa', 55: 'Garoa forte',
      61: 'Chuva fraca', 63: 'Chuva', 65: 'Chuva forte', 71: 'Neve', 73: 'Neve', 75: 'Neve forte',
      80: 'Pancadas de chuva', 81: 'Pancadas de chuva', 82: 'Pancadas fortes',
      95: 'Trovoadas', 96: 'Trovoadas', 99: 'Trovoadas fortes'
    };
    return descriptions[code] || 'Condição não informada';
  };

  function weatherIcon(code) {
    if ([0, 1].includes(code)) return '☀';
    if ([2, 3, 45, 48].includes(code)) return '☁';
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return '☂';
    if ([95, 96, 99].includes(code)) return '⚡';
    return '☁';
  }

  async function loadWeather() {
    if (!weatherElement) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const params = new URLSearchParams({ latitude: '-15.7939', longitude: '-47.8828', current: 'temperature_2m,weather_code', timezone: brasiliaTimeZone });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Clima indisponível');
      const data = await response.json();
      const temperature = Math.round(Number(data.current?.temperature_2m));
      const code = Number(data.current?.weather_code);
      if (!Number.isFinite(temperature)) throw new Error('Temperatura indisponível');
      weatherElement.textContent = `${weatherIcon(code)} Brasília ${temperature}°C · ${weatherDescription(code)}`;
      weatherElement.title = `Clima atual de Brasília: ${weatherDescription(code)}`;
    } catch {
      weatherElement.textContent = '☁ Brasília · clima indisponível';
      weatherElement.title = 'Não foi possível atualizar o clima agora';
    } finally {
      window.clearTimeout(timeout);
    }
  }

  updateDateTime();
  window.setInterval(updateDateTime, 1000);
  loadWeather();
})();


