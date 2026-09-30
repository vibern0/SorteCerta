import { useState } from "react";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="site-header-wrap">
      <div className="site-header">
        <a className="brand" href="#top" aria-label="SorteCerta home">
          SorteCerta
        </a>
        <nav className="site-nav" aria-label="Primary navigation">
          <a href="#the-idea">The idea</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <a className="button button-outline header-access" href="#waitlist">
          Invitation access
        </a>
        <button
          className="menu-button"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>
      {menuOpen ? (
        <nav className="mobile-navigation" id="mobile-navigation" aria-label="Mobile navigation">
          <a href="#the-idea" onClick={closeMenu}>The idea</a>
          <a href="#how-it-works" onClick={closeMenu}>How it works</a>
          <a href="#waitlist" onClick={closeMenu}>Invitation access</a>
        </nav>
      ) : null}
    </header>
  );
}
