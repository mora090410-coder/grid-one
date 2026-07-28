import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, FileSearch, Trophy } from 'lucide-react';

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
                    bg: 'bg-cardinal-subtle',
                    border: 'border-cardinal',
                    iconBg: 'bg-cardinal',
                    iconColor: 'text-broadcast-white',
                    titleColor: 'text-cardinal'
                };
            case 'first-time':
                return {
                    bg: 'bg-broadcast-white',
                    border: 'border-ink',
                    iconBg: 'bg-gold',
                    iconColor: 'text-ink',
                    titleColor: 'text-ink'
                };
            case 'no-results':
            default:
                return {
                    bg: 'bg-transparent',
                    border: 'border-transparent',
                    iconBg: 'bg-newsprint',
                    iconColor: 'text-ink/60',
                    titleColor: 'text-ink/70'
                };
        }
    };

    const styles = getVariantStyles();

    // Default icon based on variant if none provided
    const getDefaultIcon = () => {
        if (icon) return icon;

        switch (variant) {
            case 'error': return <AlertCircle className="w-8 h-8" strokeWidth={1.5} />;
            case 'no-results': return <FileSearch className="w-8 h-8 opacity-60" strokeWidth={1.5} />;
            case 'first-time': return <Trophy className="w-8 h-8" strokeWidth={1.5} />;
            default: return <FileSearch className="w-8 h-8 opacity-60" strokeWidth={1.5} />;
        }
    };

    return (
        <div className={`oa-root p-12 flex flex-col items-center justify-center text-center ${styles.bg} ${variant !== 'no-results' ? `border ${styles.border}` : ''}`}>

            {/* Icon */}
            <div className={`w-16 h-16 flex items-center justify-center mb-6 border border-ink ${styles.iconBg} ${styles.iconColor}`}>
                {getDefaultIcon()}
            </div>

            {/* Content */}
            <div className="max-w-md space-y-2 mb-8">
                <h3 className={`text-heading ${styles.titleColor}`}>
                    {title}
                </h3>
                <p className="text-body-secondary leading-relaxed">
                    {description}
                </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
                {action && (
                    action.to ? (
                        <Link
                            to={action.to}
                            className="oa-btn oa-btn-primary"
                        >
                            {action.label}
                        </Link>
                    ) : (
                        <button
                            onClick={action.onClick}
                            className="oa-btn oa-btn-primary"
                        >
                            {action.label}
                        </button>
                    )
                )}

                {secondaryAction && (
                    <button
                        onClick={secondaryAction.onClick}
                        className="oa-btn oa-btn-ghost"
                    >
                        {secondaryAction.label}
                    </button>
                )}
            </div>
        </div>
    );
};

export default EmptyState;
