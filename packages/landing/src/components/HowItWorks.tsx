const steps = [
  {
    icon: "wallet",
    title: "Save",
    body: "Add USDC at your pace.",
  },
  {
    icon: "bars",
    title: "Stay in",
    body: "Your balance sets your chances.",
  },
  {
    icon: "calendar",
    title: "Check",
    body: "See the result when the draw ends.",
  },
];

function StepIcon({ icon }: { icon: string }) {
  if (icon === "wallet") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M5 9.5h20a2 2 0 0 1 2 2v13H7a2 2 0 0 1-2-2v-13Zm2-3 15-2v5H7a2 2 0 0 1 0-4Z" />
        <circle cx="22" cy="17" r="1.5" />
      </svg>
    );
  }

  if (icon === "bars") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M5 20h6v7H5v-7Zm8-7h6v14h-6V13Zm8-8h6v22h-6V5Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect x="5" y="7" width="22" height="20" rx="3" />
      <path d="M5 13h22M11 4v6M21 4v6" />
    </svg>
  );
}

export function HowItWorks() {
  return (
    <section className="how-section" id="how-it-works" aria-labelledby="how-it-works-title">
      <div className="section-inner">
        <h2 className="visually-hidden" id="how-it-works-title">How it works</h2>
        <ol className="step-grid">
          {steps.map((step) => (
            <li className="step-card" key={step.title}>
              <span className="step-icon"><StepIcon icon={step.icon} /></span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
