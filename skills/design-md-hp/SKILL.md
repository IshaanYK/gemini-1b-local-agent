---
name: design-md-hp
description: Design system and styling guidelines based on hp. Use this skill when asked to create a design inspired by hp.
---
---
version: alpha
name: HP-design-analysis
description: An inspired interpretation of HP's design language â€” a white-paper enterprise-consumer system anchored by HP Electric Blue (`#024ad8`) as the lone signal CTA, near-black ink (`#1a1a1a`) for headlines, geometric Forma-DJR sans throughout, and angular blue-chevron decorations that nod to the HP wordmark's slashes. Cards round at 8â€“16px, photos sit in soft 16px frames, and dark navy slabs anchor the customer-story and "how can we help" closing bands.

colors:
  primary: "#024ad8"
  primary-bright: "#296ef9"
  primary-deep: "#0e3191"
  primary-soft: "#c9e0fc"
  on-primary: "#ffffff"
  ink: "#1a1a1a"
  ink-deep: "#000000"
  ink-soft: "#292929"
  on-ink: "#ffffff"
  canvas: "#ffffff"
  paper: "#ffffff"
  cloud: "#f7f7f7"
  fog: "#e8e8e8"
  steel: "#c2c2c2"
  graphite: "#636363"
  charcoal: "#3d3d3d"
  hairline: "#e8e8e8"
  hairline-strong: "#c2c2c2"
  link: "#024ad8"
  link-pressed: "#0e3191"
  bloom-coral: "#ff5050"
  bloom-rose: "#f9d4d2"
  bloom-deep: "#b3262b"
  bloom-wine: "#5a1313"
  storm-mist: "#8ebdce"
  storm-sea: "#7fadbe"
  storm-deep: "#356373"
  error: "#b3262b"

typography:
  display-xxl:
    fontFamily: Forma DJR Micro
    fontSize: 72px
    fontWeight: 500
    lineHeight: 1.0
    letterSpacing: 0
  display-xl:
    fontFamily: Forma DJR Micro
    fontSize: 56px
    fontWeight: 500
    lineHeight: 1.0
    letterSpacing: 0
  display-lg:
    fontFamily: Forma DJR Micro
    fontSize: 44px
    fontWeight: 500
    lineHeight: 1.0
    letterSpacing: 0
  display-md:
    fontFamily: Forma DJR Micro
    fontSize: 32px
    fontWeight: 500
    lineHeight: 1.0
    letterSpacing: 0
  display-sm:
    fontFamily: Forma DJR Micro
    fontSize: 24px
    fontWeight: 500
    lineHeight: 1.17
    letterSpacing: 0
  display-xs:
    fontFamily: Forma DJR Micro
    fontSize: 20px
    fontWeight: 500
    lineHeight: 1.0
    letterSpacing: 0
  body-lg:
    fontFamily: Forma DJR Micro
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: 0
  body-md:
    fontFamily: Forma DJR Micro
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.38
    letterSpacing: 0
  body-emphasis:
    fontFamily: Forma DJR Micro
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.38
    letterSpacing: 0
  caption-md:
    fontFamily: Forma DJR Micro
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  caption-sm:
    fontFamily: Forma DJR Micro
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: 0
  caption-bold:
    fontFamily: Forma DJR Micro
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 0
  link-md:
    fontFamily: Forma DJR Micro
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.38
    letterSpacing: 0
  button-md:
    fontFamily: Forma DJR Micro
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.7px
    textTransform: uppercase
  button-sm:
    fontFamily: Forma DJR Micro
    fontSize: 12.6px
    fontWeight: 700
    lineHeight: 1.0
    letterSpacing: 0.126px
  price-md:
    fontFamily: Forma DJR Micro
    fontSize: 24px
    fontWeight: 500
    lineHeight: 1.17
    letterSpacing: 0

