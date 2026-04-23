export type Gp2040InputModeState = {
  current: number | null;
  draft: number | null;
  usingDefaults: boolean;
  dirty: boolean;
  busy: boolean;
  error: string;
};

export function createEmptyGp2040InputModeState(): Gp2040InputModeState {
  return {
    current: null,
    draft: null,
    usingDefaults: false,
    dirty: false,
    busy: false,
    error: '',
  };
}

export function setLoadedGp2040InputMode(
  _state: Gp2040InputModeState,
  next: { inputMode: number; usingDefaults: boolean },
): Gp2040InputModeState {
  return {
    current: next.inputMode,
    draft: next.inputMode,
    usingDefaults: next.usingDefaults,
    dirty: false,
    busy: false,
    error: '',
  };
}

export function setGp2040InputModeDraft(
  state: Gp2040InputModeState,
  inputMode: number,
): Gp2040InputModeState {
  return {
    ...state,
    draft: inputMode,
    dirty: state.current !== null && inputMode !== state.current,
    error: '',
  };
}

export function setGp2040InputModeBusy(
  state: Gp2040InputModeState,
  busy: boolean,
): Gp2040InputModeState {
  return {
    ...state,
    busy,
    error: busy ? '' : state.error,
  };
}

export function setGp2040InputModeError(
  state: Gp2040InputModeState,
  error: string,
): Gp2040InputModeState {
  return {
    ...state,
    busy: false,
    error,
  };
}

export function setAppliedGp2040InputMode(
  state: Gp2040InputModeState,
  inputMode: number,
): Gp2040InputModeState {
  return {
    ...state,
    current: inputMode,
    draft: inputMode,
    usingDefaults: false,
    dirty: false,
    busy: false,
    error: '',
  };
}
