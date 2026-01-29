import { useRegisterSW } from 'virtual:pwa-register/react';

const PENDING_UPDATE_KEY = 'orca.changelog.pendingUpdate';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Check for updates every hour
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      }
    },
  });

  if (!needRefresh) {
    return null;
  }

  return (
    <div className="update-banner">
      <span>A new version is available</span>
      <button
        className="primary"
        onClick={() => {
          try {
            window.localStorage.setItem(PENDING_UPDATE_KEY, '1');
          } catch {
            // ignore
          }
          updateServiceWorker(true);
        }}
      >
        Refresh
      </button>
    </div>
  );
}
