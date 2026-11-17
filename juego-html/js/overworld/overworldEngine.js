/**
 * Motor de Overworld en HTML5 Canvas (Fase 3)
 * - Renderizado pixel-art crisp (imageSmoothingEnabled = false, rejilla 16x16)
 * - Movimiento suave por casillas: Caminar, Correr (Shift) y Bicicleta (B)
 * - Colisiones (0..4), saltos de desniveles (ledges), warps Bidireccionales y conexiones de borde
 * - Ciclo horario visual (Día / Tarde / Noche) exclusivo en exteriores (environment === "outdoor")
 */

const DIR_VECTORS = {
  down: { dx: 0, dy: 1 },
  up: { dx: 0, dy: -1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

const DIR_OPPOSITE = {
  down: "up",
  up: "down",
  left: "right",
  right: "left",
};

const STEP_DURATIONS_MS = {
  walk: 155,
  run: 85,
  bike: 58,
  ledge: 260,
};

export class OverworldEngine {
  constructor({
    canvas,
    assetLoader,
    onMapChange = null,
    onStepTile = null,
    onEncounterCheck = null,
    onInteract = null,
    getDynamicNpcs = null,
    onNotification = null,
    onDebugUpdate = null,
  }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.assetLoader = assetLoader;

    this.onMapChange = onMapChange;
    this.onStepTile = onStepTile;
    this.onEncounterCheck = onEncounterCheck;
    this.onInteract = onInteract;
    this.getDynamicNpcs = getDynamicNpcs;
    this.onNotification = onNotification;
    this.onDebugUpdate = onDebugUpdate;

    // Resolución entera múltiple de 16x16 (16 x 12 metatiles = 256 x 192 px)
    this.viewWidth = canvas.width || 256;
    this.viewHeight = canvas.height || 192;

    this.coreData = null;
    this.currentBundle = null;
    this.neighborBundles = new Map();

    this.playerCharKey = "ash";
    this.playerSheet = null;
    this.player = {
      x: 6,
      y: 8,
      renderX: 6 * 16,
      renderY: 8 * 16,
      facing: "down",
      bikeMode: false,
      surfEnabled: false,
      stepParity: 0,
      hopOffsetY: 0,
    };

    this.moveState = null;
    this.suppressWarpCoord = null;
    this.paused = false;
    this.isTransitioning = false;

    this.heldDirs = [];
    this.shiftDown = false;
    this.turnGraceElapsed = 0;
    this._dirSources = new Map();
    this._runSources = new Set();

    this.timePeriod = "day";
    this.showCollisionOverlay = false;

    this._rafId = null;
    this._lastTs = 0;
    this._keyDownHandler = (e) => this._onKeyDown(e);
    this._keyUpHandler = (e) => this._onKeyUp(e);
    this._blurHandler = () => {
      this._clearAllInputs();
    };
  }

  _clearAllInputs() {
    this._dirSources.clear();
    this._runSources.clear();
    this.heldDirs = [];
    this.shiftDown = false;
    this.turnGraceElapsed = 0;
  }

  _isDirHeldByOtherSource(dir, excludedSource) {
    for (const [src, dirs] of this._dirSources.entries()) {
      if (src !== excludedSource && dirs.has(dir)) {
        return true;
      }
    }
    return false;
  }

  async init({ initialMapId = "MAP_PALLET_TOWN", characterKey = "ash", timePeriod = "day", spawn = null } = {}) {
    this.coreData = await this.assetLoader.loadCoreData();
    this.timePeriod = timePeriod;
    await this.setCharacter(characterKey);
    await this.loadMap(initialMapId, spawn);
    this.attachInput();
    this.startLoop();
  }

  attachInput() {
    window.addEventListener("keydown", this._keyDownHandler);
    window.addEventListener("keyup", this._keyUpHandler);
    window.addEventListener("blur", this._blurHandler);
  }

  destroy() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    window.removeEventListener("keydown", this._keyDownHandler);
    window.removeEventListener("keyup", this._keyUpHandler);
    window.removeEventListener("blur", this._blurHandler);
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    if (paused) {
      this._clearAllInputs();
    }
  }

  setTimePeriod(timeKey) {
    this.timePeriod = timeKey;
    this.emitDebugUpdate();
  }

  setShowCollisionOverlay(enabled) {
    this.showCollisionOverlay = Boolean(enabled);
  }

  setSurfEnabled(enabled) {
    this.player.surfEnabled = Boolean(enabled);
    this.emitDebugUpdate();
  }

  async setCharacter(charKey) {
    this.playerCharKey = charKey;
    this.playerSheet = await this.assetLoader.loadCharacterSprite(charKey);
    this.emitDebugUpdate();
  }

  toggleBike() {
    if (this.paused || this.moveState) return false;
    if (!this.player.bikeMode && this.currentBundle?.map && !this.currentBundle.map.allowCycling) {
      this.notify("El Prof. Oak dice: ¡Aquí no es momento para usar la Bicicleta!", "warn");
      return false;
    }
    this.player.bikeMode = !this.player.bikeMode;
    this.notify(
      this.player.bikeMode ? "Subiste a la Bicicleta." : "Bajaste de la Bicicleta.",
      "info"
    );
    this.emitDebugUpdate();
    return true;
  }

  setShiftRun(active, source = "default") {
    if (active) {
      this._runSources.add(source);
    } else {
      this._runSources.delete(source);
    }
    this.shiftDown = this._runSources.size > 0;
    this.emitDebugUpdate();
  }

  pressDirection(dir, source = "default") {
    if (!DIR_VECTORS[dir]) return;
    if (!this._dirSources.has(source)) {
      this._dirSources.set(source, new Set());
    }
    this._dirSources.get(source).add(dir);
    this.heldDirs = this.heldDirs.filter((d) => d !== dir);
    this.heldDirs.push(dir);
  }

  releaseDirection(dir, source = "default") {
    const set = this._dirSources.get(source);
    if (set) {
      set.delete(dir);
      if (set.size === 0) this._dirSources.delete(source);
    }
    if (!this._isDirHeldByOtherSource(dir, source)) {
      this.heldDirs = this.heldDirs.filter((d) => d !== dir);
    }
    if (this.heldDirs.length === 0) {
      this.turnGraceElapsed = 0;
    }
  }

  /**
   * Asigna una única dirección activa (o null) para una fuente continua
   * como palanca de Gamepad o cruceta táctil deslizante.
   */
  setDirectionalSource(source, dir) {
    const prevSet = this._dirSources.get(source);
    const prevDirs = prevSet ? [...prevSet] : [];
    for (const oldDir of prevDirs) {
      if (oldDir !== dir) {
        this.releaseDirection(oldDir, source);
      }
    }
    if (dir && DIR_VECTORS[dir]) {
      this.pressDirection(dir, source);
    }
  }

  _onKeyDown(e) {
    if (this.paused) return;
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.interact();
      return;
    }
    if (e.key === "Shift") {
      if (!this._runSources.has("keyboard")) {
        this.setShiftRun(true, "keyboard");
      }
      return;
    }
    if (e.key === "b" || e.key === "B") {
      e.preventDefault();
      this.toggleBike();
      return;
    }

    const dirMap = {
      ArrowDown: "down",
      s: "down",
      S: "down",
      ArrowUp: "up",
      w: "up",
      W: "up",
      ArrowLeft: "left",
      a: "left",
      A: "left",
      ArrowRight: "right",
      d: "right",
      D: "right",
    };
    const dir = dirMap[e.key];
    if (dir) {
      e.preventDefault();
      this.pressDirection(dir, "keyboard");
    }
  }

  _onKeyUp(e) {
    if (e.key === "Shift") {
      this.setShiftRun(false, "keyboard");
      return;
    }
    const dirMap = {
      ArrowDown: "down",
      s: "down",
      S: "down",
      ArrowUp: "up",
      w: "up",
      W: "up",
      ArrowLeft: "left",
      a: "left",
      A: "left",
      ArrowRight: "right",
      d: "right",
      D: "right",
    };
    const dir = dirMap[e.key];
    if (dir) {
      this.releaseDirection(dir, "keyboard");
    }
  }

  notify(text, kind = "info") {
    if (this.onNotification) this.onNotification(text, kind);
  }

  async loadMap(mapId, spawn = null, facing = null) {
    this.isTransitioning = true;
    this.moveState = null;

    const bundle = await this.assetLoader.loadMapBundle(mapId);
    this.currentBundle = bundle;
    await this.refreshDynamicNpcs();

    // Auto-desmontar bicicleta si el mapa no permite ciclismo
    if (this.player.bikeMode && !bundle.map.allowCycling) {
      this.player.bikeMode = false;
    }

    // Cargar vecinos en caché para render continuo en bordes
    this.neighborBundles.clear();
    for (const conn of bundle.map.connections || []) {
      this.assetLoader
        .loadMapBundle(conn.map, { prefetchConnections: false })
        .then((nb) => {
          if (this.currentBundle?.map?.id === mapId) {
            this.neighborBundles.set(conn.map, nb);
          }
        })
        .catch(() => {});
    }

    const indexMeta = this.coreData?.mapsById?.[mapId];
    const targetSpawn = spawn || indexMeta?.defaultSpawn || { x: Math.floor(bundle.map.width / 2), y: Math.floor(bundle.map.height / 2) };

    this.player.x = Math.max(0, Math.min(bundle.map.width - 1, targetSpawn.x));
    this.player.y = Math.max(0, Math.min(bundle.map.height - 1, targetSpawn.y));
    this.player.renderX = this.player.x * 16;
    this.player.renderY = this.player.y * 16;
    this.player.hopOffsetY = 0;
    if (facing) this.player.facing = facing;

    this.suppressWarpCoord = spawn?.suppressWarp ? { x: this.player.x, y: this.player.y } : null;
    this.isTransitioning = false;

    if (this.onMapChange) this.onMapChange(bundle.map);
    this.emitDebugUpdate();
  }

  async refreshDynamicNpcs() {
    if (!this.currentBundle?.map || !this.getDynamicNpcs) {
      if (this.currentBundle) this.currentBundle.dynamicNpcs = [];
      return;
    }
    const list = this.getDynamicNpcs(this.currentBundle.map) || [];
    this.currentBundle.dynamicNpcs = list;
    await Promise.all(
      list
        .map((n) => n.spriteFile)
        .filter((f) => f && !this.currentBundle.npcSprites[f])
        .map(async (f) => {
          try {
            this.currentBundle.npcSprites[f] = await this.assetLoader.loadImage(f);
          } catch {
            this.currentBundle.npcSprites[f] = null;
          }
        })
    );
  }

  getNpcsForMap(map = this.currentBundle?.map) {
    if (!map) return [];
    const base = (map.npcs || []).filter((n) => !n.hidden);
    const dyn =
      this.currentBundle?.map?.id === map.id
        ? this.currentBundle.dynamicNpcs || []
        : this.getDynamicNpcs
        ? this.getDynamicNpcs(map) || []
        : [];
    if (!dyn.length) return base;
    const dynIds = new Set(dyn.map((d) => d.id || d.localId).filter(Boolean));
    const filteredBase = base.filter((b) => !dynIds.has(b.localId));
    return [...filteredBase, ...dyn];
  }

  interact() {
    if (this.paused || this.isTransitioning || this.moveState || !this.currentBundle?.map) return false;
    const map = this.currentBundle.map;
    const vec = DIR_VECTORS[this.player.facing] || DIR_VECTORS.down;
    const tx = this.player.x + vec.dx;
    const ty = this.player.y + vec.dy;

    let npc = this.getNpcAt(tx, ty, map);
    const behavior =
      tx >= 0 && ty >= 0 && tx < map.width && ty < map.height
        ? map.behaviors?.[ty * map.width + tx] ?? 0
        : 0;

    // Si hay un mostrador (MB_COUNTER = 0x80), permitir hablar con la enfermera/vendedor detrás
    if (!npc && behavior === 0x80) {
      npc = this.getNpcAt(tx + vec.dx, ty + vec.dy, map);
    }

    const sign = (map.signs || []).find((s) => s.x === tx && s.y === ty) || null;
    if (npc) {
      npc.facing = DIR_OPPOSITE[this.player.facing] || npc.facing;
    }

    if (!npc && !sign && behavior !== 0x83) {
      return false;
    }

    if (this.onInteract) {
      this.onInteract({
        npc,
        sign,
        behavior,
        x: tx,
        y: ty,
        map,
      });
    }
    return true;
  }

  getMovementMode() {
    if (this.player.bikeMode) return "bike";
    if (this.shiftDown && this.currentBundle?.map?.allowRunning !== false) return "run";
    return "walk";
  }

  getTileCollisionAt(x, y, map = this.currentBundle?.map) {
    if (!map) return 1;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return 1;
    return map.collisions[y * map.width + x];
  }

  getWarpAt(x, y, map = this.currentBundle?.map) {
    if (!map) return null;
    return (map.warps || []).find((w) => w.x === x && w.y === y) || null;
  }

  getNpcAt(x, y, map = this.currentBundle?.map) {
    if (!map) return null;
    return this.getNpcsForMap(map).find((n) => n.x === x && n.y === y) || null;
  }

  findConnectionAt(nx, ny) {
    const map = this.currentBundle?.map;
    if (!map) return null;
    for (const conn of map.connections || []) {
      const targetMeta = this.coreData?.mapsById?.[conn.map];
      if (!targetMeta) continue;
      if (conn.direction === "up" && ny < 0) {
        const destX = nx - conn.offset;
        const destY = targetMeta.height + ny;
        if (destX >= 0 && destX < targetMeta.width && destY >= 0 && destY < targetMeta.height) {
          return { mapId: conn.map, x: destX, y: destY };
        }
      } else if (conn.direction === "down" && ny >= map.height) {
        const destX = nx - conn.offset;
        const destY = ny - map.height;
        if (destX >= 0 && destX < targetMeta.width && destY >= 0 && destY < targetMeta.height) {
          return { mapId: conn.map, x: destX, y: destY };
        }
      } else if (conn.direction === "left" && nx < 0) {
        const destX = targetMeta.width + nx;
        const destY = ny - conn.offset;
        if (destX >= 0 && destX < targetMeta.width && destY >= 0 && destY < targetMeta.height) {
          return { mapId: conn.map, x: destX, y: destY };
        }
      } else if (conn.direction === "right" && nx >= map.width) {
        const destX = nx - map.width;
        const destY = ny - conn.offset;
        if (destX >= 0 && destX < targetMeta.width && destY >= 0 && destY < targetMeta.height) {
          return { mapId: conn.map, x: destX, y: destY };
        }
      }
    }
    return null;
  }

  async executeWarp(warp, approachDir = null) {
    if (!warp || !warp.destMap || !this.coreData?.mapsById?.[warp.destMap]) {
      this.notify(`Warp ${warp?.destMap || "?"} fuera de la región extraída.`, "warn");
      return;
    }

    this.isTransitioning = true;
    const destBundle = await this.assetLoader.loadMapBundle(warp.destMap);
    const destMap = destBundle.map;
    const destWarp = destMap.warps[warp.destWarpId] || destMap.warps[0];

    let spawnX = Math.floor(destMap.width / 2);
    let spawnY = Math.floor(destMap.height / 2);
    let outFacing = approachDir || this.player.facing;
    let suppressWarp = true;

    if (destWarp) {
      spawnX = destWarp.x;
      spawnY = destWarp.y;

      // Si el destino es una puerta exterior cerrada (collision === 1 / kind === "door"),
      // colocamos al protagonista un paso frente a la puerta mirando hacia afuera.
      const destCol = destMap.collisions[spawnY * destMap.width + spawnX];
      if (destWarp.kind === "door" || destCol === 1) {
        if (spawnY + 1 < destMap.height && destMap.collisions[(spawnY + 1) * destMap.width + spawnX] !== 1) {
          spawnY += 1;
          outFacing = "down";
          suppressWarp = false;
        }
      } else if (destWarp.kind === "arrow_down") {
        outFacing = "up";
      } else if (destWarp.kind === "arrow_up") {
        outFacing = "down";
      } else if (destWarp.kind === "arrow_left") {
        outFacing = "right";
      } else if (destWarp.kind === "arrow_right") {
        outFacing = "left";
      }
    }

    await this.loadMap(warp.destMap, { x: spawnX, y: spawnY, suppressWarp }, outFacing);
    this.notify(`Entraste a ${destMap.displayName || destMap.name}.`, "info");
  }

  startLoop() {
    const tick = (ts) => {
      const dt = this._lastTs ? Math.min(50, ts - this._lastTs) : 16;
      this._lastTs = ts;
      this.update(dt);
      this.render();
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  update(dt) {
    if (!this.currentBundle || this.paused || this.isTransitioning) return;

    if (this.moveState) {
      this.moveState.elapsed += dt;
      const t = Math.min(1, this.moveState.elapsed / this.moveState.duration);
      this.player.renderX = this.moveState.startPxX + (this.moveState.endPxX - this.moveState.startPxX) * t;
      this.player.renderY = this.moveState.startPxY + (this.moveState.endPxY - this.moveState.startPxY) * t;

      if (this.moveState.isLedge) {
        this.player.hopOffsetY = Math.round(Math.sin(t * Math.PI) * 10);
      } else {
        this.player.hopOffsetY = 0;
      }

      if (t >= 1) {
        this.player.x = this.moveState.toX;
        this.player.y = this.moveState.toY;
        this.player.renderX = this.player.x * 16;
        this.player.renderY = this.player.y * 16;
        this.player.hopOffsetY = 0;
        const finishedMode = this.moveState.mode;
        this.moveState = null;
        this.onStepFinished(finishedMode);
      }
      return;
    }

    const activeDir = this.heldDirs[this.heldDirs.length - 1];
    if (!activeDir) return;

    if (this.player.facing !== activeDir) {
      this.player.facing = activeDir;
      this.turnGraceElapsed += dt;
      // Breve pausa natural para girar en el sitio si es pulsación corta
      if (this.turnGraceElapsed < 55) {
        this.emitDebugUpdate();
        return;
      }
    }
    this.turnGraceElapsed = 55;
    this.tryMove(activeDir);
  }

  tryMove(dir) {
    const map = this.currentBundle.map;
    const vec = DIR_VECTORS[dir];

    // ¿Está parado sobre una alfombra warp direccional (ej. salida de casa/lab hacia abajo)?
    const standingWarp = this.getWarpAt(this.player.x, this.player.y, map);
    if (standingWarp && standingWarp.kind === `arrow_${dir}`) {
      this.executeWarp(standingWarp, dir);
      return;
    }

    const nx = this.player.x + vec.dx;
    const ny = this.player.y + vec.dy;

    // 1. Conexiones continuas en bordes de mapa
    if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) {
      const connTarget = this.findConnectionAt(nx, ny);
      if (connTarget) {
        this.loadMap(connTarget.mapId, { x: connTarget.x, y: connTarget.y }, dir);
      }
      return;
    }

    // 2. Puerta cerrada / cueva warp al empujar contra ella
    const targetWarp = this.getWarpAt(nx, ny, map);
    const targetCol = this.getTileCollisionAt(nx, ny, map);
    if (targetWarp && (targetWarp.kind === "door" || targetCol === 1)) {
      this.executeWarp(targetWarp, dir);
      return;
    }

    // 3. Bloqueo por NPC
    if (this.getNpcAt(nx, ny, map)) {
      return;
    }

    // 4. Salto de desnivel unidireccional (ledge, colisión 4)
    if (targetCol === 4) {
      const ledgeDir = map.ledgeDirs?.[String(ny * map.width + nx)];
      if (ledgeDir === dir) {
        const landX = nx + vec.dx;
        const landY = ny + vec.dy;
        const landCol = this.getTileCollisionAt(landX, landY, map);
        if ((landCol === 0 || landCol === 2) && !this.getNpcAt(landX, landY, map)) {
          this.player.stepParity = (this.player.stepParity + 1) % 2;
          this.moveState = {
            toX: landX,
            toY: landY,
            startPxX: this.player.x * 16,
            startPxY: this.player.y * 16,
            endPxX: landX * 16,
            endPxY: landY * 16,
            elapsed: 0,
            duration: STEP_DURATIONS_MS.ledge,
            mode: "walk",
            isLedge: true,
          };
        }
      }
      return;
    }

    // 5. Agua / Surf (colisión 3)
    if (targetCol === 3 && !this.player.surfEnabled) {
      return;
    }

    // 6. Bloqueado (colisión 1)
    if (targetCol === 1) {
      return;
    }

    // 7. Paso normal (0 = transitable, 2 = hierba/encuentro, 3 = agua c/ surf)
    const mode = this.getMovementMode();
    this.player.stepParity = (this.player.stepParity + 1) % 2;
    this.moveState = {
      toX: nx,
      toY: ny,
      startPxX: this.player.x * 16,
      startPxY: this.player.y * 16,
      endPxX: nx * 16,
      endPxY: ny * 16,
      elapsed: 0,
      duration: STEP_DURATIONS_MS[mode],
      mode,
      isLedge: false,
    };
  }

  onStepFinished() {
    const map = this.currentBundle.map;
    if (
      this.suppressWarpCoord &&
      (this.player.x !== this.suppressWarpCoord.x || this.player.y !== this.suppressWarpCoord.y)
    ) {
      this.suppressWarpCoord = null;
    }

    const col = this.getTileCollisionAt(this.player.x, this.player.y, map);
    this.emitDebugUpdate();
    if (this.onStepTile) this.onStepTile(map, this.player.x, this.player.y, col);

    // Verificar si pisó una casilla warp de escalera / cueva / alfombra de salida
    const warp = this.getWarpAt(this.player.x, this.player.y, map);
    if (
      warp &&
      (!this.suppressWarpCoord ||
        this.suppressWarpCoord.x !== warp.x ||
        this.suppressWarpCoord.y !== warp.y)
    ) {
      this.executeWarp(warp, this.player.facing);
      return;
    }

    // Evaluar encuentro salvaje (2: hierba alta / cueva, 3: agua)
    if ((col === 2 || col === 3) && this.onEncounterCheck) {
      this.onEncounterCheck(map, col, { x: this.player.x, y: this.player.y });
    }
  }

  emitDebugUpdate() {
    if (!this.onDebugUpdate || !this.currentBundle) return;
    const map = this.currentBundle.map;
    const col = this.getTileCollisionAt(this.player.x, this.player.y, map);
    this.onDebugUpdate({
      map,
      x: this.player.x,
      y: this.player.y,
      collision: col,
      facing: this.player.facing,
      mode: this.getMovementMode(),
      character: this.playerCharKey,
      timePeriod: this.timePeriod,
    });
  }

  // -------------------------------------------------------------------------
  // Renderizado Canvas (Pixel-Perfect GBA)
  // -------------------------------------------------------------------------
  render() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);

    if (!this.currentBundle || !this.currentBundle.tilesetImage) return;

    const map = this.currentBundle.map;
    const camX = Math.round(this.player.renderX + 8 - this.viewWidth / 2);
    const camY = Math.round(this.player.renderY + 8 - this.viewHeight / 2);

    const startTx = Math.floor(camX / 16) - 1;
    const endTx = Math.floor((camX + this.viewWidth) / 16) + 1;
    const startTy = Math.floor(camY / 16) - 1;
    const endTy = Math.floor((camY + this.viewHeight) / 16) + 1;

    // Capa 1: Terreno debajo de los sprites
    this._drawMapLayer(ctx, map, this.currentBundle, startTx, endTx, startTy, endTy, camX, camY, 0);

    // Capa 2: Entidades (NPCs + Protagonista) ordenadas por eje Y para profundidad correcta
    this._drawEntities(ctx, map, camX, camY);

    // Capa 3: Copas de árboles, tejados y techos por encima del protagonista
    this._drawMapLayer(ctx, map, this.currentBundle, startTx, endTx, startTy, endTy, camX, camY, 1);

    // Efecto sutil de hierba cubriendo los pies si está sobre hierba alta (behavior 0x02)
    this._drawTallGrassFeetOverlay(ctx, map, camX, camY);

    // Capa 4: Depuración opcional (colisiones / warps)
    if (this.showCollisionOverlay) {
      this._drawCollisionDebug(ctx, map, startTx, endTx, startTy, endTy, camX, camY);
    }

    // Capa 5: Filtro ambiental de Día / Tarde / Noche SOLO en exteriores ("outdoor")
    this._drawAmbientLighting(ctx, map, camX, camY);
  }

  _resolveTileSource(map, bundle, tx, ty) {
    // 1. Dentro del mapa actual
    if (tx >= 0 && ty >= 0 && tx < map.width && ty < map.height) {
      const mtId = map.metatiles[ty * map.width + tx];
      return { mtId, tsMeta: bundle.tilesetMeta, tsImg: bundle.tilesetImage };
    }

    // 2. Conexiones adyacentes precargadas
    for (const conn of map.connections || []) {
      const nb = this.neighborBundles.get(conn.map);
      if (!nb || !nb.tilesetImage) continue;
      const nm = nb.map;
      let dx = -1;
      let dy = -1;
      if (conn.direction === "up" && ty < 0) {
        dx = tx - conn.offset;
        dy = nm.height + ty;
      } else if (conn.direction === "down" && ty >= map.height) {
        dx = tx - conn.offset;
        dy = ty - map.height;
      } else if (conn.direction === "left" && tx < 0) {
        dx = nm.width + tx;
        dy = ty - conn.offset;
      } else if (conn.direction === "right" && tx >= map.width) {
        dx = tx - map.width;
        dy = ty - conn.offset;
      }
      if (dx >= 0 && dy >= 0 && dx < nm.width && dy < nm.height) {
        return {
          mtId: nm.metatiles[dy * nm.width + dx],
          tsMeta: nb.tilesetMeta,
          tsImg: nb.tilesetImage,
        };
      }
    }

    // 3. Borde repetible 2x2 del mapa actual
    const bw = map.border?.width || 2;
    const bh = map.border?.height || 2;
    const borderMts = map.border?.metatiles;
    if (borderMts && borderMts.length > 0) {
      const bx = ((tx % bw) + bw) % bw;
      const by = ((ty % bh) + bh) % bh;
      const mtId = borderMts[(by * bw + bx) % borderMts.length];
      return { mtId, tsMeta: bundle.tilesetMeta, tsImg: bundle.tilesetImage };
    }
    return null;
  }

  _drawMapLayer(ctx, map, bundle, startTx, endTx, startTy, endTy, camX, camY, layerIndex) {
    for (let ty = startTy; ty <= endTy; ty++) {
      const dy = ty * 16 - camY;
      for (let tx = startTx; tx <= endTx; tx++) {
        const src = this._resolveTileSource(map, bundle, tx, ty);
        if (!src || !src.tsImg || !src.tsMeta) continue;
        const { mtId, tsMeta, tsImg } = src;
        if (mtId >= tsMeta.numMetatiles) continue;

        const sx = (mtId % tsMeta.cols) * 16;
        const sy = Math.floor(mtId / tsMeta.cols) * 16 + (layerIndex === 1 ? tsMeta.layerHeight : 0);
        const dx = tx * 16 - camX;
        ctx.drawImage(tsImg, sx, sy, 16, 16, dx, dy, 16, 16);
      }
    }
  }

  _drawEntities(ctx, map, camX, camY) {
    const drawList = [];

    for (const npc of this.getNpcsForMap(map)) {
      const img = npc.spriteFile ? this.currentBundle.npcSprites[npc.spriteFile] : null;
      if (!img) continue;
      drawList.push({
        type: "npc",
        sortY: npc.y * 16,
        npc,
        img,
      });
    }

    drawList.push({
      type: "player",
      sortY: Math.round(this.player.renderY),
    });

    drawList.sort((a, b) => a.sortY - b.sortY);

    for (const ent of drawList) {
      if (ent.type === "npc") {
        this._drawNpc(ctx, ent.npc, ent.img, camX, camY);
      } else {
        this._drawPlayer(ctx, camX, camY);
      }
    }
  }

  _drawNpc(ctx, npc, img, camX, camY) {
    const fw = npc.frameWidth || 16;
    const fh = npc.frameHeight || 32;
    const count = npc.frameCount || 1;
    let frameIdx = 0;
    let flipH = false;

    if (count >= 3) {
      if (npc.facing === "up") frameIdx = 1;
      else if (npc.facing === "left") frameIdx = 2;
      else if (npc.facing === "right") {
        frameIdx = 2;
        flipH = true;
      }
    }

    const screenX = Math.round(npc.x * 16 + 8 - fw / 2 - camX);
    const screenY = Math.round(npc.y * 16 + 16 - fh - camY);

    // Sombra ovalada sutil
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(Math.round(npc.x * 16 + 3 - camX), Math.round(npc.y * 16 + 13 - camY), 10, 3);

    if (flipH) {
      ctx.save();
      ctx.translate(screenX + fw, screenY);
      ctx.scale(-1, 1);
      ctx.drawImage(img, frameIdx * fw, 0, fw, fh, 0, 0, fw, fh);
      ctx.restore();
    } else {
      ctx.drawImage(img, frameIdx * fw, 0, fw, fh, screenX, screenY, fw, fh);
    }
  }

  _drawPlayer(ctx, camX, camY) {
    if (!this.playerSheet || !this.playerSheet.image) return;

    const mode = this.getMovementMode();
    const manifest = this.playerSheet.manifest;
    const row = manifest.rows[mode] ?? 0;
    const dirCols = manifest.directions[this.player.facing]?.cols || [0, 1, 2];

    let col = dirCols[0]; // quieto
    if (this.moveState && !this.moveState.isLedge) {
      const t = this.moveState.elapsed / this.moveState.duration;
      if (t < 0.65) {
        col = this.player.stepParity === 0 ? dirCols[1] : dirCols[2];
      }
    } else if (this.moveState && this.moveState.isLedge) {
      col = dirCols[1];
    }

    const sx = col * 32;
    const sy = row * 32;
    const screenX = Math.round(this.player.renderX + 8 - 16 - camX);
    const screenY = Math.round(this.player.renderY + 16 - 32 - this.player.hopOffsetY - camY);

    // Sombra bajo los pies (permanece en el suelo durante saltos)
    ctx.fillStyle = "rgba(0, 0, 0, 0.30)";
    ctx.fillRect(Math.round(this.player.renderX + 3 - camX), Math.round(this.player.renderY + 13 - camY), 10, 3);

    ctx.drawImage(this.playerSheet.image, sx, sy, 32, 32, screenX, screenY, 32, 32);
  }

  _drawTallGrassFeetOverlay(ctx, map, camX, camY) {
    if (this.moveState?.isLedge) return;
    const gx = this.player.x;
    const gy = this.player.y;
    const idx = gy * map.width + gx;
    const behavior = map.behaviors?.[idx];
    if (behavior !== 0x02) return; // Solo en hierba alta exterior (MB_TALL_GRASS)

    const fx = Math.round(this.player.renderX + 2 - camX);
    const fy = Math.round(this.player.renderY + 11 - camY);
    ctx.fillStyle = "rgba(38, 128, 48, 0.68)";
    ctx.fillRect(fx, fy + 2, 12, 3);
    ctx.fillStyle = "rgba(86, 192, 82, 0.85)";
    ctx.fillRect(fx + 1, fy, 2, 3);
    ctx.fillRect(fx + 5, fy - 1, 2, 4);
    ctx.fillRect(fx + 9, fy, 2, 3);
  }

  _drawCollisionDebug(ctx, map, startTx, endTx, startTy, endTy, camX, camY) {
    const warpSet = new Set((map.warps || []).map((w) => `${w.x},${w.y}`));
    for (let ty = Math.max(0, startTy); ty < Math.min(map.height, endTy + 1); ty++) {
      for (let tx = Math.max(0, startTx); tx < Math.min(map.width, endTx + 1); tx++) {
        const idx = ty * map.width + tx;
        const col = map.collisions[idx];
        const dx = tx * 16 - camX;
        const dy = ty * 16 - camY;

        if (col === 1) {
          ctx.fillStyle = "rgba(239, 68, 68, 0.34)";
          ctx.fillRect(dx + 1, dy + 1, 14, 14);
        } else if (col === 2) {
          ctx.fillStyle = "rgba(34, 197, 94, 0.34)";
          ctx.fillRect(dx + 1, dy + 1, 14, 14);
        } else if (col === 3) {
          ctx.fillStyle = "rgba(56, 189, 248, 0.38)";
          ctx.fillRect(dx + 1, dy + 1, 14, 14);
        } else if (col === 4) {
          ctx.fillStyle = "rgba(250, 204, 21, 0.55)";
          ctx.fillRect(dx + 1, dy + 1, 14, 14);
        }

        if (warpSet.has(`${tx},${ty}`)) {
          ctx.strokeStyle = "#f472b6";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(dx + 1.5, dy + 1.5, 13, 13);
        }
      }
    }
  }

  _drawAmbientLighting(ctx, map, camX, camY) {
    if (map.environment === "cave") {
      // Penumbra sutil constante en cuevas sin importar la hora
      const cx = this.viewWidth / 2;
      const cy = this.viewHeight / 2;
      const grad = ctx.createRadialGradient(cx, cy, 48, cx, cy, this.viewWidth * 0.72);
      grad.addColorStop(0, "rgba(0, 0, 0, 0)");
      grad.addColorStop(1, "rgba(6, 10, 20, 0.36)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
      return;
    }

    // Interiores permanecen iluminados con luz artificial uniforme
    if (map.environment !== "outdoor") return;

    if (this.timePeriod === "evening") {
      ctx.fillStyle = "rgba(255, 128, 38, 0.23)";
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
    } else if (this.timePeriod === "night") {
      const px = Math.round(this.player.renderX + 8 - camX);
      const py = Math.round(this.player.renderY + 4 - camY);
      const grad = ctx.createRadialGradient(px, py, 16, px, py, 118);
      grad.addColorStop(0, "rgba(18, 32, 78, 0.28)");
      grad.addColorStop(1, "rgba(8, 18, 56, 0.56)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
    }
  }
}
