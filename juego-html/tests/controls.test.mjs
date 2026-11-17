import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_DEADZONE,
  GamepadController,
  NAV_INITIAL_DELAY_MS,
  NAV_REPEAT_INTERVAL_MS,
  STANDARD_BUTTONS,
  formatGamepadLabel,
  readGamepadDirection,
  readStandardGamepadState,
  resolveSlidingDpadDirection,
  selectPrimaryGamepad,
  translateAxesToDirection,
} from "../js/game/gamepadController.js";
import { OverworldEngine } from "../js/overworld/overworldEngine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_ROOT = path.resolve(__dirname, "..");

function createMockGamepad({
  index = 0,
  id = "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)",
  mapping = "standard",
  connected = true,
  axes = [0, 0, 0, 0],
  pressedButtons = [],
  analogButtons = {},
} = {}) {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
  for (const idx of pressedButtons) {
    buttons[idx] = { pressed: true, value: 1 };
  }
  for (const [idxStr, value] of Object.entries(analogButtons)) {
    const idx = Number(idxStr);
    buttons[idx] = { pressed: value > 0.5, value };
  }
  return { index, id, mapping, connected, axes, buttons };
}

function createMockEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    dispatchEvent(evt) {
      for (const fn of listeners.get(evt.type) || []) {
        fn(evt);
      }
    },
    listenerCount(type) {
      return listeners.get(type)?.size || 0;
    },
  };
}

function createHeadlessOverworldEngine(allowCycling = true) {
  const noopCtx = {
    imageSmoothingEnabled: false,
    fillStyle: "#000",
    fillRect() {},
  };
  const canvas = {
    width: 256,
    height: 192,
    getContext() {
      return noopCtx;
    },
  };
  const engine = new OverworldEngine({
    canvas,
    assetLoader: {},
  });
  engine.currentBundle = {
    map: {
      id: "MAP_PALLET_TOWN",
      width: 24,
      height: 20,
      allowCycling,
    },
  };
  return engine;
}

test("1. Zona muerta (0.35) y traducción de ejes analógicos a 4 direcciones", () => {
  assert.equal(DEFAULT_DEADZONE, 0.35);

  // Dentro de la zona muerta (incluyendo el límite exacto ±0.35) -> null
  assert.equal(translateAxesToDirection(0, 0), null);
  assert.equal(translateAxesToDirection(0.35, -0.35), null);
  assert.equal(translateAxesToDirection(-0.2, 0.34), null);
  assert.equal(translateAxesToDirection(Number.NaN, undefined), null);

  // Superando zona muerta -> dirección cardinal dominante
  assert.equal(translateAxesToDirection(0, -0.36), "up");
  assert.equal(translateAxesToDirection(0, 0.9), "down");
  assert.equal(translateAxesToDirection(-0.75, 0.2), "left");
  assert.equal(translateAxesToDirection(0.85, -0.4), "right");

  // En diagonal exacta o mayor módulo vertical, el eje dominante decide
  assert.equal(translateAxesToDirection(0.6, -0.8), "up");
  assert.equal(translateAxesToDirection(-0.9, 0.5), "left");
});

test("2. Mapeo estándar HTML5 Gamepad API (cruceta 12-15, stick, botones A/B/X/Select/Start)", () => {
  // Prioridad de cruceta física sobre palanca analógica
  const gpDpadAndStick = createMockGamepad({
    axes: [0.95, 0], // stick apunta derecha
    pressedButtons: [STANDARD_BUTTONS.DPAD_UP, STANDARD_BUTTONS.A, STANDARD_BUTTONS.B],
  });
  assert.equal(readGamepadDirection(gpDpadAndStick), "up");

  const state = readStandardGamepadState(gpDpadAndStick);
  assert.equal(state.connected, true);
  assert.equal(state.direction, "up");
  assert.equal(state.buttons.A, true);
  assert.equal(state.buttons.B, true);
  assert.equal(state.buttons.X, false);
  assert.equal(state.buttons.START, false);

  // Botones X (2), Select (8), Start (9) y valores analógicos > 0.5
  const gpMeta = createMockGamepad({
    axes: [-0.8, 0.1],
    pressedButtons: [STANDARD_BUTTONS.X, STANDARD_BUTTONS.START],
    analogButtons: { [STANDARD_BUTTONS.SELECT]: 0.9 },
  });
  const metaState = readStandardGamepadState(gpMeta);
  assert.equal(metaState.direction, "left");
  assert.equal(metaState.buttons.X, true);
  assert.equal(metaState.buttons.SELECT, true);
  assert.equal(metaState.buttons.START, true);

  // Selección prioritaria de mando estándar
  const nonStd = createMockGamepad({ index: 0, mapping: "", id: "Generic Joystick" });
  const std = createMockGamepad({ index: 1, mapping: "standard", id: "DualSense Wireless Controller (STANDARD)" });
  const { active, count } = selectPrimaryGamepad([null, nonStd, std]);
  assert.equal(count, 2);
  assert.equal(active.index, 1);
  assert.equal(formatGamepadLabel(std.id), "DualSense Wireless Co…");
});

