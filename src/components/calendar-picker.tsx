"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useLanguage, localeByLanguage } from "@/lib/i18n";

interface CalendarPickerProps { startDate: string; endDate: string; onChange: (startDate: string, endDate: string) => void; }

const pad = (value: number) => String(value).padStart(2, "0");
const keyForDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function CalendarPicker({ startDate, endDate, onChange }: CalendarPickerProps) {
  const { language, t } = useLanguage();
  const locale = localeByLanguage[language];
  const today = keyForDate(new Date());
  const [month, setMonth] = useState(() => { const date = startDate ? new Date(`${startDate}T12:00:00`) : new Date(); return new Date(date.getFullYear(), date.getMonth(), 1); });
  const monthName = month.toLocaleDateString(locale, { month: "long", year: "numeric" });
  const weekdays = useMemo(() => (
    // 2023-01-01 was a Sunday; used only as a stable reference to derive localized weekday labels.
    Array.from({ length: 7 }, (_, index) => new Date(2023, 0, 1 + index).toLocaleDateString(locale, { weekday: "short" }).replace(/^\w/, (c) => c.toUpperCase()))
  ), [locale]);
  const days = useMemo(() => {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(firstDay).fill(null), ...Array.from({ length: count }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1))];
  }, [month]);

  function chooseDay(date: Date) {
    const value = keyForDate(date);
    if (value < today) return;
    if (!startDate || (startDate && endDate)) onChange(value, "");
    else if (value < startDate) onChange(value, "");
    else onChange(startDate, value);
  }

  return <div className="calendar-picker"><div className="calendar-toolbar"><button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18} /></button><strong>{monthName}</strong><button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18} /></button></div><div className="calendar-weekdays">{weekdays.map((weekday, index) => <span key={index}>{weekday}</span>)}</div><div className="calendar-grid">{days.map((date, index) => { if (!date) return <span className="calendar-empty" key={`empty-${index}`} />; const value = keyForDate(date); const selected = value === startDate || value === endDate; const inRange = Boolean(startDate && endDate && value > startDate && value < endDate); const disabled = value < today; return <button className={`calendar-day ${selected ? "selected" : ""} ${inRange ? "in-range" : ""}`} disabled={disabled} type="button" key={value} onClick={() => chooseDay(date)}>{date.getDate()}</button>; })}</div><p className="calendar-hint">{startDate && !endDate ? t("calendarChooseReturn") : t("calendarChoosePickup")}</p></div>;
}
