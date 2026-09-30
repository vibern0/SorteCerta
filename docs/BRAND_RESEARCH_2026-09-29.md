# SorteCerta brand research and decision brief

29 September 2026. Internal research and recommendations, not customer-facing copy.

**Decision update:** the founder selected **Direction 02 — playful and expressive**. The [brand decision](BRAND_DIRECTION.md) is the current reference. Earlier alternatives and recommendations below are retained as research history, not competing approved directions.

**Finding:** SorteCerta has the beginnings of a brand, but its identity is fragmented. The web app, original landing page, and PR #15 express different visual personalities. Their language also creates different expectations. Matching one button color will not resolve that.

**Recommendation after selection:** formalize the chosen playful direction into one product promise, recognizable visual assets, and a shared vocabulary across the landing page and app. Preserve useful structural work from PR #15 while aligning its expression with the selected direction.

## 1. Scope, evidence, and unanswered decisions

This research combines a repository audit, visual inspection of the live app and PR preview, academic research, marketing research, and brands' own published material. It does not include interviews, a representative market survey, conversion experiments, or measurement of SorteCerta's existing brand recognition.

Evidence is distinguished as follows:

- **Observed:** present in source files or visible in the inspected product.
- **Research finding:** reported by the linked study, within its original setting.
- **Interpretation:** an application of that evidence to SorteCerta, requiring validation.
- **Decision pending:** a business or aesthetic preference that research cannot choose for the founder.

**Founder decisions, confirmed 29 September 2026:** the first audience is existing USDC holders in Nigeria and Kenya; prize excitement leads the emotional positioning; every existing brand element was open to reconsideration during exploration. The founder subsequently chose Direction 02, playful and expressive. This does not establish priority between the two countries, audience demographics, preferred language, or measured audience preference. The name remains a working label, not a confirmed naming decision.

Existing constraints remain in force: [bounty scope](BOUNTY_SCOPE.md), [roadmap](ROADMAP.md), [product copy rules](../AGENTS.md), and [mainnet readiness](ROAD_TO_MAINNET.md). This report makes no deployment or network change.

## 2. What we actually have

