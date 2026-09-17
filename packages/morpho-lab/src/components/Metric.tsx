import { useState } from "react";

type MetricProps = {
  label: string;
  value: string;
  rawValue?: string;
  href?: string;
  copyValue?: string;
};

export function Metric({ label, value, rawValue, href, copyValue }: MetricProps) {
  const [copied, setCopied] = useState(false);
  const display = href === undefined ? value : <a href={href} rel="noreferrer" target="_blank">{value}</a>;

  const copy = async () => {
    if (copyValue === undefined || !navigator.clipboard) return;
    await navigator.clipboard.writeText(copyValue);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  };

  return (
    <div className="metric">
      <dt>{label}</dt>
      <dd title={rawValue}>{display}</dd>
      {copyValue === undefined ? null : (
        <button aria-label={`Copy ${label}`} className="copy-button" onClick={() => void copy()} type="button">
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  );
}
