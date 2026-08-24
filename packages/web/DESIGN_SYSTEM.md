# SorteCerta Design System

## Direction

SorteCerta uses warm glassmorphism over an organic aurora mesh. The interface should feel calm, tactile, friendly, and trustworthy. Depth comes from translucent layers and diffused light, never heavy shadows or high-saturation gradients.

## Color

- Aurora mesh: pale slate blue, dusty rose, warm sand, and muted peach.
- Glass: white at 34–60% opacity, with the mesh visible beneath it.
- Primary ink and actions: soft charcoal (`#2B2D32` to `#34363C`).
- Secondary ink: warm gray (`#67666D`).
- Small accents: muted rose and pale cyan.
- Semantic colors: desaturated green, red, and amber so state colors remain harmonious with the palette.

Color variables live in `src/app/globals.css`; Tailwind aliases live in `tailwind.config.ts`.

## Surfaces and depth

- Standard glass blur: `24px`, with light saturation enhancement.
- Glass borders: `1px` translucent white.
- Edge light: an inset white highlight on the top-left edge.
- Shadows: large, soft, low-opacity, and neutral.
- Main card radius: `28px`.
- Buttons, status pills, and tabs: full pill radius.
- Inputs: `18px` radius.

Use `.card` for content containers and `.glass-surface` when a custom container needs the same material without standard spacing or radius.

## Typography

SorteCerta uses a two-font system. TT Ramillas is the display family for page titles, card titles, section labels, and buttons. It brings a softer editorial serif voice to the warm glass UI without taking over dense reading.

TT Interphases Pro Mono is the body family for regular text, supporting paragraphs, data, captions, addresses, and card copy. Its monospaced structure gives the product a precise financial feel while Ramillas keeps the brand warm.

The bundled files are DaFont trial versions, marked free for personal use. Published or commercial use requires proper TypeType licenses.

## Components

- `.btn-primary`: charcoal pill, white text, diffused lift.
- `.btn-secondary`: translucent glass pill.
- `.btn-ghost`: low-emphasis text action.
- `.input`: translucent recessed glass field.
- `.pill`: compact translucent status element.
- `.accent-rose` and `.accent-cyan`: small icon or numbered-marker backgrounds only.

## Motion

Motion stays soft and brief. Content enters with a small `8px` rise over `400ms`; button presses scale to `98%`. Avoid decorative movement that competes with balances, draw timing, or transaction feedback.

## Accessibility

Keep body text on the dark ink tokens. Do not place long text directly on a saturated part of the mesh without a glass surface. Preserve visible focus states and never rely on accent color alone to communicate transaction state.