Inspected [live app](https://sortecerta.netlify.app/), [PR #15](https://github.com/vibern0/SorteCerta/pull/15), and its [landing preview](https://quiet-invitation-sortecerta-landing.blvieira5.workers.dev/). PR source was inspected at commit `6d6ed846ddde041b1b6f373aee221a31b75f66b0`.

| Element | Existing app | Earlier landing in local checkout | PR #15 |
| --- | --- | --- | --- |
| Base | Warm grey and pastel gradients | Dark graphite | Warm ivory and paper |
| Dominant action | Charcoal `#34363C` | Warm accent, with teal/plum atmosphere | Forest `#123F32` |
| Supporting colors | Slate `#B8C1D2`, rose `#DAB3B9`, sand `#DECDAE`, peach `#E6B79D` | Teal `#24D6BD`, plum `#8F5CFF`, warm `#F3BA62` | Sage `#DFE7D8`, yellow `#FFE995` |
| Materials | Translucent cards, blur, layered gradients | Dark surfaces and selective glass | Mostly solid surfaces, fine lines, orbital decoration |
| Typography | TT Ramillas display; TT Interphases Pro Mono body | Georgia display; Inter/system body tokens | System serif display; Inter/system body tokens |
| Identity | Image icon and serif name | Landing-specific expression | Serif name and orbital motif |
| Main message | Savings and a chance to win | Lucky USDC | Saving habits and a little upside |

These are source/visual observations. “Calm,” “premium,” “playful,” or “technical” are interpretations of those choices, not measured audience responses.

The common starting points are useful: a serif identity, rounded actions, saving plus prizes, and an attempt to make finance approachable. There is something to build on. What is missing is a rule for which elements remain constant when the context changes.

The [original landing specification](superpowers/specs/2026-09-25-invitation-only-landing-design.md) explicitly kept the app unchanged. That explains how independent styles could develop; it does not settle whether they should remain independent.

### The wording mismatch matters as much as the palette

The live app says “Your principal always returns,” “Win without losing,” and “Each USDC counts as one ticket for the weekly draw.” PR #15 says “Good saving habits. A little more upside,” followed by eligibility at the end of each draw.

These differ in promise, precision, and emotional emphasis:

- “Always returns” reads as an unconditional assurance. The presence of a prize mechanism does not establish that the underlying financial product is without risk.
- “Tickets” gives a lottery interpretation and suggests a discrete object. It needs to match the actual accounting and eligibility rules.
- “Weekly” should follow verified product scheduling, not be independently hardcoded into marketing. The contract accepts a configurable draw interval.
- “A little more upside” is restrained, but does not clearly explain whether someone receives interest, cashback, or a chance-based prize.
- “Withdraw when you need it” may be understood as immediate settlement. The app's withdrawal model explicitly includes requested, preparing, claimable, finalizing, and complete states.
- “Technology partners” can imply a commercial endorsement. Integration evidence alone does not establish that relationship.

References: [home copy](../packages/web/src/app/page.tsx), [withdrawal states](../packages/web/src/lib/withdrawal-state.ts), [contract](../packages/contracts/contracts/ConfidentialPrizePool.sol), and [PR files](https://github.com/vibern0/SorteCerta/pull/15/files).

### Two implementation details affect the brand audit

The app includes font files with “Trial” in their names. This does not prove the absence of a license; it means licensing and production-ready files must be confirmed before those fonts become a permanent brand asset.

On the inspected PR preview, the computed body font is `Times`, with `normal` line height. The CSS first specifies the body family and line height, then overrides them through `body, button, input { font: inherit; }`. The intended Inter/system body typography is therefore not the typography currently being judged in that browser. Fixing this should precede a final typography comparison; no product code was changed in this research.

## 3. What branding should accomplish

A useful distinction is:

| Layer | Question it answers | SorteCerta decision |
| --- | --- | --- |
| Positioning | Why would someone choose this? | Audience, situation, alternative, benefit, evidence |
| Identity | How do they recognize it? | Name, logo, colors, typography, imagery, repeated language |
| Voice | What kind of relationship does it create? | Clarity, warmth, confidence, degree of playfulness |
| Experience | Does it keep its promise? | Deposit comprehension, eligibility, prize checking, withdrawals, support |
| Governance | How does it stay coherent? | Shared standards, reusable assets, ownership, review |

Keller's foundational customer-based brand equity model centers on how knowledge of a brand changes consumer response, with awareness and associations as key components. It is a conceptual framework, not evidence that a particular visual style produces financial returns. The implication here is to build a coherent expectation people can remember and verify through use. [Keller, 1993](https://doi.org/10.1177/002224299305700101).

Distinctiveness and differentiation solve different problems. Distinctiveness helps someone recognize SorteCerta. Differentiation gives them a reason to choose it. A beautiful forest-green page may accomplish neither if people confuse it with another financial app and cannot explain its benefit.

## 4. What the research supports—and its limits

| Evidence | Finding | Application to SorteCerta | Limitation |
| --- | --- | --- | --- |
| Ehrenberg-Bass distinctive-asset framework | Assess whether an asset brings the brand to mind and whether it also brings competitors to mind: fame and uniqueness | Choose a few cues, use them repeatedly with the name, then measure recognition | A new palette is a potential asset, not established brand equity |
| Labrecque & Milne, 2012, four studies | Hue, saturation, and value can affect perceived brand personality and related responses | Evaluate a whole palette in context, including saturation and contrast | Does not identify a universally best fintech color or predict our conversion |
| Elliot, 2015 review | Color effects need careful interpretation; the literature has methodological and contextual limits | Reject deterministic charts such as “green = trust” | Review is a methodological caution, not a current palette recommendation |
| Jonauskaite et al., 2020 | 4,598 participants across 30 nations showed both shared and locally varying color-emotion associations | Test actual layouts and language with the intended markets | Participants associated emotion concepts with color terms; this is not a financial-app choice experiment |
| Nielsen Norman Group tone study | Wording changes altered perceived friendliness, trustworthiness, and willingness to recommend; friendliness did not automatically improve trust | Test reassuring clarity separately from likability | Stated impressions of fictional organizations are not actual deposits or long-term trust |
| Nielsen Norman Group web-writing study | Concise, scannable, objective writing improved measured usability in its study | Put the offer, eligibility, and action in plain language | Historical study; its percentage improvements are not forecast uplift for SorteCerta |
| Filiz-Ozbay et al., 2013 | A laboratory prize-linked payment option increased payment deferral relative to equal-expected-value conventional interest | Prize motivation is a credible hypothesis to test | Laboratory payment deferral is not lasting savings behavior in our target markets |
| Gertler et al., 2023 | A randomized experiment across 110 Mexican bank branches found increased account openings and deposits during a lottery incentive | There is field evidence for the behavioral mechanism | A bank campaign in Mexico does not establish demand for a USDC product, our brand, or our jurisdictions |

Sources: [Ehrenberg-Bass measurement](https://marketingscience.info/learn-with-us/commercial-research/distinctive-asset), [fame and uniqueness](https://marketingscience.info/news-and-insights/how-brands-can-harness-creative-data-to-build-distinctive-assets), [Labrecque & Milne](https://doi.org/10.1007/s11747-010-0245-y), [Elliot review](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2015.00368/full), [cross-country study](https://www.psychologicalscience.org/journals/psychological-science/0956797620948810/), [tone research](https://www.nngroup.com/articles/tone-voice-users/), [web-writing research](https://www.nngroup.com/articles/concise-scannable-and-objective-how-to-write-for-the-web/), [laboratory prize-savings study](https://www.nber.org/papers/w19130), [field experiment](https://www.nber.org/papers/w31529).

For the academic papers, conclusions above are limited to accessible abstracts or summaries except where full text was available; no independent reanalysis or systematic literature review was performed. NBER abstracts were accessible through search, while direct page opens returned access errors. Neither study is presented as new research conducted for SorteCerta.

The strongest inference is procedural: develop a coherent candidate, test comprehension and recognition, and revise from evidence. Research cannot select the exact hex values on the founder's behalf.

## 5. What strong brands actually do

“Strongest” has several meanings: financial brand valuation, recognition, customer preference, or category authority. Kantar's 2026 valuation puts Google, Apple, Microsoft, and Amazon at the top, using financial analysis and consumer brand-equity measures. This is useful context, not a causal ranking of design quality. Large brands also have distribution, budgets, and product familiarity that a new company cannot reproduce with a visual treatment. [Kantar methodology and ranking](https://www.kantar.com/Campaigns/BrandZ/Global).

The cases below are selected for lessons relevant to this decision. Some are globally valuable brands; others are financial or category references. They are not all claimed to be top-ranked brands.

| Brand | Observable practice | What we should learn | What should not be inferred |
| --- | --- | --- | --- |
| Apple | Current product pages organize short benefit statements around the product, with explanation and evidence beneath | Establish a clear information hierarchy and demonstrate what the product does | Extreme brevity works equally well for an unfamiliar financial mechanism |
| Coca-Cola | Its July 2026 refresh reinforces red/white, script, ribbon, and a unified system across physical and digital contexts | Evolve recognizable assets together, across surfaces | Red itself caused the brand's success |
| Wise | Its 2023 redesign coordinated green, typography, imagery, symbols, and voice around a global-money proposition | Tie the visual system to the service promise; a rebrand is broader than recoloring one page | Green automatically communicates trust or is available to us as an ownable cue |
| Nubank | Its June 2026 refresh retains purple and the core symbol, creates hierarchy for different contexts, and distinguishes display and text typography | Marketing and product can vary while retaining a recognizable center | SorteCerta needs multiple subbrands or a custom font now |
| Monzo | Published writing principles make clarity and kindness universal; delight and humor depend on context | Write operational and marketing examples, not just adjectives describing a voice | A friendly joke is appropriate during a failed withdrawal |
| NS&I Premium Bonds | Product copy explicitly distinguishes prize chances from regular income and guaranteed returns | Explain what a prize product does and does not deliver next to the offer | SorteCerta inherits NS&I's institutional assurances or product protections |
| PiggyVest | Its navigation names recognizable savings jobs: automated, fixed, goal-oriented, flexible, dollar savings | If Nigeria is selected, study language already used for local savings decisions | Those users want our mechanism, or its product promises apply to us |

Primary references: [Apple product page](https://www.apple.com/iphone/), [Coca-Cola visual identity](https://www.coca-colacompany.com/media-center/coca-cola-sharpens-its-identity-under-one-bold-visual-system), [Wise redesign](https://wise.com/gb/blog/a-brand-for-everywhere-wise-unveils-bold-new-look), [Nubank refresh](https://blog.nubank.com.br/brand-refresh-como-renovamos-a-identidade-visual-do-nubank/), [Monzo writing principles](https://monzo.com/tone-of-voice), [NS&I product explanation](https://www.nsandi.com/products/premium-bonds), [PiggyVest product navigation](https://www.piggyvest.com/).

These are brands' own descriptions and visible communication, not independent proof that their redesigns improved commercial performance. The transferable pattern is coordination: the promise, name, visual assets, language, and product behavior reinforce one another.

## 6. Positioning choices for SorteCerta

The founder has now selected existing USDC holders in Nigeria and Kenya. The [GTM](GTM.md) and [regional research](GTM_AFRICA_ASIA_RESEARCH_2026-09-25.md) provide supporting context, but neither country is treated as representative of the other. Their relative launch priority remains undecided in this brand brief.

Three viable strategic emphases should be compared:

| Direction | Main reason to care | Strength | Tradeoff |
| --- | --- | --- | --- |
| Saving first | Make putting money aside feel worthwhile, with a chance of a prize | Clear connection to the useful behavior; can support approachable, composed design | Can become generic or hide the prize mechanism |
| Prize first | Enjoy the anticipation of a draw while holding savings | Makes the unusual benefit immediately visible | Can resemble gambling or imply that excitement is more important than financial understanding |
| Control first | Understand and manage savings, participation, and withdrawal | Addresses practical objections for existing USDC holders | “Control” becomes empty language unless the actual experience proves it |

**Updated recommendation: lead with prize excitement, make saving the clear mechanism, and establish trust through precise product behavior.** This replaces the initial saving-first recommendation after the founder selected prize excitement. The research remains relevant; the strategic emphasis now reflects the founder's decision. Anticipation can lead acquisition and draw experiences, while financial instructions remain factual.

A positioning statement to test with the selected audience:

> For USDC holders in Nigeria and Kenya, SorteCerta makes saving something to look forward to: eligible savings bring a chance to win a prize at the end of each draw.

This explains the category. It is not yet a unique competitive claim: [PoolTogether already describes saving and winning](https://pooltogether.com/). We need to test which product advantage actually matters to our audience.

The internal GTM treats confidentiality as a differentiator, while project rules prohibit privacy/implementation vocabulary in product copy. That is an unresolved messaging constraint. We should not silently remove the rule, or replace it with an absolute such as “only you can see everything.” Validate the precise consumer benefit and permitted wording before making it a positioning pillar. A technical advantage can exist without being the lead headline.

The invitation system is an access mechanism. It should become a prestige or exclusivity story only if that is an intentional founder decision and resonates with the intended audience. Otherwise, “invitation only” belongs in the access instructions, not at the center of the brand.

Useful situations to investigate include receiving income in USDC, deciding what to do with an idle balance, checking a completed draw, and needing to take money out. These are interview hypotheses, not established customer behavior.

## 7. Color and visual direction

Do not choose between “green is trustworthy” and “pastels are friendly.” Choose a system based on recognition, category fit, distinctiveness, readability, operational usefulness, and founder intent.

| Candidate | What stays recognizable | How it could span both surfaces | Main risk |
| --- | --- | --- | --- |
| A. Evolve the existing app | Charcoal, muted rose/slate/peach, serif identity | Marketing uses the same restrained atmosphere; transactional screens use solid, legible cards | Soft fintech gradients are common; too many accents weaken recognition |
| B. Adopt PR #15 across the product | Forest, ivory, sage, limited yellow, serif identity | Landing is spacious and expressive; app uses denser layouts and the same typography/actions | Resemblance to established green financial brands; discards existing app cues |
| C. Build a common system from existing assets | One chosen dark anchor, one light base, one highlight, one recurring motif | Both surfaces share the same core; atmosphere is reserved for selected moments | Can become an indecisive mixture unless most competing elements are removed |

If the app's identity has meaningful recognition or is something the founder wants to preserve, A is the sensible starting point. If the founder intends a full rebrand and research supports the calmer direction, B is coherent—but it requires the app to follow. C only works with disciplined subtraction; placing every existing color into one palette would preserve the inconsistency.

These three routes document the original continuity options. After the founder opened every asset to change and selected prize excitement, continuity is no longer the leading design constraint. Explore more expressive alternatives described in section 13. There is still no audience evidence selecting a winning palette.

### Specify roles, not just swatches

The chosen system should define a stable identity color, canvas and surface colors, primary and secondary text, actions, focus, borders, and status colors. Decorative color should have a separate role from success, error, and pending states.

One practical starting rule is a mostly neutral task interface with a consistently used action color, plus a limited celebratory accent for confirmed results. This is a proposed design convention, not a scientific percentage formula.

An action must still look actionable without relying on hue. An error needs text and a recognizable indicator. A pending prize check must not resemble a confirmed win.

### Contrast checks on the existing values

Calculated using the WCAG relative-luminance formula for opaque sRGB foreground/background pairs:

| Pair | Ratio | Interpretation |
| --- | --- | --- |
| App ink `#2B2D32` on flat base `#E8E3E1` | 10.83:1 | Strong text contrast |
| App muted `#67666D` on flat base `#E8E3E1` | 4.46:1 | Below the 4.5:1 normal-text threshold on this particular pair |
| White on app charcoal `#34363C` | 12.08:1 | Strong text contrast |
| PR forest `#123F32` on ivory `#F7F5EE` | 10.80:1 | Strong text contrast |
| PR muted `#667169` on ivory | 4.66:1 | Passes normal-text threshold, with limited margin |
| PR forest on yellow `#FFE995` | 9.73:1 | Strong text contrast |
| PR yellow on ivory | 1.11:1 | Decorative use; unsuitable as text or a sole essential indicator |
| PR line `#C8CFC5` on paper `#FFFDF7` | 1.57:1 | Fine for some decoration; insufficient where an essential control boundary requires 3:1 |

This is **not a complete accessibility audit**. The app uses transparency and gradients, so actual contrast depends on the composited background. A token pair alone cannot establish whether every rendered component passes or fails. WCAG specifies 4.5:1 for ordinary text and 3:1 for qualifying large text, with defined exceptions; meaningful non-text controls have their own criteria. [Text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).

### Typography, imagery, and motion

A shared display face could connect the brand's existing serif expressions. For instructions, forms, balances, and status messages, test a readable text face and tabular numerals. Reserve monospacing for content that benefits from it, rather than assuming it is necessary for the entire financial interface. This is a usability hypothesis to validate on real devices.

Choose one logo/icon relationship. The app image icon, landing wordmark, and orbital decoration currently do not form a documented family. An orbit or spark could become a repeated asset, but neither is distinctive merely because we name it one.

Use imagery that helps people understand saving or the product. Avoid implying wealth, a guaranteed prize, or a verified customer endorsement through invented stories. If a market is selected, test local interpretation without reducing it to national flags or stereotypes.

Motion should explain a transition or acknowledge a confirmed event. Do not use spinning-reel suspense, near-win messages, or a celebration before prize status is known. Support reduced motion.

## 8. Voice and wording proposal

Updated voice: **clear, warm, lively, and hopeful**. Composure remains essential during financial operations; anticipation leads campaigns and draw-related content. This is intentionally more specific in use than a generic instruction to “sound trustworthy.”

| Principle | Operational rule |
| --- | --- |
| Clear | State what happens, what the user needs to do, and what comes next |
| Warm | Speak directly to the person, without judgment about how much they save |
| Lively | Use energetic, direct headlines and moments of anticipation; shift to factual status language during money movement |
| Hopeful | Describe the possibility of a prize without implying entitlement or certainty |

Use more personality in a headline and less during an error. Monzo's published distinction between universal clarity and context-dependent humor is a useful model; our proposed wording remains our own. [Monzo principles](https://monzo.com/tone-of-voice).

### Candidate copy, for testing

**Primary explanation**

> Your savings. Your chance to win.

> Save in USDC. Your savings balance at the end of each draw determines your chances. After the draw, check whether you have a prize to claim.

The second line describes the intended mechanism and must remain aligned with the verified implementation. It is clearer than “upside,” but it does not claim the category is unique to SorteCerta.

**Useful headings and labels**

- Savings balance
- Add to savings
- Request withdrawal
- Next draw
- Check for a prize
- Claim prize — shown only when a claim is available

**Status examples, conditional on the actual state**

| Situation | Candidate wording | Required truth |
| --- | --- | --- |
| Withdrawal request recorded | “Withdrawal requested. Follow its progress here.” | The request is confirmed, not merely submitted |
| User must complete a transfer step | “Your withdrawal is ready. Complete the transfer.” | The next action is available and accurately named |
| Prize has not been checked | “The draw has ended. Check whether you have a prize to claim.” | Draw completion is verified |
| Prize entitlement confirmed | “You have a prize to claim.” | A positive claimable amount has been verified |
| No claimable amount after checking | “No prize to claim right now.” | The check completed successfully; an error is not treated as zero |
| Request failed | “We couldn’t complete your request. Please try again.” | The action really failed; uncertain outcomes need a status check first |

### Copy requiring replacement or proof

| Existing or tempting wording | Problem | Better rule |
| --- | --- | --- |
| “Your principal always returns” | Unconditional assurance | Describe the actual mechanism and withdrawal conditions; do not promise risk-free outcomes |
| “Win without losing” | Can be understood as a guarantee | Lead with saving and a chance to win |
| “Withdraw anytime” | Conflates requesting with receiving | Distinguish request, processing, and completion; publish verified expectations |
| “No hidden fees” | Vague without a complete fee picture | Show applicable costs clearly before confirmation |
| “Each USDC is one ticket” | May misrepresent a weighted balance as a discrete ticket | Explain that eligible balance determines chances |
| “Guaranteed rewards” | Incorrect for a chance-based allocation | Describe eligibility and check/claim states |
| “Yield powered by Morpho” | Needs to match the product and deployment being described | Maintain evidence for claims about providers and prize funding |
| “Approved email” | Bureaucratic and potentially ambiguous | Test “Email on your invitation,” if that accurately describes the requirement |
| “Stay in” | Vague, potentially sounds like pressure to keep money deposited | Explain eligibility at the end of the draw directly |
| “A little more upside” | Pleasant but abstract | Use as secondary tone only after the mechanism is clear |

Treat “weekly,” partner labels, fee statements, and settlement timing as product facts with owners and evidence. Treat headlines as expressions of those facts, not exceptions to them.

Keep the repository's prohibited implementation/privacy terms out of customer-facing examples. Necessary product explanations should use accessible language; simplicity must not conceal material conditions.

## 9. Naming and international fit

SorteCerta can suggest luck and certainty to a Portuguese speaker. That is a linguistic interpretation to test, particularly because a prize is not certain. It is not a recommendation to rename the company.

For the selected Nigerian and Kenyan audiences, test unaided pronunciation, spelling after hearing the name, recall, and inferred product category. Do people think it is a savings service, a lottery, or something else? Does “Certa” imply assured winnings? Ask without teaching participants the intended interpretation first. English is the working language of these concept examples; preferred customer languages still need validation.

An unfamiliar name can work when paired consistently with a clear descriptor. Initially, “USDC savings with a chance to win” does more explanatory work than an abstract slogan. Evaluate whether USDC belongs in the main descriptor only after the audience decision.

Do not change the brand name, translate its meaning, or create local subbrands without evidence that the current name is a material obstacle. Trademark/domain clearance was not performed in this research.

## 10. How to choose without guessing

The next research should answer separate questions rather than hold a general “which design do you like?” poll.

1. **Founder brief.** Confirmed: existing USDC holders in Nigeria/Kenya, prize excitement, every asset open. Still establish preferred customer languages and whether invitation access is temporary operating policy; do not assume prestige positioning.
2. **Message comprehension.** Show equally plain explanations with different emphasis. Ask participants to explain what happens to their savings, how eligibility works, whether a prize is guaranteed, and how withdrawals work.
3. **Visual comparison.** Use identical copy and layout while comparing palette and typography. Otherwise, a preference cannot be attributed to color. Compare three matched surfaces: landing hero, savings screen, withdrawal state.
4. **Recognition test.** Show a candidate briefly with the name, introduce a distraction, then ask participants to match another surface to it. Later measure unaided brand association once there has been real exposure; a new brand should not be expected to have fame already.
5. **Trust calibration.** Ask what they believe is guaranteed, who is responsible, and what they expect after a withdrawal request. The goal is accurate confidence, not maximal reassurance.
6. **Practical usability.** Test small screens, outdoor readability where relevant, zoom, long amounts, form errors, and reduced motion. Confirm licensed fonts and language coverage.

For an initial qualitative round, 6–8 people in each deliberately chosen segment/market would be a practical proposed budget, not a statistically representative sample or a guarantee of issue discovery. Avoid pooling audiences with different needs into one vote. Report raw counts and recurring explanations, not percentages that imply precision.

Use results to identify recurring misunderstandings, then revise and retest. If a quantitative choice is needed, size a randomized study against a declared baseline and minimum detectable effect. Do not announce a winning conversion variant after a handful of invitation submissions.

| Measure | What it tells us | What it does not establish |
| --- | --- | --- |
| Correct explanation of saving/prizes | Message comprehension | Demand or retention |
| Correct withdrawal expectations | Promise/experience alignment | Operational reliability |
| Cross-surface matching | Visual coherence | Established brand equity |
| Recall and competitor confusion | Emerging recognition and uniqueness | Long-term preference |
| Qualified invitation completion | Acquisition behavior | Correct understanding or willingness to deposit |
| Successful task completion | Product usability | Financial safety |

Keep liking and understanding separate. If a beautiful design repeatedly creates a false belief about guaranteed money or prizes, revise it even when it wins a preference vote.

## 11. What the resulting brand standard should contain

Once the founder choices and initial tests are resolved, produce a short, usable standard with:

- One audience statement, positioning statement, and message hierarchy.
- A single approved wordmark/icon family, including small-size and monochrome use.
- Color roles and permitted combinations, with contrast checks.
- Licensed typography for display, text, numbers, and supported languages.
- Rules for shapes, surfaces, illustration, imagery, and motion.
- Voice examples for landing copy, eligibility, prize checking, withdrawal, errors, and support.
- A vocabulary and claim register, linking factual claims to current evidence.
- A clear boundary between brand assets that stay constant and layouts that may adapt.

Engineering should consume the same token values and assets in both packages. The frameworks and page layouts can remain different. A shared source for colors and typography does not require a large cross-framework component platform.

Name an owner for changes to the promise, logo, typography, and core colors. Future PRs should show the affected marketing and product screens together, so local improvements cannot silently create another identity.

## 12. Decision on PR #15

PR #15 demonstrates a coherent direction, but its quiet, editorial emphasis is less aligned with the founder's newly confirmed preference for prize excitement. It is not, by itself, an established SorteCerta brand system.

Preserve its useful work: spacing, hierarchy, responsive navigation, and clearer content structure. Align typography, colors, decoration, and wording with the chosen playful direction, using matched marketing and product screens to check consistency.

Direction 02 now provides the shared reference for both surfaces. Neither PR #15's forest/ivory identity nor the existing app palette should continue as an independent brand expression.

The founder has resolved audience, emotional emphasis, and creative direction. The next work is to formalize and apply that direction across marketing and product. The exact palette variant and a replacement name were not separately selected. Product files remain unchanged.

## 13. Revised creative brief: prize excitement for Nigeria and Kenya

### Local precedents and what they establish

Access Bank's DiamondXtra terms link a qualifying savings balance to participation in prize draws. This is a Nigerian precedent for connecting saving with prize eligibility. It does not establish awareness or preference among our intended USDC users. [DiamondXtra terms](https://www.accessbankplc.com/access/media/documents/TERMS-AND-CONDITIONS-OF-ACCEPTANCE.pdf).

Safaricom's official history describes its June 2024 Shine Kenya campaign around cash prizes and community projects. Its partner newsletter records the promotion ending in September. It is a historical communication reference, not a current offer or a savings-product equivalent. [Safaricom history](https://www.safaricom.co.ke/personal/m-pesa/m-pesa-journey), [campaign timeline](https://www.safaricom.co.ke/PartnerNewsletter/highlights/product-and-service-highlights-of-the-year).

Kuda's current site uses short action vocabulary around sending, spending, saving, and rewards. This is a useful language reference, not evidence that our users want its precise tone or that its bank protections apply to SorteCerta. [Kuda](https://kuda.com/).

**Interpretation:** a prize-led brand can be locally relevant without explaining the idea entirely through unfamiliar technical concepts. But these examples do not establish that any national audience prefers bright colors, slang, gambling aesthetics, or a particular name. Test the two markets separately.

### Message hierarchy

1. **Emotional invitation:** the possibility of a prize makes saving worth looking forward to.
2. **Product explanation:** save in USDC; eligible balance at the end of the draw determines chances.
3. **Participation details:** explain eligibility, weighting, draw status, and prize checking.
4. **Trust through specifics:** accurate costs, withdrawal steps, timing, support, and evidence for claims.

Candidate headline: **“Your savings. Your chance to win.”** Candidate explanatory line: **“Save in USDC. Your balance at the end of each draw determines your chances.”** Candidate action after a completed draw: **“Check for a prize.”** The last action is shown only in the applicable product state; acquisition uses the actual available access action.

Avoid “quiet upside,” “exclusive wealth,” or “good saving habits” as the leading emotional message for this brief. Avoid jackpot-sized claims, invented prizes, or unsupported assurances. These are creative judgments grounded in the confirmed emphasis, not measured conversion findings.

### Initial color hypotheses (exploration history)

These are exploration palettes, not final tokens or scientifically optimized colors. Apply identical copy and layouts when comparing them.

| Direction | Core candidates | Proposed expression | Test particularly for |
| --- | --- | --- | --- |
| Cobalt and coral | Cobalt `#2548F4`, coral `#FF947F`, warm paper `#FFF9F3`, ink `#17213B` | Clear, energetic, accessible; cobalt carries identity/actions and coral carries highlights | Confusion with other blue financial brands; coral must not double as error status |
| Ink and citron | Ink `#202826`, citron `#DDF76B`, warm paper `#F7F8EE` | Bold, high-contrast anticipation with fewer competing colors | Perceived betting or promotional-site resemblance; seriousness of money movement |
| Plum and peach | Plum `#63318F`, peach `#FFC2A8`, warm paper `#FFF8F3`, ink `#2D173A` | Warm, expressive, celebratory | Category/competitor confusion around purple; differentiation must come from the full system |

**Original starting recommendation: develop cobalt and coral first**, because it supports visible excitement while leaving a strong dark/light hierarchy for task screens. This recommendation preceded the selected playful concept and is superseded by the [brand decision](BRAND_DIRECTION.md). No source proves this combination will outperform the alternatives, and no exclusive ownership of these hues is claimed.

Typography should first explore a bold, approachable sans-serif display with a highly readable text face. Compare a serif alternative using the same message before excluding it; a serif is not inherently incompatible with excitement. A stable wordmark, repeated shape, and recognizable layout pattern must carry identity alongside the colors.

Keep SorteCerta as a temporary label during palette comparison so naming and color are not changed in the same test. Naming is fully open for the next exercise. A replacement needs pronunciation, recall, inferred-promise, availability, and trademark checks before selection. No candidate name is assumed available.

### Excitement across the experience

Marketing can use bold scale, warm contrast, and direct prize language. Upcoming-draw screens can build anticipation around a verified closing time. A completed draw invites a check without implying a win. A verified positive result can celebrate. Withdrawals and errors use the same visual identity with less expressive motion and factual language.

The goal is an emotionally engaging prize experience that remains understandable when someone needs to act. Do not attach shame, streak loss, fake urgency, or near-miss framing to deposits or withdrawals.

### What remains to learn

The founder has not specified age, gender, occupation, typical savings amount, preferred language, or a nationality-specific style. Do not fill those gaps with stereotypes. Recruit actual USDC holders, learn where/how they use the asset, and evaluate comprehension, recognition, and usability of the chosen playful direction in Nigeria and Kenya as separate groups. The creative direction is decided; audience response and messaging effectiveness remain unmeasured.