rounded:
  none: 0px
  xs: 2px
  sm: 3px
  md: 4px
  lg: 8px
  xl: 16px
  pill: 9999px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 32px
  section: 80px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: 12px 24px
    height: 44px
  button-primary-pressed:
    backgroundColor: "{colors.primary-deep}"
    textColor: "{colors.on-primary}"
  button-primary-disabled:
    backgroundColor: "{colors.steel}"
    textColor: "{colors.on-primary}"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: 12px 24px
    height: 44px
  button-outline:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: 12px 24px
    height: 44px
  button-outline-ink:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: 12px 24px
    height: 44px
  button-text-link:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.primary}"
    typography: "{typography.link-md}"
    padding: 4px 0
  badge-pill-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 6px 12px
  badge-pill-outline:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 6px 12px
  badge-sale-coral:
    backgroundColor: "{colors.bloom-coral}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption-bold}"
    rounded: "{rounded.sm}"
    padding: 4px 8px
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 12px 16px
    height: 44px
  text-input-focused:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
  text-input-search:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 12px 16px
    height: 40px
  card-product:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 24px
  card-product-feature:
    backgroundColor: "{colors.cloud}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 32px
  card-pricing-tier:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 24px
  card-pricing-tier-featured:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 24px
  card-customer-story:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 16px
  card-article-tile:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 16px
  card-category-icon:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-emphasis}"
    rounded: "{rounded.lg}"
    padding: 16px
  promo-strip-dark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.xl}"
    padding: 48px
  hero-promo-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 32px
  utility-strip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption-md}"
    height: 36px
    padding: 0 24px
  nav-bar-top:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    height: 64px
    padding: 0 32px
  nav-link:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    padding: 8px 16px
  category-tab:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-emphasis}"
    rounded: "{rounded.pill}"
    padding: 8px 20px
  category-tab-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
  faq-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-emphasis}"
    rounded: "{rounded.lg}"
    padding: 20px 24px
  chevron-decoration:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.none}"
  help-band-dark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-md}"
    padding: 64px 32px
  footer-dark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-md}"
    padding: 64px 32px
---

## Overview

HP reads like a long-running consumer-electronics catalog crossed with an enterprise-software product page. The whole system sits on **pure white** (`{colors.canvas}` â€” `#ffffff`) with thin gray panels (`{colors.cloud}` / `{colors.fog}`) for alternating section bands. There is one chromatic action color â€” **HP Electric Blue** (`{colors.primary}` â€” `#024ad8`) â€” and one ink color (`{colors.ink}` â€” `#1a1a1a`); together they do ninety percent of the work. Type is a single family across every surface: **Forma DJR Micro**, HP's bespoke geometric grotesque, set at weight 500 for headlines and 400 for body â€” clean, neutral, slightly mechanical.

The signature gesture is **angular blue chevrons** â€” sharp 0-radius slashes derived from the HP wordmark's pair of parallel slashes â€” that anchor the homepage hero, the laptop-page hero, and the printer pricing page. They appear on the left and right edges of the primary banner card, layered behind product photography. Outside those decorative slashes, every other surface is rectilinear with **soft 8â€“16px corners** on cards and a 4px corner on buttons.

The system breaks into three voice modes: a **white commercial body** for product browsing (cards, category icons, pricing tiers); a **dark navy slab** (`{colors.ink}` near-black) for testimonial bands, the closing "How can we help?" footer-prelude, and the page footer; and a **light fog band** (`{colors.cloud}` / `{colors.fog}`) for utility sections like comparison strips and FAQ accordions. The blue accent appears only on filled CTAs, link text, the chevron decorations, and the active price-stamp on a featured tier â€” never as a section background.

**Key Characteristics:**
- Pure white canvas (`{colors.canvas}`) with deep ink (`{colors.ink}`) running every body surface; light fog bands (`{colors.cloud}`, `{colors.fog}`) alternate for section rhythm
- HP Electric Blue (`{colors.primary}`) is the lone CTA fill and link color; it appears at most twice per viewport
- Bespoke Forma DJR Micro across every surface â€” display, body, button, caption â€” at weights 400 / 500 / 600 / 700
- Cards round at `{rounded.xl}` (16px) for product/pricing tiles; buttons sit at `{rounded.md}` (4px) with capitalize labels
- Geometric blue chevrons (`{colors.primary}` rectangles cut at 45Â°) frame hero photography and reinforce the wordmark
- Dark-navy slabs (`{colors.ink}`) close every page rhythm â€” testimonial bands, "how can we help?" prelude, and the footer
- Section rhythm: utility-strip â†’ top nav â†’ white body â†’ cloud-band â†’ ink slab â†’ cloud-band â†’ ink footer

## Colors

> **No Interaction sub-section.** Hover colors are silently filtered. Allowed sub-sections: Brand & Accent, Surface, Text, Semantic.

