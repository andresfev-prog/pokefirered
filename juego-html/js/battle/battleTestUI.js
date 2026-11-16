import {
  BattleEngine,
  STATUS_LABELS,
  buildDataMaps,
  calculateCatchOdds,
} from "./battleEngine.js";
import {
  getExpForLevel,
  getMoveCategory,
  getTypeEffectiveness,
} from "./damageCalculator.js";
import {
  calculateTargetLevel,
  calculateTrainerReward,
  scalePartyLevels,
} from "./levelScaler.js";

const TYPE_COLORS = {
  NORMAL: "#9ca3af",
  FIGHTING: "#b91c1c",
  FLYING: "#6366f1",
  POISON: "#9333ea",
  GROUND: "#ca8a04",
  ROCK: "#a16207",
  BUG: "#84cc16",
  GHOST: "#6d28d9",
  STEEL: "#64748b",
  FIRE: "#ef4444",
  WATER: "#3b82f6",
  GRASS: "#22c55e",
  ELECTRIC: "#eab308",
  PSYCHIC: "#ec4899",
  ICE: "#06b6d4",
  DRAGON: "#4338ca",
  DARK: "#374151",
  MYSTERY: "#0f766e",
};

const ACTIVITY_LABELS = {
  diurnal: "Diurno",
  nocturnal: "Nocturno",
  any: "Cualquier hora",
};

const PRESETS = {
  wild: [
    {
      id: "safari_chansey",
      label: "Zona Safari: Chansey (Nv. 25, CR 90)",
      trainerName: "Zona Safari",
      party: [{ speciesKey: "CHANSEY", baseLevel: 25 }],
    },
    {
      id: "safari_scyther",
      label: "Zona Safari: Scyther (Nv. 25, CR 105)",
      trainerName: "Zona Safari",
      party: [{ speciesKey: "SCYTHER", baseLevel: 25 }],
    },
    {
      id: "safari_tauros",
      label: "Zona Safari: Tauros (Nv. 26, CR 105)",
      trainerName: "Zona Safari",
      party: [{ speciesKey: "TAUROS", baseLevel: 26 }],
    },
    {
      id: "safari_dratini",
      label: "Zona Safari: Dratini (Nv. 18, CR 105)",
      trainerName: "Zona Safari",
      party: [{ speciesKey: "DRATINI", baseLevel: 18 }],
    },
    {
      id: "tower_gastly",
      label: "Torre Pokémon: Gastly (Nv. 20, Inmunidades)",
      trainerName: "Torre Pokémon",
      party: [{ speciesKey: "GASTLY", baseLevel: 20 }],
    },
    {
      id: "mtmoon_clefairy",
      label: "Monte Moon: Clefairy (Nv. 11)",
      trainerName: "Monte Moon",
      party: [{ speciesKey: "CLEFAIRY", baseLevel: 11 }],
    },
  ],
  trainer: [
    {
      id: "route3_youngster",
      label: "Ruta 3: Joven Chano (3 Pokémon)",
      trainerName: "Joven Chano",
      party: [
        { speciesKey: "RATTATA", baseLevel: 11 },
        { speciesKey: "EKANS", baseLevel: 11 },
        { speciesKey: "SPEAROW", baseLevel: 12 },
      ],
    },
    {
      id: "bridge_lass",
      label: "Puente Pepita: Chica Celia (3 Pokémon)",
      trainerName: "Chica Celia",
      party: [
        { speciesKey: "PIDGEOTTO", baseLevel: 16 },
        { speciesKey: "ODDISH", baseLevel: 16 },
        { speciesKey: "CLEFAIRY", baseLevel: 17 },
      ],
    },
    {
      id: "victory_cooltrainer",
      label: "Calle Victoria: Entrenador Guay (3 Pokémon)",
      trainerName: "Entrenador Guay",
      party: [
        { speciesKey: "MACHAMP", baseLevel: 42 },
        { speciesKey: "ALAKAZAM", baseLevel: 43 },
        { speciesKey: "CHARIZARD", baseLevel: 44 },
      ],
    },
  ],
  leader: [
    {
      id: "brock",
      label: "Líder Brock — Gimnasio Plateado (Base 12–14)",
      trainerName: "Líder Brock",
      party: [
        { speciesKey: "GEODUDE", baseLevel: 12 },
        { speciesKey: "SANDSHREW", baseLevel: 12 },
        { speciesKey: "ONIX", baseLevel: 14, moveKeys: ["TACKLE", "SCREECH", "BIND", "ROCK_TOMB"] },
      ],
    },
    {
      id: "misty",
      label: "Líder Misty — Gimnasio Celeste (Base 18–21)",
      trainerName: "Líder Misty",
      party: [
        { speciesKey: "STARYU", baseLevel: 18 },
        { speciesKey: "GOLDEEN", baseLevel: 19 },
        { speciesKey: "STARMIE", baseLevel: 21, moveKeys: ["WATER_PULSE", "RAPID_SPIN", "RECOVER", "SWIFT"] },
      ],
    },
    {
      id: "surge",
      label: "Líder Lt. Surge — Gimnasio Carmín (Base 18–24)",
      trainerName: "Líder Lt. Surge",
      party: [
        { speciesKey: "VOLTORB", baseLevel: 21 },
        { speciesKey: "PIKACHU", baseLevel: 18 },
        { speciesKey: "RAICHU", baseLevel: 24, moveKeys: ["THUNDER_SHOCK", "QUICK_ATTACK", "SHOCK_WAVE", "THUNDERBOLT"] },
      ],
    },
    {
      id: "sabrina",
      label: "Líder Sabrina — Gimnasio Azafrán (Base 37–43)",
      trainerName: "Líder Sabrina",
      party: [
        { speciesKey: "KADABRA", baseLevel: 38 },
        { speciesKey: "MR_MIME", baseLevel: 37 },
        { speciesKey: "ALAKAZAM", baseLevel: 43 },
      ],
    },
  ],
};

