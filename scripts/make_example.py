"""Genera el proyecto de ejemplo (negocio ficticio) y su CSV de Search Console simulado.

    python scripts/make_example.py
"""
import csv
import json
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "examples"
rng = random.Random(42)

# consulta, impresiones, posición media  (clics se derivan con una curva de CTR + ruido)
QUERIES = [
    ("cafe brujula", 1450, 1.2), ("café brújula menú", 610, 1.5), ("cafe brujula horario", 380, 1.4),
    ("cafeteria cerca de mi", 5200, 6.8), ("cafe de especialidad cerca de mi", 2300, 9.4),
    ("cafe de especialidad", 3100, 14.2), ("mejor cafe del centro", 1250, 7.9), ("cafeteria en el centro", 1900, 4.1),
    ("desayunos cerca de mi", 4400, 11.6), ("desayunos en el centro", 1700, 8.8), ("brunch domingo", 2100, 12.3),
    ("brunch cerca de mi", 1600, 16.5), ("chilaquiles cerca de mi", 900, 18.9), ("desayuno saludable", 1300, 24.0),
    ("cafe para trabajar con wifi", 980, 5.2), ("cafeteria con enchufes para trabajar", 420, 3.6), ("lugares para trabajar con laptop", 760, 13.4),
    ("pastel de chocolate por rebanada", 640, 9.9), ("pasteles para cumpleaños", 2800, 21.5), ("galletas artesanales", 530, 17.2),
    ("cafe en grano para llevar", 450, 6.1), ("comprar cafe de oaxaca en grano", 710, 15.8), ("metodos de cafe v60", 380, 28.0),
    ("cafeteria pet friendly", 690, 4.8), ("cafeteria con jardin", 820, 10.7), ("cafe para llevar", 1100, 19.4),
    ("latte de avena", 340, 8.3), ("matcha latte cerca de mi", 560, 7.4), ("chai latte", 900, 31.0),
    ("cafeteria abierta en la noche", 470, 12.9), ("cafe abierto domingo", 610, 6.6),
]
CTR = [0.30, 0.16, 0.10, 0.07, 0.05, 0.04, 0.03, 0.025, 0.02, 0.018]

def clicks(imp, pos):
    base = CTR[min(9, round(pos) - 1)] if pos < 10.5 else max(0.002, 0.012 - (pos - 10) * 0.0006)
    # Algunas consultas en top 10 con CTR bajo a propósito (título poco atractivo).
    if pos < 8 and rng.random() < 0.35:
        base *= 0.3
    return max(0, round(imp * base * rng.uniform(0.8, 1.2)))

rows = [(q, clicks(i, p), i, p) for q, i, p in QUERIES]
rows.sort(key=lambda r: -r[1])

