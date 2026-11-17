/**
 * Controlador de UI para Banco de Pruebas de Overworld (Fase 3)
 * Conecta AssetLoader + OverworldEngine + EncounterManager + BattleEngine (Fase 2)
 */

import { AssetLoader } from "./assetLoader.js";
import { OverworldEngine } from "./overworldEngine.js";
import {
  detectTimeOfDay,
  filterEncountersByTimeAndEnv,
  rollWildEncounter,
  TIME_PERIOD_DEFS,
} from "./encounterManager.js";
import { BattleEngine, buildDataMaps, createBattlePokemon } from "../battle/battleEngine.js";

const COLLISION_LABELS = {
  0: "0: Transitable",
  1: "1: Bloqueado",
  2: "2: Hierba / Encuentro",
  3: "3: Agua / Surf",
  4: "4: Salto / Desnivel",
};

const ACTIVITY_LABELS = {
  diurnal: "Diurno",
  nocturnal: "Nocturno",
  any: "24 Horas",
};

async function bootstrap() {
  const els = {
    protocolBanner: document.getElementById("protocol-banner"),
    timeStatusBadge: document.getElementById("time-status-badge"),
    timeModeSelect: document.getElementById("time-mode-select"),
    protagonistBtns: [...document.querySelectorAll("#protagonist-buttons .seg-btn")],
    spritePreviewCanvas: document.getElementById("sprite-preview-canvas"),
    spriteModeLabel: document.getElementById("sprite-mode-label"),
    btnToggleBike: document.getElementById("btn-toggle-bike"),
    btnToggleSurf: document.getElementById("btn-toggle-surf"),
    quickMapPills: [...document.querySelectorAll("#quick-map-pills button")],
    mapTotalCount: document.getElementById("map-total-count"),
    mapTeleportSelect: document.getElementById("map-teleport-select"),
    btnTeleport: document.getElementById("btn-teleport"),
    chkCollisionOverlay: document.getElementById("chk-collision-overlay"),
    btnForceEncounter: document.getElementById("btn-force-encounter"),
    encounterEnvNote: document.getElementById("encounter-env-note"),
    encounterPreviewList: document.getElementById("encounter-preview-list"),
    hudMapName: document.getElementById("hud-map-name"),
    hudCoords: document.getElementById("hud-coords"),
    hudEnvBadge: document.getElementById("hud-env-badge"),
    hudCollisionLabel: document.getElementById("hud-collision-label"),
    overworldCanvas: document.getElementById("overworld-canvas"),
    toastBar: document.getElementById("toast-bar"),
    dpadBtns: [...document.querySelectorAll(".dpad-btn[data-dir]")],
    btnPadRun: document.getElementById("btn-pad-run"),
    overworldLog: document.getElementById("overworld-log"),
    // Wild battle modal
    wbModal: document.getElementById("wild-battle-modal"),
    wbCloseBtn: document.getElementById("wb-close-btn"),
    wbTitle: document.getElementById("wb-title"),
    wbStage: document.getElementById("wb-stage"),
    wbFoeName: document.getElementById("wb-foe-name"),
    wbFoeLevel: document.getElementById("wb-foe-level"),
    wbFoeHpFill: document.getElementById("wb-foe-hp-fill"),
    wbFoeHpText: document.getElementById("wb-foe-hp-text"),
    wbFoeSprite: document.getElementById("wb-foe-sprite"),
    wbPlyName: document.getElementById("wb-ply-name"),
    wbPlyLevel: document.getElementById("wb-ply-level"),
    wbPlyHpFill: document.getElementById("wb-ply-hp-fill"),
    wbPlyHpText: document.getElementById("wb-ply-hp-text"),
    wbPlySprite: document.getElementById("wb-ply-sprite"),
    wbMovesGrid: document.getElementById("wb-moves-grid"),
    wbBallBtn: document.getElementById("wb-ball-btn"),
    wbGreatBtn: document.getElementById("wb-great-btn"),
    wbHealBtn: document.getElementById("wb-heal-btn"),
    wbRunBtn: document.getElementById("wb-run-btn"),
    wbLog: document.getElementById("wb-log"),
  };

  if (window.location.protocol === "file:") {
    els.protocolBanner.classList.remove("hidden");
    return;
  }

  const loader = new AssetLoader({ basePath: "." });
  const core = await loader.loadCoreData();
  const dataMaps = buildDataMaps({
    species: core.species,
    moves: core.moves,
    items: core.items,
  });

  // Poblar selector de mapas agrupados
  populateMapSelect(els.mapTeleportSelect, core.mapsIndex.maps);
  els.mapTotalCount.textContent = String(core.mapsIndex.count);

  let toastTimer = null;
  function showToast(text) {
    els.toastBar.textContent = text;
    els.toastBar.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toastBar.classList.add("hidden"), 2400);
  }

  function addLog(msg, color = "#cbd5e1") {
    const row = document.createElement("div");
    row.style.color = color;
    row.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    els.overworldLog.prepend(row);
    while (els.overworldLog.children.length > 60) {
      els.overworldLog.removeChild(els.overworldLog.lastChild);
    }
  }

  function resolveActiveTimeKey() {
    const sel = els.timeModeSelect.value;
    if (sel === "auto") return detectTimeOfDay().key;
    return sel;
  }

  function updateClockBadge() {
    const mode = els.timeModeSelect.value;
    const key = resolveActiveTimeKey();
    const def = TIME_PERIOD_DEFS[key];
    els.timeStatusBadge.textContent =
      mode === "auto" ? `${def.icon} Auto: ${def.label}` : `${def.icon} Manual: ${def.label}`;
  }

  // Equipo de prueba del jugador para combates salvajes
  const demoParty = [
    createBattlePokemon(core.speciesByKey.PIKACHU, 12, dataMaps.movesMap),
    createBattlePokemon(core.speciesByKey.BULBASAUR, 12, dataMaps.movesMap),
    createBattlePokemon(core.speciesByKey.CHARMANDER, 12, dataMaps.movesMap),
  ];

  let activeBattleEngine = null;

  function syncBattleModal() {
    if (!activeBattleEngine) return;
    const state = activeBattleEngine.getState();
    const foe = state.enemySide.active;
    const ply = state.playerSide.active;

    els.wbFoeName.textContent = foe.name;
    els.wbFoeLevel.textContent = `Nv. ${foe.level}`;
    const foePct = Math.max(0, Math.round((foe.currentHp / foe.maxHp) * 100));
    els.wbFoeHpFill.style.width = `${foePct}%`;
    els.wbFoeHpFill.style.background = foePct > 50 ? "#22c55e" : foePct > 20 ? "#f59e0b" : "#ef4444";
    els.wbFoeHpText.textContent = `${foe.currentHp} / ${foe.maxHp}`;
    els.wbFoeSprite.src = loader.getPokemonSpritePath(foe.speciesId, "front");

    els.wbPlyName.textContent = ply.name;
    els.wbPlyLevel.textContent = `Nv. ${ply.level}`;
    const plyPct = Math.max(0, Math.round((ply.currentHp / ply.maxHp) * 100));
    els.wbPlyHpFill.style.width = `${plyPct}%`;
    els.wbPlyHpFill.style.background = plyPct > 50 ? "#22c55e" : plyPct > 20 ? "#f59e0b" : "#ef4444";
    els.wbPlyHpText.textContent = `${ply.currentHp} / ${ply.maxHp}`;
    els.wbPlySprite.src = loader.getPokemonSpritePath(ply.speciesId, "back");

    const finished = state.status !== "active";
    els.wbMovesGrid.innerHTML = "";
    ply.moves.forEach((mv, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wb-move-btn";
      btn.disabled = finished || mv.currentPp <= 0;
      btn.innerHTML = `<strong>${mv.name}</strong><br><small>${mv.type} · PP ${mv.currentPp}/${mv.maxPp}</small>`;
      btn.addEventListener("click", () => {
        activeBattleEngine.executeTurn({ type: "move", moveIndex: idx });
        syncBattleModal();
      });
      els.wbMovesGrid.appendChild(btn);
    });

    els.wbBallBtn.disabled = finished;
    els.wbGreatBtn.disabled = finished;
    els.wbHealBtn.disabled = finished;
    els.wbRunBtn.disabled = finished;

    els.wbLog.innerHTML = "";
    for (const entry of state.logs.slice(-12)) {
      const div = document.createElement("div");
      div.textContent = entry.message;
      els.wbLog.appendChild(div);
    }
    els.wbLog.scrollTop = els.wbLog.scrollHeight;

    if (finished) {
      els.wbTitle.textContent =
        state.status === "caught"
          ? `🎉 ¡Capturaste a ${foe.name}!`
          : state.status === "player_win"
          ? `🏆 ¡Venciste al ${foe.name} salvaje!`
          : state.status === "fled"
          ? "🏃 Escapaste del combate."
          : "💀 Combate terminado (equipo curado al volver)";
      // Restaurar PS del equipo de demostración tras terminar
      if (state.status === "enemy_win") {
        for (const m of demoParty) {
          m.currentHp = m.maxHp;
          m.status = null;
        }
      }
    }
  }

  function openWildBattle(encounter) {
    engine.setPaused(true);
    // Restaurar PS si todo el equipo cayó antes
    if (demoParty.every((m) => m.currentHp <= 0)) {
      demoParty.forEach((m) => {
        m.currentHp = m.maxHp;
        m.status = null;
      });
    }

    activeBattleEngine = new BattleEngine({
      playerParty: demoParty,
      enemyParty: [{ speciesKey: encounter.species.key, baseLevel: encounter.level }],
      battleType: "wild",
      speciesMap: dataMaps.speciesMap,
      movesMap: dataMaps.movesMap,
      typeChart: core.typeChart,
      itemsMap: dataMaps.itemsMap,
    });

    els.wbStage.className = "wb-stage";
    if (encounter.environment === "cave") {
      els.wbStage.classList.add("env-cave");
    } else if (encounter.timeKey === "night") {
      els.wbStage.classList.add("env-night");
    } else if (encounter.timeKey === "evening") {
      els.wbStage.classList.add("env-evening");
    }

    els.wbTitle.textContent = `⚔️ Encuentro en ${encounter.mapName} — ${encounter.species.name} Nv.${encounter.level}`;
    els.wbModal.classList.remove("hidden");
    syncBattleModal();
    addLog(
      `¡Encuentro salvaje en ${encounter.mapName}: ${encounter.species.name} Nv.${encounter.level} (${encounter.environment}, ${encounter.timeKey})!`,
      "#86efac"
    );
  }

  function closeWildBattle() {
    els.wbModal.classList.add("hidden");
    activeBattleEngine = null;
    engine.setPaused(false);
  }

  els.wbCloseBtn.addEventListener("click", closeWildBattle);
  els.wbBallBtn.addEventListener("click", () => {
    if (!activeBattleEngine) return;
    activeBattleEngine.executeTurn({ type: "item", itemKey: "POKE_BALL" });
    syncBattleModal();
  });
  els.wbGreatBtn.addEventListener("click", () => {
    if (!activeBattleEngine) return;
    activeBattleEngine.executeTurn({ type: "item", itemKey: "GREAT_BALL" });
    syncBattleModal();
  });
  els.wbHealBtn.addEventListener("click", () => {
    if (!activeBattleEngine) return;
    activeBattleEngine.executeTurn({ type: "item", itemKey: "POTION", targetIndex: 0 });
    syncBattleModal();
  });
  els.wbRunBtn.addEventListener("click", () => {
    if (!activeBattleEngine) return;
    activeBattleEngine.executeTurn({ type: "run" });
    syncBattleModal();
    setTimeout(closeWildBattle, 420);
  });

  function renderEncounterSidebar(map) {
    if (!map) return;
    const timeKey = resolveActiveTimeKey();
    const zone = core.wildZonesByMapId[map.id];
    const hasWaterOnly = zone && !zone.methods.land && zone.methods.water;
    const method = hasWaterOnly ? "water" : "land";

    if (!zone || !zone.methods?.[method]) {
      els.encounterEnvNote.textContent =
        map.environment === "indoor"
          ? "Interior seguro: sin encuentros salvajes."
          : "Zona urbana sin hierba alta ni tabla salvaje.";
      els.encounterPreviewList.innerHTML = "";
      els.btnForceEncounter.disabled = true;
      return;
    }

    els.btnForceEncounter.disabled = false;
    const filtered = filterEncountersByTimeAndEnv({
      zone,
      method,
      speciesByKey: core.speciesByKey,
      timeKey,
      mapEnvironment: map.environment,
    });

    const def = TIME_PERIOD_DEFS[timeKey];
    if (filtered.ignoresTime) {
      els.encounterEnvNote.textContent = `Cueva/interior cerrado (${filtered.environment}): aparecen TODAS las especies sin filtro de hora.`;
    } else {
      els.encounterEnvNote.textContent = `Exterior (${def.shortLabel}): ${filtered.entries.length} de ${filtered.rawCount} especies activas según su hábito.`;
    }

    els.encounterPreviewList.innerHTML = "";
    if (filtered.entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "env-note";
      empty.textContent = "Las especies diurnas de esta zona duermen durante la noche.";
      els.encounterPreviewList.appendChild(empty);
      return;
    }

    for (const item of filtered.entries) {
      const row = document.createElement("div");
      row.className = "encounter-item";
      row.innerHTML = `
        <div class="encounter-item-left">
          <img src="${loader.getPokemonSpritePath(item.speciesId, "front")}" alt="${item.speciesName}" />
          <div>
            <strong>${item.speciesName}</strong>
            <div style="color:#94a3b8;">Nv. ${item.minLevel}–${item.maxLevel} · ${item.effectiveChance}%</div>
          </div>
        </div>
        <span class="activity-tag activity-${item.activityPeriod}">${ACTIVITY_LABELS[item.activityPeriod] || item.activityPeriod}</span>
      `;
      els.encounterPreviewList.appendChild(row);
    }
  }

  // Inicializar OverworldEngine
  const initialTime = resolveActiveTimeKey();
  const engine = new OverworldEngine({
    canvas: els.overworldCanvas,
    assetLoader: loader,
    onMapChange: (map) => {
      els.mapTeleportSelect.value = map.id;
      renderEncounterSidebar(map);
      addLog(`Mapa cargado: ${map.displayName || map.name} (${map.environment})`, "#7dd3fc");
    },
    onNotification: (msg, kind) => {
      showToast(msg);
      addLog(msg, kind === "warn" ? "#fde047" : "#cbd5e1");
    },
    onEncounterCheck: (map, col) => {
      const encounter = rollWildEncounter({
        map,
        tileCollision: col,
        timeKey: resolveActiveTimeKey(),
        wildZonesByMapId: core.wildZonesByMapId,
        speciesByKey: core.speciesByKey,
      });
      if (encounter) {
        openWildBattle(encounter);
      }
    },
    onDebugUpdate: (info) => {
      els.hudMapName.textContent = info.map.displayName || info.map.name;
      els.hudCoords.textContent = `(${info.x}, ${info.y})`;
      els.hudEnvBadge.textContent = info.map.environment;
      els.hudEnvBadge.className = `env-badge ${info.map.environment}`;
      els.hudCollisionLabel.textContent = COLLISION_LABELS[info.collision] || String(info.collision);
      els.btnToggleBike.classList.toggle("active", engine.player.bikeMode);
      els.btnToggleSurf.classList.toggle("active", engine.player.surfEnabled);
      els.spriteModeLabel.textContent = `Modo: ${
        info.mode === "bike" ? "Bicicleta" : info.mode === "run" ? "Correr" : "Caminar"
      } · mirando ${info.facing}`;
    },
  });

  await engine.init({
    initialMapId: "MAP_PALLET_TOWN",
    characterKey: "ash",
    timePeriod: initialTime,
    spawn: { x: 6, y: 8 },
  });
  updateClockBadge();

  // Mini Canvas animado mostrando caminar/correr/bici del protagonista seleccionado
  const prevCtx = els.spritePreviewCanvas.getContext("2d");
  prevCtx.imageSmoothingEnabled = false;
  let previewTick = 0;
  setInterval(() => {
    previewTick += 1;
    const sheet = engine.playerSheet;
    if (!sheet || !sheet.image) return;
    prevCtx.clearRect(0, 0, 128, 40);
    const stepFrame = [0, 1, 0, 2][previewTick % 4];
    const row = engine.getMovementMode() === "bike" ? 2 : engine.getMovementMode() === "run" ? 1 : 0;
    const dirs = ["down", "up", "left", "right"];
    dirs.forEach((d, i) => {
      const col = sheet.manifest.directions[d].cols[stepFrame];
      prevCtx.drawImage(sheet.image, col * 32, row * 32, 32, 32, i * 32, 4, 32, 32);
    });
  }, 190);

  // Selector de protagonista (Ash / Gary / Leaf)
  els.protagonistBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      els.protagonistBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const key = btn.dataset.char;
      await engine.setCharacter(key);
      addLog(`Protagonista cambiado a ${key.toUpperCase()}.`, "#f8fafc");
    });
  });

  // Selector de horario (Automático / Día / Tarde / Noche)
  els.timeModeSelect.addEventListener("change", () => {
    const key = resolveActiveTimeKey();
    engine.setTimePeriod(key);
    updateClockBadge();
    renderEncounterSidebar(engine.currentBundle?.map);
    addLog(`Horario actualizado: ${TIME_PERIOD_DEFS[key].label}.`, "#fde047");
  });

  // Teletransporte por píldoras rápidas y select completo
  els.quickMapPills.forEach((btn) => {
    btn.addEventListener("click", () => {
      engine.loadMap(btn.dataset.map);
      els.overworldCanvas.focus?.();
    });
  });
  els.btnTeleport.addEventListener("click", () => {
    if (els.mapTeleportSelect.value) {
      engine.loadMap(els.mapTeleportSelect.value);
    }
  });

  // Modos de movimiento y overlay de colisiones
  els.btnToggleBike.addEventListener("click", () => engine.toggleBike());
  els.btnToggleSurf.addEventListener("click", () => {
    engine.setSurfEnabled(!engine.player.surfEnabled);
    showToast(engine.player.surfEnabled ? "Surf activado (puedes cruzar agua)." : "Surf desactivado.");
  });
  els.chkCollisionOverlay.addEventListener("change", (e) => {
    engine.setShowCollisionOverlay(e.target.checked);
  });

  els.btnForceEncounter.addEventListener("click", () => {
    const map = engine.currentBundle?.map;
    if (!map) return;
    const zone = core.wildZonesByMapId[map.id];
    const hasLand = Boolean(zone?.methods?.land);
    const enc = rollWildEncounter({
      map,
      tileCollision: hasLand ? 2 : 3,
      timeKey: resolveActiveTimeKey(),
      wildZonesByMapId: core.wildZonesByMapId,
      speciesByKey: core.speciesByKey,
      forceTrigger: true,
    });
    if (enc) {
      openWildBattle(enc);
    } else {
      showToast("No hay especies activas en este mapa para la hora seleccionada.");
    }
  });

  // D-Pad táctil y de ratón
  els.dpadBtns.forEach((btn) => {
    const dir = btn.dataset.dir;
    const start = (e) => {
      e.preventDefault();
      btn.classList.add("active");
      engine.pressDirection(dir);
    };
    const stop = () => {
      btn.classList.remove("active");
      engine.releaseDirection(dir);
    };
    btn.addEventListener("pointerdown", start);
    btn.addEventListener("pointerup", stop);
    btn.addEventListener("pointerleave", stop);
    btn.addEventListener("pointercancel", stop);
  });

  let padRunToggle = false;
  els.btnPadRun.addEventListener("click", () => {
    padRunToggle = !padRunToggle;
    els.btnPadRun.classList.toggle("active", padRunToggle);
    engine.setShiftRun(padRunToggle);
  });
}

