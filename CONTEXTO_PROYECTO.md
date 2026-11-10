# Contexto Completo del Proyecto — AgentOps Studio (`v4.5`)

> **Instrucción rápida para iniciar en un nuevo chat de Antigravity:**
> Abrí la carpeta `C:\Users\agusl\.gemini\antigravity\scratch\agentops-studio` como Workspace (o pegale a Antigravity: *"Leé el archivo `C:\Users\agusl\.gemini\antigravity\scratch\agentops-studio\CONTEXTO_PROYECTO.md` para tener todo el contexto de dónde venimos"*).

---

## 1. Contexto del Usuario y Objetivo Principal

* **Usuario:** Agustín Luján (`agustin.lujan.it@gmail.com` · Merlo, Buenos Aires, Argentina).
* **Perfil Técnico:**
  * **IA Agent Developer en Botmaker** (Feb 2026 – Actualidad) y **Conversational Solution Developer** (Oct 2025 – Feb 2026).
  * Estudiante de **Ingeniería en Informática (UNLaM)**.
  * Experiencia real construyendo arquitecturas Multi-Agente con LLMs, integración de APIs REST, acciones de código en JavaScript, flujos multilingües (**Español y Portugués**) para **13 países de Latinoamérica**, geolocalización de sucursales con **`@turf/turf`** ($0 costo de API externa), **WhatsApp Flows** y suites de **30 casos de QA** pre-producción.
* **GitHub:** `https://github.com/AgusLujan-AL` (`https://github.com/AgusLujan-AL/agentops-studio`)
* **LinkedIn:** `https://www.linkedin.com/in/agustin-lujan-it/`

### ¿Por qué creamos `AgentOps Studio`?
Agustín se postuló al puesto de **Implementation Engineer en Kleva (`kleva.co`) / Sidetool (`sidetool.co`)** en LinkedIn (`https://www.linkedin.com/jobs/view/4479224480/`, rango propuesto: `2.200 - 2.500 USD/mes`).
* **Sobre la empresa:** **Sidetool** (fundada por Ed Escobar) es el AI/software studio del cual nació **Kleva** (cofundada por Ed Escobar y Juan Martín Pagella, ex cofundador de Sirena). Kleva construye **agentes de IA de voz (Callbots) y WhatsApp para cobranzas bancarias y recupero de deuda en Latinoamérica** ($1.55M seed round).
* **El pedido de Kleva:** Respondieron pidiendo enviar en un plazo de **3 días un video de Loom + perfil de GitHub** mostrando:
  1. Presentación personal y demostración en vivo de un proyecto del que esté orgulloso.
  2. Breve recorrido por el código.
  3. **¿Cuáles fueron los principales desafíos que enfrentaste y cómo los superaste?**
  4. **¿Cuál es tu stack actual de herramientas de IA para desarrollo?**
* Como Agustín no puede mostrar código ni pantallas internas de clientes de Botmaker por confidencialidad, construimos **`AgentOps Studio`**: una consola de ingeniería completa ("Implementation & QA Workbench") hecha 100% a medida que demuestra en vivo todos los logros de su CV aplicados exactamente al negocio de Kleva y Botmaker.

---

## 2. Ubicación de Archivos y Comandos Clave

* **Directorio raíz del proyecto:**
  `C:\Users\agusl\.gemini\antigravity\scratch\agentops-studio`
* **Servidor en ejecución:**
  `http://localhost:3000` (comando: `node src/server.js` o `npm start`)
* **Ejecutar los 30 casos de QA por consola:**
  `node src/qa/cliRunner.js` (o `npm test`) — Resultado actual: **`30/30 APROBADOS (100%)` en ~30ms**.
* **Script de subida a GitHub en 1 clic:**
  `C:\Users\agusl\.gemini\antigravity\scratch\agentops-studio\subir-a-github.bat`
* **Skill global de búsqueda de trabajo creada también en la sesión previa:**
  * `C:\Users\agusl\.gemini\config\skills\job-hunter-ia\SKILL.md`
  * `C:\Users\agusl\.gemini\config\skills\job-hunter-ia\scripts\scan_linkedin.mjs`

---

## 3. Arquitectura y Funcionalidades de `AgentOps Studio` (`v4.5`)

La plataforma está diseñada como un **Pipeline de Implementación de 5 Etapas a Pantalla Completa (`100vh`)**, navegable mediante un **Menú Hamburguesa Deslizante (`☰` o tecla `M`)**, selectores rápidos `01–05`, soporte de **Modo Oscuro / Modo Claro (`localStorage`)** y un **Drawer Derecho de Relojes en Tiempo Real (13 Países) & Convertidor Multimoneda FX**.

