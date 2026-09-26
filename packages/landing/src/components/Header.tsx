export function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="SorteCerta home">
        <span className="brand-mark" aria-hidden="true">
          SC
        </span>
        <span>SorteCerta</span>
      </a>
      <nav className="site-nav" aria-label="Primary navigation">
        <a href="#how-it-works">How it works</a>
        <a href="#why-sortecerta">Why SorteCerta</a>
      </nav>
      <a className="button button-small" href="#waitlist">
        Join the waitlist
      </a>
    </header>
  );
}
