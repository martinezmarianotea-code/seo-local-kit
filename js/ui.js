// Ayudas pequeñas para construir DOM sin frameworks.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "value") el.value = v;
    else if (k === "checked") el.checked = !!v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export const fmt = {
  int: (n) => Math.round(n || 0).toLocaleString("es-MX"),
  pct: (n) => `${((n || 0) * 100).toFixed(1)} %`,
  pos: (n) => (n ? n.toFixed(1) : "—"),
};

export function download(filename, content, type = "text/plain") {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = h("input", { type: "file", accept });
    input.addEventListener("change", () => resolve(input.files[0] ?? null));
    input.click();
  });
}

let toastTimer;
export function toast(message, kind = "info") {
  let el = document.getElementById("toast");
  if (!el) {
    el = h("div", { id: "toast", role: "status" });
    document.body.append(el);
  }
  el.textContent = message;
  el.dataset.kind = kind;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copiado al portapapeles.");
  } catch {
    toast("No se pudo copiar; selecciona el texto manualmente.", "error");
  }
}

/** Campo de formulario con etiqueta que escribe en obj[key] al cambiar. */
export function field(label, obj, key, { type = "text", placeholder, options, onInput, hint, wide } = {}) {
  const id = `f-${key}-${Math.random().toString(36).slice(2, 7)}`;
  let input;
  const handler = (e) => onInput?.(key, type === "checkbox" ? e.target.checked : e.target.value);
  if (options) {
    input = h("select", { id, onchange: handler }, options.map(([v, l]) => h("option", { value: v }, l)));
    input.value = obj[key] ?? options[0][0];
  } else if (type === "textarea") {
    input = h("textarea", { id, rows: 3, placeholder, oninput: handler }, obj[key] ?? "");
  } else if (type === "checkbox") {
    return h("label", { class: "check" }, h("input", { type: "checkbox", checked: obj[key], onchange: handler }), label);
  } else {
    input = h("input", { id, type, placeholder, value: obj[key] ?? "", oninput: handler });
  }
  return h("div", { class: `field${wide ? " wide" : ""}` }, h("label", { for: id }, label), input, hint && h("small", {}, hint));
}
