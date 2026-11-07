import { test } from "node:test";
import assert from "node:assert/strict";
import { detectDelimiter, parseCsv, toCsv } from "../js/csv.js";

test("lee campos con comillas, comas y saltos de línea", () => {
  const rows = parseCsv('a,b\n"hola, mundo","dijo ""sí""\nok"\n');
  assert.deepEqual(rows, [["a", "b"], ["hola, mundo", 'dijo "sí"\nok']]);
});

test("ignora BOM y líneas vacías, acepta CRLF", () => {
  assert.deepEqual(parseCsv("﻿x,y\r\n\r\n1,2\r\n"), [["x", "y"], ["1", "2"]]);
});

test("detecta punto y coma como separador", () => {
  assert.equal(detectDelimiter("a;b;c\n1;2;3"), ";");
});

test("ida y vuelta", () => {
  const rows = [["k", "v"], ["con, coma", 'con "comillas"']];
  assert.deepEqual(parseCsv(toCsv(rows)), rows);
});
