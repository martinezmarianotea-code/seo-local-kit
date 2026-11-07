// Construye el grafo del mapa semántico a partir del proyecto y lo acomoda
// en anillos: negocio al centro, luego clústeres, páginas y keywords.

export const RING = { business: 0, cluster: 230, page: 420, keyword: 600 };

export function buildGraph(project) {
  const nodes = [];
  const edges = [];
  const add = (node, parent, kind = "solid") => {
    nodes.push({ ...node, parent: parent ?? null });
    if (parent) edges.push({ from: parent, to: node.id, kind });
  };

  add({ id: "business", type: "business", label: project.business?.name || "Mi negocio" });

  for (const c of project.clusters) {
    add({ id: `c:${c.id}`, type: "cluster", label: c.name || "Clúster" }, "business");
  }
  for (const pg of project.pages) {
    const parent = pg.clusterId && project.clusters.some((c) => c.id === pg.clusterId) ? `c:${pg.clusterId}` : "business";
    add({ id: `p:${pg.id}`, type: "page", label: pg.url || "/", title: pg.title }, parent);
  }
  for (const k of project.keywords) {
    if (!k.keyword) continue;
    let parent = "business";
    let kind = "dashed"; // sin página: conexión punteada = pendiente
    if (k.pageId && project.pages.some((p) => p.id === k.pageId)) {
      parent = `p:${k.pageId}`;
      kind = "solid";
    } else if (k.clusterId && project.clusters.some((c) => c.id === k.clusterId)) {
      parent = `c:${k.clusterId}`;
    }
    add({
      id: `k:${k.id}`, type: "keyword", label: k.keyword, priority: k.priority,
      impressions: k.impressions ?? 0, position: k.position ?? null,
    }, parent, kind);
  }
  return { nodes, edges };
}

/** Reparte el círculo entre subárboles según cuántas hojas tiene cada uno. */
export function layoutRadial(graph) {
  const children = new Map(graph.nodes.map((n) => [n.id, []]));
  for (const n of graph.nodes) if (n.parent) children.get(n.parent).push(n.id);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  const leaves = new Map();
  const countLeaves = (id) => {
    const kids = children.get(id);
    const total = kids.length ? kids.reduce((s, k) => s + countLeaves(k), 0) : 1;
    leaves.set(id, total);
    return total;
  };
  countLeaves("business");

  const pos = { business: { x: 0, y: 0 } };
  const place = (id, start, end) => {
    let angle = start;
    for (const kid of children.get(id)) {
      const span = ((end - start) * leaves.get(kid)) / leaves.get(id);
      const mid = angle + span / 2;
      const r = RING[byId.get(kid).type];
      // Las keywords colgadas directo del negocio o de un clúster van en su anillo propio.
      pos[kid] = { x: Math.cos(mid) * r, y: Math.sin(mid) * r };
      place(kid, angle, angle + span);
      angle += span;
    }
  };
  place("business", -Math.PI / 2, (3 * Math.PI) / 2);
  return pos;
}

export function nodeRadius(node) {
  if (node.type === "business") return 58;
  if (node.type === "cluster") return 30;
  if (node.type === "page") return 18;
  return 6 + Math.min(14, Math.sqrt(node.impressions || 0) / 6);
}

const PALETTE = {
  bg: "#faf8f3", ink: "#1f2328", ink2: "#59606a", rule: "#c9c4b8",
  business: "#24434f", cluster: "#3d7a6b", page: "#b5832c", keyword: "#8d97a3", hot: "#b5452f",
};

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const shorten = (t, n) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/** SVG independiente (para exportar o incrustar en el informe). */
export function mapSvgString(project, positions) {
  const graph = buildGraph(project);
  const auto = layoutRadial(graph);
  const pos = Object.fromEntries(graph.nodes.map((n) => [n.id, positions?.[n.id] ?? project.map?.positions?.[n.id] ?? auto[n.id]]));
  const xs = Object.values(pos).map((p) => p.x);
  const ys = Object.values(pos).map((p) => p.y);
  const pad = 110;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const w = Math.max(...xs) - minX + pad;
  const h = Math.max(...ys) - minY + pad;
  const P = PALETTE;

  const edges = graph.edges.map((e) => {
    const a = pos[e.from];
    const b = pos[e.to];
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${P.rule}" stroke-width="1.2"${e.kind === "dashed" ? ' stroke-dasharray="4 4"' : ""}/>`;
  });
  const nodes = graph.nodes.map((n) => {
    const { x, y } = pos[n.id];
    const r = nodeRadius(n);
    let circle;
    let text;
    if (n.type === "business") {
      circle = `<circle r="${r}" fill="${P.business}"/>`;
      text = `<text y="4" text-anchor="middle" font-weight="700" fill="#fff">${esc(shorten(n.label, 18))}</text>`;
    } else if (n.type === "cluster") {
      circle = `<circle r="${r}" fill="${P.cluster}"/>`;
      text = `<text y="${r + 15}" text-anchor="middle" font-weight="600" fill="${P.ink}">${esc(shorten(n.label, 26))}</text>`;
    } else if (n.type === "page") {
      circle = `<circle r="${r}" fill="${P.bg}" stroke="${P.page}" stroke-width="3"/>`;
      text = `<text y="${r + 14}" text-anchor="middle" fill="${P.ink}">${esc(shorten(n.label, 26))}</text>`;
    } else {
      circle = `<circle r="${r}" fill="${n.priority === "alta" ? P.hot : P.keyword}"/>`;
      text = `<text y="${r + 12}" text-anchor="middle" font-size="11" fill="${P.ink2}">${esc(shorten(n.label, 26))}</text>`;
    }
    return `<g transform="translate(${x} ${y})">${circle}${text}</g>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}" width="${Math.round(w)}" height="${Math.round(h)}" font-family="system-ui, sans-serif" font-size="12">`
    + `<rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="${P.bg}"/>`
    + `<g>${edges.join("")}</g><g>${nodes.join("")}</g></svg>`;
}
