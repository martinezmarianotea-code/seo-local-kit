import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assignCluster, findOpportunities, parseQueries, summarize } from "../js/gsc.js";

const ES = "Consultas principales,Clics,Impresiones,CTR,Posición\ncafe centro,10,1000,1%,4.2\nbrunch,5,800,0.63%,12.5\n";
const EN = "Top queries,Clicks,Impressions,CTR,Position\ncoffee,1,30,3.33%,2.1\n";

test("lee encabezados en español", () => {
  const [q] = parseQueries(ES);
  assert.deepEqual(q, { query: "cafe centro", clicks: 10, impressions: 1000, ctr: 0.01, position: 4.2 });
});

test("lee encabezados en inglés", () => {
  assert.equal(parseQueries(EN)[0].query, "coffee");
});

test("acepta decimales con coma y separador punto y coma", () => {
  const [q] = parseQueries("Consulta;Clics;Impresiones;CTR;Posición\npan;2;100;2,5%;8,4\n");
  assert.equal(q.position, 8.4);
  assert.equal(q.ctr, 0.025);
});

test("rechaza un CSV que no es de consultas", () => {
  assert.throws(() => parseQueries("Página,Clics\n/,3\n"), /Search Console/);
});

test("detecta oportunidades de página 2 y de CTR bajo", () => {
  const opps = findOpportunities(parseQueries(ES));
  assert.deepEqual(opps.map((o) => [o.query, o.type]).sort(), [["brunch", "pagina-2"], ["cafe centro", "ctr-bajo"]]);
  assert.ok(opps.every((o) => o.potential > 0));
});

test("ignora consultas con pocas impresiones", () => {
  assert.equal(findOpportunities(parseQueries(EN)).length, 0);
});

test("asigna clúster por término", () => {
  const clusters = [{ id: "a", terms: ["desayuno"] }, { id: "b", terms: ["Brunch"] }];
  assert.equal(assignCluster("brunch domingo", clusters), "b");
  assert.equal(assignCluster("tacos", clusters), null);
});

test("resumen con posición ponderada por impresiones", () => {
  const s = summarize(parseQueries(ES));
  assert.equal(s.clicks, 15);
  assert.equal(s.impressions, 1800);
  assert.ok(Math.abs(s.position - (4.2 * 1000 + 12.5 * 800) / 1800) < 1e-9);
});

test("el CSV de ejemplo se procesa completo", () => {
  const text = readFileSync(new URL("../examples/consultas-ejemplo.csv", import.meta.url), "utf8");
  const queries = parseQueries(text);
  assert.equal(queries.length, 31);
  assert.ok(findOpportunities(queries).length >= 5);
});
