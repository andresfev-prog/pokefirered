/**
 * Controlador Principal del Juego Web Completo (Fase 4).
 * Conecta Pantalla de Título (3 ranuras + Import .json), Selector de Protagonista (Ash/Gary/Leaf),
 * Overworld GBA en Canvas, Ciclo Horario, Tiendas, PC de Bill, Eventos Anime,
 * Torneo de la Liga / Alto Mando, Batalla de la Frontera y Arena de Combate (Fase 2).
 */

import { AssetLoader } from "../overworld/assetLoader.js";
import {
  detectTimeOfDay,
  getEffectiveSafariFleeRate,
  rollWildEncounter,
} from "../overworld/encounterManager.js";
import { OverworldEngine } from "../overworld/overworldEngine.js";
import {
  BattleEngine,
  STATUS_LABELS,
  buildDataMaps,
  createBattlePokemon,
} from "../battle/battleEngine.js";
import { getExpForLevel } from "../battle/damageCalculator.js";
import {
  addPokemonToPartyOrBox,
  applyEvolutionToPokemon,
  checkAndApplyLevelEvolutions,
  consumeBagItem,
  depositPartyPokemonToBox,
  formatEvolutionGuide,
  getAvailableEvolutionsForItem,
  getBagItemCount,
  getPokedexStats,
  healPartyFull,
  markCaptured,
  markSeen,
  normalizeItemKey,
  reorderParty,
  swapPartyAndBox,
  useOverworldItem,
} from "./pokemonProgress.js";
import {
  createExportFilename,
  deleteSlot,
  exportSaveJson,
  importSaveJson,
  listSaveSlots,
  loadFromSlot,
  saveToSlot,
} from "./saveManager.js";
import {
  GRAND_PRIX_P1_ROUNDS,
  GYM_BY_MAP_ID,
  GYM_LEADERS,
  KANTO_HUBS,
  PROTAGONIST_PROFILES,
  SAFARI_RACE_OPPONENT,
  STARTER_KEYS,
  awardGymBadge,
  canTriggerAshEvent,
  checkGrandPrixEligibility,
  completeAshBulbasaurWithPotion,
  completeGrandPrixP1,
  completeSafariRace,
  createCampaignNewGame,
  getAshEventTrainerBattle,
  getGaryEeveeEvolution,
  getIntroSceneLines,
  getMartCatalog,
  getStoryOverlayNpcsForMap,
  grantAshEventPokemon,
  healAtPokemonCenter,
  buyMartItem,
  recordRivalBattleOutcome,
} from "./storyEvents.js";
import {
  FRONTIER_BRAINS,
  FRONTIER_BY_ID,
  LEAGUE_TOURNAMENT_ROUNDS,
  awardFrontierSymbol,
  canChallengeEliteFour,
  canChallengeLeague,
  checkFrontierBrainUnlock,
  completeEliteFour,
  getAllFrontierStatus,
  getEliteFourSequence,
  onTournamentRoundVictory,
} from "./leagueAndFrontier.js";

const STARTER_LABELS_ES = {
  BULBASAUR: "Bulbasaur (Planta)",
  CHARMANDER: "Charmander (Fuego)",
  SQUIRTLE: "Squirtle (Agua)",
};

function stripBoldMarkers(text) {
  return String(text || "").replace(/\*\*/g, "");
}

function hpColorClass(ratio) {
  if (ratio <= 0.2) return "crit";
  if (ratio <= 0.5) return "warn";
  return "";
}

class PokemonWebGame {
  constructor() {
    this.loader = new AssetLoader({ basePath: "." });
    this.coreData = null;
    this.dataMaps = null;

    this.gameState = null;
    this.overworldEngine = null;
    this.battleEngine = null;
    this.activeBattleContext = null;

    // UI selection state
    this.selectedProtagonist = "ash";
    this.selectedStarter = "BULBASAUR";
    this.selectedNewGameSlot = 1;
    this.nameManuallyEdited = false;
    this.selectedPauseTab = "pokedex";
    this.selectedPcPartyIdx = null;
    this.battleSubMode = "fight";
    this.dialogueQueue = [];
    this.toastTimer = null;

    this.dom = this.collectDom();
  }

  collectDom() {
    const id = (x) => document.getElementById(x);
    return {
      screenTitle: id("screenTitle"),
      screenGame: id("screenGame"),

      tabTitleContinue: id("tabTitleContinue"),
      tabTitleNewGame: id("tabTitleNewGame"),
      tabTitleImport: id("tabTitleImport"),
      panelContinue: id("panelContinue"),
      panelNewGame: id("panelNewGame"),
      panelImportSave: id("panelImportSave"),

      slotContinueGrid: id("slotContinueGrid"),
      protagonistSelector: id("protagonistSelector"),
      inputPlayerName: id("inputPlayerName"),
      newGameSlotSelect: id("newGameSlotSelect"),
      overwriteWarning: id("overwriteWarning"),
      btnStartNewGame: id("btnStartNewGame"),
      starterSection: id("starterSection"),
      ashNoticeBox: id("ashNoticeBox"),
      starterPickerGrid: id("starterPickerGrid"),

      selectImportSlot: id("selectImportSlot"),
      inputImportFile: id("inputImportFile"),
      importFeedback: id("importFeedback"),

      hudMapName: id("hudMapName"),
      hudTimeBadge: id("hudTimeBadge"),
      hudMoney: id("hudMoney"),
      hudBadges: id("hudBadges"),
      hudSymbols: id("hudSymbols"),
      selectTimeOverride: id("selectTimeOverride"),
      btnOpenTravel: id("btnOpenTravel"),
      btnToggleBike: id("btnToggleBike"),
      btnInteractAction: id("btnInteractAction"),
      btnOpenPauseMenu: id("btnOpenPauseMenu"),

      overworldCanvas: id("overworldCanvas"),
      overworldToast: id("overworldToast"),
      dialogueOverlay: id("dialogueOverlay"),
      dialogueSpeaker: id("dialogueSpeaker"),
      dialogueText: id("dialogueText"),
      dialogueChoices: id("dialogueChoices"),
      btnDialogueNext: id("btnDialogueNext"),

      btnDpadUp: id("btnDpadUp"),
      btnDpadDown: id("btnDpadDown"),
      btnDpadLeft: id("btnDpadLeft"),
      btnDpadRight: id("btnDpadRight"),
      btnTouchA: id("btnTouchA"),
      btnTouchRun: id("btnTouchRun"),
      btnTouchMenu: id("btnTouchMenu"),

      travelModal: id("travelModal"),
      travelHubsList: id("travelHubsList"),
      btnCloseTravel: id("btnCloseTravel"),

      shopModal: id("shopModal"),
      shopPlayerMoney: id("shopPlayerMoney"),
      shopFeedback: id("shopFeedback"),
      shopCatalogList: id("shopCatalogList"),
      btnCloseShop: id("btnCloseShop"),

      pcModal: id("pcModal"),
      pcSelectedInfo: id("pcSelectedInfo"),
      pcPartyCount: id("pcPartyCount"),
      pcBoxCount: id("pcBoxCount"),
      pcPartyList: id("pcPartyList"),
      pcBoxList: id("pcBoxList"),
      btnClosePc: id("btnClosePc"),

      pauseOverlay: id("pauseOverlay"),
      btnReturnTitle: id("btnReturnTitle"),
      btnClosePause: id("btnClosePause"),
      pauseTabPokedex: id("pauseTabPokedex"),
      pauseTabParty: id("pauseTabParty"),
      pauseTabBag: id("pauseTabBag"),
      pauseTabCard: id("pauseTabCard"),
      pauseTabSave: id("pauseTabSave"),
      pauseViewPokedex: id("pauseViewPokedex"),
      pauseViewParty: id("pauseViewParty"),
      pauseViewBag: id("pauseViewBag"),
      pauseViewCard: id("pauseViewCard"),
      pauseViewSave: id("pauseViewSave"),
      pokedexSummary: id("pokedexSummary"),
      pokedexFilterSelect: id("pokedexFilterSelect"),
      pokedexSearchInput: id("pokedexSearchInput"),
      pokedexGrid: id("pokedexGrid"),
      partyActionFeedback: id("partyActionFeedback"),
      pausePartyList: id("pausePartyList"),
      bagTargetSelect: id("bagTargetSelect"),
      bagActionFeedback: id("bagActionFeedback"),
      pauseBagList: id("pauseBagList"),
      trainerCardHeader: id("trainerCardHeader"),
      trainerCardBadges: id("trainerCardBadges"),
      trainerCardStoryFlags: id("trainerCardStoryFlags"),
      trainerCardFrontier: id("trainerCardFrontier"),
      saveFeedback: id("saveFeedback"),
      pauseSaveSlots: id("pauseSaveSlots"),
      btnExportSaveJson: id("btnExportSaveJson"),

      battleOverlay: id("battleOverlay"),
      battleSafariHint: id("battleSafariHint"),
      battleBannerText: id("battleBannerText"),
      battleEnemyName: id("battleEnemyName"),
      battleEnemyLevel: id("battleEnemyLevel"),
      battleEnemyStatus: id("battleEnemyStatus"),
      battleEnemyCaughtBadge: id("battleEnemyCaughtBadge"),
      battleEnemyHpFill: id("battleEnemyHpFill"),
      battleEnemyHpText: id("battleEnemyHpText"),
      battleEnemySprite: id("battleEnemySprite"),
      battlePlayerName: id("battlePlayerName"),
      battlePlayerLevel: id("battlePlayerLevel"),
      battlePlayerStatus: id("battlePlayerStatus"),
      battlePlayerHpFill: id("battlePlayerHpFill"),
      battlePlayerHpText: id("battlePlayerHpText"),
      battlePlayerExpFill: id("battlePlayerExpFill"),
      battlePlayerSprite: id("battlePlayerSprite"),
      battleForcedNotice: id("battleForcedNotice"),
      btnBattleModeFight: id("btnBattleModeFight"),
      btnBattleModeBag: id("btnBattleModeBag"),
      btnBattleModeSwitch: id("btnBattleModeSwitch"),
      btnBattleRun: id("btnBattleRun"),
      battleMovesGrid: id("battleMovesGrid"),
      battleBagPanel: id("battleBagPanel"),
      battleSwitchPanel: id("battleSwitchPanel"),
      battleLog: id("battleLog"),
      battleFinishBar: id("battleFinishBar"),
      btnBattleContinue: id("btnBattleContinue"),
    };
  }

  async init() {
    this.coreData = await this.loader.loadCoreData();
    this.dataMaps = buildDataMaps({
      species: this.coreData.species,
      moves: this.coreData.moves,
      items: this.coreData.items,
    });
    this.bindEvents();
    this.renderTitleScreen();
    this.startTimeRefreshLoop();
  }

  startTimeRefreshLoop() {
    setInterval(() => {
      if (this.gameState && this.dom.selectTimeOverride.value === "auto") {
        const period = detectTimeOfDay();
        if (this.overworldEngine && this.overworldEngine.timePeriod !== period.key) {
          this.overworldEngine.setTimePeriod(period.key);
        }
        this.updateHud();
      }
    }, 30000);
  }

  getActiveTimePeriod() {
    const val = this.dom.selectTimeOverride.value;
    if (val === "auto") return detectTimeOfDay();
    return detectTimeOfDay(val === "day" ? 12 : val === "evening" ? 18 : 22);
  }

