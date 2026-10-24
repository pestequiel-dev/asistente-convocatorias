# Convocatorias · Mehmiro

Panel local para gestionar convocatorias, aceleradoras y premios. Pegás un link (y opcionalmente el texto del
posteo de LinkedIn/Instagram) y el sistema:

1. rastrea el sitio con un navegador real,
2. encuentra las **bases y condiciones**, los requisitos y el **formulario**,
3. extrae todo con **citas textuales y URLs**,
4. compara los requisitos contra el perfil de Mehmiro,
5. detecta la **fecha de cierre** y muestra el panel.

---

## Arrancar

```bash
npm install
npm run dev
```

Abrí **http://localhost:3100**.

`npm run dev` levanta dos procesos: la web (Next.js) y el worker que procesa la cola de análisis.

### Conectar DeepSeek (recomendado)

Sin API key la app funciona igual, pero con un **modo heurístico** (regex + reglas): mucho menos preciso.

1. Creá una key en https://platform.deepseek.com/api_keys
2. Andá a **Ajustes** en la app y pegala. Queda guardada solo en `data/app.db`.

Costo aproximado: **US$ 0,01–0,05 por convocatoria** (depende de cuántas páginas y PDFs tenga el sitio).

También podés usar variables de entorno: copiá `.env.example` a `.env.local`.

### Navegador

El rastreo usa Playwright. Si no hay Chromium descargado, la app detecta automáticamente
**Brave / Chrome / Edge** instalados en macOS. Si preferís el Chromium de Playwright:

```bash
npx playwright install chromium
```

---

## Cómo funciona

```
POST /api/programs (url + texto)
        │
        ├─ resolveStartUrl()   si el link es de LinkedIn/Instagram, busca el link real dentro del texto pegado
        │
        ├─ classify()          preview por HTTP (sin navegador) + LLM → convocatoria | evento | competidor | referencia
        │                      de acá sale cuánto se rastrea: 24 páginas, 6, 6 o 2
        │
        ├─ crawlSite()         BFS con scoring de links, Chromium headless, PDFs vía unpdf
        │                      guarda cada página en `sources` (hash + texto) como evidencia
        │
        ├─ extract()           DeepSeek con response_format=json_object → schema fijo
        │                      fallback: extractHeuristic()
        │                      validateCitations() baja la confianza si una cita no existe en la fuente
        │
        ├─ matchWithLlm()      criterio por criterio contra el perfil → cumple / no_cumple / falta_dato / ambiguo
        │  └ matchHeuristic()  reglas por categoría si no hay LLM
        │
        └─ computeScore()      score 0–100 + veredicto global
```

### Rechazo temprano

Antes de crear cualquier registro se hace un chequeo barato (preview HTTP + clasificación). El clasificador
devuelve dos cosas distintas: el **tipo** (convocatoria / evento / competidor / referencia) y la **relevancia**
para el negocio.

Si el link **no es relevante**, se devuelve `422` con el motivo y no se crea nada ni se rastrea. Ser
“referencia” no alcanza para rechazarlo: la home de un fondo de inversión, una nota sobre edtech o el perfil de
un docente son contexto útil y se guardan. Lo que se descarta es una industria ajena (bebidas, retail, deportes).

El modal ofrece “Guardar igual” para forzar el alta (manda `force: true`), y el ingreso manual desde
“Analizar link” tiene el mismo botón.

### Triage: no todo es una convocatoria

`lib/classify.ts` decide **antes** del rastreo profundo, con un preview HTTP + el texto pegado. El costo del
crawl es lo caro; la clasificación son centavos.

| Tipo | Qué se extrae | Qué pregunta responde |
|---|---|---|
| **convocatoria** | bases, criterios, formulario, cierre | ¿somos elegibles? |
| **evento** | fecha, sede, costo, audiencia, call for speakers, stands | ¿vale la pena ir o exponer? |
| **competidor** | posicionamiento, precios, funcionalidades, fortalezas/debilidades | ¿qué hacen y cuánto cobran? |
| **referencia** | título + resumen | se archiva, no se analiza |

Lo clasificado entra a la **bandeja de entrada** y no aparece en el panel hasta que confirmás el tipo. Si
cambiás el tipo, se vuelve a analizar con ese tipo forzado (`?kind=`), porque el primer análisis se hizo con el
ruteo equivocado.

**Eventos**: además de los datos, se calcula una `relevance_score` (audiencia escolar, call for speakers,
stands, virtualidad, país) para priorizar.

**Competidores**: cada página se guarda con hash. Al re-analizar se calcula un diff de líneas contra el
snapshot anterior y se guarda en `diff_summary` — sirve para detectar cambios de precio o funcionalidades.
El corte es determinístico (sin LLM), así que no cuesta nada.

### Por qué cada dato tiene cita

Un panel de gestión solo sirve si confiás en él. Por eso:

- cada criterio guarda `quote` (texto literal) y `source_url`;
- si la cita no aparece en el texto de la fuente, se descarta y baja la confianza;
- la ficha muestra siempre el texto original de la fecha de cierre;
- la pestaña de evidencia lista todas las páginas leídas.

### Elegibilidad

