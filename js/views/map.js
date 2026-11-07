import * as store from "../store.js";
import { buildGraph, layoutRadial, mapSvgString, nodeRadius } from "../mapmodel.js";
import { download, fmt, h, toast } from "../ui.js";

const SVG = "http://www.w3.org/2000/svg";
const s = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  kids.flat().forEach((k) => k != null && el.append(k));
  return el;
};

const TYPE_LABEL = { business: "Negocio", cluster: "Clúster", page: "Página", keyword: "Keyword" };
const short = (t, n = 26) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

export function render(root) {
  const project = store.get();
  const graph = buildGraph(project);
  const auto = layoutRadial(graph);
  const pos = {};
  for (const n of graph.nodes) pos[n.id] = project.map.positions[n.id] ?? auto[n.id];

  let view = { x: 0, y: 0, k: 0.8 };
  const viewport = s("g");
  const edgesG = s("g", { class: "edges" });
  const nodesG = s("g", { class: "nodes" });
  viewport.append(edgesG, nodesG);
  const svg = s("svg", { class: "map", role: "img", "aria-label": "Mapa semántico del sitio" }, viewport);
  const detail = h("aside", { class: "map-detail" }, h("p", { class: "muted" }, "Toca un nodo para ver sus datos. Arrastra para moverlo; arrastra el fondo para desplazarte y usa la rueda para acercar."));

  const edgeEls = graph.edges.map((e) => {
    const line = s("line", { class: `edge ${e.kind}` });
    edgesG.append(line);
    return { e, line };
  });

  const nodeEls = graph.nodes.map((n) => {
    const r = nodeRadius(n);
    const g = s("g", { class: `node ${n.type} ${n.priority ? `prio-${n.priority}` : ""}`, tabindex: 0 },
      s("circle", { r }),
      s("text", { class: "label", y: n.type === "business" ? 4 : n.type === "keyword" ? r + 12 : r + 15, "text-anchor": "middle" },
        short(n.label, n.type === "business" ? 18 : 26)),
    );
    g.addEventListener("pointerdown", (ev) => startDrag(ev, n));
    g.addEventListener("keydown", (ev) => ev.key === "Enter" && showDetail(n));
    nodesG.append(g);
    return { n, g };
  });

  function draw() {
    viewport.setAttribute("transform", `translate(${view.x} ${view.y}) scale(${view.k})`);
    // El texto compensa el zoom hasta cierto punto para seguir siendo legible al alejar.
    svg.style.setProperty("--text-scale", 1 / Math.max(view.k, 0.65));
    for (const { e, line } of edgeEls) {
      const a = pos[e.from];
      const b = pos[e.to];
      line.setAttribute("x1", a.x); line.setAttribute("y1", a.y);
      line.setAttribute("x2", b.x); line.setAttribute("y2", b.y);
    }
    for (const { n, g } of nodeEls) g.setAttribute("transform", `translate(${pos[n.id].x} ${pos[n.id].y})`);
  }

  function center() {
    // Ajusta el zoom para que todo el mapa (con etiquetas) quepa en el marco.
    const box = svg.getBoundingClientRect();
    const xs = Object.values(pos).map((p) => p.x);
    const ys = Object.values(pos).map((p) => p.y);
    const minX = Math.min(...xs) - 90;
    const maxX = Math.max(...xs) + 90;
    const minY = Math.min(...ys) - 40;
    const maxY = Math.max(...ys) + 40;
    const k = Math.min(1.4, Math.max(0.3, Math.min(box.width / (maxX - minX), box.height / (maxY - minY))));
    view = { k, x: box.width / 2 - ((minX + maxX) / 2) * k, y: box.height / 2 - ((minY + maxY) / 2) * k };
    draw();
  }

  function showDetail(n) {
    const rows = [["Tipo", TYPE_LABEL[n.type]]];
    if (n.title) rows.push(["Título", n.title]);
    if (n.type === "keyword") {
      rows.push(["Prioridad", n.priority ?? "—"], ["Impresiones", fmt.int(n.impressions)], ["Posición", fmt.pos(n.position)]);
      const parent = graph.nodes.find((x) => x.id === n.parent);
      rows.push(["Página", parent?.type === "page" ? parent.label : "Sin asignar"]);
    } else {
      const kids = graph.nodes.filter((x) => x.parent === n.id);
      rows.push(["Elementos conectados", kids.length]);
    }
    detail.replaceChildren(h("h3", {}, n.label), h("dl", {}, rows.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])));
  }

  // Arrastre de nodos y del fondo
  let drag = null;
  function startDrag(ev, n) {
    ev.stopPropagation();
    drag = { node: n, x: ev.clientX, y: ev.clientY, moved: false };
    svg.setPointerCapture(ev.pointerId);
  }
  svg.addEventListener("pointerdown", (ev) => {
    drag = { pan: true, x: ev.clientX, y: ev.clientY };
    svg.setPointerCapture(ev.pointerId);
  });
  svg.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const dx = ev.clientX - drag.x;
    const dy = ev.clientY - drag.y;
    drag.x = ev.clientX;
    drag.y = ev.clientY;
    if (drag.pan) {
      view.x += dx;
      view.y += dy;
    } else {
      drag.moved = true;
      const p = pos[drag.node.id];
      pos[drag.node.id] = { x: p.x + dx / view.k, y: p.y + dy / view.k };
    }
    draw();
  });
  svg.addEventListener("pointerup", () => {
    if (drag?.node && drag.moved) {
      const id = drag.node.id;
      store.update((p) => { p.map.positions[id] = pos[id]; }, { silent: true });
    } else if (drag?.node) {
      showDetail(drag.node);
    }
    drag = null;
  });
  svg.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    const box = svg.getBoundingClientRect();
    const mx = ev.clientX - box.left;
    const my = ev.clientY - box.top;
    const factor = Math.exp(-ev.deltaY * 0.0015);
    const k = Math.min(3, Math.max(0.15, view.k * factor));
    view.x = mx - ((mx - view.x) * k) / view.k;
    view.y = my - ((my - view.y) * k) / view.k;
    view.k = k;
    draw();
  }, { passive: false });

  const standaloneSvg = () => mapSvgString(store.get(), pos);

  async function exportPng() {
    const svgText = standaloneSvg();
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
    await img.decode();
    const scale = 2;
    const canvas = h("canvas", { width: img.width * scale, height: img.height * scale });
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((blob) => download("mapa-semantico.png", blob), "image/png");
  }

  const counts = (t) => graph.nodes.filter((n) => n.type === t).length;
  const pending = graph.edges.filter((e) => e.kind === "dashed").length;

  root.replaceChildren(
    h("div", { class: "section-head" },
      h("div", {},
        h("h2", {}, "Mapa semántico"),
        h("p", { class: "lead" }, `${counts("cluster")} clústeres · ${counts("page")} páginas · ${counts("keyword")} keywords`,
          pending ? ` · ${pending} keyword(s) sin página (línea punteada)` : ""),
      ),
      h("div", { class: "row" },
        h("button", { onclick: center }, "Centrar"),
        h("button", { onclick: () => { store.update((p) => { p.map.positions = {}; }); toast("Mapa reorganizado."); } }, "Reorganizar"),
        h("button", { onclick: () => download("mapa-semantico.svg", standaloneSvg(), "image/svg+xml") }, "SVG"),
        h("button", { class: "primary", onclick: exportPng }, "PNG"),
      ),
    ),
    graph.nodes.length > 1
      ? h("div", { class: "map-layout" }, h("div", { class: "map-frame" }, svg,
        h("ul", { class: "legend" },
          h("li", { class: "l-cluster" }, "Clúster"), h("li", { class: "l-page" }, "Página"),
          h("li", { class: "l-keyword" }, "Keyword"), h("li", { class: "l-hot" }, "Prioridad alta"))), detail)
      : h("div", { class: "empty" }, "El mapa se arma solo con los clústeres, páginas y keywords del proyecto. Agrega algunos en la pestaña Keywords."),
  );
  if (graph.nodes.length > 1) requestAnimationFrame(center);
}
