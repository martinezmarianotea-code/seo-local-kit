import * as store from "../store.js";
import { h } from "../ui.js";

const blank = () => ({
  id: store.uid(), name: "", summary: "", goals: "", frustrations: "", searches: "", objections: [],
});

function set(id, key, value) {
  store.update((p) => { p.personas.find((x) => x.id === id)[key] = value; }, { silent: true });
}

function area(persona, key, label, hint) {
  const id = `${key}-${persona.id}`;
  return h("div", { class: "field wide" },
    h("label", { for: id }, label),
    h("textarea", { id, rows: 3, oninput: (e) => set(persona.id, key, e.target.value) }, persona[key] ?? ""),
    hint && h("small", {}, hint));
}

function card(persona) {
  const objections = h("div", { class: "objections" },
    persona.objections.map((o, i) => h("div", { class: "objection" },
      h("input", { value: o.q, placeholder: "Duda u objeción del cliente", "aria-label": "Objeción",
        oninput: (e) => store.update((p) => { p.personas.find((x) => x.id === persona.id).objections[i].q = e.target.value; }, { silent: true }) }),
      h("input", { value: o.a, placeholder: "Cómo la responde el sitio", "aria-label": "Respuesta",
        oninput: (e) => store.update((p) => { p.personas.find((x) => x.id === persona.id).objections[i].a = e.target.value; }, { silent: true }) }),
      h("button", { class: "link danger", "aria-label": "Quitar objeción",
        onclick: () => store.update((p) => p.personas.find((x) => x.id === persona.id).objections.splice(i, 1)) }, "×"),
    )),
  );

  return h("article", { class: "card persona" },
    h("div", { class: "card-head" },
      h("input", { class: "title-input", value: persona.name, placeholder: "Nombre del perfil (p. ej. «Turista de fin de semana»)",
        "aria-label": "Nombre del perfil", oninput: (e) => set(persona.id, "name", e.target.value) }),
      h("button", { class: "link danger", onclick: () => store.update((p) => { p.personas = p.personas.filter((x) => x.id !== persona.id); }) }, "Eliminar"),
    ),
    h("div", { class: "grid" },
      area(persona, "summary", "Quién es", "Edad, ocupación, de dónde viene, con quién compra."),
      area(persona, "goals", "Qué busca resolver"),
      area(persona, "frustrations", "Qué le frustra o le hace dudar"),
      area(persona, "searches", "Cómo lo busca en Google", "Una búsqueda por línea, con sus palabras."),
    ),
    h("h4", {}, "Objeciones y respuestas"),
    objections,
    h("button", { class: "small", onclick: () => store.update((p) => p.personas.find((x) => x.id === persona.id).objections.push({ q: "", a: "" })) }, "+ Objeción"),
  );
}

export function render(root) {
  const p = store.get();
  root.replaceChildren(
    h("div", { class: "section-head" },
      h("div", {},
        h("h2", {}, "Buyer personas"),
        h("p", { class: "lead" }, "Para quién se escribe el sitio. Las búsquedas de cada perfil deberían aparecer en la lista de keywords y tener una página que las responda."),
      ),
      h("button", { class: "primary", onclick: () => store.update((pr) => pr.personas.push(blank())) }, "+ Perfil"),
    ),
    p.personas.length
      ? h("div", { class: "cards" }, p.personas.map(card))
      : h("div", { class: "empty" }, "Sin perfiles todavía."),
  );
}