test("3. GamepadController: eventos connect/disconnect, flancos A/X/Start, correr continuo con B y auto-repetición UI", () => {
  let nowMs = 1000;
  let currentGamepads = [];
  const winTarget = createMockEventTarget();

  const events = {
    connections: [],
    directions: [],
    navigates: [],
    runChanges: [],
    downs: [],
    ups: [],
  };

  const ctrl = new GamepadController({
    deadzone: 0.35,
    windowTarget: winTarget,
    raf: null, // Polling manual determinista en test
    now: () => nowMs,
    getGamepads: () => currentGamepads,
    onConnectionChange: (info) => events.connections.push(info),
    onDirectionChange: (dir, prev) => events.directions.push({ dir, prev }),
    onNavigate: (dir) => events.navigates.push({ dir, at: nowMs }),
    onRunChange: (held) => events.runChanges.push(held),
    onButtonDown: (btn) => events.downs.push(btn),
    onButtonUp: (btn) => events.ups.push(btn),
  });

  ctrl.start();
  assert.equal(winTarget.listenerCount("gamepadconnected"), 1);
  assert.equal(winTarget.listenerCount("gamepaddisconnected"), 1);
  assert.equal(ctrl.connected, false);

  // Conectar mando por evento gamepadconnected
  const pad = createMockGamepad({
    index: 2,
    id: "Nintendo Switch Pro Controller (Vendor: 057e)",
    axes: [0, 0],
    pressedButtons: [],
  });
  currentGamepads = [null, null, pad];
  winTarget.dispatchEvent({ type: "gamepadconnected", gamepad: pad });

  assert.equal(ctrl.connected, true);
  assert.equal(ctrl.activeIndex, 2);
  assert.equal(events.connections.at(-1).connected, true);
  assert.equal(events.connections.at(-1).label, "Nintendo Switch Pro C…");

  // Mantener B (correr) + mover arriba con palanca + pulsar A
  pad.axes = [0, -0.75];
  pad.pressedButtons = [];
  pad.buttons[STANDARD_BUTTONS.B] = { pressed: true, value: 1 };
  pad.buttons[STANDARD_BUTTONS.A] = { pressed: true, value: 1 };
  ctrl.poll(nowMs);

  assert.deepEqual(events.runChanges, [true]);
  assert.deepEqual(events.directions, [{ dir: "up", prev: null }]);
  assert.deepEqual(events.downs, ["A", "B"]);
  assert.equal(events.navigates.length, 1);

  // Siguiente frame rápido (antes del delay inicial de 320ms): no repite navegación UI ni re-dispara A/B
  nowMs += 150;
  ctrl.poll(nowMs);
  assert.equal(events.navigates.length, 1);
  assert.deepEqual(events.downs, ["A", "B"]);

  // Al cruzar NAV_INITIAL_DELAY_MS dispara segunda navegación UI y luego cada NAV_REPEAT_INTERVAL_MS
  nowMs += NAV_INITIAL_DELAY_MS;
  ctrl.poll(nowMs);
  assert.equal(events.navigates.length, 2);
  nowMs += NAV_REPEAT_INTERVAL_MS;
  ctrl.poll(nowMs);
  assert.equal(events.navigates.length, 3);

  // Soltar A, seguir manteniendo B (correr sigue activo), cambiar a derecha con cruceta
  pad.buttons[STANDARD_BUTTONS.A] = { pressed: false, value: 0 };
  pad.buttons[STANDARD_BUTTONS.DPAD_RIGHT] = { pressed: true, value: 1 };
  pad.buttons[STANDARD_BUTTONS.START] = { pressed: true, value: 1 };
  nowMs += 16;
  ctrl.poll(nowMs);
  assert.deepEqual(events.ups, ["A"]);
  assert.ok(events.downs.includes("START"));
  assert.equal(ctrl.getStatus().runHeld, true);
  assert.equal(ctrl.getStatus().direction, "right");

  // Desconexión libera dirección, botones y modo correr inmediatamente
  currentGamepads = [];
  winTarget.dispatchEvent({ type: "gamepaddisconnected", gamepad: pad });
  assert.equal(ctrl.connected, false);
  assert.equal(ctrl.getStatus().runHeld, false);
  assert.equal(ctrl.getStatus().direction, null);
  assert.equal(events.runChanges.at(-1), false);
  assert.ok(events.ups.includes("B"));
  assert.ok(events.ups.includes("START"));

  ctrl.stop();
  assert.equal(winTarget.listenerCount("gamepadconnected"), 0);
});