const PLAYER_TEAM_PRESETS = {
  starters_14: [
    { speciesKey: "CHARMANDER", level: 14 },
    { speciesKey: "BULBASAUR", level: 14 },
    { speciesKey: "SQUIRTLE", level: 14 },
  ],
  mid_25: [
    { speciesKey: "PIKACHU", level: 26 },
    { speciesKey: "PIDGEOTTO", level: 24 },
    { speciesKey: "NIDOKING", level: 25 },
  ],
  high_45: [
    { speciesKey: "CHARIZARD", level: 48 },
    { speciesKey: "GYARADOS", level: 44 },
    { speciesKey: "ALAKAZAM", level: 43 },
  ],
  imbalanced: [
    { speciesKey: "RAICHU", level: 40 },
    { speciesKey: "CHARMANDER", level: 36 },
    { speciesKey: "BULBASAUR", level: 10 },
  ],
};

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function detectTimeOfDay(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 6 && hour <= 16) return { key: "day", label: "Día (06:00–16:59)", icon: "☀️" };
  if (hour >= 17 && hour <= 19) return { key: "evening", label: "Tarde (17:00–19:59)", icon: "🌇" };
  return { key: "night", label: "Noche (20:00–05:59)", icon: "🌙" };
}

function createPokemonSvg(mon) {
  const c1 = TYPE_COLORS[mon.types[0]] || "#64748b";
  const c2 = TYPE_COLORS[mon.types[1]] || c1;
  const dex = String(mon.speciesId).padStart(3, "0");
  const initial = escapeHtml((mon.speciesName || "?").slice(0, 2).toUpperCase());

  return `
    <svg viewBox="0 0 110 90" width="110" height="90" aria-hidden="true">
      <defs>
        <linearGradient id="g-${dex}-${escapeHtml(mon.uid)}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${c1}" />
          <stop offset="100%" stop-color="${c2}" />
        </linearGradient>
      </defs>
      <ellipse cx="55" cy="76" rx="34" ry="8" fill="rgba(0,0,0,0.45)" />
      <circle cx="55" cy="42" r="29" fill="url(#g-${dex}-${escapeHtml(mon.uid)})" stroke="rgba(255,255,255,0.65)" stroke-width="2.5" />
      <path d="M26 42 H84" stroke="rgba(15,23,42,0.42)" stroke-width="3" />
      <circle cx="55" cy="42" r="10" fill="rgba(15,23,42,0.72)" stroke="#ffffff" stroke-width="2" />
      <text x="55" y="46" text-anchor="middle" font-size="10" font-weight="800" fill="#ffffff" font-family="system-ui, sans-serif">${initial}</text>
      <text x="55" y="24" text-anchor="middle" font-size="8.5" font-weight="700" fill="#ffffff" opacity="0.92" font-family="ui-monospace, monospace">#${dex}</text>
    </svg>
  `;
}

function renderTypeBadges(types) {
  return (types || [])
    .map((t) => `<span class="type-badge type-${escapeHtml(t)}">${escapeHtml(t)}</span>`)
    .join(" ");
}