### Mapa de Archivos del Proyecto
1. **`src/engine/router.js` — Ruteador Multi-País (13 países), Husos Horarios, FX y Anti-Loop:**
   * Configura los **13 países de LatAm** (`AR, BR, MX, CL, CO, PE, UY, PY, BO, EC, CR, PA, GT`) con su capital, zona horaria IANA (`America/Argentina/Buenos_Aires`, `America/Sao_Paulo`, `America/Mexico_City`, etc.), moneda local, tasa de cambio `fxPerUsd`, ventana horaria legal y normativa local (`Ley 26.951`, `ANATEL`, `Ley 2300`, `CONDUSEF`, etc.).
   * `detectLanguageSwitch(text, currentLang)`: Detecta cambios dinámicos `ES ↔ PT`.
   * `sanitizeHandoffState(sessionState, targetAgent, reason)`: Limpia flags transitorios (`pendingLanguageSwitch`, `pendingCountryRedirect`, `subAgentRetryTrigger`, `awaitingSubAgentAck`), guarda auditoría `stateBefore` y aplica un circuit-breaker (`MAX_HANDOFF_HOPS = 3`) para evitar loops infinitos entre sub-agentes.
   * Prioriza `GuardrailSecurityAgent` (#1) antes de las intenciones de negocio para impedir que un prompt injection con la palabra `"descuento"` se filtre al agente de cobranzas.

2. **`src/engine/codeActionsEngine.js` — Flujo Dinámico de Sub-Agentes & Sandbox `node:vm` para Code Actions JS:**
   * **`CODE_ACTIONS_REGISTRY`:** Contiene scripts JavaScript reales ejecutados de forma segura con el módulo nativo `node:vm` de Node.js (`executeCodeAction`):
     1. `calculateDebtQuitaAndPlan.js` (`action_calc_quita`): Calcula quita, ahorro, cuota fija, equivalencia en USD (`debtAmountUsd`, `calculatedPayoffUsd`), genera link de pago y registra traza `POST /api/v1/collections/quote-engine`.
     2. `verifyPaymentReceiptOCR.js` (`action_verify_receipt`): Valida comprobantes de transferencia (`CBU / PIX / SPEI`), pausa reclamos (`state.collectionPaused = true`) y genera auditoría `CMP-...`.
     3. `geolocateCashPointTurf.js` (`action_turf_locator`): Emite token de caja presencial `CAJA-...` para clientes que pagan en efectivo en sucursal.
     4. `sanitizeHandoffContext.js` (`action_anti_loop_guard`): Empaqueta contexto limpio hacia el CRM humano.
   * **`AGENT_FLOW_NODES`:** Nodos vivos del flujo (`CollectionsNegotiationAgent`, `GeoBranchAgent`, `ReceiptValidationAgent`, `HumanHandoffAgent`, `GuardrailSecurityAgent`, `SupportTriageAgent`, más cualquier agente creado en vivo desde la UI con `upsertAgentNode`).

3. **`src/engine/geolocator.js` — Motor Geodésico `@turf/turf` ($0 API Cost):**
   * Catálogo completo de sucursales reales en los **13 países** (`BRANCHES_CATALOG`) y coordenadas por defecto (`DEFAULT_COORDS_BY_COUNTRY`).
   * Usa `turf.point`, `turf.distance` (km) y `turf.bearing` (rumbo cardinal N/S/E/O) + estimación de caminata y generación de payload **WhatsApp Interactive List**.

4. **`src/engine/portfolioValidator.js` — Sanitizador de Padrón `E.164`, Filtro `DNC` y Valuación `USD`:**
   * Soporta entrada dual **JSON y CSV** (`parsePortfolioInput`).
   * Normaliza números crudos a formato internacional `E.164` según prefijo de los 13 países, bloquea inscritos en registros *No Llame (DNC)*, filtra saldos negativos o teléfonos duplicados, calcula `debtAmountUsd` y `totalPortfolioUsd`, y segmenta en 3 tramos de mora (`Temprana 1-30d`, `Media 31-90d`, `Tardía +90d`).

5. **`src/engine/agentOrchestrator.js` — Orquestador Multi-Turno:**
   * Mantiene memoria de sesión multi-turno, ejecuta la **Code Action JS** vinculada al sub-agente activo, soporta confirmación de acuerdos en 1 pago o cuotas (`PRM-...`), confirmación de turnos de sucursal (`TRN-...` + código de barras `779...`), e interpolación de plantillas dinámicas (`{{customerName}}`, `{{debtAmount}}`, `{{calculatedPayoff}}`, `{{actionSummary}}`).

6. **`src/qa/qaRunner.js` & `src/qa/cliRunner.js` — Suite de 30+ Casos de QA Pre-Producción:**
   * 30 casos automatizados divididos en 5 categorías (6 por categoría): `Ruteo & Anti-Loop`, `Geolocalización Turf.js`, `Negociación & APIs`, `Guardrails & Compliance`, `Handoff & 13 Países`.
   * Permite inyectar nuevos casos en vivo (`addCustomQaCase`, ej: `QA-31`).

7. **`public/index.html`, `public/styles.css`, `public/app.js` — Interfaz Frontend (`v4.5`):**
   * **Etapa 01 (`/#onboarding`):** Presets de clientes, matriz de 13 países con relojes en vivo, **barra visual de línea de tiempo 24h** (ventana verde + cursor de hora actual), edición de tasas FX y exportación de Blueprint `.json`.
   * **Etapa 02 (`/#builder`):** **Probador de ruteo en tiempo real** (ilumina el nodo en el grafo mientras escribís), constructor de sub-agentes (keywords, intents, plantillas ES/PT) e **IDE de Code Actions JS** con barra de snippets en 1 clic, consola *Dry-Run* y comparador de mutación de estado (`Antes -> Después`).
   * **Etapa 03 (`/#portfolio`):** Editor JSON/CSV, carga de archivos, valuación en USD, **simulador de despacho masivo (`Batch HSM`)** cruzado contra el horario legal de cada país y botón **`Corregir e Inyectar ↗`** en registros rechazados.
   * **Etapa 04 (`/#simulator`):** Terminal WhatsApp/Callbot con voz STT/TTS, botón **`📍 Mi GPS Real`**, **Radar Geodésico SVG interactivo (`@turf/turf`)**, tarjetas de variables mutadas (`MODIFICADO`) y exportación de transcripción JSON.
   * **Etapa 05 (`/#qa`):** Tabla filtrable de 30+ casos, inspector de aserciones, botón **`Reproducir en Sandbox ↗`**, creador de nuevos casos QA y descarga de certificado pre-producción.

---

## 4. Guion Resumen para el Video de Loom (Kleva — 3 a 4 min)

1. **Presentación (0:00 - 0:30):**
   * Presentarse como Agustín Luján, IA Agent Developer y estudiante avanzado de Ingeniería en Informática en UNLaM.
   * Explicar que construyó **AgentOps Studio**, un Workbench de Implementación y QA para desplegar campañas de agentes de cobranza y atención en 13 países de Latinoamérica sin fallas operativas.
2. **Demo Rápida por el Pipeline de 5 Etapas (0:30 - 2:15):**
   * **Etapa 01 + Relojes & FX:** Mostrar los 13 países con sus relojes en tiempo real, la barra de ventana legal de 24h, el convertidor multimoneda a USD y el cambio entre Modo Oscuro y Modo Claro.
   * **Etapa 02 (Builder & Code Actions JS):** Escribir una frase en el probador de ruteo en vivo, mostrar cómo se ejecuta una **Acción de Código en JavaScript (`calculateDebtQuitaAndPlan.js`)** en la máquina virtual `node:vm`, correr el *Dry-Run* viendo el *Diff* de variables de sesión y cómo un cambio en el código o en un agente impacta en vivo al bot.
   * **Etapa 03 (Ingesta E.164 & Despacho Batch):** Mostrar la limpieza de números a `E.164`, el bloqueo de registros *No Llame (DNC)*, la valuación consolidada en USD y correr el **Despacho Batch HSM**.
   * **Etapa 04 (Sandbox & Radar Turf.js):** Simular una negociación de deuda con registro de promesa `201 Created`, probar la búsqueda de sucursales para pago en efectivo viendo el **Radar Geodésico `@turf/turf`**, y mostrar el sanitizador Anti-Loop en cambios de idioma `ES ↔ PT`.
   * **Etapa 05 (Gate QA 30/30):** Ejecutar los 30 casos automatizados en ~30ms (`100% Pass Rate`).
3. **Recorrido por el Código y Desafíos Superados (2:15 - 3:15):**
   * Mostrar `src/engine/router.js` (`sanitizeHandoffState`) explicando el **Desafío #1:** los loops infinitos entre sub-agentes cuando un usuario cambia de idioma o país a mitad de flujo, resuelto limpiando banderas transitorias y agregando un circuit-breaker (`MAX_HANDOFF_HOPS = 3`).
   * Mostrar `src/engine/geolocator.js` y `src/engine/codeActionsEngine.js` explicando el **Desafío #2:** calcular distancias geodésicas con `@turf/turf` en memoria ($0 costo y <2ms) y ejecutar lógica financiera determinística en un sandbox `node:vm` para que el LLM nunca alucine montos de quita.
4. **Stack de Herramientas de IA para Desarrollo (3:15 - 3:45):**
   * **Antigravity / Cursor / Claude Code** para desarrollo agéntico asistido, prototipado rápido y generación de suites de regresión.
   * **OpenAI / Gemini APIs** con *Structured Outputs*, *Function Calling* y arquitectura de sub-agentes especializados.
   * **Node.js, Express, `@turf/turf`, REST APIs y WhatsApp Business API / Flows**.
