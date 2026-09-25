export function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <img className="hero-art" src="/og-image.png" alt="" aria-hidden="true" />
      <div className="section-inner hero-layout">
        <div className="hero-copy">
          <p className="eyebrow">Prize-linked USDC savings</p>
          <h1 id="hero-title">Make your USDC feel lucky.</h1>
          <p>
            Save in USDC, stay eligible at the end of each draw, and keep control of your money while your balance sets
            your chances.
          </p>
          <div className="hero-actions" aria-label="Landing actions">
            <a className="button button-primary" href="#waitlist">
              Join the waitlist
            </a>
            <a className="button button-secondary" href="#how-it-works">
              See how it works
            </a>
          </div>
        </div>

        <div className="prize-panel" aria-label="Prize draw overview">
          <div className="prize-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <dl className="prize-list">
            <div>
              <dt>Next draw</dt>
              <dd>Access opens by invitation</dd>
            </div>
            <div>
              <dt>Your savings set your chances</dt>
              <dd>Eligibility is checked at the end of each draw.</dd>
            </div>
            <div>
              <dt>Your money stays yours</dt>
              <dd>Request a withdrawal when you want to step out.</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
