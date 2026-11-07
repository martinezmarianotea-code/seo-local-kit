// Genera el marcado schema.org (JSON-LD) de un negocio local a partir de su ficha.

export const BUSINESS_TYPES = [
  ["LocalBusiness", "Negocio local (genérico)"],
  ["Restaurant", "Restaurante"],
  ["CafeOrCoffeeShop", "Cafetería"],
  ["Bakery", "Panadería"],
  ["BarOrPub", "Bar"],
  ["Store", "Tienda"],
  ["BeautySalon", "Salón de belleza"],
  ["Dentist", "Dentista"],
  ["MedicalClinic", "Clínica"],
  ["AutoRepair", "Taller mecánico"],
  ["LodgingBusiness", "Hotel / hospedaje"],
  ["ProfessionalService", "Servicio profesional"],
];

const FOOD_TYPES = new Set(["Restaurant", "CafeOrCoffeeShop", "Bakery", "BarOrPub"]);

export const DAYS = [
  ["Monday", "Lunes"],
  ["Tuesday", "Martes"],
  ["Wednesday", "Miércoles"],
  ["Thursday", "Jueves"],
  ["Friday", "Viernes"],
  ["Saturday", "Sábado"],
  ["Sunday", "Domingo"],
];

const clean = (v) => (typeof v === "string" ? v.trim() : v);

function compact(obj) {
  // Quita campos vacíos para no publicar propiedades sin valor.
  if (Array.isArray(obj)) {
    const arr = obj.map(compact).filter((v) => v !== undefined);
    return arr.length ? arr : undefined;
  }
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const c = compact(clean(v));
      if (c !== undefined && c !== "") out[k] = c;
    }
    const keys = Object.keys(out).filter((k) => k !== "@type");
    return keys.length ? out : undefined;
  }
  return obj === "" || obj == null ? undefined : obj;
}

function openingHours(hours = {}) {
  // Agrupa días con el mismo horario en una sola especificación.
  const groups = new Map();
  for (const [day] of DAYS) {
    const h = hours[day];
    if (!h || h.closed || !h.opens || !h.closes) continue;
    const key = `${h.opens}-${h.closes}`;
    if (!groups.has(key)) groups.set(key, { opens: h.opens, closes: h.closes, days: [] });
    groups.get(key).days.push(day);
  }
  return [...groups.values()].map((g) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: g.days,
    opens: g.opens,
    closes: g.closes,
  }));
}

export function buildJsonLd(business) {
  const b = business ?? {};
  const type = b.type || "LocalBusiness";
  const lat = Number.parseFloat(b.latitude);
  const lng = Number.parseFloat(b.longitude);

  const data = {
    "@context": "https://schema.org",
    "@type": type,
    name: b.name,
    description: b.description,
    url: b.url,
    telephone: b.phone,
    email: b.email,
    image: b.image,
    logo: b.logo,
    priceRange: b.priceRange,
    address: {
      "@type": "PostalAddress",
      streetAddress: b.street,
      addressLocality: b.city,
      addressRegion: b.region,
      postalCode: b.postalCode,
      addressCountry: b.country,
    },
    geo: Number.isFinite(lat) && Number.isFinite(lng)
      ? { "@type": "GeoCoordinates", latitude: lat, longitude: lng }
      : undefined,
    openingHoursSpecification: openingHours(b.hours),
    areaServed: (b.areaServed || "").split(",").map((s) => s.trim()).filter(Boolean),
    sameAs: (b.sameAs || "").split(/\s+/).map((s) => s.trim()).filter(Boolean),
  };
  if (FOOD_TYPES.has(type)) {
    data.servesCuisine = (b.cuisine || "").split(",").map((s) => s.trim()).filter(Boolean);
    data.menu = b.menu;
    data.acceptsReservations = b.reservations ? "True" : undefined;
  }
  return compact(data) ?? { "@context": "https://schema.org", "@type": type };
}

/** Campos que Google recomienda para negocios locales y que faltan en la ficha. */
export function missingFields(business) {
  const b = business ?? {};
  const checks = [
    ["name", "Nombre"],
    ["street", "Dirección"],
    ["city", "Ciudad"],
    ["phone", "Teléfono"],
    ["url", "Sitio web"],
    ["image", "Imagen"],
  ];
  const missing = checks.filter(([k]) => !clean(b[k])).map(([, label]) => label);
  if (!openingHours(b.hours).length) missing.push("Horario");
  if (!(Number.isFinite(Number.parseFloat(b.latitude)) && Number.isFinite(Number.parseFloat(b.longitude)))) {
    missing.push("Coordenadas");
  }
  return missing;
}

export function jsonLdScript(business) {
  return `<script type="application/ld+json">\n${JSON.stringify(buildJsonLd(business), null, 2)}\n</script>`;
}
