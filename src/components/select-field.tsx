"use client";

import { Check, ChevronDown } from "lucide-react";
import { Drawer } from "vaul";
import { useState } from "react";

interface SelectFieldProps { name: string; label: string; defaultValue: string; options: Array<{ value: string; label: string }>; onChange?: (value: string) => void; }

export function SelectField({ name, label, defaultValue, options, onChange }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const selected = options.find((option) => option.value === value) ?? options[0];
  function choose(nextValue: string) {
    setValue(nextValue);
    setOpen(false);
    onChange?.(nextValue);
  }
  return <Drawer.Root open={open} onOpenChange={setOpen}><div className="select-field"><span className="select-label">{label}</span><input type="hidden" name={name} value={value} /><Drawer.Trigger asChild><button className="select-trigger" type="button" aria-haspopup="dialog" aria-expanded={open}>{selected.label}<ChevronDown size={16} /></button></Drawer.Trigger></div><Drawer.Portal><Drawer.Overlay className="drawer-overlay" /><Drawer.Content className="drawer-content"><div className="drawer-handle" /><Drawer.Title className="drawer-title">{label}</Drawer.Title><div className="drawer-options">{options.map((option) => <button className="select-option" type="button" key={option.value} onClick={() => choose(option.value)}>{option.label}{value === option.value && <Check size={18} />}</button>)}</div></Drawer.Content></Drawer.Portal></Drawer.Root>;
}
