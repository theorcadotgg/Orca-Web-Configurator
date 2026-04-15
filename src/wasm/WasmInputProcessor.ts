/**
 * @file WasmInputProcessor.ts
 * @brief TypeScript wrapper for the Orca input processing WASM module.
 *
 * This module provides a high-level TypeScript interface for the shared
 * C input processing library compiled to WebAssembly.
 */

// Emscripten type values for setValue/getValue
type EmscriptenType = 'i8' | 'i16' | 'i32' | 'i64' | 'float' | 'double' | '*';

// WASM module type definitions
export interface OrcaInputWasmModule {
  // Memory management
  _wasm_malloc(size: number): number;
  _wasm_free(ptr: number): void;

  // Context management
  _wasm_create_context(): number;
  _wasm_destroy_context(ctx: number): void;
  _wasm_reset_dpad_state(ctx: number): void;

  // Struct allocation
  _wasm_alloc_raw_inputs(): number;
  _wasm_alloc_output_state(): number;
  _wasm_alloc_melee_output(): number;
  _wasm_alloc_range_calibration(): number;
  _wasm_alloc_stick_curve_params(): number;
  _wasm_alloc_trigger_policy(): number;
  _wasm_alloc_dpad_layer(): number;
  _wasm_alloc_gp2040_extra_mappings(): number;

  // Raw input setters
  _wasm_set_raw_digital(raw: number, digitalMask: number): void;
  _wasm_set_raw_analog(raw: number, idx: number, value: number): void;

  // Calibration setters
  _wasm_set_range_calibration(cal: number, idx: number, lower: number, upper: number): void;
  _wasm_set_stick_curve_axis(params: number, idx: number, range: number, notch: number): void;
  _wasm_set_stick_curve_deadzone(params: number, idx: number, dzLower: number, dzUpper: number): void;
  _wasm_set_stick_curve_notch_inputs(params: number, notchStartInput: number, notchEndInput: number): void;
  _wasm_set_stick_curve_flags(params: number, flags: number): void;
  _wasm_set_trigger_policy(
    policy: number,
    analogMax: number,
    digitalFull: number,
    digitalLight: number,
    flags: number
  ): void;
  _wasm_set_trigger_light_sources(policy: number, ltSrc: number, rtSrc: number): void;
  _wasm_set_gp2040_extra_mappings(extra: number, l3Src: number, r3Src: number): void;

  // DPAD layer setters
  _wasm_set_dpad_mode(dpad: number, mode: number): void;
  _wasm_set_dpad_source(
    dpad: number,
    sourceIdx: number,
    type: number,
    index: number,
    threshold: number,
    hysteresis: number
  ): void;

  // Processing functions
  _wasm_process_orca(
    ctx: number,
    raw: number,
    rangeCal: number,
    analogMapping: number,
    digitalMapping: number,
    curve: number,
    trigger: number,
    extra: number,
    dpad: number,
    out: number
  ): void;
  _wasm_process_gp2040(
    ctx: number,
    raw: number,
    rangeCal: number,
    analogMapping: number,
    digitalMapping: number,
    curve: number,
    trigger: number,
    extra: number,
    dpad: number,
    out: number
  ): void;
  _wasm_convert_to_melee(unified: number, melee: number): void;

  // Output getters
  _wasm_get_left_stick_x(out: number): number;
  _wasm_get_left_stick_y(out: number): number;
  _wasm_get_right_stick_x(out: number): number;
  _wasm_get_right_stick_y(out: number): number;
  _wasm_get_trigger_l(out: number): number;
  _wasm_get_trigger_r(out: number): number;
  _wasm_get_digital_mask(out: number): number;
  _wasm_get_dpad_mask(out: number): number;