### Brand & Accent
- **HP Electric Blue** (`{colors.primary}` â€” `#024ad8`): the system's lone signal â€” primary CTA fill, link color, chevron-decoration fill, active sub-nav indicator. Reserved.
- **Bright Blue** (`{colors.primary-bright}` â€” `#296ef9`): a slightly lighter variant used inside dark slabs (testimonial-card buttons, dark-band CTA links) where the deeper blue would muddy.
- **Deep Navy** (`{colors.primary-deep}` â€” `#0e3191`): pressed state for the primary CTA and the visited-link color.
- **Soft Blue** (`{colors.primary-soft}` â€” `#c9e0fc`): pale-blue surface used inside customer-story cards and selection chips.

### Surface
- **Canvas** (`{colors.canvas}` â€” `#ffffff`): the universal page background. White, full opacity.
- **Paper** (`{colors.paper}` â€” `#ffffff`): card surfaces â€” same white as canvas, with hairline borders or shadows providing the lift.
- **Cloud** (`{colors.cloud}` â€” `#f7f7f7`): the lightest gray section band, used for alternating-row backgrounds and product-feature card groups.
- **Fog** (`{colors.fog}` â€” `#e8e8e8`): a slightly darker gray surface band, used for FAQ outer panels and the "Trending laptops" header strip.
- **Steel** (`{colors.steel}` â€” `#c2c2c2`): hairline border used on outlined elements with stronger emphasis (focus states, active filter).
- **Bloom Coral / Bloom Rose** (`{colors.bloom-coral}` / `{colors.bloom-rose}` â€” `#ff5050`, `#f9d4d2`): the "Get 25% off" sale-tag chip + soft pink lifestyle accent on the sale hero.
- **Storm Mist / Sea / Deep** (`{colors.storm-mist}`, `{colors.storm-sea}`, `{colors.storm-deep}` â€” `#8ebdce`, `#7fadbe`, `#356373`): the teal-storm tones reserved for the printer-plan illustration backdrop and supporting infographic accents.

### Text
- **Ink** (`{colors.ink}` â€” `#1a1a1a`): the universal text color on white surfaces â€” headlines, body, button labels, navigation.
- **Ink Deep** (`{colors.ink-deep}` â€” `#000000`): pure black used for the wordmark and 1px hairline strokes around badge outlines.
- **Ink Soft** (`{colors.ink-soft}` â€” `#292929`): an alternate near-black used inside dark-navy slabs as a subtle textural shift.
- **On Ink** (`{colors.on-ink}` â€” `#ffffff`): pure white used for headline and body text on every dark-navy slab.
- **Charcoal** (`{colors.charcoal}` â€” `#3d3d3d`): muted body color on white surfaces â€” secondary descriptions, fine-print disclaimers.
- **Graphite** (`{colors.graphite}` â€” `#636363`): smaller-print color, used for legal lines and timestamp metadata.

### Semantic
- **Bloom Deep** (`{colors.bloom-deep}` â€” `#b3262b`) + **Bloom Wine** (`{colors.bloom-wine}` â€” `#5a1313`): error and discount-emphasis colors. The deep brick reads as "sale" or "destructive" depending on placement.
- **Storm Deep** (`{colors.storm-deep}` â€” `#356373`): used as a neutral status accent (e.g., printer-plan tier "Versatile" tier color).

## Typography

### Font Family