Los criterios se clasifican en: `geografia`, `legal`, `etapa`, `sector`, `ingresos`, `equipo`, `producto`,
`idioma`, `otro`.

Veredictos: `cumple` (1), `falta_dato` (0,5), `ambiguo` (0,5), `no_cumple` (0). El veredicto global es
`no elegible` si hay algún `no_cumple`, `faltan datos` si hay campos sin cubrir, y `elegible` si todo cumple.

### Accesibilidad visual

La app está pensada para lectura con baja visión:

- **Sin bold en ningún lado**: el peso máximo es 500 (títulos, badges, botones). No hay 600/700.
- **Tamaño global** con un control en la barra lateral: **A** (×1.10 → 16 px de cuerpo), **A+** (×1.25, por
  defecto → 18 px) y **A++** (×1.45 → 21 px). Se aplica a toda la app, se guarda en `localStorage` y se aplica
  antes del primer pintado (sin flash).
- Ningún texto queda por debajo de **16 px** en el ajuste máximo.
- Todo el escalado usa `calc(Npx * var(--fs))`, así que también crecen tablas, badges, formularios y la ficha.
- **Foco de teclado visible** de 3 px, `prefers-reduced-motion` respetado y contraste AA.
- La información nunca depende solo del color: siempre hay texto (“Cierra en 7 días”, “Ya pasó”, “Falta dato”).

### Línea de tiempo

El Panel (`/`) es solo la línea de tiempo, agrupada por mes:

- meses en **37 px** en el ajuste por defecto (sin bold);
- los meses futuros van primero en orden cronológico; los pasados al final con la etiqueta “ya pasó”;
- lo que no tiene fecha se agrupa al final en “Sin fecha”;
- ocupa la pantalla completa y **solo scrollea el contenedor interno**, con encabezados de mes sticky.

## Análisis en lote (400+ links)

La cola vive en SQLite, así que **sobrevive reinicios**: podés cargar 400 links, cerrar la laptop y al volver
sigue donde quedó.

- **Cargar**: `/cola` → pegás los links (uno por línea o separados por coma). Se descartan duplicados y los que
  ya están en el panel. No se clasifica al encolar: cada link se evalúa cuando le toca.
- **Concurrencia**: 1 a 4 análisis en paralelo. Cada uno abre su propio Chromium (~250 MB). Empezá con 2.
- **Pausa**: los análisis en curso terminan y no se toma ninguno nuevo. Reanudar es instantáneo.
- **Progreso**: pendientes, procesando, listas, descartadas, errores, promedio por link y ETA calculada con los
  últimos 20.
- **Descarte automático**: si la clasificación dice que el link no tiene que ver con el negocio, se marca
  `rejected` **sin rastrear una sola página** (2 segundos en vez de 2 minutos).
- **Recuperación**: si el proceso muere a mitad de un análisis, el worker lo reencola solo a los 8 minutos.

Tiempo estimado para 400 links con 2 en paralelo y ~2 min por link: **~6,5 horas**. Con 3: ~4,5 horas.

## Mensajeros (CRM de aliados)

`/mensajeros` es una base de contactos de gente con reputación que puede hablar de Mehmiro: docentes
referentes, directores, creadores de contenido, periodistas educativos.

Cada contacto guarda rol, organización, plataforma, audiencia, alcance, temas, **cuánto cobra** y estado
(`nuevo → contactado → interesado → negociando → acuerdo → publicó / descartado`). Cada interacción se registra
en un historial con canal, tipo, resumen, costo y fecha; eso alimenta el “último contacto” y el total invertido.

**¿A quién le mando esto?** Pegás un brief y DeepSeek elige los 5 contactos con mejor encaje, explica por qué y
redacta un primer mensaje personalizado. Devuelve además **costo estimado, alcance y CPM** (costo por mil
alcances). Sin API key cae a un ranking por coincidencia de palabras.

### Resend o ERP: ninguna de las dos

- **ERP no**: un ERP gestiona inventario, finanzas y RRHH; no relaciones. Sería sobre-ingeniería.
- **Resend no es un CRM**: es una API de envío de email (transaccional y broadcasts). No tiene estados,
  pipeline, notas ni historial por contacto. Sirve como **canal**, no como sistema de registro.
- Lo correcto es lo que ya está: el CRM vive en la misma SQLite, al lado de las convocatorias.
- **Cuándo sumar Resend**: cuando el canal sea email masivo o secuencias. Se guarda el `message_id` y un webhook
  actualiza el historial (entregado / abierto / respondido). Es una integración de 50 líneas, no un reemplazo.
- **Cuándo migrar a un CRM real**: si pasás ~200 contactos, necesitás multi-usuario o automatizaciones. Ahí sí
  HubSpot free / Attio / Folk, exportando el CSV.

## Pegar un link rápido

Hay un botón flotante **“Pegar link”** siempre visible, en cualquier pantalla (o **⌘K / Ctrl+K**). Al abrirlo:

1. Lee el portapapeles **solo en ese momento** (requiere gesto del usuario; nunca en segundo plano).
2. Si encuentra una URL —aunque venga mezclada con texto— la pega sola.
3. El campo hace una animación de onda (wobble) como confirmación, y se desactiva con
   `prefers-reduced-motion`.
