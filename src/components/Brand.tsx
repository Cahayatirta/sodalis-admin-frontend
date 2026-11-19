import React from "react";

type BrandProps = { variant?: "sidebar" | "login" };

export function Brand({ variant = "sidebar" }: BrandProps) {
  return <div className={`sodalis-brand sodalis-brand-${variant}`}>
    <img src="/sodalis-mark.png" alt="Sodalis" />
    <div className="sodalis-brand-copy"><strong>Sodalis</strong><span>MICRO-FINANCE</span></div>
  </div>;
}
