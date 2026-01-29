import { useState, type AnchorHTMLAttributes, type MouseEvent } from 'react';
import { useOrcaApp } from '../contexts/OrcaAppContext';
import { ConfirmModal } from './ConfirmModal';

type Props = AnchorHTMLAttributes<HTMLAnchorElement>;

export function FirmwareDownloadLink({ onClick, children, ...rest }: Props) {
  const { state, dirty, enterBootselNow } = useOrcaApp();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (state.transport) {
      setShowConfirm(true);
    }
  };

  return (
    <>
      <a {...rest} onClick={handleClick}>
        {children}
      </a>
      <ConfirmModal
        isOpen={showConfirm}
        title="Enter Firmware Update Mode?"
        message={
          <>
            This will reboot the controller into BOOTSEL/UF2 mode and disconnect it from the configurator.
            <br />
            <br />
            {dirty ? <strong>Unsaved changes will be lost.</strong> : null}
            {dirty ? <br /> : null}
            Drag the new firmware `.uf2` onto the RPI-RP2 drive, then reconnect.
          </>
        }
        confirmLabel="Enter Update Mode"
        cancelLabel="Not Now"
        onConfirm={() => {
          setShowConfirm(false);
          void enterBootselNow();
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
