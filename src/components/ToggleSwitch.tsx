import React from 'react';

interface ToggleSwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, label }) => {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className="flex w-full items-center justify-between gap-4 text-left select-none"
        >
            <span className="text-sm text-slate-900 dark:text-card-fg">{label}</span>
            <span
                className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors duration-200 ${
                    checked ? 'bg-toggle-on' : 'bg-gray-300 dark:bg-white/20'
                }`}
            >
                <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        checked ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                />
            </span>
        </button>
    );
};