function populateMapSelect(selectEl, maps) {
  const groups = {
    towns: { label: "Ciudades y Pueblos", items: [] },
    routes: { label: "Rutas y Safari", items: [] },
    caves: { label: "Cuevas y Mazmorras", items: [] },
    indoors: { label: "Interiores (Labs, Centros Pokémon, Gimnasios)", items: [] },
  };

  for (const m of maps) {
    if (m.mapType === "MAP_TYPE_TOWN" || m.mapType === "MAP_TYPE_CITY") {
      groups.towns.items.push(m);
    } else if (m.mapType === "MAP_TYPE_ROUTE" || m.mapType === "MAP_TYPE_OCEAN_ROUTE") {
      groups.routes.items.push(m);
    } else if (m.environment === "cave") {
      groups.caves.items.push(m);
    } else {
      groups.indoors.items.push(m);
    }
  }

  selectEl.innerHTML = "";
  for (const grp of Object.values(groups)) {
    const og = document.createElement("optgroup");
    og.label = `${grp.label} (${grp.items.length})`;
    for (const m of grp.items) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.displayName} (${m.width}×${m.height})`;
      og.appendChild(opt);
    }
    selectEl.appendChild(og);
  }
}

bootstrap().catch((err) => {
  console.error(err);
  const logEl = document.getElementById("overworld-log");
  if (logEl) {
    logEl.textContent = `Error al inicializar Overworld: ${err.message}`;
  }
});