The voice is **single-family**: Forma DJR Micro (HP's bespoke geometric grotesque, fallback Arial) across every surface â€” display, body, button, caption. Forma DJR Micro is a wide, slightly rounded grotesque designed at small optical sizes to stay legible at UI-chrome scale. HP runs it at weight 400 for body, 500 for display headlines, 600/700 for emphasis and button labels.

The 16/14/12-px caption tier carries the catalog metadata â€” model numbers, spec rows, fine print â€” at weight 400 with a 1.4â€“1.5 line-height. Button labels lift to weight 600/700 with positive 0.5â€“1.1px letter-spacing and uppercase transform â€” the only place the system tracks letters.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-xxl}` | 72px | 500 | 1.0 | 0 | Hero headline (homepage, laptop hub) |
| `{typography.display-xl}` | 56px | 500 | 1.0 | 0 | Section headlines on landing pages |
| `{typography.display-lg}` | 44px | 500 | 1.0 | 0 | Sub-section headlines on shop pages |
| `{typography.display-md}` | 32px | 500 | 1.0 | 0 | Promo strip headlines, FAQ section headers |
| `{typography.display-sm}` | 24px | 500 | 1.17 | 0 | Card titles, pricing-tier names |
| `{typography.display-xs}` | 20px | 500 | 1.0 | 0 | Inline list headers, accordion labels |
| `{typography.body-lg}` | 18px | 400 | 1.33 | 0 | Lead paragraphs |
| `{typography.body-md}` | 16px | 400 | 1.38 | 0 | Default body |
| `{typography.body-emphasis}` | 16px | 500 | 1.38 | 0 | Bolded run-in copy |
| `{typography.caption-md}` | 14px | 400 | 1.5 | 0 | Specs, metadata, captions |
| `{typography.caption-bold}` | 14px | 700 | 1.3 | 0 | Sale tags, in-card highlights |
| `{typography.caption-sm}` | 12px | 400 | 1.33 | 0 | Footnotes, legal lines |
| `{typography.link-md}` | 16px | 500 | 1.38 | 0 | Inline link emphasis |
| `{typography.button-md}` | 14px | 600 | 1.4 | 0.7px | Primary/secondary button labels (uppercase) |
| `{typography.button-sm}` | 12.6px | 700 | 1.0 | 0.126px | Compact button labels in tight cells |
| `{typography.price-md}` | 24px | 500 | 1.17 | 0 | Tier and product price stamps |

### Principles

The typographic decision worth flagging: HP runs **weight 500 for every display size**, including the largest 72px hero headline. Most editorial systems jump to 600/700 at hero scale; HP doesn't. The result feels open and approachable rather than commanding â€” appropriate for a brand that sells across consumer, SMB, and enterprise audiences in the same catalog.

Forma DJR Micro's rounded-grotesque shapes do most of the warmth. There's no italic in the system except inside legal disclaimers; emphasis is carried by weight (500 â†’ body-emphasis, 700 â†’ caption-bold) instead.

### Note on Font Substitutes

Forma DJR Micro is proprietary (Commercial Type / Mark Caneso). Closest open-source substitutes:
- **Inter** at weights 400 / 500 / 600 / 700 â€” slightly narrower than Forma DJR Micro; bump font-size by ~3% to compensate
- **Manrope** at weights 400 / 500 / 600 / 700 â€” closer in proportion, gentler curves; use directly with no metric adjustment
- **Roboto** at weights 400 / 500 / 700 â€” flatter character; use as last-resort fallback

When swapping, set body line-height to 1.4 and display line-height to 1.0 explicitly â€” the Forma DJR Micro line-height numbers are tight, and most substitutes default looser.

## Layout

### Spacing System

- **Base unit**: 8px. Smaller half-step at 4px. The scale is gentle â€” most card padding lands at 16px or 24px; section gap at 80px.
- **Tokens (front matter)**: `{spacing.xxs}` 4px Â· `{spacing.xs}` 8px Â· `{spacing.sm}` 12px Â· `{spacing.md}` 16px Â· `{spacing.lg}` 20px Â· `{spacing.xl}` 24px Â· `{spacing.xxl}` 32px Â· `{spacing.section}` 80px
- **Section padding**: `{spacing.section}` (80px) vertical between major bands on desktop; collapses to ~48px on mobile.
- **Card internal padding**: `{spacing.xl}` (24px) for product cards; `{spacing.xxl}` (32px) for promo strips and feature cards; `{spacing.md}` (16px) for compact article tiles.
- **Gutter**: `{spacing.xl}` (24px) between grid columns at desktop; `{spacing.md}` (16px) on tablet/mobile.

The 80px section gap is the universal rhythm constant â€” it appears between every major homepage band, between the hero and the comparison table on the printer-plan page, and between feature rows on the laptop-shop page.

### Grid & Container

- **Desktop max-width**: 1366px content container with full-bleed-on-canvas section backgrounds.
- **Hero**: a single full-width photo card (homepage and laptop-hub hero) with the headline overlay positioned upper-left or upper-right.
- **Product family grid**: 4 columns at >1200px, 3 at 1024â€“1199px, 2 at 768â€“1023px, 1 below 768px.
- **Pricing tiers**: 4 columns at >1024px, 2x2 grid at 768â€“1023px, single-column accordion below 768px.
- **Footer**: 5-column link grid at >1024px, collapsing to 2-column then accordion on mobile.

### Whitespace Philosophy

Whitespace is **commercial-clean** â€” generous around hero photography, tight around catalog spec rows. Product cards leave breathing room above and below the photo (â‰¥32px) so the laptop or printer reads as a hero shot rather than a thumbnail. The fine-print disclaimer regions (legal, footnote rows) tighten line-height to 1.3 and shrink type to 11â€“12px so the bulk of fine print stays compact.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 â€” Flat | No border, no shadow. | Section bands (white, cloud, fog), full-bleed photo heroes |
| 1 â€” Hairline | 1px solid `{colors.hairline}` (`#e8e8e8`) border, no shadow. | Outlined buttons, comparison-table cells, FAQ accordion outers |
| 2 â€” Soft Lift | `0 2px 8px rgba(26, 26, 26, 0.08)`. | Product cards, pricing-tier columns, customer-story tiles |
| 3 â€” Floating Modal | `0 8px 24px rgba(26, 26, 26, 0.12)`. | Add-to-cart drawer, mobile-nav sheet, image zoom modal |