test("4. Cruceta táctil deslizante (PointerEvent): deslizar el pulgar sin levantar el dedo", () => {
  const dpadRect = { left: 20, top: 400, width: 150, height: 150 }; // centro en (95, 475)

  // Centro dentro de zona neutra -> null
  assert.equal(resolveSlidingDpadDirection(95, 475, dpadRect), null);
  assert.equal(resolveSlidingDpadDirection(100, 480, dpadRect), null);

  // Secuencia continua de deslizamiento sin soltar el puntero: Arriba -> Derecha -> Abajo -> Izquierda
  const slideSequence = [
    [95, 420, "up"],
    [155, 475, "right"],
    [95, 535, "down"],
    [35, 475, "left"],
  ];
  for (const [x, y, expected] of slideSequence) {
    assert.equal(resolveSlidingDpadDirection(x, y, dpadRect), expected);
  }

  // Incluso si el dedo se sale un poco del rectángulo mientras mantiene captura de puntero
  assert.equal(resolveSlidingDpadDirection(95, 360, dpadRect), "up");
  assert.equal(resolveSlidingDpadDirection(200, 475, dpadRect), "right");
  assert.equal(resolveSlidingDpadDirection(0, 0, { left: 0, top: 0, width: 0, height: 0 }), null);
});

test("5. OverworldEngine coordina entradas simultáneas de teclado, táctil y mando sin conflictos", () => {
  const engine = createHeadlessOverworldEngine(true);

  // Teclado y mando mantienen "up"; soltar táctil "up" no borra "up" ni viceversa
  engine.pressDirection("up", "keyboard");
  engine.setDirectionalSource("gamepad", "up");
  engine.setDirectionalSource("touch", "up");
  assert.deepEqual(engine.heldDirs, ["up"]);

  engine.setDirectionalSource("touch", "right");
  assert.deepEqual(engine.heldDirs, ["up", "right"]);

  engine.setDirectionalSource("touch", null);
  assert.deepEqual(engine.heldDirs, ["up"]);

  engine.releaseDirection("up", "keyboard");
  assert.deepEqual(engine.heldDirs, ["up"]); // Gamepad sigue manteniendo "up"

  engine.setDirectionalSource("gamepad", null);
  assert.deepEqual(engine.heldDirs, []);

  // Shift / B correr desde múltiples fuentes
  engine.setShiftRun(true, "keyboard");
  engine.setShiftRun(true, "gamepad");
  assert.equal(engine.shiftDown, true);
  engine.setShiftRun(false, "gamepad");
  assert.equal(engine.shiftDown, true);
  engine.setShiftRun(false, "touch");
  assert.equal(engine.shiftDown, true);
  engine.setShiftRun(false, "keyboard");
  assert.equal(engine.shiftDown, false);

  // toggleBike respeta allowCycling y actualiza estado
  assert.equal(engine.toggleBike(), true);
  assert.equal(engine.player.bikeMode, true);
  assert.equal(engine.toggleBike(), true);
  assert.equal(engine.player.bikeMode, false);

  const indoorEngine = createHeadlessOverworldEngine(false);
  assert.equal(indoorEngine.toggleBike(), false);
  assert.equal(indoorEngine.player.bikeMode, false);
});

test("6. Integridad de UI, CSS responsive/táctil y manifiesto Offline PWA para Gamepad y Controles", () => {
  const html = fs.readFileSync(path.join(WEB_ROOT, "index.html"), "utf8");
  const css = fs.readFileSync(path.join(WEB_ROOT, "css/game.css"), "utf8");
  const mainJs = fs.readFileSync(path.join(WEB_ROOT, "js/game/mainApp.js"), "utf8");
  const swJs = fs.readFileSync(path.join(WEB_ROOT, "sw.js"), "utf8");
  const offlineManifest = JSON.parse(
    fs.readFileSync(path.join(WEB_ROOT, "data/offline_assets.json"), "utf8")
  );

  // Elementos requeridos en index.html
  const requiredIds = [
    "hudGamepadBadge",
    "btnToggleTouchControls",
    "controlsFooter",
    "touchControls",
    "touchDpad",
    "btnDpadUp",
    "btnDpadDown",
    "btnDpadLeft",
    "btnDpadRight",
    "btnTouchA",
    "btnTouchB",
    "btnTouchBike",
    "btnTouchMenu",
  ];
  for (const domId of requiredIds) {
    assert.ok(html.includes(`id="${domId}"`), `Falta #${domId} en index.html`);
  }

  // Reglas ergonómicas obligatorias en game.css
  assert.match(css, /touch-action:\s*none;/);
  assert.match(css, /user-select:\s*none;/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /@media\s*\(pointer:\s*coarse\)/);
  assert.match(css, /\.gamepad-focus/);
  assert.match(css, /\.touch-force-show/);

  // Integración en mainApp.js, sw.js y offline_assets.json
  assert.match(mainJs, /GamepadController/);
  assert.match(mainJs, /resolveSlidingDpadDirection/);
  assert.ok(swJs.includes("./js/game/gamepadController.js"));
  assert.ok(
    offlineManifest.assets.includes("./js/game/gamepadController.js"),
    "offline_assets.json debe incluir ./js/game/gamepadController.js"
  );
});
