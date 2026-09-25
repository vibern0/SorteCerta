# Africa and Asia GTM research

Research date: 25 September 2026. Internal strategy, not customer-facing copy.

**Recommendation: validate Nigeria first, Kenya second, and keep the
Philippines as a conditional Asian comparison.** Target adults who already
receive or hold stablecoins and have discretionary savings. Country selection
should sharpen the existing crypto-native GTM, rather than immediately expand
it to mainstream savers.

This is a research priority, not a finding that any jurisdiction has approved
SorteCerta. No provider was contacted, commercial quote obtained, or live
transaction tested. Published coverage is evidence of a possible route, not
confirmed acceptance of our business model.

The existing [GTM](GTM.md) keeps acquisition focused on qualified interest and
guided previews. [Bounty scope](BOUNTY_SCOPE.md) and the
[mainnet gates](ROAD_TO_MAINNET.md) remain the project constraints.

## What supports the hypothesis

The strongest opportunity is a specific customer: someone who already uses
stablecoins, keeps some balance between payments, and can reliably convert back
to local money. That avoids asking a new user to learn both crypto and prize
savings in the same session. Whether they prefer prizes to predictable yield
remains unproven.

Chainalysis's index published on 23 September 2026 ranks Nigeria third,
Thailand eighth, South Africa ninth, Indonesia fourteenth, Vietnam eighteenth,
and the Philippines nineteenth. Its methodology changed this year; do not
interpret changes from the 2025 ranking as pure growth or decline. These are
activity indicators, not counts of prospective SorteCerta customers.
[Source: 2026 adoption index](https://www.chainalysis.com/blog/2026-global-crypto-adoption-index/).

The IMF's June 2026 analysis describes Nigerian stablecoin use for cross-border
payments, remittances, and access to dollar-linked assets. This supports testing
a stablecoin savings proposition, but payment volume does not establish idle
balances or willingness to use a prize pool.
[Source: IMF](https://www.imf.org/en/news/articles/2026/06/16/stablecoins-in-nigeria).

## Country assessment

| Market | Evidence and product fit | Main unresolved issue | Research priority |
| --- | --- | --- | --- |
| Nigeria | Yellow Card documents bank pay-ins and payouts; Access Bank operates a savings-linked prize scheme. Strongest combination of rails and relevant consumer precedent found. | Product classification, provider acceptance, exact USDC corridor and costs. | First |
| Kenya | Busha documents M-Pesa deposits and withdrawals. Useful comparison for a mobile-money-led journey. | USDC ramp availability and current licensing implementation. | Second |
| Philippines | Coins.ph documents Ethereum USDC deposits/withdrawals and peso cash-out to banks and e-wallets. | BSP restrictions on anonymity-enhancing assets create a specific FHE question. | Conditional Asian comparison |
| South Africa | Established crypto licensing and documented EFT ramps. | Adverse prize-savings court precedent. | Defer |
| Ghana | New virtual-asset framework. | Express restrictions on unauthorised mass promotion; incomplete ramp evidence. | Defer |
| Vietnam | Substantial crypto activity and an enacted market pilot. | Local licensing and VND-based pilot rules need specialist review. | Later partner-led research |
| Indonesia | OJK-regulated crypto trading ecosystem. | Exchange trading permission does not establish permission for a prize-savings service. | Later partner-led research |
| Thailand | Government Savings Bank offers prize-linked savings certificates. | SEC restrictions on operators providing/supporting crypto deposit-taking and lending. | Defer pending product classification |

Priorities are qualitative judgments, not measured conversion or acquisition-cost
scores. Evidence for each is detailed below.

### Nigeria

Yellow Card's current channel table lists Nigerian bank transfers for both
collections and payouts, with instant settlement indicated. Its widget asset
documentation lists ERC-20 USDC. Its integration guide describes local-money
purchase to a customer wallet and crypto sale to local-money payout. These
pages establish candidate components, but do not prove that every combination
is enabled for a particular merchant.
[Channels](https://docs.yellowcard.engineering/docs/channels-api),
[assets](https://docs.yellowcard.engineering/v1.0.26/docs/supported-crypto-widget),
[buy/sell flow](https://docs.yellowcard.engineering/docs/buy-sell-digital-assets).

Busha also documents Nigerian bank deposits and withdrawals. However, its
currency table distinguishes asset transfers from ramp support: USDC deposits
and withdrawals are marked supported, while USDC ramp buy/sell are marked
unsupported; USDT ramp buy/sell are supported. Do not describe this as a verified
one-step NGN–USDC integration. Some network entries warrant reconfirmation.
[Channels](https://docs.busha.co/guide/reference/supported-countries-and-payment-channels),
[currency matrix](https://docs.busha.co/guide/reference/supported-currencies).

Access Bank's DiamondXtra terms describe a reward scheme for customers
maintaining a qualifying savings balance, including draws witnessed by relevant
regulators. This is evidence of an existing product format and a local
competitor for attention and trust. It does not establish demand for our product
or extend a bank's permissions to a DeFi app.
[DiamondXtra terms](https://www.accessbankplc.com/access/media/documents/TERMS-AND-CONDITIONS-OF-ACCEPTANCE.pdf).

Nigeria's SEC lists Busha and Quidax as ARIP participants. Treat that as the
specific status shown, not unlimited authorisation. A May 2026 SEC notice says
registration is required to promote investment services or solicit funds in the
Nigerian capital market. Counsel must determine SorteCerta's treatment, including
the applicable federal/state prize and promotion rules, before commercial GTM.
[SEC register](https://sec.gov.ng/fintech-and-innovation-hub-finport/registered-fintech-operators/),
[SEC notice](https://sec.gov.ng/for-investors/keep-track-of-circulars/public-notice-unregistered-online-investment-schemes/).

**Initial segment hypothesis:** freelancers, remote workers, and existing
stablecoin savers with money they can leave between draws. Test the desired
balance and holding period; do not assume remittance recipients can spare funds
needed for household spending.

### Kenya

Busha documents M-Pesa funding and withdrawal, and marks KES ramp buy/sell as
supported. Its USDC limitation above still applies. Kotani Pay advertises USDC
and USDT on/off ramps and is another candidate for diligence, without proving
the exact Kenyan corridor or approval for SorteCerta.
[Busha channels](https://docs.busha.co/guide/reference/supported-countries-and-payment-channels),
[Kotani Pay](https://www.kotanipay.com/on-off-ramp).

Coverage varies by provider and product. Yellow Card's current API channel table
lists Kenyan bank payouts with a 24–48-hour settlement indication and no Kenyan
pay-in row. Its older widget table lists mobile-money sell support with buy
marked coming soon. These are different product/version claims; neither should
be advertised as confirmed two-way instant M-Pesa support for our integration.
[Current channels](https://docs.yellowcard.engineering/docs/channels-api),
[older widget coverage](https://docs.yellowcard.engineering/v1.0.24/docs/coverage-widget).

Kenya published draft implementing regulations for its VASP framework in March
2026. This research did not establish the final licensing status of our proposed
service or partners under that framework. A draft is not a granted licence.
[CBK consultation](https://www.centralbank.go.ke/2026/03/18/public-notice-invitation-for-comments-from-the-public-on-the-draft-virtual-asset-service-providers-regulations-2026/).

### Philippines

Coins.ph lists Ethereum USDC deposits and withdrawals. Its documented cash-out
options include InstaPay transfers to banks and GCash. Its fee page lists a
PHP10 InstaPay cash-out charge and free individual PESONet cash-out. These are
only the local payout leg: conversion spread, trading, crypto withdrawal and
network costs remain additional and require fresh quotes.
[USDC networks](https://support.coins.ph/hc/en-us/articles/6133146885529-What-are-the-supported-networks-per-token-in-Coins-ph),
[cash-out options](https://support.coins.ph/hc/en-us/articles/202398194-Coins-ph-Cash-Out-Options),
[fees](https://support.coins.ph/hc/en-us/articles/34288784427929-Coins-ph-Features-and-Services).

Two regulatory findings materially lower its priority. BSP continued its new
VASP licence moratorium from September 2025. In June 2026, BSP's coin/token
listing guidance prohibited VASPs from listing/supporting anonymity-enhancing
virtual assets. Whether SorteCerta's FHE wrapper or associated flows fall within
that restriction is unresolved. Supporting ordinary USDC does not answer that
question, and unwrapping before cash-out is not automatically a legal solution.
[Moratorium](https://www.bsp.gov.ph/Regulations/Issuances/2025/M-2025-031.pdf),
[2026 listing guidance](https://www.bsp.gov.ph/Regulations/Issuances/2026/M-2026-023.pdf).

Coins.ph also restricts unlicensed financial services and illegal/unlicensed
gambling. Provider terms and the SEC CASP framework require product-specific
review; a working retail account is not commercial integration approval.
[Coins legal terms](https://www.coins.ph/en-ph/legal),
[SEC CASP rules](https://www.sec.gov.ph/mc-2025/sec-mc-no-04-series-of-2025the-sec-rules-on-crypto-asset-service-providers-sec-casp-rules/).

### Why the other markets are lower priority

**South Africa:** the Supreme Court of Appeal dismissed FirstRand's appeal over
its Million-a-Month account in 2008. Returning the deposit did not prevent the
scheme from being treated as a prohibited lottery. That historical decision is
a material warning, not a legal ruling about our different implementation or
current permissions. Review the present law before pursuing this market.
[Judgment](https://www3.saflii.org/za/cases/ZASCA/2008/29.html).

**Ghana:** the Bank of Ghana describes a framework under the 2025 VASP Act.
A joint notice dated 20 February 2026 directs VASPs, including sandbox operators,
to refrain from mass marketing or promotional campaigns without express
authorisation. A generic waitlist advertising campaign should not be assumed
exempt. Busha's matrix marks GHS ramp buy/sell unsupported.
[Framework](https://www.bog.gov.gh/virtual-assets/),
[dated advertising notice](https://www.bog.gov.gh/wp-content/uploads/2026/02/PRESS-RELEASE-PUBLIC-NOTICE-ON-UNAUTHORISED-ADVERTISING-OF-VIRTUAL-ASSET-AND-STABLECOIN-PRODUCTS-200226.pdf).

**Vietnam:** Resolution 05/2025 establishes a regulated crypto-market pilot with
VND requirements and licensed-provider provisions. High adoption is insufficient
evidence that a foreign USDC prize pool has an easy compliant route.
[Government resolution](https://xaydungchinhsach.chinhphu.vn/toan-van-nghi-quyet-so-5-2025-nq-cp-ve-trien-khai-thi-diem-thi-truong-tai-san-ma-hoa-tai-viet-nam-119250909184045221.htm).

**Indonesia:** OJK's December 2025 rules strengthen the regulated trading
framework and asset-list requirements. No researched source establishes a
clear permission pathway for SorteCerta's combination of savings, yield, and
random prizes. This is an evidence gap, not a finding that crypto trading is
prohibited.
[OJK rules update](https://www.ojk.go.id/id/berita-dan-kegiatan/siaran-pers/Pages/POJK-23-Tahun-2025-Perubahan-POJK-27-Tahun-2024-Penyelenggaraan-Perdagangan-Aset-Keuangan-Digital-Termasuk-Aset-Kripto.aspx).

**Thailand:** Government Savings Bank publishes prize-savings certificate
products, providing a behavioral reference. Separately, the SEC's annual report
describes rules prohibiting digital-asset operators from providing/supporting
deposit-taking and lending. Bank prize products do not establish equivalent
permissions for crypto services.
[GSB prize products](https://www.gsb.or.th/personal/resultsalak/?cpage=2&type=salak-2year),
[SEC annual report, page 83](https://www.sec.or.th/EN/Documents/AnnualReport/pb_ar_2023.pdf).

India also deserves caution in a later screen: its tax authority documents a
30% tax on VDA transfer income and a 1% withholding regime with conditions and
thresholds. Withholding is not an additional final 1% tax. Product-specific tax
analysis would be needed; market size alone does not remove transaction friction.
[VDA tax FAQ](https://www.incometax.gov.in/iec/foportal/help/FileITR-2Online-FAQ?mobile-app=1),
[withholding guidance](https://incometaxindia.gov.in/tutorials/72.tds-on-payment-for-the-transfer-of-virtual-digital-assets.pdf).

## Economics and positioning

An easy ramp must cover the full loop: local money → usable USDC → pool →
withdrawal/unwrap → USDC → local money. Measure KYC completion, minimums, fees,
spreads, gas, failed transfers, support interventions, and time until money is
spendable. The project plans asynchronous withdrawals; instant fiat payout
cannot make the pool's withdrawal queue instant.

Illustrative assumptions, not forecasts: a $100 balance at 5% annual gross yield
contributes $5 per year, approximately $0.42 per month. A $2 round-trip cost
consumes roughly 4.8 months of that contribution. Individual prize receipts are
random, not a guaranteed monthly return. A $10,000 pool at the same yield
generates only about $9.62 per week before costs and fees. Small pilots may
require explicit sponsor budgets, and subsidies must be measured separately
from sustainable demand.

The critical competitive question is whether savers prefer a chance at a prize
to predictable interest or simply retaining liquid stablecoins. Dollar exposure
also does not preserve a fixed local-currency value. A principal-return mechanic
does not eliminate FX, stablecoin, contract, or yield-source risk. Avoid absolute
safety claims.

For interviews, compare the existing simple positioning with a prize-focused
version while respecting product copy rules. Explain eligibility at the end of
each draw. Test whether the name SorteCerta is understood and trusted locally
before deciding to rebrand.

## Proposed validation, before a commercial launch decision

1. Recruit a directional research sample: 15 Nigerian and 10 Kenyan adult
   stablecoin users; add 5 Philippine interviews if practical. Use existing
   relationships and permissioned freelancer/developer communities. Keep the
   current Zama cohort as a comparison. No paid campaign is needed to learn
   whether this segment exists.
2. Record the token and chain they actually use, current cash-out method,
   discretionary balance, holding period, preference for prizes versus regular
   yield, and evidence needed to trust withdrawals. Separate stablecoin owners
   from people who would first need to purchase it.
3. Prepare provider diligence for Yellow Card and Busha in Nigeria, Busha and
   Kotani in Kenya, and Coins.ph for the Philippine questions. Obtain written
   acceptance of the exact prize/FHE model, customer locations, and contracting
   entity; check licensed scope, USDC network, both ramp directions, smart-account
   transfers, source-of-funds handling, KYC and commercial minimums.
4. Obtain comparable quotes for $25, $100 and $500 equivalents. Count all legs
   and separate provider documentation from observed settlement. Later live
   payment tests require the project's real-funds gates; previews stay on the
   existing Sepolia environment.
5. Run guided previews and invite users to return for a second draw. Suggested
   directional gate: at least 10 completions and 5 voluntary returners, with
   users able to explain withdrawal timing and that a prize is not guaranteed.
   These small samples guide the next test; they do not establish market fit.
6. Choose a country only when three kinds of evidence agree: repeat user
   interest, an accepted and affordable full payment route, and jurisdiction-
   specific approval of the operating/marketing model. Otherwise retain the
   existing global crypto-native acquisition strategy.

The near-term GTM adjustment is to make geography and existing stablecoin habits
explicit recruitment criteria. The research does not justify building several
ramp integrations, switching networks, or broadly soliciting deposits yet.
