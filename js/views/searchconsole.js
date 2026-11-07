import * as store from "../store.js";
import { assignCluster, findOpportunities, parseQueries, summarize } from "../gsc.js";
import { fmt, h, pickFile, toast } from "../ui.js";

const TYPE_LABEL = { "pagina-2": "Cerca de la 1.ª página", "ctr-bajo": "CTR bajo" };

export function addKeywordFromQuery(q) {
  store.update((p) => {
    if (p.keywords.some((k) => k.keyword.toLowerCase() === q.query.toLowerCase())) return;
    p.keywords.push({
      id: store.uid(),
      keyword: q.query,
      clusterId: assignCluster(q.query, p.clusters),
      intent: "local",
      pageId: null,
      priority: "media",
      clicks: q.clicks,
      impressions: q.impressions,
      position: q.position,
    });
  });
}

async function importCsv() {
  const file = await pickFile(".csv,text/csv");
  if (!file) return;
  try {
    const queries = parseQueries(await file.text());
    store.update((p) => {
      p.queries = queries;
      // Actualiza métricas de keywords que ya existían.
      for (const k of p.keywords) {
        const q = queries.find((x) => x.query.toLowerCase() === k.keyword.toLowerCase());
        if (q) Object.assign(k, { clicks: q.clicks, impressions: q.impressions, position: q.position });
      }
    });
    toast(`${queries.length} consultas importadas.`);
  } catch (e) {
    toast(e.message, "error");
  }
}

function stat(label, value) {
  return h("div", { class: "stat" }, h("span", {}, label), h("strong", {}, value));
}

export function render(root) {
  const p = store.get();
  const tracked = new Set(p.keywords.map((k) => k.keyword.toLowerCase()));

  const addBtn = (q) => tracked.has(q.query.toLowerCase())
    ? h("span", { class: "muted" }, "en la lista")
    : h("button", { class: "small", onclick: () => addKeywordFromQuery(q) }, "+ Keyword");

  const header = h("div", { class: "section-head" },
    h("div", {},
      h("h2", {}, "Search Console"),
      h("p", { class: "lead" },
        "En Search Console abre ", h("em", {}, "Rendimiento → Resultados de búsqueda"),
        ", elige un periodo de 3 a 12 meses y exporta en CSV. Sube aquí el archivo ",
        h("code", {}, "Consultas.csv"), ". Se procesa en tu navegador; no se envía a ningún lado."),
    ),
    h("button", { class: "primary", onclick: importCsv }, p.queries.length ? "Reemplazar CSV" : "Importar CSV"),
  );

  if (!p.queries.length) {
    root.replaceChildren(header, h("div", { class: "empty" }, "Todavía no hay datos. Importa el CSV o carga el proyecto de ejemplo desde el menú Proyecto."));
    return;
  }

  const s = summarize(p.queries);
  const opps = findOpportunities(p.queries);
  const top = [...p.queries].sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 25);
  const clusterOf = (q) => p.clusters.find((c) => c.id === assignCluster(q.query, p.clusters))?.name ?? "—";

  root.replaceChildren(
    header,
    h("div", { class: "stats" },
      stat("Consultas", fmt.int(s.queries)),
      stat("Clics", fmt.int(s.clicks)),
      stat("Impresiones", fmt.int(s.impressions)),
      stat("CTR medio", fmt.pct(s.ctr)),
      stat("Posición media", fmt.pos(s.position)),
    ),

    h("section", {},
      h("h3", {}, `Oportunidades (${opps.length})`),
      h("p", { class: "hint" }, "Consultas con al menos 50 impresiones. «Potencial» es una estimación de clics extra al alcanzar el CTR típico de la posición objetivo."),
      opps.length
        ? h("div", { class: "table-wrap" }, h("table", {},
          h("thead", {}, h("tr", {}, ["Consulta", "Tipo", "Impr.", "CTR", "Pos.", "Potencial", "Qué hacer", ""].map((t, i) => h("th", { class: i >= 2 && i <= 5 ? "num" : "" }, t)))),
          h("tbody", {}, opps.slice(0, 30).map((o) => h("tr", {},
            h("td", {}, o.query),
            h("td", {}, h("span", { class: `tag ${o.type}` }, TYPE_LABEL[o.type])),
            h("td", { class: "num" }, fmt.int(o.impressions)),
            h("td", { class: "num" }, fmt.pct(o.ctr)),
            h("td", { class: "num" }, fmt.pos(o.position)),
            h("td", { class: "num" }, `+${fmt.int(o.potential)}`),
            h("td", { class: "action" }, o.action),
            h("td", {}, addBtn(o)),
          ))),
        ))
        : h("p", { class: "muted" }, "No se detectaron oportunidades con los umbrales actuales."),
    ),

    h("section", {},
      h("h3", {}, "Consultas principales"),
      h("div", { class: "table-wrap" }, h("table", {},
        h("thead", {}, h("tr", {}, ["Consulta", "Clúster", "Clics", "Impr.", "CTR", "Pos.", ""].map((t, i) => h("th", { class: i >= 2 && i <= 5 ? "num" : "" }, t)))),
        h("tbody", {}, top.map((q) => h("tr", {},
          h("td", {}, q.query),
          h("td", { class: "muted" }, clusterOf(q)),
          h("td", { class: "num" }, fmt.int(q.clicks)),
          h("td", { class: "num" }, fmt.int(q.impressions)),
          h("td", { class: "num" }, fmt.pct(q.ctr)),
          h("td", { class: "num" }, fmt.pos(q.position)),
          h("td", {}, addBtn(q)),
        ))),
      )),
    ),
  );
}
