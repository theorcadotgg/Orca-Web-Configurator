import { useState, type ReactNode } from 'react';

type Props = {
    title: string;
    badge?: ReactNode;
    defaultOpen?: boolean;
    children: ReactNode;
};

export function CollapsiblePanel({ title, badge, defaultOpen = false, children }: Props) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={`collapsible-panel ${isOpen ? 'open' : ''}`}>
            <div
                className="collapsible-header"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="collapsible-title">
                    {title}
                    {badge}
                </span>
                <span className="collapsible-chevron">▶</span>
            </div>
            <div className="collapsible-content">
                {children}
            </div>
        </div>
    );
}
