import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

type Options<T> = {
  serialize?: (value: T) => string;
  deserialize?: (raw: string) => T | undefined;
};

export function useLocalStorageState<T>(
  key: string,
  initialValue: T | (() => T),
  options: Options<T> = {},
): [T, Dispatch<SetStateAction<T>>] {
  const serialize = options.serialize ?? ((value) => JSON.stringify(value));
  const deserialize = options.deserialize ?? ((raw) => JSON.parse(raw) as T);

  const [state, setState] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        const parsed = deserialize(raw);
        if (parsed !== undefined) return parsed;
      }
    } catch {
      // ignore
    }
    return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, serialize(state));
    } catch {
      // ignore
    }
  }, [key, state]);

  return [state, setState];
}