function formatStageChips(statStages) {
  const names = {
    attack: "Atq",
    defense: "Def",
    spAttack: "At.E",
    spDefense: "Df.E",
    speed: "Vel",
    accuracy: "Pre",
    evasion: "Eva",
  };
  return Object.entries(statStages || {})
    .filter(([, val]) => val !== 0)
    .map(([k, val]) => {
      const sign = val > 0 ? `+${val}` : `${val}`;
      const cls = val < 0 ? "stage-chip neg" : "stage-chip";
      return `<span class="${cls}">${names[k] || k} ${sign}</span>`;
    })
    .join("");
}

function formatEffectivenessBadge(mult) {
  if (mult === 0) return `<span class="eff-hint eff-immune">×0 Inmune</span>`;
  if (mult >= 4) return `<span class="eff-hint eff-super">×4 ¡Devastador!</span>`;
  if (mult >= 2) return `<span class="eff-hint eff-super">×2 Muy eficaz</span>`;
  if (mult <= 0.25) return `<span class="eff-hint eff-resist">×0.25 Muy resist.</span>`;
  if (mult < 1) return `<span class="eff-hint eff-resist">×0.5 Resistido</span>`;
  return `<span class="eff-hint eff-neutral">×1 Normal</span>`;
}

function getHpClass(ratio) {
  if (ratio > 0.5) return "hp-high";
  if (ratio > 0.2) return "hp-mid";
  return "hp-low";
}

