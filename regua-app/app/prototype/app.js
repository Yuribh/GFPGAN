// UI for the prototype. Data and formatting come from the tested src/ files (inlined by build.mjs).
const params = new URLSearchParams(location.search);
const repo = createFakeRepository({
  latencyMs: Number(params.get('latency') || 0),
  failWith: params.get('fail') ? new Error('Sem conexão') : undefined,
});
const TYPE_LABEL = { cars: 'Carros', motorcycles: 'Motos', trucks: 'Caminhões' };

const ICON = {
  cars: '<path d="M5 16l1.5-5.5A2 2 0 0 1 8.4 9h7.2a2 2 0 0 1 1.9 1.5L19 16M4 16h16v3h-2v-1.5H6V19H4z"/><circle cx="8" cy="13.5" r=".6"/><circle cx="16" cy="13.5" r=".6"/>',
  motorcycles: '<circle cx="6" cy="16" r="3"/><circle cx="18" cy="16" r="3"/><path d="M6 16l4-6h5l3 6M10 10L9 7H7"/>',
  trucks: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.2-4.2"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.600-7 10-7 10z"/>',
  clock: '<path d="M4 12a8 8 0 1 0 2.5-5.800M4 5v4h4M12 8v4l3 2"/>',
  home: '<path d="M4 11l8-7 8 7M6 10v9h12v-9"/>',
  info: '<circle cx="12" cy="12" r="8"/><path d="M12 11v5M12 8h.01"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  share: '<path d="M12 15V4M8 8l4-4 4 4M5 12v7h14v-7"/>',
  compare: '<path d="M4 18V6M4 18h16M7 14l4-4 3 3 5-6"/>',
};
const icon = (n, s = 28) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
const fold = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- tiny persistence with in-memory fallback (storage can be blocked) ----
const mem = {};
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : (mem[k] ?? d); } catch { return mem[k] ?? d; } },
  set(k, v) { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

// ---- state ----
const S = { tab: 'home', view: 'home', pick: null, query: '', chartMonths: 12, toast: '' };
const $app = document.getElementById('app');
let toastTimer;

function toast(msg) { S.toast = msg; render(); clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = ''; render(); }, 3500); }
function go(patch) { Object.assign(S, patch); render(); window.scrollTo(0, 0); }

// ---- views ----
function tabs() {
  const t = [['home', 'home', 'Home'], ['favorites', 'heart', 'Favoritos'], ['about', 'info', 'Sobre']];
  return `<nav class="tabs" role="tablist" aria-label="Navegação principal">${t.map(([id, ic, label]) =>
    `<button role="tab" data-tab="${id}" aria-selected="${S.tab === id}">${icon(ic, 24)}<span>${label}</span></button>`).join('')}</nav>`;
}
function header(title, back) {
  return `<header class="bar">${back ? `<button class="back" data-back aria-label="Voltar">${icon('back', 24)}Voltar</button>` : `<h1 tabindex="-1">${esc(title)}</h1>`}${back ? `<h1 tabindex="-1">${esc(title)}</h1><span style="min-width:48px"></span>` : ''}</header>`;
}

function homeView() {
  return `${header('Régua')}<main>
    <section class="card" aria-labelledby="h-find"><h2 id="h-find" style="margin:4px 4px 8px">Qual veículo você quer consultar?</h2>
      <div class="tiles">${['trucks', 'motorcycles', 'cars'].map(t => `<button data-type="${t}">${icon(t)}<span>${TYPE_LABEL[t]}</span></button>`).join('')}</div></section>
    <h2>Ferramentas</h2>
    <div class="tools">
      <button class="tool" data-type="cars"><span class="circ">${icon('search')}</span>Buscar veículo</button>
      <button class="tool" data-view="history"><span class="circ">${icon('clock')}</span>Histórico</button>
      <button class="tool" data-tab="favorites"><span class="circ">${icon('heart')}</span>Favoritos</button>
      <button class="tool" disabled aria-disabled="true"><span class="circ">${icon('compare')}</span>Comparar (em breve)</button>
    </div>
    <div class="ad" role="complementary" aria-label="Espaço reservado para anúncio">Anúncio</div>
    <p class="muted small" style="margin-top:16px">Protótipo com dados de exemplo. Os preços não são valores reais da tabela FIPE.</p>
  </main>${tabs()}`;
}