  // Melee output getters
  _wasm_get_melee_left_x(melee: number): number;
  _wasm_get_melee_left_y(melee: number): number;
  _wasm_get_melee_right_x(melee: number): number;
  _wasm_get_melee_right_y(melee: number): number;
  _wasm_get_melee_trigger_l(melee: number): number;
  _wasm_get_melee_trigger_r(melee: number): number;
  _wasm_get_melee_buttons(melee: number): number;

  // Direct SOCD access
  _wasm_socd_clean(positive: number, negative: number): number;

  // Struct sizes
  _wasm_sizeof_context(): number;
  _wasm_sizeof_raw_inputs(): number;
  _wasm_sizeof_output_state(): number;
  _wasm_sizeof_melee_output(): number;
  _wasm_sizeof_range_calibration(): number;
  _wasm_sizeof_stick_curve_params(): number;
  _wasm_sizeof_trigger_policy(): number;
  _wasm_sizeof_dpad_layer(): number;

  // Emscripten memory access functions
  setValue(ptr: number, value: number, type: EmscriptenType): void;
  getValue(ptr: number, type: EmscriptenType): number;
}

/** Constants matching the C header */
export const UNIFIED_ANALOG_INPUT_COUNT = 5;
export const UNIFIED_DIGITAL_INPUT_COUNT = 17;
export const UNIFIED_ANALOG_MAPPING_DISABLED = 0xff;

/** Analog input indices */
export enum UnifiedAnalogIndex {
  JOYSTICK_X_LEFT = 0,
  JOYSTICK_X_RIGHT = 1,
  JOYSTICK_Y_UP = 2,
  JOYSTICK_Y_DOWN = 3,
  TRIGGER_R = 4,
}

/** Digital input indices */
export enum UnifiedDigitalIndex {
  A_BUTTON = 0,
  B_BUTTON = 1,
  X_BUTTON = 2,
  Y_BUTTON = 3,
  Z_BUTTON = 4,
  L_BUTTON = 5,
  R_BUTTON = 6,
  C_LEFT = 7,
  C_RIGHT = 8,
  C_UP = 9,
  C_DOWN = 10,
  DPAD = 11,
  LIGHTSHIELD = 12,
  WISDOM_BUTTON = 13,
  COURAGE_BUTTON = 14,
  POWER_BUTTON = 15,
  DUMMY_FIELD = 16,
}

/** Stick curve flags */
export const STICK_CURVE_FLAG_CIRCLE_COORDS = 1 << 0;

/** Trigger policy flags */
export const TRIGGER_POLICY_FLAG_ANALOG_TO_LT = 1 << 0;
export const TRIGGER_POLICY_FLAG_LIGHTSHIELD_CLAMP = 1 << 1;

/** Processing mode */
export enum ProcessingMode {
  ORCA = 0,
  GP2040 = 1,
}

/** DPAD layer modes */
export enum DpadLayerMode {
  DISABLED = 0,
  WHILE_HELD = 1,
  ALWAYS_ON = 2,
}

/** Digital source types */
export enum DigitalSourceType {
  NONE = 0,
  ORCA_DIGITAL_BIT = 1,
  ORCA_ANALOG_GE = 2,
  ORCA_ANALOG_LE = 3,
}

/** Range calibration input */
export interface RangeCalibrationInput {
  lower: number[];
  upper: number[];
}

/** Stick curve parameters input */
export interface StickCurveParamsInput {
  range: number[];
  notch: number[];
  dz_lower?: number[];
  dz_upper?: number[];
  notch_start_input?: number;
  notch_end_input?: number;
  flags?: number;
}

/** Trigger policy input */
export interface TriggerPolicyInput {
  analogRangeMax: number;
  digitalFullPress: number;
  digitalLightshield: number;
  flags?: number;
  digitalLightLtSrc?: number;
  digitalLightRtSrc?: number;
}

export interface Gp2040ExtraMappingsInput {
  l3Src: number;
  r3Src: number;
}

/** Digital source input */
export interface DigitalSourceInput {
  type: DigitalSourceType;
  index: number;
  threshold?: number;
  hysteresis?: number;
}

