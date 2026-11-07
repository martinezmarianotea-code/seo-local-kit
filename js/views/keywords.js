import * as store from "../store.js";
import { assignCluster } from "../gsc.js";
import { toCsv } from "../csv.js";
import { download, fmt, h } from "../ui.js";

export const INTENTS = [
  ["local", "Local (cerca de mí)"],
  ["transaccional", "Transaccional"],
  ["informacional", "Informacional"],
  ["navegacional", "Navegacional"],
];
export const PRIORITIES = [["alta", "Alta"], ["media", "Media"], ["baja", "Baja"]];

const select = (value, options, onChange, label) =>
  h("select", { "aria-label": label, onchange: (e) => onChange(e.target.value || null) },
    options.map(([v, l]) => {
      const o = h("option", { value: v ?? "" }, l);
      if ((v ?? "") === (value ?? "")) o.selected = true;
      return o;
    }));

function patch(collection, id, changes, silent = true) {
  store.update((p) => Object.assign(p[collection].find((x) => x.id === id), changes), { silent });
}

function remove(collection, id) {
  store.update((p) => {
    p[collection] = p[collection].filter((x) => x.id !== id);
    if (collection === "clusters") {
      p.keywords.forEach((k) => { if (k.clusterId === id) k.clusterId = null; });
      p.pages.forEach((pg) => { if (pg.clusterId === id) pg.clusterId = null; });
    }
    if (collection === "pages") p.keywords.forEach((k) => { if (k.pageId === id) k.pageId = null; });
  });
}

function exportCsv(p) {
  const rows = [["keyword", "cluster", "intencion", "pagina", "prioridad", "clics", "impresiones", "posicion"]];
  for (const k of p.keywords) {
    rows.push([
      k.keyword, store.clusterName(p, k.clusterId), k.intent, store.pageOf(p, k.pageId)?.url ?? "",
      k.priority, k.clicks ?? "", k.impressions ?? "", k.position ? k.position.toFixed(1) : "",
    ]);
  }
  download("keywords.csv", toCsv(rows), "text/csv");
}

