import type { ReactNode } from 'react';

type Props = {
    isOpen: boolean;
    title: string;
    message: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

export function ConfirmModal({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
    onConfirm,
    onCancel,
}: Props) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 style={{ margin: 0, marginBottom: 'var(--spacing-md)', color: 'var(--color-text-primary)' }}>
                    {title}
                </h3>
                <p style={{ margin: 0, marginBottom: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
                    {message}
                </p>
                <div className="row" style={{ gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
                    <button onClick={onCancel}>
                        {cancelLabel}
                    </button>
                    <button className={danger ? 'danger' : 'primary'} onClick={onConfirm}>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
