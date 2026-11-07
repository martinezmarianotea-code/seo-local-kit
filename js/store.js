// Estado del proyecto. Se guarda en localStorage del navegador y se puede
// exportar/importar como JSON. No se envía nada a ningún servidor.

const STORAGE_KEY = "seo-local-kit:project";
export const SCHEMA_VERSION = 1;

export const uid = () => Math.random().toString(36).slice(2, 10);

export function emptyProject() {
  return {
    version: SCHEMA_VERSION,
    business: { type: "LocalBusiness", country: "MX", hours: {} },
    clusters: [],      // { id, name, terms: [] }
    pages: [],         // { id, url, title, clusterId }
    keywords: [],      // { id, keyword, clusterId, intent, pageId, priority, clicks, impressions, position }
    personas: [],      // { id, name, summary, goals, frustrations, searches, objections: [{q, a}] }
    queries: [],       // filas importadas de Search Console
    map: { positions: {} },
    updatedAt: null,
  };
}

function migrate(data) {
  const base = emptyProject();
  return {
    ...base,
    ...data,
    business: { ...base.business, ...(data.business || {}) },
    map: { ...base.map, ...(data.map || {}) },
    version: SCHEMA_VERSION,
  };
}

const listeners = new Set();
let project = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? migrate(JSON.parse(raw)) : emptyProject();
  } catch {
    return emptyProject();
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {
    /* almacenamiento lleno o bloqueado: el proyecto sigue en memoria */
  }
}

export const get = () => project;

export function update(mutator, { silent = false } = {}) {
  mutator(project);
  project.updatedAt = new Date().toISOString();
  persist();
  if (!silent) listeners.forEach((fn) => fn(project));
}

export function replace(data) {
  project = migrate(data);
  persist();
  listeners.forEach((fn) => fn(project));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function exportJson() {
  return JSON.stringify(project, null, 2);
}

export function importJson(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== "object" || !("business" in data)) {
    throw new Error("El archivo no es un proyecto de seo-local-kit.");
  }
  replace(data);
}

// Utilidades de búsqueda usadas por varias vistas.
export const clusterName = (p, id) => p.clusters.find((c) => c.id === id)?.name ?? "Sin clúster";
export const pageOf = (p, id) => p.pages.find((pg) => pg.id === id);