/** DPAD layer input */
export interface DpadLayerInput {
  mode: DpadLayerMode;
  enable?: DigitalSourceInput;
  up?: DigitalSourceInput;
  down?: DigitalSourceInput;
  left?: DigitalSourceInput;
  right?: DigitalSourceInput;
}

/** Raw input state */
export interface RawInputState {
  digitalMask: number;
  analog: number[];
}

/** Unified output state */
export interface UnifiedOutputState {
  leftStickX: number;
  leftStickY: number;
  rightStickX: number;
  rightStickY: number;
  triggerL: number;
  triggerR: number;
  digitalMask: number;
  dpadMask: number;
}

/** Melee output state */
export interface MeleeOutputState {
  leftStick: { x: number; y: number };
  rightStick: { x: number; y: number };
  triggerL: number;
  triggerR: number;
  buttons: number;
}

/**
 * WASM Input Processor wrapper class.
 *
 * Provides a high-level TypeScript interface for input processing.
 */
export class WasmInputProcessor {
  private module: OrcaInputWasmModule | null = null;
  private contextPtr: number = 0;
  private rawInputsPtr: number = 0;
  private outputStatePtr: number = 0;
  private meleeOutputPtr: number = 0;
  private rangeCalPtr: number = 0;
  private curveParamsPtr: number = 0;
  private triggerPolicyPtr: number = 0;
  private gp2040ExtraMappingsPtr: number = 0;
  private dpadLayerPtr: number = 0;
  private analogMappingPtr: number = 0;
  private digitalMappingPtr: number = 0;

  private initialized = false;

  /**
   * Load and initialize the WASM module.
   */
  async load(): Promise<void> {
    if (this.initialized) return;

    // Import the Emscripten module directly from src/wasm/
    const moduleFactory = await import('./orca_input.js');
    const mod: OrcaInputWasmModule = await moduleFactory.default();
    this.module = mod;

    // Allocate persistent structures
    this.contextPtr = mod._wasm_create_context();
    this.rawInputsPtr = mod._wasm_alloc_raw_inputs();
    this.outputStatePtr = mod._wasm_alloc_output_state();
    this.meleeOutputPtr = mod._wasm_alloc_melee_output();
    this.rangeCalPtr = mod._wasm_alloc_range_calibration();
    this.curveParamsPtr = mod._wasm_alloc_stick_curve_params();
    this.triggerPolicyPtr = mod._wasm_alloc_trigger_policy();
    this.gp2040ExtraMappingsPtr = mod._wasm_alloc_gp2040_extra_mappings();
    this.dpadLayerPtr = mod._wasm_alloc_dpad_layer();

    // Allocate mapping arrays
    this.analogMappingPtr = mod._wasm_malloc(UNIFIED_ANALOG_INPUT_COUNT);
    this.digitalMappingPtr = mod._wasm_malloc(UNIFIED_DIGITAL_INPUT_COUNT);

    // Initialize mappings to identity using setValue
    for (let i = 0; i < UNIFIED_ANALOG_INPUT_COUNT; i++) {
      mod.setValue(this.analogMappingPtr + i, i, 'i8');
    }
    for (let i = 0; i < UNIFIED_DIGITAL_INPUT_COUNT; i++) {
      mod.setValue(this.digitalMappingPtr + i, i, 'i8');
    }

    this.initialized = true;
  }

  /**
   * Check if the module is loaded and ready.
   */
  isReady(): boolean {
    return this.initialized && this.module !== null;
  }

