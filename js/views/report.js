import * as store from "../store.js";
import { buildHtml, buildMarkdown } from "../report.js";
import { download, h } from "../ui.js";

const slug = (t) => (t || "negocio").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function render(root) {
  const p = store.get();
  const html = buildHtml(p);
  const frame = h("iframe", { class: "report-frame", title: "Vista previa del informe", sandbox: "allow-same-origin allow-modals" });
  frame.srcdoc = html;
  const name = slug(p.business.name);

  root.replaceChildren(
    h("div", { class: "section-head" },
      h("div", {},
        h("h2", {}, "Informe"),
        h("p", { class: "lead" }, "Un documento para entregar: ficha y schema, situación en Google, arquitectura con el mapa y buyer personas."),
      ),
      h("div", { class: "row" },
        h("button", { onclick: () => download(`seo-${name}.md`, buildMarkdown(store.get()), "text/markdown") }, "Markdown"),
        h("button", { onclick: () => download(`seo-${name}.html`, buildHtml(store.get()), "text/html") }, "HTML"),
        h("button", { class: "primary", onclick: () => frame.contentWindow.print() }, "Imprimir / PDF"),
      ),
    ),
    frame,
  );
}
