import { test } from "node:test";
import assert from "node:assert/strict";
import { buildJsonLd, missingFields } from "../js/schema.js";

const business = {
  type: "Restaurant", name: " Fonda Ejemplo ", phone: "+52 000", street: "Calle 1", city: "Ciudad",
  latitude: "16.5", longitude: "-95.1", cuisine: "Mexicana, Oaxaqueña", sameAs: "https://a.example\nhttps://b.example",
  hours: {
    Monday: { opens: "09:00", closes: "18:00" }, Tuesday: { opens: "09:00", closes: "18:00" },
    Saturday: { opens: "10:00", closes: "14:00" }, Sunday: { closed: true, opens: "10:00", closes: "14:00" },
  },
};

test("genera el JSON-LD con dirección, geo y cocina", () => {
  const d = buildJsonLd(business);
  assert.equal(d["@type"], "Restaurant");
  assert.equal(d.name, "Fonda Ejemplo");
  assert.deepEqual(d.geo, { "@type": "GeoCoordinates", latitude: 16.5, longitude: -95.1 });
  assert.deepEqual(d.servesCuisine, ["Mexicana", "Oaxaqueña"]);
  assert.deepEqual(d.sameAs, ["https://a.example", "https://b.example"]);
  assert.equal(d.address.addressLocality, "Ciudad");
});

test("agrupa días con el mismo horario y omite los cerrados", () => {
  const spec = buildJsonLd(business).openingHoursSpecification;
  assert.deepEqual(spec.map((s) => s.dayOfWeek), [["Monday", "Tuesday"], ["Saturday"]]);
});

test("no publica campos vacíos", () => {
  const d = buildJsonLd({ type: "Dentist", name: "X", street: "", url: "  " });
  assert.deepEqual(Object.keys(d).sort(), ["@context", "@type", "name"]);
});

test("los campos de comida solo aplican a negocios de comida", () => {
  assert.equal(buildJsonLd({ type: "Dentist", name: "X", cuisine: "Mexicana" }).servesCuisine, undefined);
});

test("lista los datos recomendados que faltan", () => {
  assert.deepEqual(missingFields({ name: "X" }), ["Dirección", "Ciudad", "Teléfono", "Sitio web", "Imagen", "Horario", "Coordenadas"]);
  assert.ok(!missingFields(business).includes("Horario"));
});
