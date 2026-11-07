// Análisis del archivo "Consultas" que exporta Google Search Console
// (Rendimiento → Exportar → CSV). Acepta encabezados en español o inglés.

import { parseCsv } from "./csv.js";

const HEADERS = {
  query: ["consultas principales", "consulta", "top queries", "query", "queries"],
  clicks: ["clics", "clicks"],
  impressions: ["impresiones", "impressions"],
  ctr: ["ctr"],
  position: ["posición", "posicion", "position", "average position", "posición media"],
};

// CTR orgánico aproximado por posición (1–10). Es una referencia gruesa
// basada en estudios públicos de CTR; sirve para detectar resultados que
// reciben muchos menos clics de lo esperable para su lugar.
export const EXPECTED_CTR = [0.28, 0.15, 0.1, 0.07, 0.05, 0.04, 0.03, 0.025, 0.02, 0.018];

const norm = (s) => s.trim().toLowerCase();

function number(value) {
  if (value == null) return 0;
  let s = String(value).trim().replace("%", "");
  // "1.234,5" (es) → "1234.5"; "1,234.5" (en) → "1234.5"
  if (/,\d{1,2}$/.test(s) && !/\.\d+,/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function parseQueries(text) {
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new Error("El archivo está vacío.");

  const index = {};
  for (const [key, names] of Object.entries(HEADERS)) {
    index[key] = header.findIndex((h) => names.includes(norm(h)));
  }
  if (index.query < 0 || index.impressions < 0) {
    throw new Error("No parece un CSV de consultas de Search Console (faltan las columnas de consulta o impresiones).");
  }

  return rows
    .filter((r) => r[index.query])
    .map((r) => {
      const clicks = number(r[index.clicks]);
      const impressions = number(r[index.impressions]);
      const rawCtr = index.ctr >= 0 ? number(r[index.ctr]) : NaN;
      return {
        query: r[index.query].trim(),
        clicks,
        impressions,
        // El CSV trae el CTR como porcentaje ("3.2%"); si falta, se calcula.
        ctr: Number.isFinite(rawCtr) && index.ctr >= 0 ? rawCtr / 100 : impressions ? clicks / impressions : 0,
        position: index.position >= 0 ? number(r[index.position]) : 0,
      };
    });
}

/**
 * Clasifica cada consulta en oportunidades accionables.
 *  - "pagina-2": posición 8–20 con impresiones suficientes; está cerca de la primera página.
 *  - "ctr-bajo": ya está en el top 10 pero recibe menos de la mitad del CTR esperado.
 */
export function findOpportunities(queries, { minImpressions = 50 } = {}) {
  const out = [];
  for (const q of queries) {
    if (q.impressions < minImpressions) continue;
    if (q.position >= 8 && q.position <= 20) {
      out.push({
        ...q,
        type: "pagina-2",
        action: "Ampliar el contenido de la página y enlazarla desde otras páginas del sitio.",
        potential: Math.round(q.impressions * EXPECTED_CTR[4]) - q.clicks,
      });
    } else if (q.position >= 1 && q.position < 8) {
      const expected = EXPECTED_CTR[Math.min(9, Math.round(q.position) - 1)];
      if (q.ctr < expected * 0.5) {
        out.push({
          ...q,
          type: "ctr-bajo",
          action: "Reescribir el título y la meta descripción para que respondan a esta búsqueda.",
          potential: Math.round(q.impressions * expected) - q.clicks,
        });
      }
    }
  }
  return out.sort((a, b) => b.potential - a.potential);
}

/** Asigna cada consulta al primer clúster cuyo término aparece en ella. */
export function assignCluster(query, clusters) {
  const q = norm(query);
  for (const cluster of clusters) {
    if (cluster.terms.some((t) => t && q.includes(norm(t)))) return cluster.id;
  }
  return null;
}

export function summarize(queries) {
  const clicks = queries.reduce((s, q) => s + q.clicks, 0);
  const impressions = queries.reduce((s, q) => s + q.impressions, 0);
  const weightedPos = queries.reduce((s, q) => s + q.position * q.impressions, 0);
  return {
    queries: queries.length,
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: impressions ? weightedPos / impressions : 0,
  };
}