The system is mostly flat â€” depth is communicated by **color contrast** (cloud-band vs. white card on the same band) rather than shadow elevation. The Soft Lift level is the workhorse for the catalog â€” every product tile and pricing column gets it; nothing else does. Modal-floating is rare and reserved for transient overlays.

### Decorative Depth

The system's most distinctive depth gesture is the **HP blue chevron pair** â€” two angular `{colors.primary}` slashes (no radius, no shadow) that sit on the left and right of the homepage hero card and the laptop-shop hero. They're not decorative noise; they're a literal echo of the HP wordmark's two parallel slashes, scaled up to architectural size. Treat them as a brand artifact, not a generic geometric flourish.

Photography on the homepage and laptop-shop pages frames product imagery inside `{rounded.xl}` (16px) containers with a soft 1px hairline. Lifestyle photography (testimonials, "How HP works for X") sits full-bleed inside dark-navy slabs without rounding.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0px | Hero chevron decorations, full-bleed photo heroes, marquee strips |
| `{rounded.xs}` | 2px | Secondary chip backgrounds, sale-tag pills |
| `{rounded.sm}` | 3px | Default secondary CTA radius (small touch zones) |
| `{rounded.md}` | 4px | Primary buttons, secondary buttons, text inputs |
| `{rounded.lg}` | 8px | Badge pills, category-icon cards, FAQ row containers |
| `{rounded.xl}` | 16px | Product cards, pricing tiers, customer-story tiles, photo frames |
| `{rounded.pill}` | 9999px | Category sub-nav tabs, search-pill input, filter chips |

The system maintains a clear two-tier philosophy: **buttons stay sharp** (4px, almost rectilinear) while **cards and photo frames stay soft** (16px). This split is the visual signature â€” sharp interactive elements against softer container surfaces.

### Photography Geometry

Hero photography sits in `{rounded.xl}` (16px) frames with no border. Product family thumbnails inside the laptop-grid are 1:1 (square) on a `{colors.canvas}` background, padded so the laptop is shown at ~70% of the frame. Customer-story photography uses 16:9 inside the same `{rounded.xl}` frame. There are no full-bleed circular avatars; testimonial avatars are 4px-rounded squares.

## Components

> **No hover states documented.** Every component spec below documents only Default and Active/Pressed states. Variants live as separate front-matter entries.

### Buttons

**`button-primary`** â€” the lone HP Electric Blue CTA
- Background `{colors.primary}`, text `{colors.on-primary}`, type `{typography.button-md}` (uppercase, 0.7px tracking), padding `{spacing.sm} {spacing.xl}` (12 Ã— 24), height 44px, rounded `{rounded.md}`
- Pressed state `button-primary-pressed` â€” background `{colors.primary-deep}`, same text
- Disabled state `button-primary-disabled` â€” background `{colors.steel}`, white text
- Used for: "Buy now", "Shop now", "Get a printer", primary form submit

**`button-ink`** â€” black filled CTA
- Background `{colors.ink}`, text `{colors.on-primary}`, padding `{spacing.sm} {spacing.xl}`, height 44px, rounded `{rounded.md}`, type `{typography.button-md}`
- Used for: "Buy now" on dark photo overlays, secondary primary actions where the blue would clash with imagery

**`button-outline`** â€” blue-text outlined CTA
- Background `{colors.canvas}`, text `{colors.primary}`, 1px `{colors.primary}` border, padding `{spacing.sm} {spacing.xl}`, height 44px, rounded `{rounded.md}`
- Used for: "Compare", "Customize", "Learn more" â€” secondary actions on white surfaces

