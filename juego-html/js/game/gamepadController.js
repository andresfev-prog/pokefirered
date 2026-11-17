/**
 * Controlador HTML5 Gamepad API (mapeo estándar Xbox / PlayStation / Switch / Bluetooth)
 * y utilidades compartidas de cruceta deslizante (PointerEvent) para juego-html/.
 */

export const DEFAULT_DEADZONE = 0.35;
export const NAV_INITIAL_DELAY_MS = 320;
export const NAV_REPEAT_INTERVAL_MS = 135;

export const STANDARD_BUTTONS = Object.freeze({
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  SELECT: 8,
  START: 9,
  L3: 10,
  R3: 11,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
});

const TRACKED_ACTION_BUTTONS = ["A", "B", "X", "Y", "LB", "RB", "SELECT", "START"];

/**
 * Normaliza lectura de botón Gamepad API (soporta GamepadButton, números o booleanos en tests).
 */
export function isButtonPressed(btn) {
  if (!btn) return false;
  if (typeof btn === "boolean") return btn;
  if (typeof btn === "number") return btn > 0.5;
  return Boolean(btn.pressed || (typeof btn.value === "number" && btn.value > 0.5));
}

/**
 * Traduce ejes analógicos (axisX, axisY) a una de las 4 direcciones cardinales
 * aplicando la zona muerta (por defecto 0.35). Valores dentro de [-deadzone, deadzone]
 * devuelven null para evitar drift.
 */
export function translateAxesToDirection(ax = 0, ay = 0, deadzone = DEFAULT_DEADZONE) {
  const x = Number.isFinite(ax) ? ax : 0;
  const y = Number.isFinite(ay) ? ay : 0;
  const absX = Math.abs(x);
  const absY = Math.abs(y);

  if (absX <= deadzone && absY <= deadzone) {
    return null;
  }

  if (absY >= absX) {
    return y < 0 ? "up" : "down";
  }
  return x < 0 ? "left" : "right";
}

/**
 * Obtiene la dirección cardinal combinando cruceta física (botones 12-15)
 * con prioridad sobre la palanca analógica izquierda (ejes 0 y 1).
 */
export function readGamepadDirection(gamepad, deadzone = DEFAULT_DEADZONE) {
  if (!gamepad) return null;
  const buttons = gamepad.buttons || [];

  const up = isButtonPressed(buttons[STANDARD_BUTTONS.DPAD_UP]);
  const down = isButtonPressed(buttons[STANDARD_BUTTONS.DPAD_DOWN]);
  const left = isButtonPressed(buttons[STANDARD_BUTTONS.DPAD_LEFT]);
  const right = isButtonPressed(buttons[STANDARD_BUTTONS.DPAD_RIGHT]);

  const dpadY = (down ? 1 : 0) - (up ? 1 : 0);
  const dpadX = (right ? 1 : 0) - (left ? 1 : 0);

  if (dpadY < 0) return "up";
  if (dpadY > 0) return "down";
  if (dpadX < 0) return "left";
  if (dpadX > 0) return "right";

  const axes = gamepad.axes || [];
  return translateAxesToDirection(axes[0] ?? 0, axes[1] ?? 0, deadzone);
}

/**
 * Traduce coordenadas de puntero/dedo dentro del área rectangular de la cruceta táctil
 * a una dirección cardinal continua, permitiendo deslizar el pulgar sin levantar el dedo.
 */
export function resolveSlidingDpadDirection(clientX, clientY, rect, deadzoneRatio = 0.16) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const halfW = rect.width / 2;
  const halfH = rect.height / 2;
  const normX = (clientX - cx) / halfW;
  const normY = (clientY - cy) / halfH;

  if (Math.hypot(normX, normY) <= deadzoneRatio) {
    return null;
  }

  if (Math.abs(normY) >= Math.abs(normX)) {
    return normY < 0 ? "up" : "down";
  }
  return normX < 0 ? "left" : "right";
}

/**
 * Extrae instantánea completa de botones estándar y dirección de un Gamepad conectado.
 */
