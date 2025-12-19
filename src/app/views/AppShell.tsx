import { FooterBar } from './FooterBar';
import { HeaderBar } from './HeaderBar';
import { MainPane } from './MainPane';
import { Sidebar } from './Sidebar';

export function AppShell() {
  return (
    <div className="layout-container">
      <HeaderBar />
      <div className="layout-body">
        <MainPane />
        <Sidebar />
      </div>
      <FooterBar />
    </div>
  );
}

