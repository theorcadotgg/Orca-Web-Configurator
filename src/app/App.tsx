import { OrcaAppProvider } from './contexts/OrcaAppContext';
import { AppShell } from './views/AppShell';

export default function App() {
  return (
    <OrcaAppProvider>
      <AppShell />
    </OrcaAppProvider>
  );
}

