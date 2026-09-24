import { useEffect, useRef, useState } from "react";

type MetricProps = {
  label: string;
  value: string;
  rawValue?: string;
  href?: string;
  copyValue?: string;
};

export function Metric({
  label,
  value,
  rawValue,
  href,
  copyValue,
}: MetricProps) {
  const [copyStatus, setCopyStatus] = useState("Copy");
  const resetTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(
    () => () => {
      clearTimeout(resetTimer.current);
    },
    [],
  );
  const display =
    href === undefined ? (
      value
    ) : (
      <a href={href} rel="noreferrer" target="_blank">
        {value}
      </a>
    );

  const copy = async () => {
    if (copyValue === undefined) return;
    clearTimeout(resetTimer.current);
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopyStatus("Copied");
    } catch {
      setCopyStatus("Copy failed");
    }
    resetTimer.current = setTimeout(() => {
      setCopyStatus("Copy");
    }, 1_500);
  };

  return (
    <div className="metric">
      <dt>{label}</dt>
      <dd title={rawValue}>{display}</dd>
      {copyValue === undefined ? null : (
        <button
          aria-label={`Copy ${label}`}
          aria-live="polite"
          className="copy-button"
          onClick={() => void copy()}
          type="button"
        >
          {copyStatus}
        </button>
      )}
    </div>
  );
}
