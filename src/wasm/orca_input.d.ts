/**
 * Type declaration for the Emscripten-generated WASM module.
 */

// Re-import the interface for use in this declaration
import type { OrcaInputWasmModule } from './WasmInputProcessor';

declare const OrcaInputModule: () => Promise<OrcaInputWasmModule>;
export default OrcaInputModule;
