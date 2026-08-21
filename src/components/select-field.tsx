"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SelectFieldProps { name: string; label: string; defaultValue: string; options: Array<{ value: string; label: string }>; onChange?: (value: string) => void; }

export function SelectField({ name, label, defaultValue, options, onChange }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

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

  function choose(nextValue: string) {
    setValue(nextValue);
    setOpen(false);
    onChange?.(nextValue);
  }

  return (
    <div className="select-field" ref={rootRef}>
      <span className="select-label">{label}</span>
      <input type="hidden" name={name} value={value} />
      <button className="select-trigger" type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>{selected.label}<ChevronDown size={16} /></button>
      {open && (
        <div className="select-menu" role="listbox">
          {options.map((option) => (
            <button className="select-option" type="button" role="option" aria-selected={value === option.value} key={option.value} onClick={() => choose(option.value)}>{option.label}{value === option.value && <Check size={18} />}</button>
          ))}
        </div>
      )}
    </div>
  );
}