const STEP_NAMES = ['Marca', 'Modelo', 'Ano'];
function pickView() {
  const p = S.pick;
  const crumbs = [TYPE_LABEL[p.type], p.brand?.name, p.model?.name].filter(Boolean);
  const stepTitle = ['Escolha a marca', 'Escolha o modelo', 'Escolha o ano'][p.step];
  const showSearch = p.step < 2 && !p.loading && !p.error;
  let body;
  if (p.loading) body = `<div class="list" aria-busy="true" aria-label="Carregando">${'<div class="skel"></div>'.repeat(5)}</div>`;
  else if (p.error) body = `<div class="card state" role="alert"><p class="err">Não deu para carregar a lista.</p><p class="muted small">Confira sua conexão e tente outra vez.</p><p style="margin-top:16px"><button class="btn" data-retry>Tentar outra vez</button></p></div>`;
  else {
    const q = fold(S.query);
    const items = p.items.filter(i => !q || fold(i.label).includes(q));
    body = items.length ? `<ul class="list">${items.map(i => `<li><button data-pick="${esc(i.id)}"><span>${esc(i.label)}${i.sub ? `<br><span class="muted small">${esc(i.sub)}</span>` : ''}</span>${icon('chevron', 20)}</button></li>`).join('')}</ul>`
      : `<div class="card state"><p>Nenhum resultado${q ? ` para “${esc(S.query.trim().length > 40 ? S.query.trim().slice(0, 40) + '…' : S.query.trim())}”` : ''}.</p></div>`;
  }
  return `${header(stepTitle, true)}<main>
    <p class="steps" aria-label="Etapas">${crumbs.map((c, i) => i === crumbs.length - 1 ? `<b>${esc(c)}</b>` : `<span>${esc(c)} ›</span>`).join(' ')}</p>
    ${showSearch ? `<label class="sr" for="q">Buscar na lista</label><input id="q" class="search" type="search" placeholder="Buscar ${STEP_NAMES[p.step].toLowerCase()}" value="${esc(S.query)}" autocomplete="off">` : ''}
    ${body}</main>`;
}

