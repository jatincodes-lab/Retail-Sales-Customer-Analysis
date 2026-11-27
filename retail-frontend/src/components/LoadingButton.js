import React from 'react';

export default function LoadingButton({ type = 'button', loading = false, loadingLabel = 'Working…', disabled = false, className = '', children, ...props }) {
  return (
    <button {...props} type={type} className={className} disabled={disabled || loading} aria-busy={loading || undefined}>
      {loading && <span className="inline-spinner" aria-hidden="true" />}
      <span aria-live="polite">{loading ? loadingLabel : children}</span>
    </button>
  );
}