export function readStandardGamepadState(gamepad, deadzone = DEFAULT_DEADZONE) {
  if (!gamepad || gamepad.connected === false) {
    return {
      connected: false,
      index: -1,
      id: "",
      direction: null,
      buttons: {
        A: false,
        B: false,
        X: false,
        Y: false,
        LB: false,
        RB: false,
        SELECT: false,
        START: false,
      },
    };
  }

  const rawButtons = gamepad.buttons || [];
  const buttons = {};
  for (const name of TRACKED_ACTION_BUTTONS) {
    buttons[name] = isButtonPressed(rawButtons[STANDARD_BUTTONS[name]]);
  }

  return {
    connected: true,
    index: typeof gamepad.index === "number" ? gamepad.index : 0,
    id: String(gamepad.id || "Mando inalámbrico"),
    direction: readGamepadDirection(gamepad, deadzone),
    buttons,
  };
}

/**
 * Selecciona el mando activo prioritario entre la lista devuelta por navigator.getGamepads().
 */
export function selectPrimaryGamepad(gamepads, preferredIndex = null) {
  const list = Array.from(gamepads || []).filter((gp) => gp && gp.connected !== false);
  if (list.length === 0) return { active: null, count: 0 };

  if (preferredIndex !== null && preferredIndex !== undefined) {
    const match = list.find((gp) => gp.index === preferredIndex);
    if (match) return { active: match, count: list.length };
  }

  const standardMatch = list.find((gp) => gp.mapping === "standard");
  return { active: standardMatch || list[0], count: list.length };
}

/**
 * Genera etiqueta compacta para el indicador discreto del HUD.
 */
export function formatGamepadLabel(id = "") {
  const clean = String(id)
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "Mando conectado";
  return clean.length > 22 ? `${clean.slice(0, 21)}…` : clean;
}

export class GamepadController {
  constructor(options = {}) {
    this.deadzone = typeof options.deadzone === "number" ? options.deadzone : DEFAULT_DEADZONE;
    this.navInitialDelayMs = options.navInitialDelayMs ?? NAV_INITIAL_DELAY_MS;
    this.navRepeatIntervalMs = options.navRepeatIntervalMs ?? NAV_REPEAT_INTERVAL_MS;

    this.getGamepads =
      options.getGamepads ||
      (() => {
        if (typeof navigator !== "undefined" && typeof navigator.getGamepads === "function") {
          return navigator.getGamepads();
        }
        return [];
      });
    this.windowTarget = options.windowTarget ?? (typeof window !== "undefined" ? window : null);
    this.raf =
      options.raf ||
      (typeof requestAnimationFrame === "function" ? (fn) => requestAnimationFrame(fn) : null);
    this.cancelRaf =
      options.cancelRaf ||
      (typeof cancelAnimationFrame === "function" ? (id) => cancelAnimationFrame(id) : null);
    this.now = options.now || (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));

    this.onDirectionChange = options.onDirectionChange || null;
    this.onNavigate = options.onNavigate || null;
    this.onButtonDown = options.onButtonDown || null;
    this.onButtonUp = options.onButtonUp || null;
    this.onRunChange = options.onRunChange || null;
    this.onConnectionChange = options.onConnectionChange || null;

    this.activeIndex = null;
    this.connected = false;
    this.connectedCount = 0;
    this.activeId = "";

    this.prevDirection = null;
    this.prevButtons = {};
    for (const name of TRACKED_ACTION_BUTTONS) {
      this.prevButtons[name] = false;
    }
    this.prevRunHeld = false;
    this._nextNavAt = 0;

    this._rafId = null;
    this._running = false;

