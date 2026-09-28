const steps = [
  {
    title: "Save USDC",
    body: "Add savings when you are ready. Your balance remains the base for draw eligibility.",
  },
  {
    title: "Stay eligible",
    body: "At the end of a draw, chances are weighted by savings held through that draw.",
  },
  {
    title: "Check and claim",
    body: "After a draw closes, check whether there is a prize to claim or keep saving for the next one.",
  },
];

export function HowItWorks() {
  return (
    <section className="section-band" id="how-it-works" aria-labelledby="how-it-works-title">
      <div className="section-inner">
        <div className="section-copy">
          <p className="eyebrow">How it works</p>
          <h2 id="how-it-works-title">A simple rhythm for prize-linked saving.</h2>
        </div>
        <ol className="step-grid">
          {steps.map((step) => (
            <li className="step-card" key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
