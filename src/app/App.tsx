import { OrcaAppProvider } from './contexts/OrcaAppContext';
import { AppShell } from './views/AppShell';
import { UpdatePrompt } from './components/UpdatePrompt';

export default function App() {
  return (
    <OrcaAppProvider>
      <UpdatePrompt />
      <AppShell />
    </OrcaAppProvider>
  );
}

