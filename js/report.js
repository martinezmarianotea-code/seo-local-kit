// Informe de la estrategia en HTML imprimible y en Markdown. Funciones puras.

import { findOpportunities, summarize } from "./gsc.js";
import { jsonLdScript, missingFields } from "./schema.js";
import { mapSvgString } from "./mapmodel.js";

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const int = (n) => Math.round(n || 0).toLocaleString("es-MX");
const pct = (n) => `${((n || 0) * 100).toFixed(1)} %`;
const pos = (n) => (n ? n.toFixed(1) : "—");
const lines = (t) => String(t ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
const TYPE = { "pagina-2": "Cerca de la 1.ª página", "ctr-bajo": "CTR bajo" };

function grouped(p) {
  const groups = p.clusters.map((c) => ({
    name: c.name || "Clúster",
    pages: p.pages.filter((pg) => pg.clusterId === c.id),
    keywords: p.keywords.filter((k) => k.clusterId === c.id),
  }));
  const loose = p.keywords.filter((k) => !k.clusterId);
  if (loose.length) groups.push({ name: "Sin clúster", pages: [], keywords: loose });
  return groups;
}

const pageUrl = (p, id) => p.pages.find((pg) => pg.id === id)?.url ?? "";

export function buildHtml(p, { date = new Date() } = {}) {
  const b = p.business;
  const name = b.name || "Negocio sin nombre";
  const s = p.queries.length ? summarize(p.queries) : null;
  const opps = p.queries.length ? findOpportunities(p.queries).slice(0, 15) : [];
  const missing = missingFields(b);
  const noPage = p.keywords.filter((k) => k.priority === "alta" && !k.pageId);
  const address = [b.street, b.city, b.region, b.postalCode].filter(Boolean).join(", ");

  const table = (head, rows) => `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;

  const sections = [];

  sections.push(`<section><h2>1. Ficha del negocio</h2>
    <dl><dt>Nombre</dt><dd>${esc(name)}</dd><dt>Dirección</dt><dd>${esc(address || "—")}</dd>
    <dt>Teléfono</dt><dd>${esc(b.phone || "—")}</dd><dt>Sitio</dt><dd>${esc(b.url || "—")}</dd></dl>
    ${missing.length ? `<p class="warn">Faltan datos recomendados: ${esc(missing.join(", "))}.</p>` : `<p class="ok">La ficha está completa.</p>`}
    <p>Marcado schema.org para la página principal:</p><pre>${esc(jsonLdScript(b))}</pre></section>`);

  if (s) {
    sections.push(`<section><h2>2. Situación en Google</h2>
      <p>${int(s.queries)} búsquedas distintas generaron <strong>${int(s.impressions)} impresiones</strong> y <strong>${int(s.clicks)} clics</strong>
      (CTR ${pct(s.ctr)}, posición media ${pos(s.position)}).</p>
      ${opps.length ? `<h3>Oportunidades prioritarias</h3>${table(["Consulta", "Tipo", "Impr.", "Pos.", "Clics extra estimados", "Acción"],
        opps.map((o) => `<tr><td>${esc(o.query)}</td><td>${TYPE[o.type]}</td><td class="n">${int(o.impressions)}</td><td class="n">${pos(o.position)}</td><td class="n">+${int(o.potential)}</td><td>${esc(o.action)}</td></tr>`))}` : ""}
    </section>`);
  }

  sections.push(`<section><h2>${s ? 3 : 2}. Arquitectura de contenidos</h2>
    ${grouped(p).map((g) => `<h3>${esc(g.name)}</h3>
      ${g.pages.length ? `<p>Páginas: ${g.pages.map((pg) => `<code>${esc(pg.url)}</code>${pg.title ? ` — ${esc(pg.title)}` : ""}`).join("; ")}</p>` : ""}
      ${g.keywords.length ? table(["Keyword", "Intención", "Página", "Prioridad", "Impr.", "Pos."],
        g.keywords.map((k) => `<tr><td>${esc(k.keyword)}</td><td>${esc(k.intent)}</td><td>${esc(pageUrl(p, k.pageId) || "—")}</td><td>${esc(k.priority)}</td><td class="n">${k.impressions != null ? int(k.impressions) : "—"}</td><td class="n">${pos(k.position)}</td></tr>`)) : "<p>Sin keywords.</p>"}`).join("")}
    ${noPage.length ? `<p class="warn">Keywords de prioridad alta sin página: ${noPage.map((k) => esc(k.keyword)).join(", ")}.</p>` : ""}
    <figure>${mapSvgString(p)}<figcaption>Mapa semántico: negocio, clústeres, páginas y keywords. Las líneas punteadas son keywords sin página asignada.</figcaption></figure>
  </section>`);

  if (p.personas.length) {
    sections.push(`<section><h2>${s ? 4 : 3}. Buyer personas</h2>${p.personas.map((pe) => `<article><h3>${esc(pe.name || "Perfil")}</h3>
      ${pe.summary ? `<p>${esc(pe.summary)}</p>` : ""}
      ${pe.goals ? `<p><strong>Busca:</strong> ${esc(pe.goals)}</p>` : ""}
      ${pe.frustrations ? `<p><strong>Le frustra:</strong> ${esc(pe.frustrations)}</p>` : ""}
      ${lines(pe.searches).length ? `<p><strong>Cómo busca:</strong> ${lines(pe.searches).map((q) => `«${esc(q)}»`).join(", ")}</p>` : ""}
      ${pe.objections.length ? table(["Objeción", "Respuesta en el sitio"], pe.objections.map((o) => `<tr><td>${esc(o.q)}</td><td>${esc(o.a)}</td></tr>`)) : ""}
    </article>`).join("")}</section>`);
  }

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Estrategia SEO local — ${esc(name)}</title>
<style>
  body{font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1f2328;background:#fff;max-width:880px;margin:0 auto;padding:40px 24px}
  h1{font-size:28px;margin:0}h2{font-size:20px;margin:40px 0 12px;padding-bottom:6px;border-bottom:2px solid #1f2328}h3{font-size:16px;margin:24px 0 8px}
  .meta{color:#59606a;margin:4px 0 0}table{width:100%;border-collapse:collapse;font-size:13px;margin:8px 0}
  th{text-align:left;font-weight:600;border-bottom:1px solid #1f2328;padding:6px 8px 6px 0}td{border-bottom:1px solid #e1ddd3;padding:6px 8px 6px 0;vertical-align:top}
  .n{text-align:right;font-variant-numeric:tabular-nums}dl{display:grid;grid-template-columns:120px 1fr;gap:4px 12px}dt{color:#59606a}dd{margin:0}
  pre{background:#f6f4ee;border:1px solid #e1ddd3;padding:12px;font-size:12px;overflow:auto;white-space:pre-wrap}code{font-size:13px}
  .warn{color:#9a3b25}.ok{color:#2f6b3f}figure{margin:24px 0}figure svg{width:100%;height:auto;border:1px solid #e1ddd3}figcaption{font-size:12px;color:#59606a}
  @media print{body{padding:0}h2{break-after:avoid}table,figure,article{break-inside:avoid}}
</style></head><body>
<header><h1>Estrategia SEO local</h1><p class="meta">${esc(name)} · ${date.toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}</p></header>
${sections.join("\n")}
<footer><p class="meta">Generado con seo-local-kit.</p></footer>
</body></html>`;
}

export function buildMarkdown(p) {
  const b = p.business;
  const out = [`# Estrategia SEO local — ${b.name || "Negocio"}`, ""];
  const s = p.queries.length ? summarize(p.queries) : null;
  if (s) {
    out.push("## Situación en Google", "",
      `- Búsquedas: ${int(s.queries)}`, `- Impresiones: ${int(s.impressions)}`, `- Clics: ${int(s.clicks)}`,
      `- CTR: ${pct(s.ctr)} · Posición media: ${pos(s.position)}`, "");
    const opps = findOpportunities(p.queries).slice(0, 15);
    if (opps.length) {
      out.push("### Oportunidades", "", "| Consulta | Tipo | Impr. | Pos. | Acción |", "|---|---|--:|--:|---|");
      opps.forEach((o) => out.push(`| ${o.query} | ${TYPE[o.type]} | ${int(o.impressions)} | ${pos(o.position)} | ${o.action} |`));
      out.push("");
    }
  }
  out.push("## Arquitectura", "");
  for (const g of grouped(p)) {
    out.push(`### ${g.name}`, "");
    g.pages.forEach((pg) => out.push(`- Página \`${pg.url}\`${pg.title ? ` — ${pg.title}` : ""}`));
    g.keywords.forEach((k) => out.push(`- **${k.keyword}** (${k.intent}, prioridad ${k.priority})${k.pageId ? ` → \`${pageUrl(p, k.pageId)}\`` : " → _sin página_"}`));
    out.push("");
  }
  for (const pe of p.personas) {
    out.push(`## Persona: ${pe.name || "Perfil"}`, "");
    if (pe.summary) out.push(pe.summary, "");
    lines(pe.searches).forEach((q) => out.push(`- «${q}»`));
    out.push("");
  }
  out.push("## Schema JSON-LD", "", "```html", jsonLdScript(b), "```", "");
  return out.join("\n");
}