  /**
   * Free all allocated resources.
   */
  dispose(): void {
    if (!this.module) return;

    if (this.contextPtr) this.module._wasm_destroy_context(this.contextPtr);
    if (this.rawInputsPtr) this.module._wasm_free(this.rawInputsPtr);
    if (this.outputStatePtr) this.module._wasm_free(this.outputStatePtr);
    if (this.meleeOutputPtr) this.module._wasm_free(this.meleeOutputPtr);
    if (this.rangeCalPtr) this.module._wasm_free(this.rangeCalPtr);
    if (this.curveParamsPtr) this.module._wasm_free(this.curveParamsPtr);
    if (this.triggerPolicyPtr) this.module._wasm_free(this.triggerPolicyPtr);
    if (this.gp2040ExtraMappingsPtr) this.module._wasm_free(this.gp2040ExtraMappingsPtr);
    if (this.dpadLayerPtr) this.module._wasm_free(this.dpadLayerPtr);
    if (this.analogMappingPtr) this.module._wasm_free(this.analogMappingPtr);
    if (this.digitalMappingPtr) this.module._wasm_free(this.digitalMappingPtr);

    this.contextPtr = 0;
    this.rawInputsPtr = 0;
    this.outputStatePtr = 0;
    this.meleeOutputPtr = 0;
    this.rangeCalPtr = 0;
    this.curveParamsPtr = 0;
    this.triggerPolicyPtr = 0;
    this.gp2040ExtraMappingsPtr = 0;
    this.dpadLayerPtr = 0;
    this.analogMappingPtr = 0;
    this.digitalMappingPtr = 0;

    this.initialized = false;
    this.module = null;
  }

  /**
   * Set raw input state.
   */
  setRawInputs(inputs: RawInputState): void {
    if (!this.module) return;

    this.module._wasm_set_raw_digital(this.rawInputsPtr, inputs.digitalMask);
    for (let i = 0; i < UNIFIED_ANALOG_INPUT_COUNT && i < inputs.analog.length; i++) {
      this.module._wasm_set_raw_analog(this.rawInputsPtr, i, inputs.analog[i]);
    }
  }

  /**
   * Set range calibration.
   */
  setRangeCalibration(cal: RangeCalibrationInput | null): void {
    if (!this.module) return;

    if (!cal) {
      // Reset to identity
      for (let i = 0; i < UNIFIED_ANALOG_INPUT_COUNT; i++) {
        this.module._wasm_set_range_calibration(this.rangeCalPtr, i, 0, 1);
      }
    } else {
      for (let i = 0; i < UNIFIED_ANALOG_INPUT_COUNT; i++) {
        const lower = cal.lower[i] ?? 0;
        const upper = cal.upper[i] ?? 1;
        this.module._wasm_set_range_calibration(this.rangeCalPtr, i, lower, upper);
      }
    }
  }

  /**
   * Set stick curve parameters.
   */
  setStickCurveParams(params: StickCurveParamsInput | null): void {
    if (!this.module) return;

    if (!params) {
      // Use defaults (already set in alloc)
      return;
    }

    for (let i = 0; i < UNIFIED_ANALOG_INPUT_COUNT; i++) {
      const range = params.range[i] ?? 100 / 128;
      const notch = params.notch[i] ?? 35 / 128;
      this.module._wasm_set_stick_curve_axis(this.curveParamsPtr, i, range, notch);

      const dzLower = params.dz_lower?.[i] ?? 0;
      const dzUpper = params.dz_upper?.[i] ?? 0;
      this.module._wasm_set_stick_curve_deadzone(this.curveParamsPtr, i, dzLower, dzUpper);
    }

    // Set notch input thresholds (defaults from firmware)
    const notchStartInput = params.notch_start_input ?? 80 / 128;
    const notchEndInput = params.notch_end_input ?? 88 / 128;
    this.module._wasm_set_stick_curve_notch_inputs(this.curveParamsPtr, notchStartInput, notchEndInput);

    this.module._wasm_set_stick_curve_flags(this.curveParamsPtr, params.flags ?? 0);
  }

