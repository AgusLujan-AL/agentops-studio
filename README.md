# AgentOps Studio — Implementation & QA Workbench (`v4.5`)

**Consola de Ingeniería de Implementación, Orquestación Multi-Agente, Acciones de Código JS y Certificación QA Pre-Producción para Latinoamérica (13 Países).**

Diseñada y desarrollada por **Agustín Luján** ([GitHub](https://github.com/AgusLujan-AL) · [LinkedIn](https://www.linkedin.com/in/agustin-lujan-it/)).

---

## 🎯 Propósito del Proyecto

En implementaciones reales de agentes conversacionales de IA (WhatsApp Business API y Callbots de voz) para banca, fintech y retail en Latinoamérica, los mayores desafíos en producción no provienen del LLM aislado, sino de la **ingeniería de integración y reglas operativas**:

1. **Cumplimiento Normativo y Husos Horarios (13 Países):** Respetar ventanas horarias legales por jurisdicción (Ley 26.951 en Argentina, ANATEL en Brasil, Ley 2300 en Colombia, CONDUSEF en México) y operar con 11 monedas locales sincronizadas a USD.
2. **Sanitización de Estado Anti-Loop en Handoffs:** Evitar bucles infinitos entre sub-agentes cuando el usuario cambia dinámicamente de idioma (`ES ↔ PT`) o salta entre intenciones de pago digital y cobro presencial.
3. **Acciones de Código Serverless (`Node.js VM`) y Cálculos Geodésicos (`@turf/turf`):** Ejecutar lógica financiera determinística (quitas, planes de cuotas, conciliación de comprobantes) y calcular sucursales cercanas de pago en efectivo por GPS con **$0 de costo en APIs externas**.
4. **Higiene de Padrón Pre-Llamada (`E.164` & `DNC`):** Normalizar teléfonos al estándar internacional `E.164` y bloquear números inscritos en registros *No Llame* antes de despachar campañas salientes.
5. **Certificación Automatizada Pre-Producción (`30+ Casos de QA`):** Validar regresiones de ruteo, inyección de prompts y cálculos geodésicos en milisegundos antes de salir a producción.

---

## 🏗️ Flujo de Trabajo en 5 Etapas a Pantalla Completa

La plataforma cuenta con navegación por **Menú Hamburguesa (`☰` o tecla `M`)**, selector **Modo Oscuro / Modo Claro** y un **Centro Regional de Relojes en Tiempo Real y Convertidor Multimoneda FX**:

| Etapa | Ruta | Descripción Técnica |
| :--- | :--- | :--- |
| **01. Reglas, Relojes 24h & FX** | `/#onboarding` | Configuración de políticas bancarias (quita máxima, cuotas, guardrails), reloj en tiempo real de los 13 países con barra visual de ventana legal 24h y tasas de cambio editables (`1 USD`). |
| **02. Flujo de Agentes & Code Actions JS** | `/#builder` | Probador instantáneo de ruteo en vivo, constructor de Sub-Agentes (keywords, intents, plantillas dinámicas `ES/PT`) e IDE de **Acciones de Código JS** ejecutadas en `node:vm` con consola de *Dry-Run* y *Diff* de mutación de estado. |
| **03. Ingesta E.164 & Despacho Batch** | `/#portfolio` | Pipeline de limpieza de carteras (`JSON / CSV`), normalización `E.164`, bloqueo `DNC`, valuación consolidada en `USD`, reparación de registros rechazados en 1 clic y simulación de despacho masivo (`Batch HSM`). |
| **04. Sandbox, Radar Turf.js & Diff** | `/#simulator` | Terminal conversacional WhatsApp / Callbot con STT/TTS (`Web Speech API`), **Radar Geodésico SVG interactivo (`@turf/turf`)**, GPS real del navegador e inspector de mutaciones de sesión (`Antes -> Después`). |
| **05. Gate de Certificación QA** | `/#qa` | Suite automatizada de **30 casos de QA** (100% pass rate en ~30ms), inspector de aserciones, reproducción en 1 clic en el Sandbox y creador de nuevos casos de regresión (`QA-31+`). |

---

## 🌎 Cobertura Regional (13 Países LatAm)

`AR` Argentina (`ARS`) · `BR` Brasil (`BRL` / `PT-BR`) · `MX` México (`MXN`) · `CL` Chile (`CLP`) · `CO` Colombia (`COP`) · `PE` Perú (`PEN`) · `UY` Uruguay (`UYU`) · `PY` Paraguay (`PYG`) · `BO` Bolivia (`BOB`) · `EC` Ecuador (`USD`) · `CR` Costa Rica (`CRC`) · `PA` Panamá (`USD`) · `GT` Guatemala (`GTQ`).

---

## 🚀 Instalación y Ejecución Local

```bash
# 1. Instalar dependencias
npm install

# 2. Ejecutar la batería de 30 casos de QA por consola (CLI)
npm test

# 3. Iniciar el servidor en http://localhost:3000
npm start
```

---

## 📁 Estructura del Código

```text
agentops-studio/
├── src/
│   ├── server.js                      # API REST Express (Chat, Builder, Portfolio, Batch Dispatch, QA)
│   ├── engine/
│   │   ├── router.js                  # Ruteador de 13 países, husos horarios, FX y sanitizador Anti-Loop
│   │   ├── codeActionsEngine.js       # Motor de Sub-Agentes dinámicos y sandbox Node.js VM para Code Actions JS
│   │   ├── agentOrchestrator.js       # Orquestador multi-turno, memoria de sesión e inyección de System Prompt
│   │   ├── geolocator.js              # Motor geodésico @turf/turf (distancia, rumbo cardinal y WhatsApp List)
│   │   └── portfolioValidator.js      # Normalizador E.164, filtro DNC, valuación USD y parser CSV/JSON
│   └── qa/
│       ├── qaRunner.js                # Suite de 30+ casos de regresión pre-producción
│       └── cliRunner.js               # Ejecutor de QA por terminal
└── public/
    ├── index.html                     # Interfaz de 5 etapas fullscreen + drawers de navegación y FX
    ├── styles.css                     # Sistema de diseño Dark Zinc & Light Slate
    └── app.js                         # Cliente interactivo, Radar SVG Turf.js, Relojes IANA y Diff Viewer
```
