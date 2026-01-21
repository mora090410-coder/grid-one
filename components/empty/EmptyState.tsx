
import React from 'react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
    variant?: 'default' | 'first-time' | 'no-results' | 'error';
    title: string;
    description: string;
    icon?: React.ReactNode;
    action?: {
        label: string;
        onClick?: () => void;
        to?: string;
    };
    secondaryAction?: {
        label: string;
        onClick?: () => void;
    };
}

const EmptyState: React.FC<EmptyStateProps> = ({
    variant = 'default',
    title,
    description,
    icon,
    action,
    secondaryAction
}) => {
    // Defines styles based on variant
    const getVariantStyles = () => {
        switch (variant) {
            case 'error':
                return {
                    bg: 'bg-red-500/5',
                    border: 'border-red-500/20',
                    iconBg: 'bg-red-500/10',
                    iconColor: 'text-red-500',
                    titleColor: 'text-red-400'
                };
            case 'first-time':
                return {
                    bg: 'bg-[#1c1c1e]/40',
                    border: 'border-white/10',
                    iconBg: 'bg-white/5',
                    iconColor: 'text-[#FFC72C]',
                    titleColor: 'text-white'
                };
            case 'no-results':
            default:
                return {
                    bg: 'bg-transparent',
                    border: 'border-transparent',
                    iconBg: 'bg-white/5',
                    iconColor: 'text-gray-400',
                    titleColor: 'text-gray-200'
                };
        }
    };

    const styles = getVariantStyles();

    return (
        <div className={`rounded-3xl p-12 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-500 ${styles.bg} ${variant !== 'no-results' ? `border ${styles.border}` : ''}`}>

            {/* Icon */}
            {icon ? (
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg ${styles.iconBg} ${styles.iconColor}`}>
                    {icon}
                </div>
            ) : (
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg ${styles.iconBg} ${styles.iconColor}`}>
                    <svg className="w-8 h-8 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                </div>
            )}

            {/* Content */}
            <div className="max-w-md space-y-2 mb-8">
                <h3 className={`text-xl font-bold tracking-tight ${styles.titleColor}`}>
                    {title}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                    {description}
                </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
                {action && (
                    action.to ? (
                        <Link
                            to={action.to}
                            className={`px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg transition-transform hover:scale-105 active:scale-95 ${variant === 'error' ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'btn-cardinal'}`}
                        >
                            {action.label}
                        </Link>
                    ) : (
                        <button
                            onClick={action.onClick}
                            className={`px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg transition-transform hover:scale-105 active:scale-95 ${variant === 'error' ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'btn-cardinal'}`}
                        >
                            {action.label}
                        </button>
                    )
                )}

                {secondaryAction && (
                    <button
                        onClick={secondaryAction.onClick}
                        className="px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
                    >
                        {secondaryAction.label}
                    </button>
                )}
            </div>
        </div>
    );
};

export default EmptyState;
