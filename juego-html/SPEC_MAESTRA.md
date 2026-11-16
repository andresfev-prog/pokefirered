# Documento Técnico Maestro: Pokémon FireRed/LeafGreen Web Edition

## 1. Arquitectura General y Stack
* **Fuente de datos y lógica:** Repositorio oficial `pret/pokefirered` (descompilación en C de GBA).
* **Destino:** Aplicación web modular en **HTML5, CSS3 y JavaScript (ES6+)** usando **HTML5 Canvas** para renderizado 2D, sin dependencias pesadas externas.
* **Estrategia de desarrollo:** Extracción y traducción modular en 4 fases (Base de datos -> Combate -> Mapas/Overworld -> Eventos y Liga).

---

## 2. Selección de Protagonista y Bifurcación de Campaña
Al iniciar una partida nueva, el jugador elige entre **3 personajes**, lo que define el rival y los eventos activos (`playerCharacter = "ash" | "gary" | "leaf"`):

| Protagonista | Pokémon Inicial | Rival Asignado | Inicial del Rival | Dinámica de Campaña |
| :--- | :--- | :--- | :--- | :--- |
| **Ash** | **Pikachu** (llega tarde al laboratorio de Oak) | **Gary** | **Eevee** (evoluciona según resultados de combate) | **Modo Anime:** Activa eventos especiales para obtener a Bulbasaur, Charmander y Squirtle. |
| **Gary** | Elección libre (Bulbasaur, Charmander o Squirtle) | **Ash (Red)** | **Pikachu** (llega tarde y recibe a Pikachu del Prof. Oak) | **Modo Clásico:** Progresión estándar de *FireRed/LeafGreen* sin eventos extra. |
| **Chica (Leaf)** | Elección libre (Bulbasaur, Charmander o Squirtle) | **Gary** | Inicial con ventaja de tipo | **Modo Clásico:** Progresión estándar de *FireRed/LeafGreen* sin eventos extra. |

* **Nota de sprites:** Extraer animaciones completas de *Red* (Ash) y *Leaf* desde `graphics/object_events/`. Para *Gary*, clonar la hoja de *sprites* de *Red* y adaptar su paleta de colores y cabello.

### Eventos Exclusivos de la Ruta Ash
* **Bulbasaur (Ciudad Celeste):** Evento con NPC guardiana; se obtiene tras superar un combate de prueba o entregar una poción para proteger la aldea oculta.
* **Charmander (Ruta 24):** Evento de rescate bajo la lluvia y combate contra su antiguo entrenador (Damian).
* **Squirtle (Ciudad Carmín):** Evento con la Oficial Jenny y combate contra el Escuadrón Squirtle.

---

## 3. Sistema de Combate y Escalado Dinámico de Niveles
* **Fórmulas base:** Extraídas de `src/battle_script_commands.c` y `src/pokemon.c` (daño, críticos, efectividad de tipos, estados alterados).
* **Regla de Escalado Dinámico:**
  1. **Piso mínimo:** Ningún entrenador tendrá jamás un nivel inferior a su nivel base original en `pokefirered`.
  2. **Cálculo de Nivel Objetivo ($N_{obj}$):** Promedio redondeado de los **3 Pokémon de mayor nivel** en el equipo actual del jugador (o de los que lleve si tiene menos de 3).
  3. **Líderes de Gimnasio:** Si $N_{obj}$ supera el nivel base del Líder, su Pokémon estrella iguala a $N_{obj}$ y el resto de su equipo se ajusta a **máximo 2 niveles por debajo** del estrella ($N_{obj} - 2$).
  4. **Entrenadores de ruta:** Si $N_{obj}$ supera su nivel base, sus Pokémon se ajustan entre **2 y 3 niveles por debajo** de $N_{obj}$.

---

## 4. Economía, Captura, Aparición y Evoluciones
* **Economía inicial:** El jugador comienza con **₽5,000** (en lugar de ₽3,000). Las recompensas por victoria escalan automáticamente con el nivel dinámico de los rivales.
* **Ratios de aparición y captura:**
  * Antes de modificar valores, extraer las tablas originales (`species_info.h` y `wild_encounters.json`) para auditoría.
  * Incrementar moderadamente el `catchRate` de especies de la **Zona Safari** (ej. Chansey, Kangaskhan, Tauros) a un rango medio (90–120).
  * Subir la probabilidad de aparición (`encounter_rate`) de Pokémon ultra raros en rutas/cuevas (originalmente 1 %–4 %) a un rango de **5 %–8 %**.
* **Evoluciones por intercambio eliminadas:**
  * Reemplazar todos los requisitos de intercambio (Kadabra, Machoke, Graveler, Haunter, etc.) por evolución directa mediante objetos (ej. *Cordón Unión* o piedras específicas) disponibles en las Tiendas Pokémon.
  * **Guía integrada:** Incluir el método exacto de evolución tanto en la descripción del objeto en la tienda como en la entrada de la Pokédex.

---

## 5. Liga Pokémon (Formato Torneo Anime + Alto Mando)
La Meseta Añil se divide en **dos etapas secuenciales**:
1. **Etapa 1 — Torneo de la Liga Pokémon (5 rondas):**
   * Preliminar -> Octavos de final -> Cuartos de final -> Semifinal -> Final.
   * El equipo del jugador se cura automáticamente al finalizar cada ronda.
   * Ganar la Final otorga el trofeo del Torneo y **desbloquea permanentemente** la Etapa 2 (si el jugador pierde después en el Alto Mando, no repite el torneo).
2. **Etapa 2 — Alto Mando y Campeón:**
   * Combates consecutivos contra los 4 miembros del Alto Mando seguidos del Rival como Campeón final (con niveles escalados dinámicamente).

---

## 6. Sistema de Guardado Dual
* **Guardado en navegador (`localStorage`):**
  * **3 ranuras independientes** (Ranura 1, 2 y 3).
  * Botón **Continuar** en pantalla de título: carga directamente las ranuras guardadas sin pedir archivos externos.
  * Botón **Nuevo Juego**: permite elegir una ranura vacía o confirmar sobrescritura sin borrar las demás partidas.
* **Respaldo portátil (`.json`):**
  * Botón **Exportar Partida (`.json`)** dentro del menú de pausa para descargar el archivo de guardado.
  * Botón **Importar Partida (`.json`)** en la pantalla de título para cargar un archivo externo en cualquiera de las 3 ranuras.

---

## 7. Hoja de Ruta Modular para Antigravity
1. **Fase 1 (Datos):** Extraer especies, movimientos, tabla de tipos, evoluciones y encuentros salvajes de `pokefirered` a archivos `.json` limpios (generando el reporte de ratios de captura/aparición para revisión).
2. **Fase 2 (Motor de Combate):** Implementar interfaz de batalla, fórmulas de daño, IA básica, escalado dinámico de niveles y uso de objetos.
3. **Fase 3 (Overworld):** Extraer *tilesets*, mapas, colisiones y *sprites* de personajes para navegación fluida en HTML5 Canvas.
4. **Fase 4 (Progresión y UI):** Integrar pantalla de título, selector de personaje, eventos de la ruta Ash, tiendas con guía de evolución, Torneo de la Liga y sistema de guardado de 3 ranuras + `.json`.
