const trustItems = [
  {
    title: "Privacy powered by Zama",
    body: "SorteCerta is built so personal balances and prize checks can stay personal while the draw remains verifiable.",
  },
  {
    title: "Yield powered by Morpho",
    body: "The prize pool is designed to be funded by established lending markets without promising a fixed return.",
  },
];

export function TrustSection() {
  return (
    <section className="section-band trust-section" id="why-sortecerta" aria-labelledby="why-sortecerta-title">
      <div className="section-inner trust-layout">
        <div className="section-copy">
          <p className="eyebrow">Why SorteCerta</p>
          <h2 id="why-sortecerta-title">Built for people who like upside without losing the habit of saving.</h2>
        </div>
        <div className="trust-grid">
          {trustItems.map((item) => (
            <article className="trust-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