OUT.mkdir(exist_ok=True)
with open(OUT / "consultas-ejemplo.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["Consultas principales", "Clics", "Impresiones", "CTR", "Posición"])
    for q, c, i, p in rows:
        w.writerow([q, c, i, f"{c / i * 100:.2f}%", f"{p:.2f}"])

def kid(n): return f"k{n:02d}"

clusters = [
    {"id": "c-cafe", "name": "Café de especialidad", "terms": ["cafe de especialidad", "grano", "v60", "latte", "matcha", "chai", "mejor cafe"]},
    {"id": "c-desayuno", "name": "Desayunos y brunch", "terms": ["desayuno", "brunch", "chilaquiles"]},
    {"id": "c-trabajo", "name": "Trabajar en un café", "terms": ["trabajar", "wifi", "laptop", "enchufes"]},
    {"id": "c-reposteria", "name": "Repostería", "terms": ["pastel", "galletas"]},
    {"id": "c-marca", "name": "Marca y visita", "terms": ["brujula", "brújula", "horario", "abierto", "cerca de mi", "centro", "jardin", "pet friendly"]},
]
pages = [
    {"id": "p-home", "url": "/", "title": "Café Brújula | Café de especialidad y brunch en el centro", "clusterId": "c-marca"},
    {"id": "p-menu", "url": "/menu", "title": "Menú: desayunos, brunch y café de especialidad", "clusterId": "c-desayuno"},
    {"id": "p-cafe", "url": "/cafe-de-especialidad", "title": "Nuestro café: orígenes de Oaxaca y métodos de preparación", "clusterId": "c-cafe"},
    {"id": "p-trabajo", "url": "/trabajar-en-cafe", "title": "Un café para trabajar: wifi, enchufes y horario", "clusterId": "c-trabajo"},
    {"id": "p-pasteles", "url": "/pasteles", "title": "Pasteles por pedido y repostería artesanal", "clusterId": "c-reposteria"},
    {"id": "p-tienda", "url": "/tienda/cafe-en-grano", "title": "", "clusterId": "c-cafe"},
]
assign = {
    "cafe brujula": ("p-home", "navegacional", "alta"), "café brújula menú": ("p-menu", "navegacional", "media"),
    "cafeteria cerca de mi": ("p-home", "local", "alta"), "cafe de especialidad cerca de mi": ("p-cafe", "local", "alta"),
    "cafe de especialidad": ("p-cafe", "informacional", "media"), "desayunos cerca de mi": ("p-menu", "local", "alta"),
    "brunch domingo": ("p-menu", "local", "alta"), "brunch cerca de mi": (None, "local", "alta"),
    "cafe para trabajar con wifi": ("p-trabajo", "local", "media"), "lugares para trabajar con laptop": ("p-trabajo", "informacional", "media"),
    "pasteles para cumpleaños": ("p-pasteles", "transaccional", "alta"), "pastel de chocolate por rebanada": ("p-pasteles", "transaccional", "baja"),
    "comprar cafe de oaxaca en grano": ("p-tienda", "transaccional", "media"), "cafeteria con jardin": (None, "local", "media"),
    "cafeteria pet friendly": (None, "local", "baja"), "metodos de cafe v60": (None, "informacional", "baja"),
}
by_q = {r[0]: r for r in rows}
def cluster_for(q):
    for c in clusters:
        if any(t in q for t in c["terms"]):
            return c["id"]
    return None
keywords = []
for n, (q, (page, intent, prio)) in enumerate(assign.items(), 1):
    _, c, i, p = by_q[q]
    keywords.append({"id": kid(n), "keyword": q, "clusterId": cluster_for(q), "intent": intent, "pageId": page,
                     "priority": prio, "clicks": c, "impressions": i, "position": p})

queries = [{"query": q, "clicks": c, "impressions": i, "ctr": c / i, "position": p} for q, c, i, p in rows]

project = {
    "version": 1,
    "business": {
        "type": "CafeOrCoffeeShop", "name": "Café Brújula",
        "description": "Cafetería de especialidad con café de Oaxaca tostado en casa, desayunos y brunch. (Negocio ficticio de ejemplo.)",
        "url": "https://example.com", "phone": "+52 000 000 0000", "email": "hola@example.com",
        "image": "https://example.com/fachada.jpg", "priceRange": "$$",
        "street": "Av. Ejemplo 123, Centro", "city": "Ciudad Ejemplo", "region": "Estado", "postalCode": "00000", "country": "MX",
        "latitude": "19.4326", "longitude": "-99.1332",
        "areaServed": "Centro, Barrio Norte, Colonia Jardines",
        "cuisine": "Café, Desayunos, Repostería", "menu": "https://example.com/menu", "reservations": False,
        "sameAs": "https://www.instagram.com/example\nhttps://www.facebook.com/example",
        "hours": {d: {"opens": "08:00", "closes": "21:00"} for d in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]}
                 | {"Saturday": {"opens": "09:00", "closes": "22:00"}, "Sunday": {"opens": "09:00", "closes": "15:00"}},
    },
    "clusters": clusters, "pages": pages, "keywords": keywords, "queries": queries,
    "personas": [
        {"id": "pe1", "name": "Trabajadora remota", "summary": "28–35 años, diseñadora freelance. Trabaja desde cafés tres días por semana.",
         "goals": "Un lugar tranquilo con wifi estable, enchufes y buen café para pasar la mañana.",
         "frustrations": "Llegar y que no haya mesas con enchufe, o que la señal falle en una videollamada.",
         "searches": "cafe para trabajar con wifi\ncafeteria con enchufes para trabajar\ncafe abierto temprano",
         "objections": [{"q": "¿Me van a apurar si me quedo varias horas?", "a": "La página /trabajar-en-cafe explica la política de mesas y los horarios tranquilos."},
                        {"q": "¿El wifi aguanta videollamadas?", "a": "Publicar la velocidad medida y una foto del área de trabajo."}]},
        {"id": "pe2", "name": "Familia de fin de semana", "summary": "Pareja con dos hijos que sale a desayunar el domingo.",
         "goals": "Desayuno abundante, espacio para niños y que no haya que esperar mucho.",
         "frustrations": "Filas largas sin saber el tiempo de espera; menús sin precios en línea.",
         "searches": "brunch domingo\ndesayunos cerca de mi\ncafeteria con jardin",
         "objections": [{"q": "¿Hay que reservar?", "a": "Indicar en el menú y en Google Business cómo funciona la lista de espera."}]},
    ],
    "map": {"positions": {}},
    "updatedAt": None,
}
(OUT / "cafeteria-ejemplo.json").write_text(json.dumps(project, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("ok", len(rows), "consultas,", len(keywords), "keywords")
