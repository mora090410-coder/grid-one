import React, { forwardRef, useId } from 'react';

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
  error?: string;
  containerClassName?: string;
  labelClassName?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ id, label, description, error, className = '', containerClassName = '', labelClassName = '', 'aria-describedby': describedBy, 'aria-invalid': ariaInvalid, ...props }, ref) => {
    const generatedId = useId().replace(/:/g, '');
    const fieldId = id || `field-${generatedId}`;
    const descriptionId = description ? `${fieldId}-description` : undefined;
    const errorId = error ? `${fieldId}-error` : undefined;
    const describedByIds = [describedBy, descriptionId, errorId].filter(Boolean).join(' ') || undefined;

    return (
      <div className={`space-y-1.5 ${containerClassName}`.trim()}>
        <label htmlFor={fieldId} className={`oa-slab block text-ink/70 ${labelClassName}`.trim()}>{label}</label>
        {description && <p id={descriptionId} className="oa-body text-sm text-ink/70">{description}</p>}
        <input
          ref={ref}
          id={fieldId}
          aria-describedby={describedByIds}
          aria-invalid={ariaInvalid ?? (Boolean(error) || undefined)}
          className={`oa-input min-h-11 w-full ${className}`.trim()}
          {...props}
        />
        {error && <p id={errorId} className="oa-field-error oa-body text-sm" role="alert">{error}</p>}
      </div>
    );
  },
);

Field.displayName = 'Field';
