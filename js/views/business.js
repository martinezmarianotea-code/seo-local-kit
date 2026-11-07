import * as store from "../store.js";
import { BUSINESS_TYPES, DAYS, jsonLdScript, missingFields } from "../schema.js";
import { copy, field, h } from "../ui.js";

export function render(root) {
  const p = store.get();
  const b = p.business;

  const preview = h("pre", { class: "code" });
  const missing = h("p", { class: "status" });

  function refresh() {
    preview.textContent = jsonLdScript(store.get().business);
    const m = missingFields(store.get().business);
    missing.className = `status ${m.length ? "warn" : "ok"}`;
    missing.textContent = m.length
      ? `Faltan datos recomendados por Google: ${m.join(", ")}.`
      : "La ficha tiene todos los datos recomendados.";
  }

  const set = (key, value) => {
    store.update((proj) => { proj.business[key] = value; }, { silent: true });
    refresh();
  };
  const f = (label, key, opts = {}) => field(label, b, key, { ...opts, onInput: set });

  const setHour = (day, key, value) => {
    store.update((proj) => {
      proj.business.hours[day] = { ...(proj.business.hours[day] || {}), [key]: value };
    }, { silent: true });
    refresh();
  };

  const hours = h("table", { class: "hours" },
    h("tbody", {}, DAYS.map(([day, label]) => {
      const v = b.hours?.[day] || {};
      return h("tr", {},
        h("th", { scope: "row" }, label),
        h("td", {}, h("input", { type: "time", value: v.opens || "", "aria-label": `${label} abre`, oninput: (e) => setHour(day, "opens", e.target.value) })),
        h("td", {}, h("input", { type: "time", value: v.closes || "", "aria-label": `${label} cierra`, oninput: (e) => setHour(day, "closes", e.target.value) })),
        h("td", {}, h("label", { class: "check" },
          h("input", { type: "checkbox", checked: v.closed, onchange: (e) => setHour(day, "closed", e.target.checked) }), "Cerrado")),
      );
    })),
  );

  root.replaceChildren(
    h("div", { class: "split" },
      h("section", {},
        h("h2", {}, "Ficha del negocio"),
        h("p", { class: "lead" }, "Estos datos alimentan el marcado schema.org y deben coincidir exactamente con tu perfil de Google Business y tus redes (nombre, dirección y teléfono)."),
        h("div", { class: "grid" },
          f("Nombre", "name", { wide: true }),
          f("Tipo de negocio", "type", { options: BUSINESS_TYPES }),
          f("Rango de precios", "priceRange", { placeholder: "$$" }),
          f("Descripción", "description", { type: "textarea", wide: true }),
          f("Sitio web", "url", { type: "url", placeholder: "https://" }),
          f("Teléfono", "phone", { type: "tel", placeholder: "+52 ..." }),
          f("Correo", "email", { type: "email" }),
          f("Imagen principal (URL)", "image", { type: "url" }),
        ),
        h("h3", {}, "Ubicación"),
        h("div", { class: "grid" },
          f("Calle y número", "street", { wide: true }),
          f("Ciudad", "city"),
          f("Estado / región", "region"),
          f("Código postal", "postalCode"),
          f("País (código)", "country", { placeholder: "MX" }),
          f("Latitud", "latitude", { placeholder: "16.4321" }),
          f("Longitud", "longitude", { placeholder: "-95.0198" }),
          f("Zonas que atiende", "areaServed", { wide: true, hint: "Separadas por comas: colonias, municipios o regiones." }),
        ),
        h("h3", {}, "Horario"),
        hours,
        h("h3", {}, "Extras"),
        h("div", { class: "grid" },
          f("Cocina / especialidad", "cuisine", { hint: "Solo para restaurantes, cafeterías y bares. Separadas por comas." }),
          f("Menú (URL)", "menu", { type: "url" }),
          f("Perfiles en redes", "sameAs", { type: "textarea", wide: true, hint: "Una URL por línea: Facebook, Instagram, Google Maps…" }),
          f("Acepta reservaciones", "reservations", { type: "checkbox" }),
        ),
      ),
      h("aside", { class: "sticky" },
        h("h2", {}, "Schema JSON-LD"),
        missing,
        preview,
        h("div", { class: "row" },
          h("button", { class: "primary", onclick: () => copy(jsonLdScript(store.get().business)) }, "Copiar código"),
          h("a", { href: "https://search.google.com/test/rich-results", target: "_blank", rel: "noreferrer" }, "Probar en Google ↗"),
        ),
        h("p", { class: "hint" }, "Pega el código dentro del <head> de la página principal del sitio."),
      ),
    ),
  );
  refresh();
}