  bindEvents() {
    // Title tabs
    this.dom.tabTitleContinue.addEventListener("click", () => this.switchTitleTab("continue"));
    this.dom.tabTitleNewGame.addEventListener("click", () => this.switchTitleTab("newgame"));
    this.dom.tabTitleImport.addEventListener("click", () => this.switchTitleTab("import"));

    this.dom.inputPlayerName.addEventListener("input", () => {
      this.nameManuallyEdited = true;
    });
    this.dom.newGameSlotSelect.addEventListener("change", () => {
      this.selectedNewGameSlot = Number(this.dom.newGameSlotSelect.value);
      this.updateOverwriteWarning();
    });
    this.dom.btnStartNewGame.addEventListener("click", () => this.startNewGameFromForm());
    this.dom.inputImportFile.addEventListener("change", (e) => this.handleImportFile(e));

    // Overworld controls
    this.dom.selectTimeOverride.addEventListener("change", () => {
      const p = this.getActiveTimePeriod();
      if (this.overworldEngine) this.overworldEngine.setTimePeriod(p.key);
      this.updateHud();
    });
    this.dom.btnToggleBike.addEventListener("click", () => {
      this.overworldEngine?.toggleBike();
    });
    this.dom.btnInteractAction.addEventListener("click", () => this.handleActionPress());
    this.dom.btnTouchA.addEventListener("click", () => this.handleActionPress());
    this.dom.btnOpenPauseMenu.addEventListener("click", () => this.openPauseMenu());
    this.dom.btnTouchMenu.addEventListener("click", () => this.openPauseMenu());
    this.dom.btnOpenTravel.addEventListener("click", () => this.openTravelModal());
    this.dom.btnCloseTravel.addEventListener("click", () => this.closeModal("travelModal"));
    this.dom.btnCloseShop.addEventListener("click", () => this.closeModal("shopModal"));
    this.dom.btnClosePc.addEventListener("click", () => this.closeModal("pcModal"));
    this.dom.btnClosePause.addEventListener("click", () => this.closePauseMenu());
    this.dom.btnReturnTitle.addEventListener("click", () => this.returnToTitleScreen());

    // D-pad & Touch run
    const bindDpad = (btn, dir) => {
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        this.overworldEngine?.pressDirection(dir);
      });
      const stop = () => this.overworldEngine?.releaseDirection(dir);
      btn.addEventListener("pointerup", stop);
      btn.addEventListener("pointerleave", stop);
      btn.addEventListener("pointercancel", stop);
    };
    bindDpad(this.dom.btnDpadUp, "up");
    bindDpad(this.dom.btnDpadDown, "down");
    bindDpad(this.dom.btnDpadLeft, "left");
    bindDpad(this.dom.btnDpadRight, "right");

    this.dom.btnTouchRun.addEventListener("click", () => {
      if (!this.overworldEngine) return;
      const next = !this.overworldEngine.shiftDown;
      this.overworldEngine.setShiftRun(next);
      this.dom.btnTouchRun.classList.toggle("btn-gold", next);
    });

    // Dialogue Advance
    this.dom.btnDialogueNext.addEventListener("click", () => this.advanceDialogue());

    // Pause tabs & filters
    this.dom.pauseTabPokedex.addEventListener("click", () => this.switchPauseTab("pokedex"));
    this.dom.pauseTabParty.addEventListener("click", () => this.switchPauseTab("party"));
    this.dom.pauseTabBag.addEventListener("click", () => this.switchPauseTab("bag"));
    this.dom.pauseTabCard.addEventListener("click", () => this.switchPauseTab("card"));
    this.dom.pauseTabSave.addEventListener("click", () => this.switchPauseTab("save"));
    this.dom.pokedexFilterSelect.addEventListener("change", () => this.renderPausePokedex());
    this.dom.pokedexSearchInput.addEventListener("input", () => this.renderPausePokedex());
    this.dom.btnExportSaveJson.addEventListener("click", () => this.downloadExportedSave());

    // Battle Controls
    this.dom.btnBattleModeFight.addEventListener("click", () => {
      this.battleSubMode = "fight";
      this.renderBattlePanels();
    });
    this.dom.btnBattleModeBag.addEventListener("click", () => {
      this.battleSubMode = "bag";
      this.renderBattlePanels();
    });
    this.dom.btnBattleModeSwitch.addEventListener("click", () => {
      this.battleSubMode = "switch";
      this.renderBattlePanels();
    });
    this.dom.btnBattleRun.addEventListener("click", () => this.onBattleRun());
    this.dom.btnBattleContinue.addEventListener("click", () => this.onBattleContinueClick());

    // Global keyboard shortcuts (Esc / Enter in dialogue)
    window.addEventListener("keydown", (e) => {
      if (!this.gameState || !this.dom.screenTitle.classList.contains("hidden")) return;

      if (e.key === "Escape") {
        if (!this.dom.battleOverlay.classList.contains("hidden")) return;
        e.preventDefault();
        if (!this.dom.shopModal.classList.contains("hidden")) {
          this.closeModal("shopModal");
        } else if (!this.dom.pcModal.classList.contains("hidden")) {
          this.closeModal("pcModal");
        } else if (!this.dom.travelModal.classList.contains("hidden")) {
          this.closeModal("travelModal");
        } else if (!this.dom.dialogueOverlay.classList.contains("hidden")) {
          this.closeDialogue();
        } else if (!this.dom.pauseOverlay.classList.contains("hidden")) {
          this.closePauseMenu();
        } else {
          this.openPauseMenu();
        }
        return;
      }

      if ((e.key === "Enter" || e.key === " ") && !this.dom.dialogueOverlay.classList.contains("hidden")) {
        e.preventDefault();
        const choiceButtons = [...this.dom.dialogueChoices.querySelectorAll("button")];
        if (choiceButtons.length === 1) {
          choiceButtons[0].click();
        }
      }
    });
  }

  handleActionPress() {
    if (!this.dom.dialogueOverlay.classList.contains("hidden")) {
      const choiceButtons = [...this.dom.dialogueChoices.querySelectorAll("button")];
      if (choiceButtons.length === 1) choiceButtons[0].click();
      return;
    }
    this.overworldEngine?.interact();
  }

  // -------------------------------------------------------------------------
  // PANTALLA DE TÍTULO Y RANURAS
  // -------------------------------------------------------------------------
  switchTitleTab(tab) {
    this.dom.tabTitleContinue.classList.toggle("active", tab === "continue");
    this.dom.tabTitleNewGame.classList.toggle("active", tab === "newgame");
    this.dom.tabTitleImport.classList.toggle("active", tab === "import");
    this.dom.panelContinue.classList.toggle("hidden", tab !== "continue");
    this.dom.panelNewGame.classList.toggle("hidden", tab !== "newgame");
    this.dom.panelImportSave.classList.toggle("hidden", tab !== "import");
    if (tab === "continue") this.renderContinueSlots();
    if (tab === "newgame") this.renderNewGameSetup();
  }

  renderTitleScreen() {
    this.dom.screenTitle.classList.remove("hidden");
    this.dom.screenGame.classList.add("hidden");
    this.renderContinueSlots();
    this.renderNewGameSetup();
  }

  renderContinueSlots() {
    const slots = listSaveSlots();
    this.dom.slotContinueGrid.innerHTML = "";

    for (const entry of slots) {
      const card = document.createElement("div");
      card.className = `slot-card ${entry.isEmpty ? "" : "occupied"}`;

      if (entry.isEmpty) {
        card.innerHTML = `
          <div class="slot-header">
            <strong>Ranura ${entry.slot}</strong>
            <span class="slot-badge empty">Vacía</span>
          </div>
          <p style="margin:6px 0; color:#94a3b8; font-size:0.86rem;">
            No hay partida guardada en esta ranura. Puedes iniciar un Nuevo Juego o importar un respaldo .json.
          </p>
          <div class="slot-actions">
            <button type="button" class="btn btn-sm btn-primary" data-create-slot="${entry.slot}">Crear Nueva Partida</button>
          </div>
        `;
        card.querySelector("[data-create-slot]").addEventListener("click", () => {
          this.selectedNewGameSlot = entry.slot;
          this.dom.newGameSlotSelect.value = String(entry.slot);
          this.switchTitleTab("newgame");
        });
      } else if (entry.error) {
        card.innerHTML = `
          <div class="slot-header">
            <strong>Ranura ${entry.slot}</strong>
            <span class="slot-badge" style="background:rgba(239,68,68,0.2);color:#fca5a5;">Error</span>
          </div>
          <p class="alert-box error">${entry.error}</p>
          <div class="slot-actions">
            <button type="button" class="btn btn-sm" data-del-slot="${entry.slot}">Limpiar Ranura</button>
          </div>
        `;
        card.querySelector("[data-del-slot]").addEventListener("click", () => {
          deleteSlot(entry.slot);
          this.renderContinueSlots();
        });
      } else {
        const s = entry.summary;
        const leadImg = s.leadSpeciesId ? this.loader.getPokemonSpritePath(s.leadSpeciesId, "front") : "assets/sprites/pokemon/025_front.png";
        const protagSprite = PROTAGONIST_PROFILES[s.protagonist]?.spriteFile || PROTAGONIST_PROFILES.ash.spriteFile;
        const dateStr = new Date(s.savedAt).toLocaleString();

        card.innerHTML = `
          <div class="slot-header">
            <strong>Ranura ${entry.slot} · ${s.playerName}</strong>
            <span class="slot-badge ${s.mode === "anime" ? "anime" : ""}">${s.mode === "anime" ? "Anime (Ash)" : "Clásico"}</span>
          </div>
          <div class="slot-body">
            <div class="slot-sprites">
              <canvas class="protag-canvas pixelated" width="32" height="32" style="width:40px;height:40px;" data-char-preview="${protagSprite}"></canvas>
              <img class="pixelated" src="${leadImg}" alt="Líder" style="width:44px;height:44px;" />
            </div>
            <div class="slot-meta">
              <span>📍 ${s.mapName}</span>
              <span>🏅 Medallas: ${s.badgesCount}/8 · 🏆 Frontera: ${s.frontierCount}/7</span>
              <span>📘 Pokédex: ${s.pokedexCaught}/151 · 💰 ₽${s.money.toLocaleString()}</span>
              <span style="color:#94a3b8; font-size:0.75rem;">Guardado: ${dateStr}</span>
            </div>
          </div>
          <div class="slot-actions">
            <button type="button" class="btn btn-sm btn-success" data-load-slot="${entry.slot}">▶ Continuar</button>
            <button type="button" class="btn btn-sm btn-ghost" data-del-slot="${entry.slot}">🗑️ Borrar</button>
          </div>
        `;
        this.drawProtagCanvas(card.querySelector("[data-char-preview]"), protagSprite);
        card.querySelector("[data-load-slot]").addEventListener("click", () => {
          const loaded = loadFromSlot(entry.slot, null, this.dataMaps);
          if (loaded) this.enterGame(loaded);
        });
        card.querySelector("[data-del-slot]").addEventListener("click", () => {
          deleteSlot(entry.slot);
          this.renderContinueSlots();
          this.updateOverwriteWarning();
        });
      }
      this.dom.slotContinueGrid.appendChild(card);
    }
  }

  drawProtagCanvas(canvas, spriteFile) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    this.loader
      .loadImage(spriteFile)
      .then((img) => {
        if (!img) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, 32, 32, 0, 0, canvas.width, canvas.height);
      })
      .catch(() => {});
  }

  renderNewGameSetup() {
    this.dom.protagonistSelector.innerHTML = "";
    for (const profile of Object.values(PROTAGONIST_PROFILES)) {
      const card = document.createElement("div");
      card.className = `protagonist-card ${this.selectedProtagonist === profile.id ? "selected" : ""}`;
      card.innerHTML = `
        <div class="protag-top">
          <canvas class="protag-canvas pixelated" width="32" height="32"></canvas>
          <div>
            <strong style="display:block; color:#fef08a;">${profile.title}</strong>
            <span style="font-size:0.78rem; color:#93c5fd;">Rival: ${profile.rivalName} (${profile.rivalStarterLabel})</span>
          </div>
        </div>
        <div style="font-size:0.82rem; color:#e2e8f0;">
          <strong>Inicial:</strong> ${profile.starterLabel}
        </div>
        <p style="margin:0; font-size:0.78rem; color:#94a3b8;">${profile.description}</p>
      `;
      this.drawProtagCanvas(card.querySelector("canvas"), profile.spriteFile);
      card.addEventListener("click", () => {
        this.selectedProtagonist = profile.id;
        if (!this.nameManuallyEdited) {
          this.dom.inputPlayerName.value = profile.defaultName;
        }
        this.renderNewGameSetup();
      });
      this.dom.protagonistSelector.appendChild(card);
    }

    const isAsh = this.selectedProtagonist === "ash";
    this.dom.ashNoticeBox.classList.toggle("hidden", !isAsh);
    this.dom.starterPickerGrid.classList.toggle("hidden", isAsh);

    if (!isAsh) {
      this.dom.starterPickerGrid.innerHTML = "";
      for (const key of STARTER_KEYS) {
        const sp = this.coreData.speciesByKey[key];
        const card = document.createElement("div");
        card.className = `starter-card ${this.selectedStarter === key ? "selected" : ""}`;
        card.innerHTML = `
          <img class="pixelated" src="${this.loader.getPokemonSpritePath(sp.id, "front")}" alt="${sp.name}" />
          <strong style="font-size:0.88rem;">${sp.name}</strong>
          <span style="font-size:0.72rem; color:#94a3b8;">${STARTER_LABELS_ES[key]}</span>
        `;
        card.addEventListener("click", () => {
          this.selectedStarter = key;
          this.renderNewGameSetup();
        });
        this.dom.starterPickerGrid.appendChild(card);
      }
    }

    this.updateOverwriteWarning();
  }

  updateOverwriteWarning() {
    const slot = Number(this.dom.newGameSlotSelect.value || 1);
    const slots = listSaveSlots();
    const target = slots.find((s) => s.slot === slot);
    if (target && !target.isEmpty && target.summary) {
      this.dom.overwriteWarning.classList.remove("hidden");
      this.dom.overwriteWarning.innerHTML = `⚠️ Atención: la <strong>Ranura ${slot}</strong> contiene la partida de <strong>${target.summary.playerName}</strong>. Al iniciar aquí se sobrescribirá únicamente esta ranura.`;
    } else {
      this.dom.overwriteWarning.classList.add("hidden");
    }
  }

  startNewGameFromForm() {
    const slot = Number(this.dom.newGameSlotSelect.value || 1);
    const name = this.dom.inputPlayerName.value.trim();
    const state = createCampaignNewGame({
      slot,
      protagonist: this.selectedProtagonist,
      playerName: name,
      chosenStarterKey: this.selectedProtagonist === "ash" ? "PIKACHU" : this.selectedStarter,
      dataMaps: this.dataMaps,
    });
    saveToSlot(slot, state);
    this.enterGame(state, { isNewGame: true });
  }

  async handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const slot = Number(this.dom.selectImportSlot.value || 1);
    try {
      const text = await file.text();
      const res = importSaveJson(text, slot, null, this.dataMaps);
      this.dom.importFeedback.classList.remove("hidden", "error", "success");
      if (res.ok) {
        this.dom.importFeedback.classList.add("success");
        this.dom.importFeedback.textContent = `${res.message} Pulsa "Continuar" para jugar.`;
        this.renderContinueSlots();
      } else {
        this.dom.importFeedback.classList.add("error");
        this.dom.importFeedback.textContent = res.message;
      }
    } catch (err) {
      this.dom.importFeedback.classList.remove("hidden", "success");
      this.dom.importFeedback.classList.add("error");
      this.dom.importFeedback.textContent = `Error al leer el archivo: ${err.message}`;
    } finally {
      event.target.value = "";
    }
  }

  // -------------------------------------------------------------------------
  // ENTRADA AL JUEGO Y MOTOR OVERWORLD
  // -------------------------------------------------------------------------
  async enterGame(state, { isNewGame = false } = {}) {
    this.gameState = state;
    this.dom.screenTitle.classList.add("hidden");
    this.dom.screenGame.classList.remove("hidden");

    const period = this.getActiveTimePeriod();

    if (!this.overworldEngine) {
      this.overworldEngine = new OverworldEngine({
        canvas: this.dom.overworldCanvas,
        assetLoader: this.loader,
        getDynamicNpcs: (map) => getStoryOverlayNpcsForMap(map, this.gameState, FRONTIER_BRAINS),
        onMapChange: (map) => this.onMapChanged(map),
        onStepTile: (map, x, y) => {
          if (this.gameState?.location) {
            this.gameState.location.mapId = map.id;
            this.gameState.location.mapName = map.displayName || map.name;
            this.gameState.location.x = x;
            this.gameState.location.y = y;
            this.gameState.location.facing = this.overworldEngine.player.facing;
          }
        },
        onEncounterCheck: (map, col) => this.handleWildEncounterStep(map, col),
        onInteract: (payload) => this.handleOverworldInteraction(payload),
        onNotification: (msg) => this.showToast(msg),
      });

      await this.overworldEngine.init({
        initialMapId: state.location.mapId,
        characterKey: state.protagonist,
        timePeriod: period.key,
        spawn: { x: state.location.x, y: state.location.y, suppressWarp: true },
      });
    } else {
      this.overworldEngine.setPaused(false);
      this.overworldEngine.setTimePeriod(period.key);
      await this.overworldEngine.setCharacter(state.protagonist);
      await this.overworldEngine.loadMap(
        state.location.mapId,
        { x: state.location.x, y: state.location.y, suppressWarp: true },
        state.location.facing || "down"
      );
    }

    this.updateHud();

    if (isNewGame) {
      this.startDialogueSequence(
        "Prof. Oak",
        getIntroSceneLines(state).map((line) => ({ text: stripBoldMarkers(line) }))
      );
    }
  }

  returnToTitleScreen() {
    this.closeAllModals();
    if (this.overworldEngine) this.overworldEngine.setPaused(true);
    this.renderTitleScreen();
    this.switchTitleTab("continue");
  }

  onMapChanged(map) {
    if (!this.gameState || !map) return;
    this.gameState.location.mapId = map.id;
    this.gameState.location.mapName = map.displayName || map.name;
    this.gameState.location.x = this.overworldEngine.player.x;
    this.gameState.location.y = this.overworldEngine.player.y;
    this.updateHud();
  }

  updateHud() {
    if (!this.gameState) return;
    const period = this.getActiveTimePeriod();
    this.dom.hudMapName.textContent = this.gameState.location.mapName || this.gameState.location.mapId;
    this.dom.hudTimeBadge.textContent = `${period.icon} ${period.shortLabel}`;
    this.dom.hudMoney.textContent = `₽${(this.gameState.money || 0).toLocaleString()}`;
    this.dom.hudBadges.textContent = `🏅 Medallas: ${this.gameState.badges.length}/8`;
    this.dom.hudSymbols.textContent = `🏆 Frontera: ${this.gameState.frontierSymbols.length}/7`;
    if (this.overworldEngine) {
      this.dom.btnToggleBike.textContent = this.overworldEngine.player.bikeMode ? "🚶 A pie (B)" : "🚲 Bici (B)";
    }
  }

  showToast(msg) {
    this.dom.overworldToast.textContent = msg;
    this.dom.overworldToast.classList.remove("hidden");
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.dom.overworldToast.classList.add("hidden");
    }, 3200);
  }

  // -------------------------------------------------------------------------
  // SISTEMA DE DIÁLOGOS E INTERACCIONES EN KANTO
  // -------------------------------------------------------------------------
  startDialogueSequence(speaker, steps = []) {
    if (!steps || steps.length === 0) return;
    this.dialogueQueue = steps.map((st) => (typeof st === "string" ? { text: st } : st));
    this.dom.dialogueSpeaker.textContent = speaker;
    this.overworldEngine?.setPaused(true);
    this.showCurrentDialogueStep();
  }

  showCurrentDialogueStep() {
    const step = this.dialogueQueue[0];
    if (!step) {
      this.closeDialogue();
      return;
    }
    this.dom.dialogueText.textContent = step.text;
    this.dom.dialogueChoices.innerHTML = "";

    if (Array.isArray(step.choices) && step.choices.length > 0) {
      for (const ch of step.choices) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `btn btn-sm ${ch.primary ? "btn-primary" : ch.gold ? "btn-gold" : ""}`;
        btn.textContent = ch.label;
        btn.addEventListener("click", () => {
          this.closeDialogue();
          if (ch.onSelect) ch.onSelect();
        });
        this.dom.dialogueChoices.appendChild(btn);
      }
    } else {
      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "btn btn-sm btn-primary";
      nextBtn.textContent = this.dialogueQueue.length > 1 ? "Siguiente ▼" : "Cerrar";
      nextBtn.addEventListener("click", () => this.advanceDialogue());
      this.dom.dialogueChoices.appendChild(nextBtn);
    }

    this.dom.dialogueOverlay.classList.remove("hidden");
  }

  advanceDialogue() {
    if (this.dialogueQueue.length <= 1) {
      this.closeDialogue();
      return;
    }
    this.dialogueQueue.shift();
    this.showCurrentDialogueStep();
  }

  closeDialogue() {
    this.dialogueQueue = [];
    this.dom.dialogueOverlay.classList.add("hidden");
    const anyModalOpen =
      !this.dom.battleOverlay.classList.contains("hidden") ||
      !this.dom.pauseOverlay.classList.contains("hidden") ||
      !this.dom.shopModal.classList.contains("hidden") ||
      !this.dom.pcModal.classList.contains("hidden") ||
      !this.dom.travelModal.classList.contains("hidden");
    if (!anyModalOpen) {
      this.overworldEngine?.setPaused(false);
    }
  }

  handleOverworldInteraction({ npc, sign, behavior, map }) {
    if (behavior === 0x83 || (sign && /Computer|PC/i.test(sign.script || ""))) {
      this.openPcModal();
      return;
    }

    if (!npc) {
      if (sign) {
        this.startDialogueSequence("Cartel de Kanto", [
          { text: `Información de zona (${map.displayName || map.name}): sigue explorando o usa Vuelo / Menú para gestionar tu viaje.` },
        ]);
      }
      return;
    }

    // 1. Eventos dinámicos y Overlay NPCs
    if (npc.eventType === "ash_bulbasaur") {
      this.interactAshBulbasaur();
      return;
    }
    if (npc.eventType === "ash_charmander") {
      this.interactAshCharmander();
      return;
    }
    if (npc.eventType === "ash_squirtle") {
      this.interactAshSquirtle();
      return;
    }
    if (npc.eventType === "grand_prix_p1") {
      this.interactGrandPrixP1();
      return;
    }
    if (npc.eventType === "safari_race") {
      this.interactSafariRace();
      return;
    }
    if (npc.eventType === "indigo_league") {
      this.interactIndigoLeague();
      return;
    }
    if (npc.eventType === "frontier_brain") {
      this.interactFrontierBrain(npc.frontierId);
      return;
    }
    if (npc.eventType === "oaks_lab_rival") {
      this.interactOaksLabRival();
      return;
    }

    // 2. Enfermera Joy (Centro Pokémon)
    if (npc.graphicsId === "OBJ_EVENT_GFX_NURSE" || /Nurse/i.test(npc.script || "")) {
      const res = healAtPokemonCenter(this.gameState, this.gameState.location, this.dataMaps.movesMap);
      this.updateHud();
      this.startDialogueSequence("Enfermera Joy", [
        {
          text: res.message,
          choices: [
            { label: "Abrir Caja del PC", gold: true, onSelect: () => this.openPcModal() },
            { label: "¡Gracias!", primary: true },
          ],
        },
      ]);
      return;
    }

    // 3. Dependiente Tienda Pokémon
    if (npc.graphicsId === "OBJ_EVENT_GFX_CLERK" || /Clerk|Mart/i.test(npc.script || "")) {
      this.openShopModal();
      return;
    }

    // 4. Líderes de Gimnasio
    const gym = GYM_BY_MAP_ID[map.id];
    const gymGfxSet = new Set([
      "OBJ_EVENT_GFX_BROCK",
      "OBJ_EVENT_GFX_MISTY",
      "OBJ_EVENT_GFX_LT_SURGE",
      "OBJ_EVENT_GFX_ERIKA",
      "OBJ_EVENT_GFX_KOGA",
      "OBJ_EVENT_GFX_SABRINA",
      "OBJ_EVENT_GFX_BLAINE",
      "OBJ_EVENT_GFX_GIOVANNI",
    ]);
    if (gym && (gymGfxSet.has(npc.graphicsId) || npc.script?.includes(gym.id.toUpperCase()))) {
      const alreadyWon = this.gameState.badges.includes(gym.badgeId);
      this.startDialogueSequence(gym.name, [
        {
          text: alreadyWon
            ? `${gym.introDialogue} (Ya posees la ${gym.badgeName}, ¿quieres una revancha con escalado dinámico?)`
            : gym.introDialogue,
          choices: [
            {
              label: `⚔️ Desafiar a ${gym.name}`,
              primary: true,
              onSelect: () =>
                this.startManagedBattle({
                  kind: "gym",
                  gymLeader: gym,
                  battleType: "leader",
                  trainerName: gym.name,
                  enemyParty: gym.party,
                }),
            },
            { label: "Más tarde" },
          ],
        },
      ]);
      return;
    }

    // 5. Prof. Oak en el Laboratorio
    if (/ProfOak/i.test(npc.script || "")) {
      const dex = getPokedexStats(this.gameState);
      this.startDialogueSequence("Prof. Oak", [
        {
          text: `¡Hola, ${this.gameState.playerName}! Tu Pokédex registra ${dex.seenCount} vistos y ${dex.capturedCount} capturados. ¡Sigue completándola!`,
        },
      ]);
      return;
    }

    // 6. Guardia de puerta Meseta Añil
    if (/DoorGuard/i.test(npc.script || "")) {
      this.interactIndigoLeague();
      return;
    }

    // 7. NPC genérico de ambiente
    this.startDialogueSequence("Habitante de Kanto", [
      { text: `¡Ánimo en tu viaje, ${this.gameState.playerName}! Recuerda curar a tu equipo en los Centros Pokémon.` },
    ]);
  }

  interactOaksLabRival() {
    if (this.gameState.protagonist === "ash") {
      const form = getGaryEeveeEvolution(this.gameState);
      this.startDialogueSequence("Rival Gary", [
        {
          text: `¡Ja, ${this.gameState.playerName}! Mientras tú llegaste tarde, mi Eevee (${form}) no deja de hacerse fuerte. ¿Combate de entrenamiento?`,
          choices: [
            {
              label: "⚔️ Combatir contra Gary",
              primary: true,
              onSelect: () =>
                this.startManagedBattle({
                  kind: "rival",
                  battleType: "trainer",
                  trainerName: "Rival Gary",
                  enemyParty: [
                    { speciesKey: "PIDGEOTTO", baseLevel: 16 },
                    { speciesKey: form, baseLevel: 18 },
                  ],
                }),
            },
            { label: "Luego" },
          ],
        },
      ]);
      return;
    }

    const rivalName = this.gameState.flags.rivalCharacter === "ash" ? "Rival Ash" : "Rival Gary";
    const rivalMon = this.gameState.flags.rivalStarterKey || "PIKACHU";
    this.startDialogueSequence(rivalName, [
      {
        text: `¡${this.gameState.playerName}! Mi ${rivalMon} está listo para medir fuerzas contigo cuando quieras.`,
        choices: [
          {
            label: `⚔️ Combatir contra ${rivalName}`,
            primary: true,
            onSelect: () =>
              this.startManagedBattle({
                kind: "rival",
                battleType: "trainer",
                trainerName: rivalName,
                enemyParty: [{ speciesKey: rivalMon, baseLevel: 7 }],
              }),
          },
          { label: "Cerrar" },
        ],
      },
    ]);
  }

  interactAshBulbasaur() {
    const gate = canTriggerAshEvent("ash_bulbasaur", this.gameState);
    if (!gate.allowed) {
      this.startDialogueSequence("Guardiana Melanie", [{ text: gate.reason }]);
      return;
    }
    const potions = getBagItemCount(this.gameState, "POTION");
    this.startDialogueSequence("Guardiana Melanie", [
      {
        text: "Un Bulbasaur muy valiente protege nuestra aldea oculta cerca de Ciudad Celeste. ¿Demostrarás ser digno de cuidarlo?",
        choices: [
          {
            label: `🧪 Entregar 1 Poción (tienes ${potions})`,
            gold: true,
            onSelect: () => {
              const res = completeAshBulbasaurWithPotion(this.gameState, this.dataMaps);
              this.overworldEngine?.refreshDynamicNpcs();
              this.updateHud();
              this.startDialogueSequence("Guardiana Melanie", [{ text: res.message }]);
            },
          },
          {
            label: "⚔️ Superar combate de prueba",
            primary: true,
            onSelect: () => {
              const encounter = getAshEventTrainerBattle("ash_bulbasaur");
              this.startManagedBattle({
                kind: "ash_event",
                eventId: "ash_bulbasaur",
                battleType: "trainer",
                trainerName: encounter.trainerName,
                enemyParty: encounter.party,
              });
            },
          },
          { label: "Volver luego" },
        ],
      },
    ]);
  }

  interactAshCharmander() {
    const gate = canTriggerAshEvent("ash_charmander", this.gameState);
    if (!gate.allowed) {
      this.startDialogueSequence("Damian", [{ text: gate.reason }]);
      return;
    }
    this.startDialogueSequence("Rescate en Ruta 24", [
      {
        text: "¡Bajo la lluvia espera un Charmander abandonado por Damian! Si derrotas a su cruel ex-entrenador, Charmander confiará en ti.",
        choices: [
          {
            label: "⚔️ Desafiar a Damian y rescatar a Charmander",
            primary: true,
            onSelect: () => {
              const encounter = getAshEventTrainerBattle("ash_charmander");
              this.startManagedBattle({
                kind: "ash_event",
                eventId: "ash_charmander",
                battleType: "trainer",
                trainerName: encounter.trainerName,
                enemyParty: encounter.party,
              });
            },
          },
          { label: "Cancelar" },
        ],
      },
    ]);
  }

  interactAshSquirtle() {
    const gate = canTriggerAshEvent("ash_squirtle", this.gameState);
    if (!gate.allowed) {
      this.startDialogueSequence("Oficial Jenny", [{ text: gate.reason }]);
      return;
    }
    this.startDialogueSequence("Oficial Jenny", [
      {
        text: "¡El Escuadrón Squirtle está causando alboroto en Ciudad Carmín, pero en el fondo buscan un entrenador que crea en ellos!",
        choices: [
          {
            label: "⚔️ Enfrentar al Escuadrón Squirtle",
            primary: true,
            onSelect: () => {
              const encounter = getAshEventTrainerBattle("ash_squirtle");
              this.startManagedBattle({
                kind: "ash_event",
                eventId: "ash_squirtle",
                battleType: "trainer",
                trainerName: encounter.trainerName,
                enemyParty: encounter.party,
              });
            },
          },
          { label: "Cancelar" },
        ],
      },
    ]);
  }

  interactGrandPrixP1() {
    const elig = checkGrandPrixEligibility(this.gameState, this.coreData.speciesByKey);
    if (!elig.eligible) {
      this.startDialogueSequence("Organizador Grand Prix P1", [{ text: elig.message }]);
      return;
    }
    const alreadyWon = Boolean(this.gameState.flags?.wonGrandPrixP1);
    this.startDialogueSequence("Organizador Grand Prix P1", [
      {
        text: `${elig.message} El torneo consta de 3 combates consecutivos. ${alreadyWon ? "(Ya ganaste el campeonato anteriormente)." : ""}`,
        choices: [
          {
            label: "🥊 Iniciar Grand Prix P1 (Ronda 1/3)",
            primary: true,
            onSelect: () => this.launchGrandPrixRound(0),
          },
          { label: "Salir" },
        ],
      },
    ]);
  }

  launchGrandPrixRound(roundIndex) {
    const roundSpec = GRAND_PRIX_P1_ROUNDS[roundIndex];
    if (!roundSpec) return;
    this.startManagedBattle({
      kind: "grand_prix_p1",
      roundIndex,
      bannerLabel: `Grand Prix P1 · Ronda ${roundSpec.round}/3`,
      battleType: "trainer",
      trainerName: roundSpec.trainerName,
      enemyParty: roundSpec.party,
    });
  }

  interactSafariRace() {
    const won = Boolean(this.gameState.flags?.safariRaceWon);
    this.startDialogueSequence("Juez de la Carrera Safari", [
      {
        text: won
          ? "¡Ya eres campeón de la Carrera de la Zona Safari! El bono permanente de encuentros raros y menor tasa de huida está activo."
          : "¡Participa en la Carrera de la Zona Safari! Si ganas, activaremos el bono permanente que atrae Pokémon raros y reduce su tasa de huida.",
        choices: [
          {
            label: won ? "🏁 Correr otra vez" : "🏁 Iniciar Carrera Zona Safari",
            primary: true,
            onSelect: () =>
              this.startManagedBattle({
                kind: "safari_race",
                bannerLabel: "Evento Especial · Carrera de la Zona Safari",
                battleType: "trainer",
                trainerName: SAFARI_RACE_OPPONENT.trainerName,
                enemyParty: SAFARI_RACE_OPPONENT.party,
              }),
          },
          { label: "Cancelar" },
        ],
      },
    ]);
  }

  interactIndigoLeague() {
    const gate = canChallengeLeague(this.gameState);
    if (!gate.allowed) {
      this.startDialogueSequence("Liga Pokémon · Meseta Añil", [{ text: gate.message }]);
      return;
    }

    const e4Gate = canChallengeEliteFour(this.gameState);
    const choices = [
      {
        label: gate.wonTournament
          ? "🏟️ Rejugar Etapa 1: Torneo (5 rondas)"
          : "🏟️ Etapa 1: Torneo de la Liga (5 rondas)",
        primary: !gate.wonTournament,
        onSelect: () => this.launchLeagueTournamentRound(0),
      },
    ];

    if (e4Gate.allowed) {
      choices.push({
        label: "👑 Etapa 2: Alto Mando y Campeón",
        gold: true,
        primary: true,
        onSelect: () => this.launchEliteFourBattle(0),
      });
    }
    choices.push({ label: "Salir" });

    this.startDialogueSequence("Recepción Meseta Añil", [
      {
        text: e4Gate.allowed
          ? "¡Tienes las 8 Medallas y el trofeo del Torneo! Tu acceso a la Etapa 2 (Alto Mando y Campeón) está permanentemente desbloqueado."
          : "¡Felicidades por reunir las 8 Medallas de Kanto! Primero supera la Etapa 1 (Torneo de 5 rondas con curación automática entre rondas).",
        choices,
      },
    ]);
  }

  launchLeagueTournamentRound(roundIndex) {
    const spec = LEAGUE_TOURNAMENT_ROUNDS[roundIndex];
    if (!spec) return;
    this.startManagedBattle({
      kind: "league_tournament",
      roundIndex,
      bannerLabel: `Liga Etapa 1 · ${spec.stageLabel} (${spec.round}/5) · Auto-curación tras ronda`,
      battleType: "leader",
      trainerName: spec.trainerName,
      enemyParty: spec.party,
    });
  }

  launchEliteFourBattle(memberIndex) {
    const seq = getEliteFourSequence(this.gameState);
    const spec = seq[memberIndex];
    if (!spec) return;
    this.startManagedBattle({
      kind: "elite_four",
      memberIndex,
      bannerLabel: `Liga Etapa 2 · ${spec.order}/5: ${spec.trainerName}`,
      battleType: "leader",
      trainerName: spec.trainerName,
      enemyParty: spec.party,
    });
  }

  interactFrontierBrain(brainId) {
    const status = checkFrontierBrainUnlock(brainId, this.gameState);
    const brain = status.brain;
    if (!brain) return;

    if (!status.unlocked) {
      this.startDialogueSequence(`${brain.title} ${brain.name}`, [
        { text: `Desafío bloqueado (${brain.symbolName}). Requisito: ${status.reason}` },
      ]);
      return;
    }

    this.startDialogueSequence(`${brain.title} ${brain.name}`, [
      {
        text: status.defeated
          ? `¡Bienvenido de nuevo, Campeón! Ya posees el ${brain.symbolName}. ¿Quieres un combate de exhibición?`
          : `Has cumplido mi prueba (${brain.locationLabel}). ¡Demuestra que mereces el ${brain.symbolName}!`,
        choices: [
          {
            label: `⚔️ Desafiar a ${brain.name}`,
            primary: true,
            onSelect: () =>
              this.startManagedBattle({
                kind: "frontier_brain",
                frontierId: brain.id,
                bannerLabel: `Batalla de la Frontera · ${brain.title} ${brain.name} (${brain.symbolName})`,
                battleType: "leader",
                trainerName: `${brain.title} ${brain.name}`,
                enemyParty: brain.party,
              }),
          },
          { label: "Prepararme primero" },
        ],
      },
    ]);
  }

  // -------------------------------------------------------------------------
  // VIAJE RÁPIDO / TIENDA / CAJA DEL PC / PAUSA
  // -------------------------------------------------------------------------
  openTravelModal() {
    this.overworldEngine?.setPaused(true);
    this.dom.travelHubsList.innerHTML = "";
    for (const hub of KANTO_HUBS) {
      const card = document.createElement("div");
      card.className = "info-card";
      card.innerHTML = `
        <strong style="color:#fef08a; font-size:0.92rem;">${hub.name}</strong>
        <span style="font-size:0.78rem; color:#94a3b8;">Mapa: ${hub.mapId} (${hub.x}, ${hub.y})</span>
        <button type="button" class="btn btn-sm btn-primary" style="margin-top:auto;">✈️ Viajar aquí</button>
      `;
      card.querySelector("button").addEventListener("click", async () => {
        this.closeModal("travelModal");
        await this.overworldEngine.loadMap(hub.mapId, { x: hub.x, y: hub.y, suppressWarp: true }, "up");
        this.overworldEngine.setPaused(false);
      });
      this.dom.travelHubsList.appendChild(card);
    }
    this.dom.travelModal.classList.remove("hidden");
  }

  openShopModal() {
    this.overworldEngine?.setPaused(true);
    this.dom.shopFeedback.classList.add("hidden");
    this.renderShopCatalog();
    this.dom.shopModal.classList.remove("hidden");
  }

  renderShopCatalog() {
    this.dom.shopPlayerMoney.textContent = `₽${(this.gameState.money || 0).toLocaleString()}`;
    const catalog = getMartCatalog(this.coreData.items);
    this.dom.shopCatalogList.innerHTML = "";

    for (const item of catalog) {
      const owned = getBagItemCount(this.gameState, item.normKey);
      const card = document.createElement("div");
      card.className = "info-card";
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <strong style="color:#fef08a;">${item.name}</strong>
          <span class="hud-pill gold">₽${item.price.toLocaleString()}</span>
        </div>
        <p style="margin:0; font-size:0.8rem; color:#cbd5e1;">${item.description}</p>
        ${
          item.evolutionSummary
            ? `<div style="font-size:0.76rem; color:#86efac; background:rgba(22,163,74,0.15); padding:5px 8px; border-radius:8px;">
                <strong>Evoluciona a:</strong> ${item.evolutionSummary}
              </div>`
            : ""
        }
        <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-top:auto;">
          <span style="font-size:0.78rem; color:#94a3b8;">En mochila: <strong>${owned}</strong></span>
          <div style="display:flex; gap:5px;">
            <button type="button" class="btn btn-sm btn-primary" data-buy="1">x1</button>
            <button type="button" class="btn btn-sm btn-gold" data-buy="5">x5</button>
          </div>
        </div>
      `;
      card.querySelectorAll("[data-buy]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const qty = Number(btn.getAttribute("data-buy"));
          const res = buyMartItem(this.gameState, item.normKey, qty, this.dataMaps.itemsMap);
          this.dom.shopFeedback.classList.remove("hidden", "error", "success");
          this.dom.shopFeedback.classList.add(res.ok ? "success" : "error");
          this.dom.shopFeedback.textContent = res.message;
          this.updateHud();
          this.renderShopCatalog();
        });
      });
      this.dom.shopCatalogList.appendChild(card);
    }
  }

  openPcModal() {
    this.overworldEngine?.setPaused(true);
    this.selectedPcPartyIdx = null;
    this.renderPcModal();
    this.dom.pcModal.classList.remove("hidden");
  }

  renderPcModal() {
    this.dom.pcPartyCount.textContent = String(this.gameState.party.length);
    this.dom.pcBoxCount.textContent = String(this.gameState.pcBox.length);
    this.dom.pcPartyList.innerHTML = "";
    this.dom.pcBoxList.innerHTML = "";

    this.gameState.party.forEach((mon, idx) => {
      const row = document.createElement("div");
      row.className = "info-card";
      if (this.selectedPcPartyIdx === idx) {
        row.style.borderColor = "#fbbf24";
      }
      row.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <img class="pixelated" src="${this.loader.getPokemonSpritePath(mon.speciesId, "front")}" style="width:36px;height:36px;" alt="${mon.name}" />
            <div>
              <strong>${mon.name}</strong> <span style="font-size:0.78rem; color:#94a3b8;">Nv.${mon.level} · ${mon.currentHp}/${mon.maxHp} PS</span>
            </div>
          </div>
          <div style="display:flex; gap:4px;">
            <button type="button" class="btn btn-sm ${this.selectedPcPartyIdx === idx ? "btn-gold" : ""}" data-select-party="${idx}">Intercambiar</button>
            <button type="button" class="btn btn-sm btn-ghost" data-dep-party="${idx}">Depositar</button>
          </div>
        </div>
      `;
      row.querySelector("[data-select-party]").addEventListener("click", () => {
        this.selectedPcPartyIdx = this.selectedPcPartyIdx === idx ? null : idx;
        this.dom.pcSelectedInfo.textContent =
          this.selectedPcPartyIdx !== null
            ? `Seleccionado ${mon.name}. Ahora haz clic en un Pokémon de la Caja para intercambiarlo.`
            : "Haz clic en un Pokémon de la Caja para pasarlo al equipo.";
        this.renderPcModal();
      });
      row.querySelector("[data-dep-party]").addEventListener("click", () => {
        const res = depositPartyPokemonToBox(this.gameState, idx);
        this.dom.pcSelectedInfo.textContent = res.message;
        this.selectedPcPartyIdx = null;
        this.renderPcModal();
      });
      this.dom.pcPartyList.appendChild(row);
    });

    if (this.gameState.pcBox.length === 0) {
      this.dom.pcBoxList.innerHTML = `<div class="alert-box">La Caja del PC está vacía. Captura más Pokémon en Kanto.</div>`;
      return;
    }

    this.gameState.pcBox.forEach((mon, boxIdx) => {
      const row = document.createElement("div");
      row.className = "info-card";
      row.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <img class="pixelated" src="${this.loader.getPokemonSpritePath(mon.speciesId, "front")}" style="width:36px;height:36px;" alt="${mon.name}" />
            <div>
              <strong>${mon.name}</strong> <span style="font-size:0.78rem; color:#94a3b8;">Nv.${mon.level} · ${mon.types.join("/")}</span>
            </div>
          </div>
          <button type="button" class="btn btn-sm btn-success">${this.selectedPcPartyIdx !== null ? "Intercambiar" : "Sacar al equipo"}</button>
        </div>
      `;
      row.querySelector("button").addEventListener("click", () => {
        const res = swapPartyAndBox(this.gameState, this.selectedPcPartyIdx, boxIdx);
        this.dom.pcSelectedInfo.textContent = res.message;
        this.selectedPcPartyIdx = null;
        this.renderPcModal();
      });
      this.dom.pcBoxList.appendChild(row);
    });
  }

  closeModal(domKey) {
    this.dom[domKey].classList.add("hidden");
    const anyOpen =
      !this.dom.battleOverlay.classList.contains("hidden") ||
      !this.dom.pauseOverlay.classList.contains("hidden") ||
      !this.dom.shopModal.classList.contains("hidden") ||
      !this.dom.pcModal.classList.contains("hidden") ||
      !this.dom.travelModal.classList.contains("hidden") ||
      !this.dom.dialogueOverlay.classList.contains("hidden");
    if (!anyOpen) {
      this.overworldEngine?.setPaused(false);
    }
  }

  closeAllModals() {
    this.dom.travelModal.classList.add("hidden");
    this.dom.shopModal.classList.add("hidden");
    this.dom.pcModal.classList.add("hidden");
    this.dom.pauseOverlay.classList.add("hidden");
    this.dom.battleOverlay.classList.add("hidden");
    this.dom.dialogueOverlay.classList.add("hidden");
  }

  // -------------------------------------------------------------------------
  // MENÚ DE PAUSA INTEGRADO (Pokédex / Equipo / Mochila / Ficha / Guardar)
  // -------------------------------------------------------------------------
  openPauseMenu(tab = null) {
    if (!this.gameState) return;
    if (!this.dom.battleOverlay.classList.contains("hidden")) return;
    this.overworldEngine?.setPaused(true);
    this.dom.pauseOverlay.classList.remove("hidden");
    this.switchPauseTab(tab || this.selectedPauseTab);
  }

  closePauseMenu() {
    this.closeModal("pauseOverlay");
  }

  switchPauseTab(tab) {
    this.selectedPauseTab = tab;
    const mapTabs = {
      pokedex: [this.dom.pauseTabPokedex, this.dom.pauseViewPokedex],
      party: [this.dom.pauseTabParty, this.dom.pauseViewParty],
      bag: [this.dom.pauseTabBag, this.dom.pauseViewBag],
      card: [this.dom.pauseTabCard, this.dom.pauseViewCard],
      save: [this.dom.pauseTabSave, this.dom.pauseViewSave],
    };
    for (const [k, [btn, view]] of Object.entries(mapTabs)) {
      btn.classList.toggle("active", k === tab);
      view.classList.toggle("hidden", k !== tab);
    }

    if (tab === "pokedex") this.renderPausePokedex();
    if (tab === "party") this.renderPauseParty();
    if (tab === "bag") this.renderPauseBag();
    if (tab === "card") this.renderPauseCard();
    if (tab === "save") this.renderPauseSaveSlots();
  }

  renderPausePokedex() {
    const stats = getPokedexStats(this.gameState);
    this.dom.pokedexSummary.textContent = `Vistos: ${stats.seenCount}/151 · Capturados: ${stats.capturedCount}/151`;

    const seenSet = new Set(this.gameState.pokedex.seen);
    const caughtSet = new Set(this.gameState.pokedex.captured);
    const filterMode = this.dom.pokedexFilterSelect.value;
    const query = this.dom.pokedexSearchInput.value.trim().toLowerCase();

    const filtered = this.coreData.species.filter((sp) => {
      if (filterMode === "captured" && !caughtSet.has(sp.id)) return false;
      if (filterMode === "seen" && !seenSet.has(sp.id)) return false;
      if (query) {
        const matchesName = sp.name.toLowerCase().includes(query) || String(sp.id).includes(query);
        if (!matchesName) return false;
      }
      return true;
    });

    this.dom.pokedexGrid.innerHTML = "";
    for (const sp of filtered) {
      const seen = seenSet.has(sp.id);
      const caught = caughtSet.has(sp.id);
      const periodLabel =
        sp.activityPeriod === "diurnal"
          ? "☀️ Diurno"
          : sp.activityPeriod === "nocturnal"
          ? "🌙 Nocturno"
          : "🌓 Todo el día";
      const evoText = stripBoldMarkers(
        formatEvolutionGuide(
          sp.key,
          this.coreData.evolutionsByKey,
          this.coreData.evolutionsById,
          this.coreData.speciesByKey
        )
      );

      const card = document.createElement("div");
      card.className = "info-card";
      card.innerHTML = `
        <div class="info-card-top">
          <img class="pixelated ${seen ? "" : "silhouette"}" src="${this.loader.getPokemonSpritePath(sp.id, "front")}" alt="${sp.name}" />
          <div>
            <strong style="display:block;">#${String(sp.id).padStart(3, "0")} ${seen ? sp.name : "???"}</strong>
            <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">
              ${sp.types.map((t) => `<span class="type-pill">${t}</span>`).join("")}
              <span class="habit-pill">${periodLabel}</span>
            </div>
          </div>
        </div>
        <div style="font-size:0.76rem; color:${caught ? "#86efac" : seen ? "#93c5fd" : "#94a3b8"};">
          ${caught ? "🟢 Capturado" : seen ? "👁️ Avistado" : "⬜ Sin registrar"} · CatchRate: ${sp.catchRate}
        </div>
        <div style="font-size:0.78rem; color:#cbd5e1; background:rgba(11,16,27,0.55); padding:6px 8px; border-radius:8px;">
          <strong>Evolución:</strong> ${evoText}
        </div>
      `;
      this.dom.pokedexGrid.appendChild(card);
    }
  }

  renderPauseParty() {
    this.dom.pausePartyList.innerHTML = "";
    const evoItemsInBag = this.coreData.items.filter(
      (it) => it.category === "evolution" && getBagItemCount(this.gameState, it.key) > 0
    );

    this.gameState.party.forEach((mon, idx) => {
      const ratio = mon.maxHp > 0 ? mon.currentHp / mon.maxHp : 0;
      const curBaseExp = getExpForLevel(mon.growthRate, mon.level);
      const nextExp = getExpForLevel(mon.growthRate, Math.min(100, mon.level + 1));
      const expRatio = nextExp > curBaseExp ? Math.min(1, Math.max(0, (mon.exp - curBaseExp) / (nextExp - curBaseExp))) : 1;

      const compatibleItems = evoItemsInBag.filter(
        (it) => getAvailableEvolutionsForItem(mon, it.key, this.coreData.evolutionsByKey).length > 0
      );

      const card = document.createElement("div");
      card.className = "info-card";
      card.innerHTML = `
        <div class="info-card-top">
          <img class="pixelated" src="${this.loader.getPokemonSpritePath(mon.speciesId, "front")}" alt="${mon.name}" />
          <div style="flex:1;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong>${mon.name}</strong>
              <span style="font-size:0.82rem; font-weight:700; color:#fef08a;">Nv. ${mon.level}</span>
            </div>
            <div style="display:flex; gap:4px; margin:3px 0;">
              ${mon.types.map((t) => `<span class="type-pill">${t}</span>`).join("")}
              ${mon.status ? `<span class="type-pill" style="background:#b91c1c;">${STATUS_LABELS[mon.status] || mon.status}</span>` : ""}
            </div>
            <div class="hp-bar-track"><div class="hp-bar-fill ${hpColorClass(ratio)}" style="width:${Math.round(ratio * 100)}%;"></div></div>
            <div style="font-size:0.74rem; color:#cbd5e1; margin-top:2px;">PS ${mon.currentHp}/${mon.maxHp} · EXP ${Math.round(expRatio * 100)}%</div>
          </div>
        </div>
        <div style="font-size:0.76rem; color:#94a3b8;">
          Movimientos: ${mon.moves.map((m) => `${m.name} (${m.currentPp}/${m.maxPp})`).join(" · ")}
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:auto;">
          ${idx > 0 ? `<button type="button" class="btn btn-sm" data-lead-idx="${idx}">⬆️ Hacer Líder</button>` : `<span class="hud-pill" style="font-size:0.74rem;">★ Líder</span>`}
          ${compatibleItems
            .map(
              (it) =>
                `<button type="button" class="btn btn-sm btn-gold" data-evo-item="${it.key}" data-evo-idx="${idx}">✨ Usar ${it.name}</button>`
            )
            .join("")}
        </div>
      `;

      const leadBtn = card.querySelector("[data-lead-idx]");
      if (leadBtn) {
        leadBtn.addEventListener("click", () => {
          reorderParty(this.gameState, idx, 0);
          this.renderPauseParty();
        });
      }
      card.querySelectorAll("[data-evo-item]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const itemKey = btn.getAttribute("data-evo-item");
          const pIdx = Number(btn.getAttribute("data-evo-idx"));
          const res = useOverworldItem(
            this.gameState,
            itemKey,
            pIdx,
            this.dataMaps,
            this.coreData.evolutionsByKey
          );
          this.dom.partyActionFeedback.classList.remove("hidden", "error", "success");
          this.dom.partyActionFeedback.classList.add(res.ok ? "success" : "error");
          this.dom.partyActionFeedback.textContent = res.message;
          this.renderPauseParty();
        });
      });

      this.dom.pausePartyList.appendChild(card);
    });
  }

  renderPauseBag() {
    this.dom.bagTargetSelect.innerHTML = "";
    this.gameState.party.forEach((mon, idx) => {
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = `${mon.name} (Nv.${mon.level} · ${mon.currentHp}/${mon.maxHp} PS${mon.status ? ` · ${mon.status}` : ""})`;
      this.dom.bagTargetSelect.appendChild(opt);
    });

    this.dom.pauseBagList.innerHTML = "";
    const entries = Object.entries(this.gameState.bag || {}).filter(([, qty]) => qty > 0);
    if (entries.length === 0) {
      this.dom.pauseBagList.innerHTML = `<div class="alert-box">Tu mochila está vacía. Visita cualquier Tienda Pokémon para equiparte.</div>`;
      return;
    }

    for (const [key, qty] of entries) {
      const norm = normalizeItemKey(key);
      const item = this.dataMaps.itemsMap[norm] || this.dataMaps.itemsMap[key];
      if (!item) continue;

      const card = document.createElement("div");
      card.className = "info-card";
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:#fef08a;">${item.name}</strong>
          <span class="hud-pill">x${qty}</span>
        </div>
        <p style="margin:0; font-size:0.8rem; color:#cbd5e1;">${item.description}</p>
        <div style="margin-top:auto;">
          ${
            item.usableInOverworld
              ? `<button type="button" class="btn btn-sm btn-primary" data-use-item="${norm}">Usar en seleccionado</button>`
              : `<span style="font-size:0.75rem; color:#94a3b8;">Solo utilizable durante combates</span>`
          }
        </div>
      `;

      const useBtn = card.querySelector("[data-use-item]");
      if (useBtn) {
        useBtn.addEventListener("click", () => {
          const targetIdx = Number(this.dom.bagTargetSelect.value || 0);
          const res = useOverworldItem(
            this.gameState,
            norm,
            targetIdx,
            this.dataMaps,
            this.coreData.evolutionsByKey
          );
          this.dom.bagActionFeedback.classList.remove("hidden", "error", "success");
          this.dom.bagActionFeedback.classList.add(res.ok ? "success" : "error");
          this.dom.bagActionFeedback.textContent = res.message;
          this.renderPauseBag();
        });
      }
      this.dom.pauseBagList.appendChild(card);
    }
  }

  renderPauseCard() {
    const p = PROTAGONIST_PROFILES[this.gameState.protagonist];
    const dex = getPokedexStats(this.gameState);
    const eeveeInfo =
      this.gameState.protagonist === "ash"
        ? `· Eevee de Gary: <strong>${getGaryEeveeEvolution(this.gameState)}</strong> (${this.gameState.flags.rivalWins || 0}V / ${this.gameState.flags.rivalLosses || 0}D)`
        : "";

    this.dom.trainerCardHeader.innerHTML = `
      <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
        <canvas id="cardProtagCanvas" class="protag-canvas pixelated" width="32" height="32"></canvas>
        <div>
          <strong style="font-size:1.1rem; color:#fef08a;">${this.gameState.playerName} — ${p.title}</strong>
          <div style="font-size:0.84rem; color:#cbd5e1; margin-top:4px;">
            💰 ₽${this.gameState.money.toLocaleString()} · 📘 Pokédex: ${dex.capturedCount}/151 (${dex.seenCount} vistos) · 💻 PC Box: ${this.gameState.pcBox.length}
          </div>
          <div style="font-size:0.82rem; color:#93c5fd; margin-top:2px;">
            Rival: ${p.rivalName} (${this.gameState.flags.rivalStarterKey}) ${eeveeInfo}
          </div>
        </div>
      </div>
    `;
    this.drawProtagCanvas(document.getElementById("cardProtagCanvas"), p.spriteFile);

    // 8 Badges
    this.dom.trainerCardBadges.innerHTML = GYM_LEADERS.map((g) => {
      const earned = this.gameState.badges.includes(g.badgeId);
      return `<div class="badge-chip ${earned ? "earned" : ""}">
        <strong>${earned ? "🏅" : "🔒"} ${g.badgeName}</strong>
        <div style="font-size:0.75rem; color:#94a3b8;">${g.city} (${g.name})</div>
      </div>`;
    }).join("");

    // Story Milestones
    const milestones = [
      { label: "Aldea Bulbasaur (Ash)", done: Boolean(this.gameState.flags.ashBulbasaurObtained), hidden: this.gameState.protagonist !== "ash" },
      { label: "Rescate Charmander (Ash)", done: Boolean(this.gameState.flags.ashCharmanderObtained), hidden: this.gameState.protagonist !== "ash" },
      { label: "Escuadrón Squirtle (Ash)", done: Boolean(this.gameState.flags.ashSquirtleObtained), hidden: this.gameState.protagonist !== "ash" },
      { label: "Grand Prix P1 (Fucsia)", done: Boolean(this.gameState.flags.wonGrandPrixP1) },
      { label: "Carrera Zona Safari", done: Boolean(this.gameState.flags.safariRaceWon) },
      { label: "Liga Etapa 1: Torneo 5 Rondas", done: Boolean(this.gameState.flags.wonLeagueTournament) },
      { label: "Liga Etapa 2: Campeón Alto Mando", done: Boolean(this.gameState.flags.wonEliteFour) },
    ].filter((m) => !m.hidden);

    this.dom.trainerCardStoryFlags.innerHTML = milestones
      .map(
        (m) =>
          `<div class="badge-chip ${m.done ? "earned" : ""}">${m.done ? "✅" : "⬜"} ${m.label}</div>`
      )
      .join("");

    // 7 Frontier Brains
    const frontierStatus = getAllFrontierStatus(this.gameState);
    this.dom.trainerCardFrontier.innerHTML = frontierStatus
      .map(
        (b) => `
      <div class="info-card ${b.unlocked || b.defeated ? "" : "locked"}">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>${b.defeated ? "🏆" : b.unlocked ? "🔓" : "🔒"} ${b.title} ${b.name}</strong>
          <span class="type-pill">${b.symbolName}</span>
        </div>
        <div style="font-size:0.78rem; color:#93c5fd;">📍 ${b.locationLabel}</div>
        <div style="font-size:0.76rem; color:${b.defeated ? "#86efac" : b.unlocked ? "#fde047" : "#94a3b8"};">
          ${b.defeated ? "Símbolo obtenido" : b.unlocked ? "Desbloqueado — Listo para combatir" : b.reason}
        </div>
      </div>`
      )
      .join("");
  }

  renderPauseSaveSlots() {
    const slots = listSaveSlots();
    this.dom.pauseSaveSlots.innerHTML = "";
    for (const s of slots) {
      const card = document.createElement("div");
      card.className = `slot-card ${s.isEmpty ? "" : "occupied"}`;
      const isCurrent = this.gameState.slot === s.slot;
      card.innerHTML = `
        <div class="slot-header">
          <strong>Ranura ${s.slot} ${isCurrent ? "(Activa)" : ""}</strong>
          <span class="slot-badge ${s.isEmpty ? "empty" : ""}">${s.isEmpty ? "Vacía" : s.summary?.playerName || "Ocupada"}</span>
        </div>
        <div style="font-size:0.8rem; color:#94a3b8;">
          ${s.isEmpty ? "Lista para guardar." : `${s.summary?.mapName} · Medallas: ${s.summary?.badgesCount}/8`}
        </div>
        <button type="button" class="btn btn-sm btn-primary" data-save-slot="${s.slot}">💾 Guardar aquí</button>
      `;
      card.querySelector("[data-save-slot]").addEventListener("click", () => {
        this.gameState.slot = s.slot;
        saveToSlot(s.slot, this.gameState);
        this.dom.saveFeedback.classList.remove("hidden", "error");
        this.dom.saveFeedback.classList.add("success");
        this.dom.saveFeedback.textContent = `¡Partida guardada correctamente en la Ranura ${s.slot}!`;
        this.renderPauseSaveSlots();
      });
      this.dom.pauseSaveSlots.appendChild(card);
    }
  }

  downloadExportedSave() {
    const jsonText = exportSaveJson(this.gameState);
    const blob = new Blob([jsonText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = createExportFilename(this.gameState);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    this.dom.saveFeedback.classList.remove("hidden", "error");
    this.dom.saveFeedback.classList.add("success");
    this.dom.saveFeedback.textContent = "Respaldo .json exportado y descargado correctamente.";
  }

  // -------------------------------------------------------------------------
  // ENCUENTROS SALVAJES Y MOTOR DE COMBATE INTEGRADO (FASE 2 + FASE 3)
  // -------------------------------------------------------------------------
  handleWildEncounterStep(map, tileCollision) {
    if (!this.gameState || !this.dom.battleOverlay.classList.contains("hidden")) return;
    const period = this.getActiveTimePeriod();
    const encounter = rollWildEncounter({
      map,
      tileCollision,
      timeKey: period.key,
      wildZonesByMapId: this.coreData.wildZonesByMapId,
      speciesByKey: this.coreData.speciesByKey,
      safariRaceWon: Boolean(this.gameState.flags?.safariRaceWon),
    });
    if (!encounter) return;

    this.startManagedBattle({
      kind: "wild",
      battleType: "wild",
      trainerName: "Pokémon Salvaje",
      bannerLabel: `Salvaje en ${encounter.mapName} · ${period.icon} ${period.shortLabel}${encounter.ignoresTime ? " (Cueva)" : ""}`,
      isSafariZone: encounter.isSafariZone,
      safariFleeRate: encounter.effectiveSafariFleeRate,
      enemyParty: [{ speciesKey: encounter.species.key, baseLevel: encounter.level }],
    });
  }

  startManagedBattle(ctx) {
    const livingIdx = this.gameState.party.findIndex((m) => m.currentHp > 0);
    if (livingIdx === -1) {
      this.showToast("Todos tus Pokémon están debilitados. ¡Cura al equipo primero!");
      return;
    }

    this.overworldEngine?.setPaused(true);
    this.activeBattleContext = ctx;
    this.battleSubMode = "fight";

    this.battleEngine = new BattleEngine({
      playerParty: this.gameState.party,
      enemyParty: ctx.enemyParty,
      battleType: ctx.battleType,
      trainerName: ctx.trainerName,
      speciesMap: this.dataMaps.speciesMap,
      movesMap: this.dataMaps.movesMap,
      typeChart: this.coreData.typeChart,
      itemsMap: this.dataMaps.itemsMap,
      safariBoostActive: Boolean(ctx.isSafariZone && this.gameState.flags?.safariRaceWon),
    });

    this.markEnemyActiveSeen();
    this.dom.battleFinishBar.classList.add("hidden");
    this.dom.battleOverlay.classList.remove("hidden");
    this.renderBattleUI();
  }

  markEnemyActiveSeen() {
    if (!this.battleEngine || !this.gameState) return;
    const foe = this.battleEngine.getActive("enemy");
    if (foe?.speciesId) {
      markSeen(this.gameState, foe.speciesId);
    }
  }

  renderBattleUI() {
    const state = this.battleEngine.getState();
    const enemy = state.enemySide.active;
    const player = state.playerSide.active;
    this.markEnemyActiveSeen();

    this.dom.battleBannerText.textContent =
      this.activeBattleContext?.bannerLabel ||
      (state.battleType === "wild" ? "Combate Salvaje" : `Entrenador: ${state.trainerName}`);

    if (this.activeBattleContext?.isSafariZone) {
      const fleeRate = getEffectiveSafariFleeRate(enemy, Boolean(this.gameState.flags?.safariRaceWon));
      this.dom.battleSafariHint.classList.remove("hidden");
      this.dom.battleSafariHint.textContent = this.gameState.flags?.safariRaceWon
        ? `🏎️ Bono Carrera Safari activo (Ratio huida reducido: ${fleeRate})`
        : `Zona Safari (Ratio huida: ${fleeRate})`;
    } else {
      this.dom.battleSafariHint.classList.add("hidden");
    }

    // Enemy HUD & Sprite
    this.dom.battleEnemyName.textContent = enemy.name;
    this.dom.battleEnemyLevel.textContent = `Nv. ${enemy.level}`;
    const eRatio = enemy.maxHp > 0 ? enemy.currentHp / enemy.maxHp : 0;
    this.dom.battleEnemyHpFill.style.width = `${Math.max(0, Math.round(eRatio * 100))}%`;
    this.dom.battleEnemyHpFill.className = `hp-bar-fill ${hpColorClass(eRatio)}`;
    this.dom.battleEnemyHpText.textContent = `${enemy.currentHp}/${enemy.maxHp} PS`;
    this.dom.battleEnemySprite.src = this.loader.getPokemonSpritePath(enemy.speciesId, "front");
    this.dom.battleEnemyCaughtBadge.classList.toggle(
      "hidden",
      !(state.battleType === "wild" && this.gameState.pokedex.captured.includes(enemy.speciesId))
    );
    if (enemy.status) {
      this.dom.battleEnemyStatus.classList.remove("hidden");
      this.dom.battleEnemyStatus.textContent = STATUS_LABELS[enemy.status] || enemy.status;
    } else {
      this.dom.battleEnemyStatus.classList.add("hidden");
    }

    // Player HUD & Sprite
    this.dom.battlePlayerName.textContent = player.name;
    this.dom.battlePlayerLevel.textContent = `Nv. ${player.level}`;
    const pRatio = player.maxHp > 0 ? player.currentHp / player.maxHp : 0;
    this.dom.battlePlayerHpFill.style.width = `${Math.max(0, Math.round(pRatio * 100))}%`;
    this.dom.battlePlayerHpFill.className = `hp-bar-fill ${hpColorClass(pRatio)}`;
    this.dom.battlePlayerHpText.textContent = `${player.currentHp}/${player.maxHp} PS`;
    this.dom.battlePlayerSprite.src = this.loader.getPokemonSpritePath(player.speciesId, "back");
    if (player.status) {
      this.dom.battlePlayerStatus.classList.remove("hidden");
      this.dom.battlePlayerStatus.textContent = STATUS_LABELS[player.status] || player.status;
    } else {
      this.dom.battlePlayerStatus.classList.add("hidden");
    }

    const curBaseExp = getExpForLevel(player.growthRate, player.level);
    const nextExp = getExpForLevel(player.growthRate, Math.min(100, player.level + 1));
    const expPct = nextExp > curBaseExp ? Math.min(100, Math.max(0, ((player.exp - curBaseExp) / (nextExp - curBaseExp)) * 100)) : 100;
    this.dom.battlePlayerExpFill.style.width = `${Math.round(expPct)}%`;

    this.dom.battleForcedNotice.classList.toggle("hidden", !state.awaitingPlayerSwitch);
    if (state.awaitingPlayerSwitch) {
      this.battleSubMode = "switch";
    }

    this.dom.btnBattleModeFight.disabled = state.status !== "active" || state.awaitingPlayerSwitch;
    this.dom.btnBattleModeBag.disabled = state.status !== "active" || state.awaitingPlayerSwitch;
    this.dom.btnBattleModeSwitch.disabled = state.status !== "active";
    this.dom.btnBattleRun.disabled = state.status !== "active" || state.awaitingPlayerSwitch;

    // Logs
    this.dom.battleLog.innerHTML = state.logs
      .slice(-18)
      .map((l) => `<div class="battle-log-entry ${l.kind}">${stripBoldMarkers(l.message)}</div>`)
      .join("");
    this.dom.battleLog.scrollTop = this.dom.battleLog.scrollHeight;

    // Finish bar
    const isFinished = state.status !== "active";
    this.dom.battleFinishBar.classList.toggle("hidden", !isFinished);
    if (isFinished) {
      this.dom.btnBattleContinue.textContent =
        state.status === "player_win" || state.status === "caught" ? "Continuar ▶" : "Finalizar";
    }

    this.renderBattlePanels();
  }

  renderBattlePanels() {
    const state = this.battleEngine.getState();
    const isFinished = state.status !== "active";
    const mode = state.awaitingPlayerSwitch ? "switch" : this.battleSubMode;

    this.dom.battleMovesGrid.classList.toggle("hidden", isFinished || mode !== "fight");
    this.dom.battleBagPanel.classList.toggle("hidden", isFinished || mode !== "bag");
    this.dom.battleSwitchPanel.classList.toggle("hidden", isFinished || mode !== "switch");

    if (isFinished) return;

    // Moves Grid
    if (mode === "fight") {
      const active = state.playerSide.active;
      const anyPp = active.moves.some((m) => m.currentPp > 0);
      this.dom.battleMovesGrid.innerHTML = "";
      if (!anyPp) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "move-btn";
        btn.innerHTML = `<strong>Forcejeo</strong><span>NORMAL · Potencia 50</span>`;
        btn.addEventListener("click", () => {
          this.battleEngine.executeTurn({ type: "move", struggle: true, moveIndex: -1 });
          this.renderBattleUI();
        });
        this.dom.battleMovesGrid.appendChild(btn);
      } else {
        active.moves.forEach((mv, idx) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "move-btn";
          btn.disabled = mv.currentPp <= 0;
          btn.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong>${mv.name}</strong>
              <span class="type-pill">${mv.type}</span>
            </div>
            <span style="font-size:0.75rem; color:#cbd5e1;">
              ${mv.power > 0 ? `Pot.${mv.power}` : "Estado"} · Prec.${mv.accuracy || "∞"} · PP ${mv.currentPp}/${mv.maxPp}
            </span>
          `;
          btn.addEventListener("click", () => {
            this.battleEngine.executeTurn({ type: "move", moveIndex: idx });
            this.renderBattleUI();
          });
          this.dom.battleMovesGrid.appendChild(btn);
        });
      }
    }

    // Battle Bag
    if (mode === "bag") {
      this.dom.battleBagPanel.innerHTML = "";
      const usableItems = Object.entries(this.gameState.bag || {})
        .filter(([, qty]) => qty > 0)
        .map(([k, qty]) => ({ key: normalizeItemKey(k), qty, item: this.dataMaps.itemsMap[normalizeItemKey(k)] }))
        .filter((x) => x.item && x.item.usableInBattle);

      if (usableItems.length === 0) {
        this.dom.battleBagPanel.innerHTML = `<div class="alert-box">No tienes objetos utilizables en combate.</div>`;
      } else {
        for (const entry of usableItems) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "btn btn-sm";
          btn.style.justifyContent = "space-between";
          btn.innerHTML = `<span>${entry.item.name}</span><span>x${entry.qty}</span>`;
          btn.addEventListener("click", () => {
            const beforeTurn = this.battleEngine.turn;
            const res = this.battleEngine.executeTurn({
              type: "item",
              itemKey: entry.key,
              targetIndex: state.playerSide.activeIndex,
            });
            if (res.turn > beforeTurn || res.status === "caught") {
              consumeBagItem(this.gameState, entry.key, 1);
            }
            this.battleSubMode = "fight";
            this.renderBattleUI();
          });
          this.dom.battleBagPanel.appendChild(btn);
        }
      }
    }

    // Switch Pokémon
    if (mode === "switch") {
      this.dom.battleSwitchPanel.innerHTML = "";
      state.playerSide.party.forEach((mon, idx) => {
        const isCurrent = idx === state.playerSide.activeIndex;
        const canSwitch = !isCurrent && mon.currentHp > 0;
        const card = document.createElement("div");
        card.className = "info-card";
        card.style.padding = "8px";
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong>${mon.name} (Nv.${mon.level})</strong>
            <span style="font-size:0.78rem;">${mon.currentHp}/${mon.maxHp} PS</span>
          </div>
          <button type="button" class="btn btn-sm ${canSwitch ? "btn-primary" : ""}" ${canSwitch ? "" : "disabled"}>
            ${isCurrent ? "En combate" : mon.currentHp <= 0 ? "Debilitado" : "Enviar"}
          </button>
        `;
        card.querySelector("button").addEventListener("click", () => {
          if (state.awaitingPlayerSwitch) {
            this.battleEngine.forceSwitchPlayer(idx);
          } else {
            this.battleEngine.executeTurn({ type: "switch", partyIndex: idx });
          }
          this.battleSubMode = "fight";
          this.renderBattleUI();
        });
        this.dom.battleSwitchPanel.appendChild(card);
      });
    }
  }

  onBattleRun() {
    if (!this.battleEngine) return;
    this.battleEngine.executeTurn({ type: "run" });
    this.renderBattleUI();
  }

  async onBattleContinueClick() {
    const state = this.battleEngine.getState();
    const ctx = this.activeBattleContext;

    // Sincronizar equipo real y comprobar evoluciones por nivel
    this.gameState.party = state.playerSide.party;
    const partyIndices = this.gameState.party.map((_, i) => i);
    const levelEvos = checkAndApplyLevelEvolutions(
      this.gameState,
      partyIndices,
      this.dataMaps,
      this.coreData.evolutionsByKey
    );

    const postDialogue = [];
    for (const evo of levelEvos) {
      postDialogue.push({ text: evo.message });
    }

    if (state.status === "caught") {
      const wildFoe = state.enemySide.active;
      const sp = this.dataMaps.speciesMap[wildFoe.speciesKey];
      const caughtMon = createBattlePokemon(sp, wildFoe.level, this.dataMaps.movesMap, {
        currentHp: wildFoe.currentHp,
        status: wildFoe.status,
      });
      const placed = addPokemonToPartyOrBox(this.gameState, caughtMon);
      this.gameState.stats.wildCaught += 1;
      postDialogue.push({
        text: `¡Capturaste a ${caughtMon.name} (Nv. ${caughtMon.level})! Se guardó en ${placed.destination === "party" ? "tu equipo" : "la Caja del PC"}.`,
      });
    }

    if (state.status === "player_win") {
      this.gameState.stats.battlesWon += 1;
      this.gameState.money += state.prizeMoney || 0;

      if (ctx.kind === "gym" && ctx.gymLeader) {
        const badgeRes = awardGymBadge(this.gameState, ctx.gymLeader);
        postDialogue.push({
          text: badgeRes.isFirstTime
            ? `${ctx.gymLeader.victoryDialogue} (Medallas: ${this.gameState.badges.length}/8)`
            : `¡Gran revancha contra ${ctx.gymLeader.name}!`,
        });
      } else if (ctx.kind === "rival") {
        recordRivalBattleOutcome(this.gameState, true);
        postDialogue.push({ text: `¡Venciste a ${ctx.trainerName}! (+₽${state.prizeMoney})` });
      } else if (ctx.kind === "ash_event") {
        const res = grantAshEventPokemon(ctx.eventId, this.gameState, this.dataMaps);
        postDialogue.push({ text: res.message });
      } else if (ctx.kind === "grand_prix_p1") {
        const nextIdx = ctx.roundIndex + 1;
        if (nextIdx < GRAND_PRIX_P1_ROUNDS.length) {
          this.updateHud();
          this.launchGrandPrixRound(nextIdx);
          return;
        }
        const winRes = completeGrandPrixP1(this.gameState);
        postDialogue.push({ text: winRes.message });
      } else if (ctx.kind === "safari_race") {
        const winRes = completeSafariRace(this.gameState);
        postDialogue.push({ text: winRes.message });
      } else if (ctx.kind === "league_tournament") {
        const roundRes = onTournamentRoundVictory(
          this.gameState,
          ctx.roundIndex + 1,
          this.dataMaps.movesMap
        );
        if (!roundRes.tournamentCompleted) {
          this.updateHud();
          this.showToast(roundRes.message);
          this.launchLeagueTournamentRound(ctx.roundIndex + 1);
          return;
        }
        postDialogue.push({ text: roundRes.message });
      } else if (ctx.kind === "elite_four") {
        const nextIdx = ctx.memberIndex + 1;
        if (nextIdx < getEliteFourSequence(this.gameState).length) {
          this.updateHud();
          this.launchEliteFourBattle(nextIdx);
          return;
        }
        const champRes = completeEliteFour(this.gameState);
        postDialogue.push({ text: champRes.message });
      } else if (ctx.kind === "frontier_brain") {
        const fRes = awardFrontierSymbol(this.gameState, ctx.frontierId);
        postDialogue.push({ text: fRes.message });
      }
    }

    if (state.status === "enemy_win") {
      if (ctx.kind === "rival") recordRivalBattleOutcome(this.gameState, false);
      healPartyFull(this.gameState, this.dataMaps.movesMap);
      const healLoc = this.gameState.flags?.lastHealLocation || {
        mapId: "MAP_PALLET_TOWN",
        x: 6,
        y: 8,
      };
      this.dom.battleOverlay.classList.add("hidden");
      this.battleEngine = null;
      this.activeBattleContext = null;
      await this.overworldEngine.loadMap(healLoc.mapId, { x: healLoc.x, y: healLoc.y, suppressWarp: true }, "down");
      this.updateHud();
      this.startDialogueSequence("Centro Pokémon", [
        { text: "Tus Pokémon se debilitaron. Regresaste a salvo al último lugar de curación y tu equipo ha sido restaurado." },
      ]);
      return;
    }

    // Cerrar combate y regresar exactamente al mapa/casilla actual
    this.dom.battleOverlay.classList.add("hidden");
    this.battleEngine = null;
    this.activeBattleContext = null;
    await this.overworldEngine?.refreshDynamicNpcs();
    this.updateHud();

    if (postDialogue.length > 0) {
      this.startDialogueSequence("¡Victoria!", postDialogue);
    } else {
      this.overworldEngine?.setPaused(false);
    }
  }
}

const app = new PokemonWebGame();
app.init();
