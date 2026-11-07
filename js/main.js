import * as store from "./store.js";
import { download, h, pickFile, toast } from "./ui.js";
import * as business from "./views/business.js";
import * as searchconsole from "./views/searchconsole.js";
import * as keywords from "./views/keywords.js";
import * as personas from "./views/personas.js";
import * as map from "./views/map.js";
import * as report from "./views/report.js";

const VIEWS = {
  negocio: ["Negocio", business],
  "search-console": ["Search Console", searchconsole],
  keywords: ["Keywords", keywords],
  personas: ["Personas", personas],
  mapa: ["Mapa", map],
  informe: ["Informe", report],
};

const main = document.getElementById("view");
const nav = document.getElementById("tabs");

const current = () => (location.hash.slice(1) in VIEWS ? location.hash.slice(1) : "negocio");

function renderNav() {
  const active = current();
  nav.replaceChildren(...Object.entries(VIEWS).map(([id, [label]]) =>
    h("a", { href: `#${id}`, "aria-current": id === active ? "page" : null }, label)));
}

function isEmpty(p) {
  return !p.business.name && !p.keywords.length && !p.queries.length && !p.clusters.length;
}

function welcome() {
  return h("div", { class: "welcome" },
    h("p", {}, h("strong", {}, "Proyecto vacío. "),
      "Llena la ficha del negocio o carga el ejemplo (una cafetería ficticia con datos de Search Console simulados) para recorrer la herramienta."),
    h("button", { class: "primary", onclick: loadExample }, "Cargar ejemplo"));
}

function render() {
  renderNav();
  const [label, view] = VIEWS[current()];
  document.title = `${label} · seo-local-kit`;
  view.render(main);
  if (current() === "negocio" && isEmpty(store.get())) main.prepend(welcome());
  main.focus({ preventScroll: true });
}

async function loadExample() {
  if (!isEmpty(store.get()) && !confirm("Se reemplazará el proyecto actual por el ejemplo. ¿Continuar?")) return;
  const res = await fetch("examples/cafeteria-ejemplo.json");
  store.replace(await res.json());
  toast("Ejemplo cargado.");
}

const actions = {
  new() {
    if (!confirm("¿Empezar un proyecto nuevo? Guarda antes el actual si lo necesitas.")) return;
    store.replace(store.emptyProject());
    location.hash = "#negocio";
  },
  async open() {
    const file = await pickFile(".json,application/json");
    if (!file) return;
    try {
      store.importJson(await file.text());
      toast("Proyecto abierto.");
    } catch (e) {
      toast(e.message || "No se pudo leer el archivo.", "error");
    }
  },
  save() {
    const name = (store.get().business.name || "proyecto").toLowerCase().replace(/[^a-z0-9]+/gi, "-");
    download(`${name}.seo.json`, store.exportJson(), "application/json");
  },
  example: loadExample,
};

document.getElementById("project-menu").addEventListener("change", (e) => {
  const action = e.target.value;
  e.target.value = "";
  actions[action]?.();
});

window.addEventListener("hashchange", render);
store.subscribe(render);
render();
