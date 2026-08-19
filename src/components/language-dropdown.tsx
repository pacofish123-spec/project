"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import type { SupportedLanguage } from "@/lib/marketplace-config";

// Each language's name is shown in its own language (an endonym), not
// translated into whatever's currently active — that's the standard
// convention, so a reader can always recognize their target language.
const options: Array<{ code: SupportedLanguage; label: string }> = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
];

export function LanguageDropdown() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="lang-dropdown" ref={rootRef}>
      <button className="language-button" type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Globe2 size={16} /> {language.toUpperCase()} <ChevronDown size={14} />
      </button>
      {open && (
        <div className="lang-dropdown-menu" role="listbox">
          {options.map((option) => (
            <button
              key={option.code}
              type="button"
              role="option"
              aria-selected={language === option.code}
              className={`lang-dropdown-option ${language === option.code ? "active" : ""}`}
              onClick={() => { setLanguage(option.code); setOpen(false); }}
            >
              <span>{option.label}</span>
              {language === option.code && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