  /**
   * Set trigger policy.
   */
  setTriggerPolicy(policy: TriggerPolicyInput | null): void {
    if (!this.module) return;

    if (!policy) {
      // Use defaults
      this.module._wasm_set_trigger_policy(
        this.triggerPolicyPtr,
        200 / 255,
        200 / 255,
        49 / 255,
        0
      );
      // Always reset light sources to defaults
      this.module._wasm_set_trigger_light_sources(
        this.triggerPolicyPtr,
        UnifiedDigitalIndex.LIGHTSHIELD,
        UnifiedDigitalIndex.DUMMY_FIELD
      );
      return;
    }

    this.module._wasm_set_trigger_policy(
      this.triggerPolicyPtr,
      policy.analogRangeMax,
      policy.digitalFullPress,
      policy.digitalLightshield,
      policy.flags ?? 0
    );

    // Always set light sources - use provided values or defaults
    // This prevents stale values from previous calls affecting output
    this.module._wasm_set_trigger_light_sources(
      this.triggerPolicyPtr,
      policy.digitalLightLtSrc ?? UnifiedDigitalIndex.LIGHTSHIELD,
      policy.digitalLightRtSrc ?? UnifiedDigitalIndex.DUMMY_FIELD
    );
  }

  /**
   * Set DPAD layer configuration.
   */
  setDpadLayer(dpad: DpadLayerInput | null): void {
    if (!this.module) return;

    if (!dpad || dpad.mode === DpadLayerMode.DISABLED) {
      this.module._wasm_set_dpad_mode(this.dpadLayerPtr, DpadLayerMode.DISABLED);
      return;
    }

    this.module._wasm_set_dpad_mode(this.dpadLayerPtr, dpad.mode);

    const setSource = (idx: number, src: DigitalSourceInput | undefined) => {
      if (!src) {
        this.module!._wasm_set_dpad_source(this.dpadLayerPtr, idx, DigitalSourceType.NONE, 0, 0, 0);
      } else {
        this.module!._wasm_set_dpad_source(
          this.dpadLayerPtr,
          idx,
          src.type,
          src.index,
          src.threshold ?? 0.5,
          src.hysteresis ?? 0
        );
      }
    };

    setSource(0, dpad.enable);
    setSource(1, dpad.up);
    setSource(2, dpad.down);
    setSource(3, dpad.left);
    setSource(4, dpad.right);
  }

  setGp2040ExtraMappings(mappings: Gp2040ExtraMappingsInput | null): void {
    if (!this.module) return;

    this.module._wasm_set_gp2040_extra_mappings(
      this.gp2040ExtraMappingsPtr,
      mappings?.l3Src ?? UnifiedDigitalIndex.DUMMY_FIELD,
      mappings?.r3Src ?? UnifiedDigitalIndex.DUMMY_FIELD
    );
  }

  /**
   * Set analog mapping.
   */
  setAnalogMapping(mapping: number[] | null): void {
    if (!this.module) return;

    for (let i = 0; i < UNIFIED_ANALOG_INPUT_COUNT; i++) {
      this.module.setValue(this.analogMappingPtr + i, mapping?.[i] ?? i, 'i8');
    }
  }

  /**
   * Set digital mapping.
   */
  setDigitalMapping(mapping: number[] | null): void {
    if (!this.module) return;

    for (let i = 0; i < UNIFIED_DIGITAL_INPUT_COUNT; i++) {
      this.module.setValue(this.digitalMappingPtr + i, mapping?.[i] ?? i, 'i8');
    }
  }

  /**
   * Process inputs in Orca mode.
   */
  processOrca(): UnifiedOutputState {
    if (!this.module) {
      return this.emptyOutput();
    }

    this.module._wasm_process_orca(
      this.contextPtr,
      this.rawInputsPtr,
      this.rangeCalPtr,
      this.analogMappingPtr,
      this.digitalMappingPtr,
      this.curveParamsPtr,
      this.triggerPolicyPtr,
      this.gp2040ExtraMappingsPtr,
      this.dpadLayerPtr,
      this.outputStatePtr
    );

    return this.readOutputState();
  }