4. Enter analiza el link y te lleva a la ficha.

El modal es glassmorphism (`backdrop-filter`) con un fallback sólido si el navegador no lo soporta: la
legibilidad manda. Tiene foco atrapado, `aria-modal`, cierre con Escape y devuelve el foco al botón.

## Estructura legal de un tercero

Si la startup no tiene personería propia y opera bajo la estructura de una cooperativa o sociedad aliada
(es el caso de Mehmiro), se elige **“Opera bajo la estructura legal de un tercero”** y se describe en el detalle.
En ese caso, un requisito de “estar constituida” **no se marca como cumplido ni como incumplido**: queda
`ambiguo`, con la aclaración de que hay que confirmar si la cooperativa puede figurar como solicitante.
Los requisitos de facturación/CUIT se evalúan con el campo “¿Pueden emitir factura?”.

### Documentos de contexto de la startup

En **Perfil Mehmiro → Documentos de contexto** se pueden pegar links a un pitch deck, métricas, roadmap o
one-pager. Al agregarlos, el servidor **lee el contenido** (Google Docs vía `export?format=txt`, PDFs con
`unpdf`, HTML plano) y lo guarda.

Ese texto entra como fuente de verdad en los dos prompts: al extraer requisitos de una convocatoria y al comparar
criterio por criterio. Si un documento responde un requisito, deja de ser `falta_dato`.

Lo que esté detrás de un login no se puede leer: el documento se guarda igual, marcado como “sin contenido”.

### Corregir un criterio sin salir de la ficha

Cada criterio que no está en “cumple” tiene un botón **Aportar el dato** (o *Aclarar* / *Corregir* según el
veredicto). Se abre un campo de texto en la misma tarjeta: escribís el dato real —“facturamos USD 0, factura la
cooperativa”, “los fundadores tenemos 33 y 30 años”— y la IA re-evalúa **solo ese criterio** contra el perfil +
tu aporte, recalcula el score y el veredicto del programa, y actualiza la recomendación.

El aporte queda guardado en `criteria.user_note`, se incluye en las próximas re-evaluaciones y se puede editar o
quitar. Sin LLM configurado el aporte se registra igual, pero el veredicto pasa a “ambiguo” en vez de fingir que
lo interpretó.

**El perfil es el activo principal**: cuanto más completo, menos `falta_dato`. Se edita en **Perfil Mehmiro** y
el botón **Re-evaluar** vuelve a comparar sin repetir el rastreo (rápido y barato).

---

## Estructura

```
app/
  page.tsx                  panel: solo la línea de tiempo
  resumen/                  cantidades, bandeja de tipos y tabla de gestión
  nueva/                    ingesta de links
  programa/[id]/            ficha completa
  perfil/                   perfil de la startup
  ajustes/                  API key, modelo, límites
  api/programs/             alta, detalle, PATCH, re-análisis, re-evaluación, borrado
  api/export/               CSV compatible con Google Sheets
  api/profile/  api/settings/
components/                 UI (timeline, dashboard/resumen, ficha, navegación)
lib/
  db.ts                     SQLite + schema + settings
  crawler.ts                rastreo profundo y scoring de links
  extract.ts                extracción LLM + heurística + validación de citas
  eligibility.ts            matching contra el perfil
  dates.ts                  fechas en español, timezone ART, countdown
  llm.ts                    cliente DeepSeek
  pipeline.ts               orquestador (claim atómico del trabajo)
worker.ts                   cola en background
data/app.db                 tu base local (no se versiona)
test/fixture/               sitio de prueba para el crawler
```

## Datos

Todo vive en `data/app.db` (SQLite, WAL). Tablas: `programs`, `sources`, `criteria`, `key_dates`, `profile`,
`settings`. Borrar `data/` resetea la app.

---

## Limitaciones conocidas (honestas)

- **LinkedIn / Instagram / Facebook** bloquean el rastreo anónimo. En esos casos hay que pegar el texto del
  posteo; el sistema busca el link real adentro. Si no hay link, avisa en vez de inventar.
- **Listados de programas**: si pegás una página que lista 20 programas, el rastreo se dispersa. Conviene pegar
  el link del programa específico.
- **Formularios con login** no se pueden inspeccionar: se guarda la URL y la plataforma, no los campos.
- **PDFs escaneados** (imagen) no se pueden leer sin OCR: la app lo reporta como error de esa fuente.
- **Fechas ambiguas** (“hasta agotar cupos”, “rolling”, año omitido): se muestran con el texto original y la
  confianza baja. El panel nunca esconde la ambigüedad.
- Los formularios de Google/Typeform a veces requieren abrirse para ver los campos; eso queda fuera del MVP.

## Roadmap

- Alertas por email/WhatsApp T-14 / T-7 / T-3 / T-1.
- Extensión de Chrome o bot de Telegram para “compartir → analizar”.
- Borradores de respuestas de formulario generados desde el perfil + las bases.
- Comparador lado a lado de dos convocatorias.
- Historial de versiones de las bases (si el organizador cambia las fechas).