export function render(root) {
  const p = store.get();
  const clusterOptions = [[null, "Sin clúster"], ...p.clusters.map((c) => [c.id, c.name || "(sin nombre)"])];
  const pageOptions = [[null, "Sin página"], ...p.pages.map((pg) => [pg.id, pg.url || "(sin URL)"])];

  const clusters = h("section", {},
    h("div", { class: "section-head" },
      h("div", {}, h("h3", {}, "Clústeres temáticos"),
        h("p", { class: "hint" }, "Agrupa las búsquedas por tema. Los términos sirven para clasificar automáticamente las consultas de Search Console.")),
      h("button", { onclick: () => store.update((pr) => pr.clusters.push({ id: store.uid(), name: "", terms: [] })) }, "+ Clúster"),
    ),
    p.clusters.length ? h("div", { class: "table-wrap" }, h("table", { class: "edit" },
      h("thead", {}, h("tr", {}, h("th", {}, "Nombre"), h("th", {}, "Términos (separados por comas)"), h("th", { class: "num" }, "Keywords"), h("th", {}))),
      h("tbody", {}, p.clusters.map((c) => h("tr", {},
        h("td", {}, h("input", { value: c.name, "aria-label": "Nombre del clúster", oninput: (e) => patch("clusters", c.id, { name: e.target.value }), onchange: () => store.update(() => {}) })),
        h("td", {}, h("input", { value: c.terms.join(", "), "aria-label": "Términos", oninput: (e) => patch("clusters", c.id, { terms: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) }) })),
        h("td", { class: "num" }, p.keywords.filter((k) => k.clusterId === c.id).length),
        h("td", {}, h("button", { class: "link danger", onclick: () => remove("clusters", c.id) }, "Quitar")),
      ))),
    )) : h("p", { class: "muted" }, "Sin clústeres."),
    p.clusters.length && p.keywords.some((k) => !k.clusterId)
      ? h("button", { class: "small", onclick: () => store.update((pr) => pr.keywords.forEach((k) => { if (!k.clusterId) k.clusterId = assignCluster(k.keyword, pr.clusters); })) }, "Clasificar keywords sin clúster")
      : null,
  );

  const pages = h("section", {},
    h("div", { class: "section-head" },
      h("div", {}, h("h3", {}, "Páginas del sitio"),
        h("p", { class: "hint" }, "Cada keyword importante debería tener una página que la responda. Una página por intención evita que compitan entre sí.")),
      h("button", { onclick: () => store.update((pr) => pr.pages.push({ id: store.uid(), url: "/", title: "", clusterId: null })) }, "+ Página"),
    ),
    p.pages.length ? h("div", { class: "table-wrap" }, h("table", { class: "edit" },
      h("thead", {}, h("tr", {}, h("th", {}, "URL"), h("th", {}, "Título (etiqueta title)"), h("th", {}, "Clúster"), h("th", { class: "num" }, "Keywords"), h("th", {}))),
      h("tbody", {}, p.pages.map((pg) => {
        const n = p.keywords.filter((k) => k.pageId === pg.id).length;
        const len = (pg.title || "").length;
        return h("tr", {},
          h("td", {}, h("input", { value: pg.url, "aria-label": "URL", oninput: (e) => patch("pages", pg.id, { url: e.target.value }), onchange: () => store.update(() => {}) })),
          h("td", {}, h("input", { value: pg.title, "aria-label": "Título", oninput: (e) => patch("pages", pg.id, { title: e.target.value }) }),
            len > 60 ? h("small", { class: "warn-text" }, `${len} caracteres: Google suele cortar después de ~60.`) : null),
          h("td", {}, select(pg.clusterId, clusterOptions, (v) => patch("pages", pg.id, { clusterId: v }, false), "Clúster")),
          h("td", { class: `num ${n ? "" : "warn-text"}` }, n),
          h("td", {}, h("button", { class: "link danger", onclick: () => remove("pages", pg.id) }, "Quitar")),
        );
      })),
    )) : h("p", { class: "muted" }, "Sin páginas."),
  );

  const orphan = p.keywords.filter((k) => k.priority === "alta" && !k.pageId).length;
  const keywords = h("section", {},
    h("div", { class: "section-head" },
      h("div", {}, h("h3", {}, `Keywords (${p.keywords.length})`),
        orphan ? h("p", { class: "status warn" }, `${orphan} keyword(s) de prioridad alta sin página asignada.`) : null),
      h("div", { class: "row" },
        h("button", { onclick: () => store.update((pr) => pr.keywords.push({ id: store.uid(), keyword: "", clusterId: null, intent: "local", pageId: null, priority: "media" })) }, "+ Keyword"),
        p.keywords.length ? h("button", { onclick: () => exportCsv(p) }, "Exportar CSV") : null,
      ),
    ),
    p.keywords.length ? h("div", { class: "table-wrap" }, h("table", { class: "edit" },
      h("thead", {}, h("tr", {}, ["Keyword", "Clúster", "Intención", "Página", "Prioridad", "Impr.", "Pos.", ""].map((t, i) => h("th", { class: i === 5 || i === 6 ? "num" : "" }, t)))),
      h("tbody", {}, [...p.keywords].sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0)).map((k) => h("tr", {},
        h("td", {}, h("input", { value: k.keyword, "aria-label": "Keyword", oninput: (e) => patch("keywords", k.id, { keyword: e.target.value }) })),
        h("td", {}, select(k.clusterId, clusterOptions, (v) => patch("keywords", k.id, { clusterId: v }, false), "Clúster")),
        h("td", {}, select(k.intent, INTENTS, (v) => patch("keywords", k.id, { intent: v }), "Intención")),
        h("td", {}, select(k.pageId, pageOptions, (v) => patch("keywords", k.id, { pageId: v }, false), "Página")),
        h("td", {}, select(k.priority, PRIORITIES, (v) => patch("keywords", k.id, { priority: v }, false), "Prioridad")),
        h("td", { class: "num" }, k.impressions != null ? fmt.int(k.impressions) : "—"),
        h("td", { class: "num" }, fmt.pos(k.position)),
        h("td", {}, h("button", { class: "link danger", onclick: () => remove("keywords", k.id) }, "Quitar")),
      ))),
    )) : h("p", { class: "muted" }, "Agrega keywords a mano o desde la pestaña Search Console."),
  );

  root.replaceChildren(
    h("h2", {}, "Keywords y páginas"),
    h("p", { class: "lead" }, "La arquitectura del sitio: qué temas cubre, qué página responde cada búsqueda y qué atacar primero."),
    clusters, pages, keywords,
  );
}