**`button-outline-ink`** â€” black-text outlined CTA
- Background `{colors.canvas}`, text `{colors.ink}`, 1px `{colors.ink}` border, padding `{spacing.sm} {spacing.xl}`, height 44px, rounded `{rounded.md}`
- Used for: "View" buttons inside product family card grids â€” neutral against the blue primary

**`button-text-link`** â€” inline blue link with underline
- Background `{colors.canvas}`, text `{colors.primary}`, type `{typography.link-md}`, padding `{spacing.xxs} 0`
- Used for: "See details", "Read more" inside cards and disclaimer rows

### Cards & Containers

**`card-product`** â€” the workhorse product tile
- Background `{colors.canvas}`, rounded `{rounded.xl}` (16px), padding `{spacing.xl}` (24px), Soft Lift shadow
- Layout: hero photo (1:1 ratio) on top, title in `{typography.display-xs}`, spec rows in `{typography.caption-md}`, price in `{typography.price-md}`, CTA pinned to bottom
- Used for: laptop catalog cards, desktop catalog cards

**`card-product-feature`** â€” full-row feature card with photo + copy
- Background `{colors.cloud}`, rounded `{rounded.xl}`, padding `{spacing.xxl}` (32px)
- Layout: photo on the left (50% width), copy on the right with section eyebrow + title + body + CTA pair
- Used for: "Trending laptops" feature rows, "Shop these must haves"

**`card-pricing-tier`** + **`card-pricing-tier-featured`**
- Background `{colors.canvas}`, rounded `{rounded.xl}`, padding `{spacing.xl}`, Soft Lift shadow
- Tier name in `{typography.display-sm}`, monthly price in `{typography.display-md}` with `{typography.caption-md}` cadence, page count caption, full feature list, primary CTA
- Featured tier carries `{colors.primary}` text accent on the price-stamp + a `{colors.primary}` thin top border instead of a colored card background â€” never inverted to dark

**`card-customer-story`** â€” the three-up testimonial tile
- Background `{colors.canvas}`, rounded `{rounded.xl}`, padding `{spacing.md}` (16px), Soft Lift shadow
- 16:9 photo at top in `{rounded.xl}` frame, quote excerpt in `{typography.body-md}`, attribution row at the bottom
- Used in the "See what our customers say" homepage section

**`card-article-tile`** â€” the four-up "Latest from HP" tile
- Background `{colors.canvas}`, rounded `{rounded.xl}`, padding `{spacing.md}`, Soft Lift shadow
- 16:9 thumbnail at top, date eyebrow in `{typography.caption-sm}`, title in `{typography.body-emphasis}`, "Read more" link

**`card-category-icon`** â€” the small icon-and-label card in the homepage "Our Products" row
- Background `{colors.canvas}`, rounded `{rounded.lg}` (8px), padding `{spacing.md}`
- 48px icon at top, label in `{typography.body-emphasis}` below
- Used for: Laptops, Desktops, Printers, Computer Tools, Accessories, Enterprise Solutions

**`hero-promo-card`** â€” the homepage hero card with chevron decorations
- Background `{colors.canvas}`, rounded `{rounded.xl}`, padding `{spacing.xxl}` (32px)
- Photography occupies left half; copy block (eyebrow + headline + price stamp + CTA pair) occupies right half
- Flanked by `chevron-decoration` blue slashes outside the card's bounding box on left and right edges

**`promo-strip-dark`** â€” the inline dark navy promo block
- Background `{colors.ink}`, text `{colors.on-ink}`, rounded `{rounded.xl}`, padding `{spacing.xxl} 48px`
- Used for: "When did work start getting in the way of work?" mid-page promo, the SMB testimonial slab

### Inputs & Forms

**`text-input`** + **`text-input-focused`**
- Background `{colors.canvas}`, text `{colors.ink}`, rounded `{rounded.md}`, padding `{spacing.sm} {spacing.md}`, height 44px
- 1px `{colors.steel}` border in default; gains 1px `{colors.ink}` border on focus (no halo)

**`text-input-search`** â€” pill search in the top nav
- Background `{colors.canvas}`, rounded `{rounded.md}`, padding `{spacing.sm} {spacing.md}`, height 40px, 1px `{colors.steel}` border, magnifying-glass icon at right

**`badge-pill-ink`** â€” filled tag pill
- Background `{colors.ink}`, text `{colors.on-primary}`, rounded `{rounded.lg}`, padding 6px 12px, type `{typography.body-md}`
- Used inline next to product titles to mark "New" or featured indicators

