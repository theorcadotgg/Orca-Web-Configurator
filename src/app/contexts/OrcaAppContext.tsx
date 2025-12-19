import { createContext, useContext, type ReactNode } from 'react';
import { useOrcaAppController, type OrcaAppController } from '../hooks/useOrcaAppController';

const OrcaAppContext = createContext<OrcaAppController | null>(null);

export function OrcaAppProvider({ children }: { children: ReactNode }) {
  const controller = useOrcaAppController();
  return <OrcaAppContext.Provider value={controller}>{children}</OrcaAppContext.Provider>;
}

export function useOrcaApp(): OrcaAppController {
  const ctx = useContext(OrcaAppContext);
  if (!ctx) throw new Error('useOrcaApp must be used within <OrcaAppProvider>');
  return ctx;
}