function chartSvg(points, months) {
  const pts = points.slice(-months);
  if (pts.length < 2) return `<p class="muted small">Só há um mês de dados para este veículo. O gráfico aparece quando houver mais meses.</p>`;
  const W = 320, H = 140, pad = 8;
  const ys = pts.map(p => p.priceCents), min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const xy = pts.map((p, i) => [pad + (i * (W - 2 * pad)) / (pts.length - 1), pad + (1 - (p.priceCents - min) / span) * (H - 2 * pad)]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const first = pts[0], last = pts[pts.length - 1];
  const pct = ((last.priceCents - first.priceCents) / first.priceCents) * 100;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução do preço de ${esc(formatMonth(first.referenceMonth))} a ${esc(formatMonth(last.referenceMonth))}: ${esc(formatPercent(pct))}">
      <path d="M${pad},${H - pad}H${W - pad}" stroke="var(--color-border)" stroke-width="1"/>
      <path d="${d}" fill="none" stroke="var(--color-accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${xy[xy.length - 1][0]}" cy="${xy[xy.length - 1][1]}" r="4" fill="var(--color-accent)"/></svg>
    <p class="small muted" style="margin-top:8px">${esc(formatMonth(first.referenceMonth))}: ${esc(formatBRL(first.priceCents))} → ${esc(formatMonth(last.referenceMonth))}: ${esc(formatBRL(last.priceCents))} (${esc(formatPercent(pct))})</p>`;
}

function resultView() {
  const r = S.result;
  if (r.loading) return `${header('Preço FIPE', true)}<main aria-busy="true"><div class="card"><div class="skel" style="height:24px;margin-bottom:12px"></div><div class="skel" style="height:44px;margin-bottom:12px"></div><div class="skel" style="height:24px"></div></div></main>`;
  if (r.error || !r.data) return `${header('Preço FIPE', true)}<main><div class="card state" role="alert"><p class="err">${r.error ? 'Não foi possível carregar o preço.' : 'Não há preço para este ano nesta tabela.'}</p>${r.error ? '<p style="margin-top:16px"><button class="btn" data-retry>Tentar outra vez</button></p>' : ''}</div></main>`;
  const v = r.data, favs = store.get('favs', []), isFav = favs.includes(v.year.id);
  const ch = v.change;
  const chip = ch ? `<span class="chip">${ch.cents > 0 ? '▲' : ch.cents < 0 ? '▼' : '■'} ${esc(formatPercent(ch.percent))} <span class="muted">(${esc(formatBRL(ch.cents))}) vs mês anterior</span></span>` : '<span class="chip muted">Primeiro mês de dados</span>';
  return `${header('Preço FIPE', true)}<main>
    <section class="card">
      <p class="muted small">${esc(v.brand.name)}</p><h2 style="margin:0 0 4px">${esc(v.model.name)}</h2>
      <p class="muted">${esc(formatModelYear(v.year.modelYear))} · ${esc(v.year.fuel)}</p>
      <p class="price" aria-label="Preço FIPE">${esc(formatBRL(v.latest.priceCents))}</p>
      <p class="muted small">Tabela de ${esc(formatMonth(v.latest.referenceMonth))}</p>
      <div style="margin-top:12px">${chip}</div>
      <dl class="meta small"><dt>Código FIPE</dt><dd>${esc(v.year.fipeCode)}</dd><dt>Tipo</dt><dd>${esc(TYPE_LABEL[v.brand.vehicleType])}</dd></dl>
      <div class="row" style="margin-top:16px">
        <button class="btn secondary fav" data-fav aria-pressed="${isFav}">${icon('heart', 20)}<span>${isFav ? 'Favorito' : 'Favoritar'}</span></button>
        <button class="btn secondary" data-share>${icon('share', 20)}Compartilhar</button>
      </div></section>
    <h2>Evolução do preço</h2>
    <section class="card"><div class="row between" style="margin-bottom:12px"><span class="muted small">Últimos meses</span>
      <div class="seg" role="group" aria-label="Período">${[6, 12].map(m => `<button data-months="${m}" aria-pressed="${S.chartMonths === m}">${m} meses</button>`).join('')}</div></div>
      ${chartSvg(v.history, S.chartMonths)}</section>
    <p class="muted small" style="margin-top:16px">Dados de exemplo, não são valores reais da tabela FIPE.</p>
  </main>`;
}

function favoritesView() {
  const f = S.favs;
  let body;
  if (!f) body = `<div class="list">${'<div class="skel"></div>'.repeat(3)}</div>`;
  else if (!f.length) body = `<div class="card state"><p>Sua lista está vazia.</p><p class="muted small">Abra um preço e toque em Favoritar para acompanhar aqui.</p></div>`;
  else body = `<ul class="list">${f.map(v => `<li><button data-open="${esc(v.year.id)}"><span>${esc(v.model.name)}<br><span class="muted small">${esc(formatModelYear(v.year.modelYear))} · ${esc(formatBRL(v.latest.priceCents))}${v.change ? ' · ' + esc(formatPercent(v.change.percent)) : ''}</span></span>${icon('chevron', 20)}</button></li>`).join('')}</ul>`;
  return `${header('Favoritos')}<main>${body}</main>${tabs()}`;
}
function historyView() {
  const h = S.hist;
  const body = !h ? `<div class="list">${'<div class="skel"></div>'.repeat(3)}</div>` : !h.length ? `<div class="card state"><p>Nenhuma busca ainda.</p></div>`
    : `<ul class="list">${h.map(v => `<li><button data-open="${esc(v.year.id)}"><span>${esc(v.brand.name)} ${esc(v.model.name)}<br><span class="muted small">${esc(formatModelYear(v.year.modelYear))} · ${esc(formatBRL(v.latest.priceCents))}</span></span>${icon('chevron', 20)}</button></li>`).join('')}</ul>`;
  return `${header('Histórico', true)}<main>${body}</main>`;
}
function aboutView() {
  return `${header('Sobre')}<main><div class="card"><p>Régua mostra o preço da tabela FIPE, sem cadastro e sem pop-up.</p><p class="muted small" style="margin-top:8px">Os preços mostrados são dados de exemplo inventados. Não use para decisões de compra ou venda.</p></div></main>${tabs()}`;
}

let lastScreenKey = '';
function render() {
  const views = { home: homeView, pick: pickView, result: resultView, favorites: favoritesView, history: historyView, about: aboutView };
  const focused = document.activeElement?.id;
  const caret = document.activeElement?.selectionStart;
  $app.innerHTML = views[S.view]() + (S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : '');
  if (focused === 'q') { const q = document.getElementById('q'); q.focus(); try { q.setSelectionRange(caret, caret); } catch { /* ignore */ } }
  // after a re-render the old focused element is gone; when the user moved to a new screen or step,
  // put focus on its heading so keyboard and screen-reader users continue from the top of the new content
  const key = S.view + ':' + (S.pick ? S.pick.step : '') + ':' + (S.view === 'result' ? (S.result?.loading ? 'l' : 'd') : '');
  if (key !== lastScreenKey) { lastScreenKey = key; if (focused !== 'q') document.querySelector('header h1')?.focus({ preventScroll: true }); }
  else if (focused && focused !== 'q') document.getElementById(focused)?.focus({ preventScroll: true });
}

// ---- flows ----
async function loadStep() {
  const p = S.pick; p.loading = true; p.error = false; S.query = ''; render();
  try {
    if (p.step === 0) p.items = (await repo.listBrands(p.type)).map(b => ({ id: b.id, label: b.name, raw: b }));
    else if (p.step === 1) p.items = (await repo.listModels(p.brand.id)).map(m => ({ id: m.id, label: m.name, raw: m }));
    else p.items = (await repo.listYears(p.model.id)).map(y => ({ id: y.id, label: formatModelYear(y.modelYear), sub: y.fuel, raw: y }));
  } catch { p.error = true; }
  p.loading = false; render();
}
async function loadResult(yearId) {
  S.view = 'result'; S.result = { loading: true }; S.chartMonths = 12; render(); window.scrollTo(0, 0);
  try {
    const data = await repo.getVehicle(yearId);
    S.result = { data, id: yearId };
    if (data) { const h = store.get('hist', []).filter(i => i !== yearId); h.unshift(yearId); store.set('hist', h.slice(0, 30)); }
  } catch { S.result = { error: true, id: yearId }; }
  render();
}
async function loadList(key, ids) {
  try { S[key] = (await Promise.all(ids.map(i => repo.getVehicle(i)))).filter(Boolean); } catch { S[key] = []; }
  render();
}

$app.addEventListener('click', e => {
  const el = e.target.closest('button'); if (!el) return;
  if (el.dataset.tab) { S.tab = el.dataset.tab; S.view = el.dataset.tab; if (S.tab === 'favorites') { S.favs = null; loadList('favs', store.get('favs', [])); } return go({}); }
  if (el.dataset.type) { S.pick = { type: el.dataset.type, step: 0, items: [] }; S.view = 'pick'; render(); return loadStep(); }
  if (el.dataset.view === 'history') { S.view = 'history'; S.hist = null; render(); return loadList('hist', store.get('hist', [])); }
  if (el.hasAttribute('data-back')) {
    if (S.view === 'pick' && S.pick.step > 0) { S.pick.step--; if (S.pick.step === 0) delete S.pick.brand; delete S.pick.model; render(); return loadStep(); }
    if (S.view === 'result' && S.pick && S.pick.step === 2) { S.view = 'pick'; render(); return; }
    S.view = S.tab; if (S.tab === 'favorites') { S.favs = null; loadList('favs', store.get('favs', [])); } return go({});
  }
  if (el.dataset.pick) {
    if (e.detail > 1) return;   // 2nd click of a double tap lands on the next step's list: ignore it
    const item = S.pick.items.find(i => i.id === el.dataset.pick);
    if (S.pick.step === 0) { S.pick.brand = item.raw; S.pick.step = 1; return loadStep(); }
    if (S.pick.step === 1) { S.pick.model = item.raw; S.pick.step = 2; return loadStep(); }
    return loadResult(item.id);
  }
  if (el.dataset.open) { S.pick = null; return loadResult(el.dataset.open); }
  if (el.hasAttribute('data-retry')) return S.view === 'result' ? loadResult(S.result.id) : loadStep();
  if (el.dataset.months) return go({ chartMonths: Number(el.dataset.months) });
  if (el.hasAttribute('data-fav')) {
    const id = S.result.data.year.id; let f = store.get('favs', []);
    const was = f.includes(id); f = was ? f.filter(x => x !== id) : [id, ...f]; store.set('favs', f);
    return toast(was ? 'Removido dos favoritos' : 'Adicionado aos favoritos');
  }
  if (el.hasAttribute('data-share')) {
    const v = S.result.data;
    const text = `${v.brand.name} ${v.model.name} ${formatModelYear(v.year.modelYear)}: ${formatBRL(v.latest.priceCents)} (tabela de ${formatMonth(v.latest.referenceMonth)})`;
    // native share first; where it is refused (embedded pages, desktop), copy the text, or show it to copy by hand
    const copy = () => {
      try {
        navigator.clipboard.writeText(text).then(() => toast('Texto copiado: ' + text), () => toast('Copie o texto: ' + text));
      } catch { toast('Copie o texto: ' + text); }
    };
    if (navigator.share) navigator.share({ text }).catch(err => { if (err && err.name !== 'AbortError') copy(); });
    else copy();
  }
});
$app.addEventListener('input', e => { if (e.target.id === 'q') { S.query = e.target.value; render(); } });

render();
