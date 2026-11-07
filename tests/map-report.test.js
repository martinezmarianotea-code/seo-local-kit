import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildGraph, layoutRadial, mapSvgString } from "../js/mapmodel.js";
import { buildHtml, buildMarkdown } from "../js/report.js";

const example = JSON.parse(readFileSync(new URL("../examples/cafeteria-ejemplo.json", import.meta.url), "utf8"));

test("el grafo cuelga keywords de su página, o de su clúster con línea punteada", () => {
  const g = buildGraph(example);
  const withPage = example.keywords.find((k) => k.pageId);
  const without = example.keywords.find((k) => !k.pageId && k.clusterId);
  assert.equal(g.nodes.find((n) => n.id === `k:${withPage.id}`).parent, `p:${withPage.pageId}`);
  assert.equal(g.edges.find((e) => e.to === `k:${without.id}`).kind, "dashed");
});

test("el acomodo radial da posición a todos los nodos", () => {
  const g = buildGraph(example);
  const pos = layoutRadial(g);
  assert.equal(Object.keys(pos).length, g.nodes.length);
  assert.ok(Object.values(pos).every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
});

test("el SVG escapa el texto", () => {
  const svg = mapSvgString({ ...example, business: { name: "A & <B>" }, map: {} });
  assert.match(svg, /A &amp; &lt;B&gt;/);
});

test("el informe incluye todas las secciones", () => {
  const html = buildHtml(example);
  for (const t of ["Ficha del negocio", "Situación en Google", "Arquitectura de contenidos", "Buyer personas", "application/ld+json", "<svg"]) {
    assert.ok(html.includes(t), t);
  }
  assert.match(buildMarkdown(example), /^# Estrategia SEO local — Café Brújula/);
});