**`badge-pill-outline`** â€” outlined tag pill
- Background `{colors.canvas}`, text `{colors.ink}`, 1px `{colors.ink}` border, rounded `{rounded.lg}`, padding 6px 12px

**`badge-sale-coral`** â€” the sale price-stamp
- Background `{colors.bloom-coral}`, text `{colors.on-primary}`, rounded `{rounded.sm}`, padding `{spacing.xxs} {spacing.xs}`, type `{typography.caption-bold}`
- Used for: "Save $200", "25% off" overlay tags on hero promo cards

### Navigation

**`utility-strip`** â€” the top-of-page utility bar
- Background `{colors.ink}`, text `{colors.on-primary}`, height 36px, padding 0 {spacing.xl}, type `{typography.caption-md}`
- Holds: country/locale picker, "For Business / For Home" toggle, "Sign in" link, cart link

**`nav-bar-top`** â€” desktop top nav (sits below utility strip)
- Background `{colors.canvas}`, height 64px, padding 0 32px
- Layout: HP wordmark logo flush left â†’ middle category list (Laptops / Desktops / Printers / Accessories / Solutions / Support) â†’ right slot with Search field, Sign-in link, Cart icon
- 1px `{colors.hairline}` bottom border separates nav from page

**`nav-link`**
- Background `{colors.canvas}`, text `{colors.ink}`, type `{typography.body-md}`, padding `{spacing.xs} {spacing.md}`
- Active page draws a 2px `{colors.primary}` underline below the text baseline

**Top Nav (Mobile)**
- Same height, hamburger icon replaces the middle category list, Search and Cart stay visible
- Drawer expands as a full-canvas sheet with `{typography.body-lg}` link list and a sticky Sign-in CTA at bottom

**`category-tab`** + **`category-tab-active`** â€” the pill sub-nav
- Default: background `{colors.canvas}`, text `{colors.ink}`, type `{typography.body-emphasis}`, rounded `{rounded.pill}`, padding `{spacing.xs} {spacing.lg}`
- Active: background `{colors.ink}`, text `{colors.on-primary}`, same rounding
- Used on the laptop-shop page for "All / Trending / On Sale" filtering, and on the homepage "How can we help?" closing band

### Signature Components

**`chevron-decoration`** â€” the geometric blue slash motif
- Background `{colors.primary}`, rounded `{rounded.none}`, no shadow
- Renders as a sharp parallelogram cut at ~60Â° angle, sized to the height of the hero card it flanks
- Reserved for hero bands and full-page banners â€” never decorative noise inside cards

**`faq-row`** â€” the accordion row on the printer-plan FAQ
- Background `{colors.canvas}`, rounded `{rounded.lg}`, padding `{spacing.lg} {spacing.xl}`, type `{typography.body-emphasis}`
- 1px `{colors.hairline}` divider between rows; chevron-down icon on the right collapsed, chevron-up when expanded
- Body answer renders inside the same row container in `{typography.body-md}` after expansion

**`help-band-dark`** â€” the closing "How can we help?" prelude band
- Background `{colors.ink}`, text `{colors.on-primary}`, padding 64px {spacing.xl}
- Layout: large lifestyle photograph as the band background (low-opacity) with chip-style category tabs centered: Browse Topics / Live Chat / Contact / Diagnose / Order Status

**`footer-dark`**
- Background `{colors.ink}`, text `{colors.on-primary}`, type `{typography.body-md}`, padding 64px {spacing.xl}
- 5-column link grid (Company / Shop / Support / Resources / Connect) with `{typography.body-emphasis}` headers and `{typography.caption-md}` link rows
- Bottom strip carries social icons, language picker, and legal lines in `{typography.caption-sm}` muted to `{colors.steel}`

## Do's and Don'ts

### Do
- Reserve `{colors.primary}` for the primary CTA, link color, and `chevron-decoration` motif â€” at most twice per viewport
- Set every headline in Forma DJR Micro at weight 500 with line-height 1.0 â€” resist the urge to bump weight at hero scale
- Use `{rounded.xl}` (16px) for cards and photo frames; `{rounded.md}` (4px) for buttons and inputs â€” keep the two-tier split sharp
- Pair white `{colors.canvas}` body bands with `{colors.cloud}` (`#f7f7f7`) alternating bands; let the gray do the breathing
- Close every page rhythm with a dark-navy `{colors.ink}` slab â€” the "How can we help?" prelude + footer
- Set button labels in uppercase with `{typography.button-md}` (0.7px tracking) â€” the only place the system tracks letters
- Use Soft Lift shadow exclusively for product cards and pricing tiers â€” leave section bands flat
- Frame product photography inside `{rounded.xl}` containers; never use full-bleed circular masks

