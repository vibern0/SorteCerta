"use client";

import { cn } from "@/lib/cn";

type AmountInputProps = {
  label: string;
  maxLabel: string;
  value: string;
  onChange: (value: string) => void;
  onMax: () => void;
};

export function AmountInput({ label, maxLabel, value, onChange, onMax }: AmountInputProps) {
  return (
    <div className="space-y-2">
      <label className="label">{label}</label>
      <div className="relative">
        <input
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn("input pr-24 text-2xl font-semibold tabular-nums")}
          placeholder="0"
        />
        <button
          type="button"
          onClick={onMax}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums text-muted transition-colors hover:bg-white/45 hover:text-text"
          aria-label={`Use maximum: ${maxLabel}`}
          title={maxLabel}
        >
          Max
        </button>
      </div>
    </div>
  );
}
