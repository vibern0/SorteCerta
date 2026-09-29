export function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero-orbit" aria-hidden="true">
        <span className="orbit-dot orbit-dot-left" />
        <span className="orbit-ring" />
        <span className="orbit-prize" />
        <span className="orbit-dot orbit-dot-right" />
      </div>
      <div className="section-inner hero-layout" id="the-idea">
        <div className="hero-copy">
          <p className="eyebrow">The quiet upside of saving</p>
          <h1 id="hero-title">Good saving habits. A little more upside.</h1>
          <p>
            Save in USDC, stay eligible at the end of each draw, and keep control of your money.
          </p>
          <div className="hero-actions" aria-label="Landing actions">
            <a className="button button-primary" href="#waitlist">
              Join the waitlist
            </a>
            <a className="button button-secondary" href="#how-it-works">
              See how it works <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