### Don't
- Don't introduce secondary saturated colors outside `{colors.primary}` family + the `bloom-coral` sale-tag and `storm` printer-plan accents
- Don't apply heavy material shadows â€” depth is via color contrast (cloud vs. white) and Soft Lift only
- Don't round buttons above `{rounded.md}` (4px); a soft 8px+ button reads as a different brand
- Don't run Forma DJR Micro below 12px â€” small caption at 11px is the floor
- Don't use the chevron decoration as inline noise; it is a hero-only architectural element tied to the wordmark
- Don't drop ink text opacity to create hierarchy â€” switch surface or shift to `{colors.charcoal}` / `{colors.graphite}` instead
- Don't replace the HP wordmark with a generic sans lockup; the wordmark is a custom mark with its own ratio

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| Mobile | < 480px | Single-column stack; hamburger nav; section padding drops to ~48px; hero serif scales to ~36px |
| Mobile-Large | 480â€“767px | Same column count; hero scales to ~44px; pricing tiers stack vertically |
| Tablet | 768â€“1023px | 2-column product grid; pricing 2x2; nav still full text labels |
| Desktop | 1024â€“1279px | 3-column product grid; 4-column pricing; full nav |
| Desktop-Large | â‰¥ 1280px | 4-column product grid; 1366px content max-width with full-bleed bands |

### Touch Targets

Every interactive element clears 44Ã—44px on mobile. `button-primary` at 44px height + 24px horizontal padding meets WCAG-AAA touch target. `category-tab` at 8px 20px padding bumps to 12px 24px on touch screens. Nav-link tap areas extend invisibly beyond the text run to the full 44px row height. Sticky cart/sign-in icons in the top nav use 44Ã—44 invisible hit boxes around their visible 24Ã—24 glyph.

### Collapsing Strategy

- **Utility strip**: stays visible on every breakpoint; dropdowns collapse into a single "Account" icon below 768px
- **Top nav**: middle category list collapses into a hamburger drawer below 1024px; the right-side Search + Sign-in + Cart stay visible
- **Hero**: stays single-column at every breakpoint; chevron decorations shrink to ~60% size on tablet and disappear entirely on mobile
- **Product family grid**: 4 â†’ 3 â†’ 2 â†’ 1 column as breakpoints shrink; cards keep `{rounded.xl}` corners at every size
- **Pricing comparison table**: 4-column grid on desktop collapses to 2x2 on tablet, then stacks into individual accordion-style cards on mobile
- **Footer**: 5-column link grid â†’ 2-column tablet â†’ single-column accordion on mobile; HP wordmark stays flush left

### Image Behavior

Hero photography uses `{rounded.xl}` containers at every breakpoint. The chevron decorations vanish on mobile; the underlying photo card centers in the viewport. Lifestyle photography in the testimonial and "how-can-we-help" bands maintains 16:9 ratio with horizontal cropping rather than letterboxing on mobile. There are no art-direction crop swaps between desktop and mobile â€” the same image is used at every size.

## Iteration Guide

1. Focus on ONE component at a time; resist refactoring an entire section in one pass
2. Reference component names and tokens directly (`{colors.primary}`, `{typography.display-xxl}`, `{rounded.xl}`, `card-product`) â€” do not paraphrase to hex/px in prose
3. Run `npx @google/design.md lint DESIGN.md` after edits â€” `broken-ref`, `contrast-ratio`, and `orphaned-tokens` warnings flag issues automatically
4. Add new variants as separate component entries (`-pressed`, `-disabled`, `-focused`); never bury state inside prose
5. Default body to `{typography.body-md}`; reach for `{typography.body-emphasis}` for run-in bolds; keep display sizes for true heading roles
6. Keep `{colors.primary}` scarce â€” at most two flame elements per viewport (one CTA + one chevron decoration). Three flame items in one viewport is over-saturation
7. When introducing a new section band, choose from `{colors.canvas}` / `{colors.cloud}` / `{colors.fog}` / `{colors.ink}` â€” six pre-defined surface modes is the entire surface vocabulary

