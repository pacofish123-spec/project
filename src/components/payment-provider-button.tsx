"use client";

import { CreditCard } from "lucide-react";

export interface PaymentProviderOption {
  id: string;
  label: string;
}

// Simplified brand-colored marks — same spirit as the Google/Facebook
// letter marks in oauth-buttons.tsx, not a pixel copy of anyone's
// official lockup. Stripe settles plain cards, so it's shown to
// renters as "Card" rather than the processor's own name.
function ProviderMark({ id }: { id: string }) {
  if (id === "paypal") {
    return (
      <span className="pay-mark pay-mark-paypal" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path d="M9.1 5.2h5.1c2.9 0 4.6 1.6 4.1 4.3-.6 3.4-2.8 5-6 5h-1.7c-.4 0-.7.3-.8.7l-.9 4.9c0 .2-.2.4-.5.4H6.1c-.3 0-.5-.3-.4-.6L8.4 5.8c.1-.4.4-.6.7-.6z" fill="#003087" />
          <path d="M11.6 8.9h4.7c2.7 0 4.3 1.5 3.8 4-.5 3-2.6 4.4-5.5 4.4h-1.5c-.4 0-.7.3-.8.7l-.7 3.9c0 .2-.2.4-.5.4H8.5c-.3 0-.5-.3-.4-.6l.5-2.7" fill="#009cde" />
        </svg>
      </span>
    );
  }
  if (id === "stripe") {
    return (
      <span className="pay-mark pay-mark-card" aria-hidden="true">
        <CreditCard size={14} strokeWidth={2.3} />
      </span>
    );
  }
  return (
    <span className="pay-mark pay-mark-generic" aria-hidden="true">
      {id.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function PaymentProviderButton({ provider, label, busy, onClick }: {
  provider: PaymentProviderOption;
  label: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`pay-provider-btn pay-provider-btn-${provider.id}`} type="button" disabled={busy} onClick={onClick}>
      <ProviderMark id={provider.id} />
      <span>{label}</span>
    </button>
  );
}
