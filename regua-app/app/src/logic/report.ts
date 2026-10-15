// Price report as a self-contained HTML page, turned into a PDF on the phone (expo-print) or printed on the web.
import type { VehicleResult } from '../data/types.ts';
import { formatBRL, formatModelYear, formatMonth, formatPercent } from '../format.ts';

const esc = (s: string) => s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
const TYPE = { cars: 'Carro', motorcycles: 'Moto', trucks: 'Caminhão' } as const;

function chartSvg(v: VehicleResult): string {
  const pts = v.history.slice(-12);
  if (pts.length < 2) return '';
  const W = 640, H = 200, pad = 12;
  const ys = pts.map(p => p.priceCents), min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const xy = pts.map((p, i) => [pad + (i * (W - 2 * pad)) / (pts.length - 1), pad + (1 - (p.priceCents - min) / span) * (H - 2 * pad)]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Evolução do preço"><path d="M${pad},${H - pad}H${W - pad}" stroke="#e3e6ea"/><path d="${d}" fill="none" stroke="#b5420c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

export function buildReportHtml(v: VehicleResult, generatedAt: Date, opts: { sample?: boolean } = {}): string {
  const pts = v.history.slice(-12);
  const first = pts[0];
  const yearPct = pts.length > 1 && first.priceCents > 0 ? ((v.latest.priceCents - first.priceCents) / first.priceCents) * 100 : null;
  const rows = [...pts].reverse().map((p, i, arr) => {
    const prev = arr[i + 1];
    const ch = prev && prev.priceCents > 0 ? formatPercent(((p.priceCents - prev.priceCents) / prev.priceCents) * 100) : '';
    return `<tr><td>${esc(formatMonth(p.referenceMonth))}</td><td class="n">${esc(formatBRL(p.priceCents))}</td><td class="n">${esc(ch)}</td></tr>`;
  }).join('');
  const date = generatedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório Valor do Carro · ${esc(v.model.name)}</title>
<style>
body{font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif;color:#292929;margin:32px;font-size:14px;line-height:20px}
h1{font-size:24px;line-height:30px;margin:0 0 4px}.muted{color:#5b6470}.brand{color:#b5420c;font-weight:700;font-size:18px}
.price{font-size:36px;line-height:40px;font-weight:700;margin:12px 0 4px}
.grid{display:flex;gap:24px;flex-wrap:wrap;margin:16px 0}.grid div{min-width:120px}
table{width:100%;border-collapse:collapse;margin-top:8px}td,th{padding:6px 8px;border-bottom:1px solid #e3e6ea;text-align:left}.n{text-align:right}
.note{margin-top:24px;font-size:12px;color:#5b6470}
</style></head><body>
<div class="brand">Valor do Carro</div>
<p class="muted">Relatório de preço · gerado em ${esc(date)}</p>
<p class="muted">${esc(v.brand.name)} · ${esc(TYPE[v.brand.vehicleType])}</p>
<h1>${esc(v.model.name)}</h1>
<p class="muted">${esc(formatModelYear(v.year.modelYear))} · ${esc(v.year.fuel)} · Código FIPE ${esc(v.year.fipeCode)}</p>
<p class="price">${esc(formatBRL(v.latest.priceCents))}</p>
<p class="muted">Tabela de ${esc(formatMonth(v.latest.referenceMonth))}</p>
<div class="grid">
<div><div class="muted">Mês anterior</div><b>${v.change ? esc(`${formatPercent(v.change.percent)} (${formatBRL(v.change.cents)})`) : 'sem dado'}</b></div>
<div><div class="muted">Em ${pts.length} meses</div><b>${yearPct === null ? 'sem dado' : esc(formatPercent(yearPct))}</b></div>
</div>
${chartSvg(v)}
<h2 style="font-size:16px;margin-top:24px">Preço mês a mês</h2>
<table><thead><tr><th>Mês</th><th class="n">Preço FIPE</th><th class="n">Variação</th></tr></thead><tbody>${rows}</tbody></table>
<p class="note">${opts.sample ? '<b>Dados de exemplo, não são valores reais da tabela FIPE.</b> ' : ''}Valores da tabela FIPE, referência de preço médio; o preço de mercado pode variar com estado, quilometragem e região. O Valor do Carro não é afiliado à Fundação Instituto de Pesquisas Econômicas (FIPE).</p>
</body></html>`;
}
