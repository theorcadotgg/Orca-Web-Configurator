import { OrcaAppProvider } from './contexts/OrcaAppContext';
import { AppShell } from './views/AppShell';
import { UpdatePrompt } from './components/UpdatePrompt';
import { ChangelogProvider } from './changelog/ChangelogProvider';

export default function App() {
  return (
    <ChangelogProvider>
      <OrcaAppProvider>
        <UpdatePrompt />
        <AppShell />
      </OrcaAppProvider>
    </ChangelogProvider>
  );
}