function initBattleTestApp() {
  const els = {
    protocolBanner: document.getElementById("protocol-banner"),
    timeBadge: document.getElementById("time-badge"),
    envSelect: document.getElementById("env-override"),
    matchSizeBtns: document.querySelectorAll("[data-match-size]"),
    battleTypeBtns: document.querySelectorAll("[data-battle-type]"),
    presetSelect: document.getElementById("enemy-preset"),
    trainerOffsetGroup: document.getElementById("trainer-offset-group"),
    trainerOffsetSelect: document.getElementById("trainer-offset"),
    safariBoostGroup: document.getElementById("safari-boost-group"),
    safariBoostCheck: document.getElementById("safari-boost"),
    playerSlotsContainer: document.getElementById("player-slots"),
    teamPresetBtns: document.querySelectorAll("[data-team-preset]"),
    scalerPreview: document.getElementById("scaler-preview"),
    startBattleBtn: document.getElementById("start-battle-btn"),
    arena: document.getElementById("battle-arena"),
    tabBtns: document.querySelectorAll("[data-tab]"),
    tabContent: document.getElementById("tab-content"),
    battleLog: document.getElementById("battle-log"),
  };

  if (window.location.protocol === "file:") {
    els.protocolBanner.classList.remove("hidden");
  }

  const clock = detectTimeOfDay();
  els.timeBadge.textContent = `${clock.icon} ${clock.label}`;
  els.envSelect.value = clock.key;

  const state = {
    dataLoaded: false,
    species: [],
    moves: [],
    typeChart: null,
    items: [],
    maps: null,
    matchSize: 3,
    battleType: "leader",
    presetId: "brock",
    trainerOffset: 2,
    safariBoostActive: false,
    playerSlots: JSON.parse(JSON.stringify(PLAYER_TEAM_PRESETS.starters_14)),
    engine: null,
    activeTab: "fight",
    bagTargetIndex: 0,
  };

  function applyArenaEnvironment() {
    const chosen = els.envSelect.value || clock.key;
    els.arena.classList.remove("env-day", "env-evening", "env-night");
    els.arena.classList.add(`env-${chosen}`);
  }
  applyArenaEnvironment();
  els.envSelect.addEventListener("change", applyArenaEnvironment);

  function getActiveEnemyPreset() {
    const list = PRESETS[state.battleType] || [];
    return list.find((p) => p.id === state.presetId) || list[0];
  }

  function getConfiguredEnemyParty() {
    const preset = getActiveEnemyPreset();
    if (!preset) return [];
    if (state.battleType === "wild" || state.matchSize === 3) {
      return preset.party.map((m) => ({ ...m }));
    }
    // In 1v1 against trainer/leader, pit against their Ace / strongest Pokémon
    return [{ ...preset.party[preset.party.length - 1] }];
  }

  function getConfiguredPlayerParty() {
    return state.playerSlots.slice(0, state.matchSize).map((s) => ({
      speciesKey: s.speciesKey,
      level: Math.max(1, Math.min(100, Number(s.level) || 5)),
    }));
  }

  function populatePresetSelect() {
    const list = PRESETS[state.battleType] || [];
    els.presetSelect.innerHTML = list
      .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.label)}</option>`)
      .join("");
    if (!list.some((p) => p.id === state.presetId)) {
      state.presetId = list[0].id;
    }
    els.presetSelect.value = state.presetId;

    els.trainerOffsetGroup.classList.toggle("hidden", state.battleType !== "trainer");
    els.safariBoostGroup.classList.toggle("hidden", state.battleType !== "wild");
  }

  function renderPlayerSlots() {
    if (!state.dataLoaded) return;
    const count = state.matchSize;
    const optionsHtml = state.species
      .map(
        (sp) =>
          `<option value="${escapeHtml(sp.key)}">#${String(sp.id).padStart(3, "0")} ${escapeHtml(
            sp.name
          )} (${sp.types.join("/")})</option>`
      )
      .join("");

    els.playerSlotsContainer.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const slot = state.playerSlots[i];
      const sp = state.maps.speciesMap[slot.speciesKey];
      const row = document.createElement("div");
      row.className = "player-slot";
      row.innerHTML = `
        <select data-slot-species="${i}" aria-label="Especie Pokémon ${i + 1}">
          ${optionsHtml}
        </select>
        <input type="number" min="1" max="100" value="${slot.level}" data-slot-level="${i}" aria-label="Nivel Pokémon ${i + 1}" />
        <div class="slot-meta">
          ${renderTypeBadges(sp.types)}
          <span>CR: ${sp.catchRate}</span>
          <span>Hábito: ${ACTIVITY_LABELS[sp.activityPeriod] || sp.activityPeriod}</span>
        </div>
      `;
      const sel = row.querySelector(`[data-slot-species="${i}"]`);
      sel.value = slot.speciesKey;
      sel.addEventListener("change", (e) => {
        state.playerSlots[i].speciesKey = e.target.value;
        renderPlayerSlots();
        updateScalerPreview();
      });

      const lvlInput = row.querySelector(`[data-slot-level="${i}"]`);
      lvlInput.addEventListener("input", (e) => {
        state.playerSlots[i].level = Math.max(1, Math.min(100, Number(e.target.value) || 1));
        updateScalerPreview();
      });

      els.playerSlotsContainer.appendChild(row);
    }
  }

  function updateScalerPreview() {
    if (!state.dataLoaded) return;
    const playerParty = getConfiguredPlayerParty();
    const enemyPartySpecs = getConfiguredEnemyParty();
    const scaled = scalePartyLevels(enemyPartySpecs, playerParty, state.battleType, {
      trainerOffset: state.trainerOffset,
    });
    const nObj = calculateTargetLevel(playerParty);
    const reward =
      state.battleType === "wild"
        ? 0
        : calculateTrainerReward(scaled, state.battleType === "leader" ? 80 : 40);

    const topLevels = playerParty
      .map((m) => m.level)
      .sort((a, b) => b - a)
      .slice(0, 3);

    let formulaText;
    if (state.battleType === "wild") {
      formulaText = `Encuentro salvaje sin escalado dinámico (se respeta el nivel de zona).`;
    } else if (state.battleType === "leader") {
      formulaText = `Top ${topLevels.length}: [${topLevels.join(", ")}] → <strong>N_obj = ${nObj}</strong> | Estrella = máx(base, N_obj), Resto = máx(base, N_obj - 2)`;
    } else {
      formulaText = `Top ${topLevels.length}: [${topLevels.join(", ")}] → <strong>N_obj = ${nObj}</strong> | Entrenador = máx(base, N_obj - ${state.trainerOffset})`;
    }

    const rowsHtml = scaled
      .map((spec) => {
        const sp = state.maps.speciesMap[spec.speciesKey];
        const boosted = spec.scaledLevel > spec.baseLevel;
        return `
          <div class="scaler-row">
            <span>
              ${escapeHtml(sp.name)}
              ${spec.isAce ? '<span class="ace-tag">ESTRELLA</span>' : ""}
            </span>
            <span>
              Base Nv.${spec.baseLevel} →
              <strong style="color: ${boosted ? "#4ade80" : "#f8fafc"}">Nv.${spec.scaledLevel}</strong>
              ${boosted ? "⬆" : "(piso)"}
            </span>
          </div>
        `;
      })
      .join("");

    els.scalerPreview.innerHTML = `
      <h3>Escalado Dinámico en Vivo</h3>
      <div class="scaler-summary">${formulaText}</div>
      ${rowsHtml}
      ${
        state.battleType !== "wild"
          ? `<div class="scaler-row"><span>Recompensa estimada</span><strong>₽${reward}</strong></div>`
          : ""
      }
    `;
  }

  function startNewBattle() {
    if (!state.dataLoaded) return;
    const preset = getActiveEnemyPreset();
    const playerParty = getConfiguredPlayerParty();
    const enemyParty = getConfiguredEnemyParty();

    state.engine = new BattleEngine({
      playerParty,
      enemyParty,
      battleType: state.battleType,
      trainerName: preset.trainerName,
      speciesMap: state.maps.speciesMap,
      movesMap: state.maps.movesMap,
      typeChart: state.typeChart,
      itemsMap: state.maps.itemsMap,
      safariBoostActive: state.safariBoostActive,
      trainerOffset: state.trainerOffset,
    });

    state.activeTab = "fight";
    state.bagTargetIndex = 0;
    renderAll();
  }

  function renderPokemonHud(mon, sideParty, isEnemy) {
    const sp = state.maps.speciesMap[mon.speciesKey];
    const hpRatio = mon.currentHp / Math.max(1, mon.maxHp);
    const hpPct = Math.round(hpRatio * 100);
    const balls = sideParty
      .map((m) => `<span class="ball-dot ${m.currentHp <= 0 ? "fainted" : ""}" title="${escapeHtml(m.name)}"></span>`)
      .join("");

    let expHtml = "";
    if (!isEnemy) {
      const curFloor = getExpForLevel(mon.growthRate, mon.level);
      const nextFloor = getExpForLevel(mon.growthRate, Math.min(100, mon.level + 1));
      const span = Math.max(1, nextFloor - curFloor);
      const expPct = mon.level >= 100 ? 100 : Math.max(0, Math.min(100, Math.round(((mon.exp - curFloor) / span) * 100)));
      expHtml = `
        <div class="exp-track" title="EXP: ${mon.exp} (Siguiente Nv.: ${nextFloor})">
          <div class="exp-fill" style="width: ${expPct}%"></div>
        </div>
      `;
    }

    const statusBadge = mon.status
      ? `<span class="status-chip status-${STATUS_LABELS[mon.status] || ""}">${STATUS_LABELS[mon.status] || mon.status}</span>`
      : "";
    const confBadge = mon.confused ? `<span class="status-chip status-CONF">CONF</span>` : "";

    return `
      <div class="hud-box">
        <div class="hud-top">
          <div class="hud-name">
            <span>${escapeHtml(mon.name)}</span>
            ${mon.isAce ? '<span class="ace-tag">ESTRELLA</span>' : ""}
            <span class="party-balls">${balls}</span>
          </div>
          <div class="hud-level">Nv.${mon.level}</div>
        </div>
        <div class="chips-row" style="margin-top:0; margin-bottom:6px;">
          ${renderTypeBadges(mon.types)}
          ${statusBadge}
          ${confBadge}
          ${formatStageChips(mon.statStages)}
        </div>
        <div class="hp-track">
          <div class="hp-fill ${getHpClass(hpRatio)}" style="width: ${hpPct}%"></div>
        </div>
        <div class="hp-numbers">
          <span>PS: ${mon.currentHp} / ${mon.maxHp}</span>
          <span>${
            isEnemy
              ? `Base Nv.${mon.baseLevel} · CR ${sp.catchRate}`
              : `Atq ${mon.stats.attack} · Def ${mon.stats.defense} · Vel ${mon.stats.speed}`
          }</span>
        </div>
        ${expHtml}
      </div>
    `;
  }

  function renderArena() {
    const bState = state.engine.getState();
    const enemyMon = bState.enemySide.active;
    const playerMon = bState.playerSide.active;
    const enemySpecies = state.maps.speciesMap[enemyMon.speciesKey];
    const playerSpecies = state.maps.speciesMap[playerMon.speciesKey];

    let outcomeBanner = "";
    if (bState.status !== "active") {
      const titles = {
        player_win: bState.battleType === "wild" ? "¡VICTORIA!" : `¡VICTORIA CONTRA ${bState.trainerName.toUpperCase()}! (+₽${bState.prizeMoney})`,
        caught: `¡${enemyMon.name.toUpperCase()} CAPTURADO!`,
        enemy_win: "¡DERROTA! Tu equipo fue debilitado.",
        fled: "¡ESCAPASTE DEL COMBATE!",
      };
      outcomeBanner = `
        <div class="battle-outcome-banner">
          <div>
            <strong>${escapeHtml(titles[bState.status] || "Combate terminado")}</strong>
            <div style="font-size:0.8rem; color:#cbd5e1;">Puedes reiniciar o ajustar niveles en el panel izquierdo.</div>
          </div>
          <button type="button" class="btn-small" id="rematch-btn">Nuevo Combate</button>
        </div>
      `;
    } else if (bState.awaitingPlayerSwitch) {
      outcomeBanner = `
        <div class="battle-outcome-banner">
          <div>
            <strong>¡${escapeHtml(playerMon.name)} se debilitó!</strong>
            <div style="font-size:0.8rem; color:#fde68a;">Elige otro Pokémon en la pestaña Pokémon para continuar.</div>
          </div>
        </div>
      `;
    }

    els.arena.innerHTML = `
      <div class="arena-row enemy-row">
        ${renderPokemonHud(enemyMon, bState.enemySide.party, true)}
        <div class="sprite-stage">
          <div class="sprite-card ${enemyMon.currentHp <= 0 ? "fainted" : ""}">
            ${createPokemonSvg(enemyMon)}
          </div>
          <span class="sprite-sub">${escapeHtml(bState.battleType === "wild" ? "Salvaje" : bState.trainerName)} · ${ACTIVITY_LABELS[enemySpecies.activityPeriod]}</span>
        </div>
      </div>

      ${outcomeBanner}

      <div class="arena-row player-row">
        ${renderPokemonHud(playerMon, bState.playerSide.party, false)}
        <div class="sprite-stage">
          <div class="sprite-card ${playerMon.currentHp <= 0 ? "fainted" : ""}">
            ${createPokemonSvg(playerMon)}
          </div>
          <span class="sprite-sub">Jugador · ${ACTIVITY_LABELS[playerSpecies.activityPeriod]}</span>
        </div>
      </div>
    `;

    const rematch = document.getElementById("rematch-btn");
    if (rematch) rematch.addEventListener("click", startNewBattle);
  }

  function handlePlayerAction(action) {
    if (!state.engine) return;
    if (state.engine.awaitingPlayerSwitch && action.type === "switch") {
      state.engine.forceSwitchPlayer(action.partyIndex);
      state.activeTab = "fight";
    } else {
      state.engine.executeTurn(action);
      if (state.engine.awaitingPlayerSwitch) {
        state.activeTab = "pokemon";
      }
    }
    renderAll();
  }

  function renderCommandDeck() {
    const bState = state.engine.getState();
    const isFinished = bState.status !== "active";
    const mustSwitch = bState.awaitingPlayerSwitch;
    const playerMon = bState.playerSide.active;
    const enemyMon = bState.enemySide.active;

    if (mustSwitch) {
      state.activeTab = "pokemon";
    }

    els.tabBtns.forEach((btn) => {
      const tab = btn.dataset.tab;
      btn.classList.toggle("active", state.activeTab === tab);
      if (isFinished) {
        btn.disabled = true;
      } else if (mustSwitch) {
        btn.disabled = tab !== "pokemon";
      } else {
        btn.disabled = false;
      }
    });

    if (state.activeTab === "fight") {
      const allEmpty = playerMon.moves.every((m) => m.currentPp <= 0);
      if (allEmpty) {
        els.tabContent.innerHTML = `
          <div class="moves-grid">
            <button type="button" class="move-btn" id="struggle-btn" ${isFinished ? "disabled" : ""}>
              <div class="move-head">
                <span>Combate (Struggle)</span>
                <span class="type-badge type-NORMAL">NORMAL</span>
              </div>
              <div class="move-meta">Sin PP restantes · Pot 50 · Retroceso 1/4</div>
            </button>
          </div>
        `;
        document.getElementById("struggle-btn")?.addEventListener("click", () => {
          handlePlayerAction({ type: "move", moveIndex: -1, struggle: true });
        });
        return;
      }

      const catLabels = { physical: "Físico", special: "Especial", status: "Estado" };
      els.tabContent.innerHTML = `
        <div class="moves-grid">
          ${playerMon.moves
            .map((mv, idx) => {
              const cat = getMoveCategory(mv);
              const eff =
                cat === "status"
                  ? mv.effect === "EFFECT_PARALYZE" && mv.type === "ELECTRIC" && enemyMon.types.includes("GROUND")
                    ? formatEffectivenessBadge(0)
                    : `<span class="eff-hint eff-neutral">Estado</span>`
                  : formatEffectivenessBadge(
                      getTypeEffectiveness(mv.type, enemyMon.types, state.typeChart, {
                        foresight: enemyMon.foresight,
                        defenderAbility: enemyMon.ability,
                      })
                    );
              return `
                <button type="button" class="move-btn" data-move-idx="${idx}" ${
                mv.currentPp <= 0 || isFinished ? "disabled" : ""
              }>
                  <div class="move-head">
                    <span>${escapeHtml(mv.name)}</span>
                    <span class="type-badge type-${escapeHtml(mv.type)}">${escapeHtml(mv.type)}</span>
                  </div>
                  <div class="move-meta">
                    <span>${catLabels[cat]}</span>
                    <span>Pot: ${mv.power || "—"}</span>
                    <span>Prec: ${mv.accuracy || "∞"}</span>
                    <span>PP: ${mv.currentPp}/${mv.maxPp}</span>
                    ${eff}
                  </div>
                </button>
              `;
            })
            .join("")}
        </div>
      `;

      els.tabContent.querySelectorAll("[data-move-idx]").forEach((btn) => {
        btn.addEventListener("click", () => {
          handlePlayerAction({ type: "move", moveIndex: Number(btn.dataset.moveIdx) });
        });
      });
      return;
    }

    if (state.activeTab === "bag") {
      const balls = state.items.filter((i) => i.category === "pokeball");
      const medicine = state.items.filter((i) => ["healing", "status", "revive"].includes(i.category));

      const partyOptions = bState.playerSide.party
        .map(
          (m, idx) =>
            `<option value="${idx}">${escapeHtml(m.name)} (Nv.${m.level} · ${m.currentHp}/${m.maxHp} PS${
              m.status ? ` · ${STATUS_LABELS[m.status]}` : ""
            })</option>`
        )
        .join("");

      const ballCards = balls
        .map((ball) => {
          const isWild = bState.battleType === "wild";
          const odds = isWild
            ? calculateCatchOdds(enemyMon, ball, { safariBoostActive: state.safariBoostActive })
            : null;
          const chanceStr = isWild
            ? `Captura aprox.: ${odds.approxChancePercent}% (CR ${enemyMon.catchRate}${
                state.safariBoostActive ? " +25%" : ""
              })`
            : "Bloqueado vs Entrenador";
          return `
            <button type="button" class="item-btn" data-use-item="${escapeHtml(ball.key)}" ${
            !isWild || isFinished ? "disabled" : ""
          }>
              <div class="item-title">
                <span>${escapeHtml(ball.name)}</span>
                <span>×${ball.catchMultiplier}</span>
              </div>
              <div class="item-sub">${escapeHtml(chanceStr)}</div>
            </button>
          `;
        })
        .join("");

      const medCards = medicine
        .map(
          (it) => `
            <button type="button" class="item-btn" data-use-item="${escapeHtml(it.key)}" ${
            isFinished ? "disabled" : ""
          }>
              <div class="item-title">
                <span>${escapeHtml(it.name)}</span>
                <span>₽${it.price}</span>
              </div>
              <div class="item-sub">${escapeHtml(it.description)}</div>
            </button>
          `
        )
        .join("");

      els.tabContent.innerHTML = `
        <div class="bag-section-title">Poké Balls (Captura Gen 3)</div>
        <div class="bag-grid">${ballCards}</div>
        <div class="bag-section-title" style="margin-top:14px;">Curación y Estado — Objetivo:</div>
        <div style="margin-bottom:10px; max-width:360px;">
          <select id="bag-target-select">${partyOptions}</select>
        </div>
        <div class="bag-grid">${medCards}</div>
      `;

      const targetSel = document.getElementById("bag-target-select");
      if (targetSel) {
        if (state.bagTargetIndex >= bState.playerSide.party.length) {
          state.bagTargetIndex = 0;
        }
        targetSel.value = String(state.bagTargetIndex);
        targetSel.addEventListener("change", (e) => {
          state.bagTargetIndex = Number(e.target.value);
        });
      }

      els.tabContent.querySelectorAll("[data-use-item]").forEach((btn) => {
        btn.addEventListener("click", () => {
          handlePlayerAction({
            type: "item",
            itemKey: btn.dataset.useItem,
            targetIndex: state.bagTargetIndex,
          });
        });
      });
      return;
    }

    if (state.activeTab === "pokemon") {
      els.tabContent.innerHTML = `
        <div class="party-switch-grid">
          ${bState.playerSide.party
            .map((mon, idx) => {
              const isActive = idx === bState.playerSide.activeIndex;
              const canSwitch = !isFinished && mon.currentHp > 0 && !isActive;
              return `
                <div class="party-card ${isActive ? "active-mon" : ""}">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>${escapeHtml(mon.name)} (Nv.${mon.level})</strong>
                    <span>${mon.currentHp}/${mon.maxHp} PS</span>
                  </div>
                  <div class="chips-row" style="margin-top:2px;">
                    ${renderTypeBadges(mon.types)}
                    ${mon.status ? `<span class="status-chip status-${STATUS_LABELS[mon.status]}">${STATUS_LABELS[mon.status]}</span>` : ""}
                  </div>
                  <button type="button" class="btn-small" data-switch-idx="${idx}" ${canSwitch ? "" : "disabled"}>
                    ${isActive ? "En combate" : mon.currentHp <= 0 ? "Debilitado" : "Enviar al combate"}
                  </button>
                </div>
              `;
            })
            .join("")}
        </div>
      `;

      els.tabContent.querySelectorAll("[data-switch-idx]").forEach((btn) => {
        btn.addEventListener("click", () => {
          handlePlayerAction({ type: "switch", partyIndex: Number(btn.dataset.switchIdx) });
        });
      });
      return;
    }

    // Run tab
    const canRun = !isFinished && bState.battleType === "wild";
    els.tabContent.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px; align-items:flex-start;">
        <p style="margin:0; font-size:0.88rem; color:#cbd5e1;">
          ${
            bState.battleType === "wild"
              ? "Puedes huir de este encuentro salvaje en cualquier momento."
              : "No puedes huir de un combate contra otro Entrenador o Líder de Gimnasio."
          }
        </p>
        <button type="button" class="btn-small" id="confirm-run-btn" ${canRun ? "" : "disabled"}>
          Intentar Huir
        </button>
      </div>
    `;
    document.getElementById("confirm-run-btn")?.addEventListener("click", () => {
      handlePlayerAction({ type: "run" });
    });
  }

  function renderBattleLog() {
    const logs = state.engine ? state.engine.getState().logs : [];
    els.battleLog.innerHTML = logs
      .map(
        (entry) =>
          `<div class="log-entry log-${escapeHtml(entry.kind)}"><span class="log-turn">[T${entry.turn}]</span>${escapeHtml(
            entry.message.replaceAll("**", "")
          )}</div>`
      )
      .join("");
    els.battleLog.scrollTop = els.battleLog.scrollHeight;
  }

  function renderAll() {
    if (!state.engine) return;
    renderArena();
    renderCommandDeck();
    renderBattleLog();
  }

  // Event bindings
  els.matchSizeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.matchSize = Number(btn.dataset.matchSize);
      els.matchSizeBtns.forEach((b) => b.classList.toggle("active", b === btn));
      renderPlayerSlots();
      updateScalerPreview();
    });
  });

  els.battleTypeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.battleType = btn.dataset.battleType;
      els.battleTypeBtns.forEach((b) => b.classList.toggle("active", b === btn));
      populatePresetSelect();
      updateScalerPreview();
    });
  });

  els.presetSelect.addEventListener("change", (e) => {
    state.presetId = e.target.value;
    updateScalerPreview();
  });

  els.trainerOffsetSelect.addEventListener("change", (e) => {
    state.trainerOffset = Number(e.target.value);
    updateScalerPreview();
  });

  els.safariBoostCheck.addEventListener("change", (e) => {
    state.safariBoostActive = e.target.checked;
  });

  els.teamPresetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = PLAYER_TEAM_PRESETS[btn.dataset.teamPreset];
      if (!preset) return;
      state.playerSlots = JSON.parse(JSON.stringify(preset));
      renderPlayerSlots();
      updateScalerPreview();
    });
  });

  els.tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeTab = btn.dataset.tab;
      renderCommandDeck();
    });
  });

  els.startBattleBtn.addEventListener("click", startNewBattle);

  // Load real JSON datasets
  Promise.all([
    fetch("./data/species.json").then((r) => r.json()),
    fetch("./data/moves.json").then((r) => r.json()),
    fetch("./data/type_chart.json").then((r) => r.json()),
    fetch("./data/items.json").then((r) => r.json()),
  ])
    .then(([species, moves, typeChart, items]) => {
      state.species = species;
      state.moves = moves;
      state.typeChart = typeChart;
      state.items = items;
      state.maps = buildDataMaps({ species, moves, items });
      state.dataLoaded = true;

      populatePresetSelect();
      renderPlayerSlots();
      updateScalerPreview();
      startNewBattle();
    })
    .catch((err) => {
      els.protocolBanner.classList.remove("hidden");
      els.battleLog.innerHTML = `<div class="log-entry log-warning">Error cargando JSON locales: ${escapeHtml(
        err.message
      )}</div>`;
    });
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", initBattleTestApp);
}