  /**
   * Process inputs in GP2040 mode.
   */
  processGP2040(): UnifiedOutputState {
    if (!this.module) {
      return this.emptyOutput();
    }

    this.module._wasm_process_gp2040(
      this.contextPtr,
      this.rawInputsPtr,
      this.rangeCalPtr,
      this.analogMappingPtr,
      this.digitalMappingPtr,
      this.curveParamsPtr,
      this.triggerPolicyPtr,
      this.gp2040ExtraMappingsPtr,
      this.dpadLayerPtr,
      this.outputStatePtr
    );

    return this.readOutputState();
  }

  /**
   * Convert current output state to Melee format.
   */
  toMeleeOutput(): MeleeOutputState {
    if (!this.module) {
      return this.emptyMeleeOutput();
    }

    this.module._wasm_convert_to_melee(this.outputStatePtr, this.meleeOutputPtr);

    return {
      leftStick: {
        x: this.module._wasm_get_melee_left_x(this.meleeOutputPtr),
        y: this.module._wasm_get_melee_left_y(this.meleeOutputPtr),
      },
      rightStick: {
        x: this.module._wasm_get_melee_right_x(this.meleeOutputPtr),
        y: this.module._wasm_get_melee_right_y(this.meleeOutputPtr),
      },
      triggerL: this.module._wasm_get_melee_trigger_l(this.meleeOutputPtr),
      triggerR: this.module._wasm_get_melee_trigger_r(this.meleeOutputPtr),
      buttons: this.module._wasm_get_melee_buttons(this.meleeOutputPtr),
    };
  }

  /**
   * Direct SOCD clean operation.
   */
  socdClean(positive: number, negative: number): number {
    if (!this.module) return positive - negative;
    return this.module._wasm_socd_clean(positive, negative);
  }

  /**
   * Reset DPAD state (for mode switching).
   */
  resetDpadState(): void {
    if (this.module && this.contextPtr) {
      this.module._wasm_reset_dpad_state(this.contextPtr);
    }
  }

  private readOutputState(): UnifiedOutputState {
    if (!this.module) return this.emptyOutput();

    return {
      leftStickX: this.module._wasm_get_left_stick_x(this.outputStatePtr),
      leftStickY: this.module._wasm_get_left_stick_y(this.outputStatePtr),
      rightStickX: this.module._wasm_get_right_stick_x(this.outputStatePtr),
      rightStickY: this.module._wasm_get_right_stick_y(this.outputStatePtr),
      triggerL: this.module._wasm_get_trigger_l(this.outputStatePtr),
      triggerR: this.module._wasm_get_trigger_r(this.outputStatePtr),
      digitalMask: this.module._wasm_get_digital_mask(this.outputStatePtr),
      dpadMask: this.module._wasm_get_dpad_mask(this.outputStatePtr),
    };
  }

  private emptyOutput(): UnifiedOutputState {
    return {
      leftStickX: 0,
      leftStickY: 0,
      rightStickX: 0,
      rightStickY: 0,
      triggerL: 0,
      triggerR: 0,
      digitalMask: 0,
      dpadMask: 0,
    };
  }

  private emptyMeleeOutput(): MeleeOutputState {
    return {
      leftStick: { x: 0, y: 0 },
      rightStick: { x: 0, y: 0 },
      triggerL: 0,
      triggerR: 0,
      buttons: 0,
    };
  }
}

/**
 * Singleton instance for convenient access.
 */
let instance: WasmInputProcessor | null = null;

/**
 * Get the singleton WASM processor instance.
 */
export function getWasmProcessor(): WasmInputProcessor {
  if (!instance) {
    instance = new WasmInputProcessor();
  }
  return instance;
}

/**
 * Initialize the WASM processor.
 */
export async function initWasmProcessor(): Promise<WasmInputProcessor> {
  const processor = getWasmProcessor();
  await processor.load();
  return processor;
}