    this._onConnectedEvent = (e) => {
      if (e?.gamepad && typeof e.gamepad.index === "number") {
        this.activeIndex = e.gamepad.index;
      }
      this.poll(this.now());
    };
    this._onDisconnectedEvent = (e) => {
      if (e?.gamepad && e.gamepad.index === this.activeIndex) {
        this.activeIndex = null;
      }
      this.poll(this.now());
    };
  }

  start() {
    if (this._running) return;
    this._running = true;

    if (this.windowTarget?.addEventListener) {
      this.windowTarget.addEventListener("gamepadconnected", this._onConnectedEvent);
      this.windowTarget.addEventListener("gamepaddisconnected", this._onDisconnectedEvent);
    }

    this.poll(this.now());
    if (this.raf) {
      const tick = (ts) => {
        if (!this._running) return;
        this.poll(typeof ts === "number" ? ts : this.now());
        this._rafId = this.raf(tick);
      };
      this._rafId = this.raf(tick);
    }
  }

  stop() {
    this._running = false;
    if (this._rafId !== null && this.cancelRaf) {
      this.cancelRaf(this._rafId);
      this._rafId = null;
    }
    if (this.windowTarget?.removeEventListener) {
      this.windowTarget.removeEventListener("gamepadconnected", this._onConnectedEvent);
      this.windowTarget.removeEventListener("gamepaddisconnected", this._onDisconnectedEvent);
    }
    this._releaseAllStates();
  }

  _releaseAllStates() {
    if (this.prevRunHeld) {
      this.prevRunHeld = false;
      this.onRunChange?.(false);
    }
    if (this.prevDirection !== null) {
      const prev = this.prevDirection;
      this.prevDirection = null;
      this.onDirectionChange?.(null, prev);
    }
    for (const name of TRACKED_ACTION_BUTTONS) {
      if (this.prevButtons[name]) {
        this.prevButtons[name] = false;
        this.onButtonUp?.(name);
      }
    }
    this._nextNavAt = 0;
  }

  poll(timestampMs = this.now()) {
    const { active, count } = selectPrimaryGamepad(this.getGamepads(), this.activeIndex);
    const nextState = readStandardGamepadState(active, this.deadzone);

    const connChanged =
      nextState.connected !== this.connected ||
      count !== this.connectedCount ||
      nextState.id !== this.activeId ||
      nextState.index !== (this.activeIndex ?? -1);

    this.connected = nextState.connected;
    this.connectedCount = count;
    this.activeId = nextState.id;
    this.activeIndex = nextState.connected ? nextState.index : null;

    if (connChanged) {
      this.onConnectionChange?.({
        connected: this.connected,
        count: this.connectedCount,
        index: nextState.index,
        id: this.activeId,
        label: formatGamepadLabel(this.activeId),
      });
    }

    if (!nextState.connected) {
      this._releaseAllStates();
      return nextState;
    }

    // 1. Estado continuo de correr (B mantenido)
    const runHeld = Boolean(nextState.buttons.B);
    if (runHeld !== this.prevRunHeld) {
      this.prevRunHeld = runHeld;
      this.onRunChange?.(runHeld, nextState);
    }

    // 2. Dirección continua (Cruceta + Stick izquierdo) + Auto-repetición para navegación UI
    const dir = nextState.direction;
    if (dir !== this.prevDirection) {
      const prev = this.prevDirection;
      this.prevDirection = dir;
      this.onDirectionChange?.(dir, prev);
      if (dir) {
        this._nextNavAt = timestampMs + this.navInitialDelayMs;
        this.onNavigate?.(dir);
      } else {
        this._nextNavAt = 0;
      }
    } else if (dir && timestampMs >= this._nextNavAt) {
      this._nextNavAt = timestampMs + this.navRepeatIntervalMs;
      this.onNavigate?.(dir);
    }

    // 3. Flancos de botones estándar (A, B, X, Y, LB, RB, SELECT, START)
    for (const name of TRACKED_ACTION_BUTTONS) {
      const cur = Boolean(nextState.buttons[name]);
      const prev = Boolean(this.prevButtons[name]);
      if (cur !== prev) {
        this.prevButtons[name] = cur;
        if (cur) {
          this.onButtonDown?.(name, nextState);
        } else {
          this.onButtonUp?.(name, nextState);
        }
      }
    }

    return nextState;
  }

  getStatus() {
    return {
      connected: this.connected,
      count: this.connectedCount,
      activeIndex: this.activeIndex,
      activeId: this.activeId,
      direction: this.prevDirection,
      runHeld: this.prevRunHeld,
      buttons: { ...this.prevButtons },
    };
  }
}
