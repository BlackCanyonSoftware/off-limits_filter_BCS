# Design

Status: planned. The brand kit for Off-Limits is ready and its design standard, IBM Carbon, is recorded (see "Brand" below). No web page or owner view is built yet.

## Audience and tone

People who run AI assistants on their own machines and want control over what those assistants can see. They range from experienced developers to people who only recently started using assistants.

Tone: calm, plain and practical. Say what a layer does and what it does not do, in everyday words. No alarm language, no jargon without a one-line explanation.

## Surfaces

1. **Command line.** The main surface in v1.
2. **Documentation.** `README.md` and the docs folder.
3. **Public page and optional local owner view (later).** A small static page, and later a local view with type-ahead for entries. Both follow the web conventions below.

## Command-line conventions

- Commands are short verbs: `init`, `add`, `list`, `remove`, `check`, `count`, `snippet`, `install`, `test`, `scan`, `run`.
- Output is plain text first. Colour is a bonus and is switched off for non-terminals and when `NO_COLOR` is set. Nothing depends on colour alone.
- Every command has `--help` with one example.
- Every error says what happened and what to try.
- Exit codes: `0` success or allowed, `1` usage or general error, `2` blocked (the boundary signal).

### Standard boundary signal

Refusal, always identical:

```
[offlimits:blocked] This touches something the owner has marked off-limits. Do not try another way. Tell the owner.
```

Filtered output marker, one line per run of hidden lines:

```
[offlimits:filtered] 3 lines hidden
```

Neither text names an entry, a rule or a kind.

### Match preview (owner commands only)

```
[hide] name: docs
This would match, in this folder: 12 files, 3 folders.
Warning: this is a common word. It may block ordinary work.
Add it? [y/N]
```

## Web conventions (for any page or owner view)

These follow the owner's shared project standards:

- **Info buttons.** Extra explanation hides behind an "i" button that reveals it, so the page stays uncluttered.
- **Light and dark.** A toggle using a sun and moon icon. Default follows the system setting.
- **Brand.** Logos, colours, type and page templates come from the brand kit. See "Brand" below.
- **Tokens.** Radii, spacing, type scale, control heights, elevation and motion come from the kit's `tokens.css`, which is built to IBM Carbon (see "Brand"). Use the token names; never retype a number the standard supplies.
- **Accessibility.** WCAG 2.2 AA: semantic HTML, full keyboard operation with a visible focus indicator, contrast of at least 4.5:1 for text, targets of at least 24×24 px, `prefers-reduced-motion` respected.
- **States.** Every screen handles loading, empty, error, success and disabled.
- **Responsive.** Mobile-first, checked at about 375, 768 and 1280 px.

## Brand

Off-Limits is a product of Black Canyon Software. Its brand is defined in the owner's brand kit (`brands/off-limits/brand.toml` in the Brand Logos project) and its generated guide is `dist/off-limits/BRAND.md` there. That guide is the single source for which file does which job.

- **Mark:** the shared Black Canyon box, in the crimson brand colour. Initials "OL".
- **Type:** the name is set in Libre Franklin (`--font-display`: wordmark, headings) and the product reads in Public Sans (`--font`: body, labels, tables). The kit's font files are in `font/` and ship beside `template/fonts.css` in the full page set. Link that sheet; never name a typeface in our own CSS. The README banners already have the name drawn.
- **Colour:** never write a colour into our own code, and do not copy the kit's values into a document either (a second written copy drifts). The roles, light and dark, are in `dist/off-limits/BRAND.md` (Colour) and `theme/theme.css`; load the kit's `tokens.css` or `theme.css`.
- **Status colours** (error, warning, success) are the kit's house colours, the same in every brand. Because this brand is itself crimson, an error is never told apart by colour alone: error and warning use the kit's shapes and edges as well.
- **Icons:** the kit's `ui/` set, which includes `icon-sun`, `icon-moon` and `icon-info` for the light/dark toggle and the info buttons above.

### Design standard: IBM Carbon

Off-Limits is built to **IBM Carbon**, and to nothing else (the kit's `docs/standards/carbon.md`; `dist/off-limits/BRAND.md`, "The design standard"). The standard owns the interface: shape, spacing, type scale, control heights, elevation and motion, and how each control looks. It does not own our colours, mark or display face. There is no screen yet, so nothing here has been applied to a UI; these are the rules to build to if one is added (an owner view, a public page, an HTML report):

- Corners are square: a button, field, card and menu have none. Only a tag, a toggle and a circle are round.
- Space comes from the scale 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 160; sizes are multiples of 8 px.
- Controls are 32, 40 or 48 px high; a button and a field default to 40 so they line up.
- A field is filled, with a 1 px rule along the bottom and no other edge. Focus is a 2 px outline inside the box.
- Depth is background tone (page, then layer-01, 02, 03), not shadow. Only what floats (a menu, a toast) casts one shadow. A screen that looks flat is the standard working.
- Regular weight in the productive type scale; semibold only for the two smallest headings and a selected tab. Nothing is set in capitals; labels are sentence case, 12 px.
- Motion is 110 ms for a state change and 240 ms for movement. The shell is a 48 px header and a 256 px side nav.
- Off-Limits is a **public** product, so it never takes Apple's patterns, and it does not borrow from any other design system.
- The kit does not yet have a form-item wrapper, a required-field marker, table density classes, or Carbon's layering and data components (listed in the kit's `docs/standards/README.md`). If we need one, build it here in Carbon's terms and say so in the roadmap.

Use the classes in the kit's `components.css` (`.btn`, `.input`, `.card`, `.tabs`, `.menu`) rather than our own, and compare every screen with the kit's `dist/off-limits/template/showcase.html` at 375, 768 and 1280 px wide, in light and dark.

### Provenance and record

- **Bundled from:** brandkit **1.56.1** (the design-standards rollout names 1.56.0; 1.56.1 is a patch release with no change to this brand's design), Brand Logos commit `eef776be`, tree dirty (three files: `requests/README.md`, `requests/TEMPLATE.md` and the rollout tracker; none concerns this brand). `brandkit verify` was clean and `dist/off-limits` present.
- **Set:** `readme`, in `docs/brand/`. On 2026-11-06 `brandkit check` reported it matches the current build, and its two files match this repo's own `BUNDLE.json` (no local edits), so nothing was re-bundled.
- **Deliberately absent:** the brand's `tagline`, `summary` and `domain` are empty in the kit. They are not invented here.
- **Brand drift retired:** the table of hex colour values that used to sit in this section. The kit owns those values.

### What is in the repository

`docs/brand/` holds the kit's "readme" set: the banner lockup in light and dark. It is generated, so it is never edited by hand. Update or verify it with the kit's own commands, run from the Brand Logos project (with `src` on `PYTHONPATH`, or the installed `brandkit`):

```bash
brandkit bundle off-limits <this repo>/docs/brand --set readme
brandkit check  off-limits <this repo>/docs/brand --set readme
```

There is no stylesheet or page in the repository yet, so no font file ships and nothing names a typeface. If a web page or owner view is built later, bring in the kit's default set (`brandkit bundle off-limits <path>/static/brand`) rather than copying files by hand. That set carries `template/fonts.css` and `font/`, and the page links the sheet.

### README header

A README header is a pair, light and dark, because GitHub picks the page colour to suit the reader. Use the PNG banners, centred with `align`:

```html
<p align="center">
  <picture>
    <source
      media="(prefers-color-scheme: dark)"
      srcset="docs/brand/lockup/banner/lockup-horizontal-dark-banner.png"
    />
    <img
      alt="Off-Limits"
      width="480"
      src="docs/brand/lockup/banner/lockup-horizontal-light-banner.png"
    />
  </picture>
</p>
```

### Licence of the artwork

The repository code is MIT. The kit's guidelines say the artwork, names and marks are not covered by that licence: they identify Black Canyon Software and its products. The repository should say so wherever the logo appears (a line in the README near the licence section). This is the owner's wording to confirm.

## Writing guidelines

- Use the glossary terms in `docs/PRD.md` and one term per concept: "entry", "policy", "guard", "filter", "isolation".
- Describe each layer by what it does and what it covers. Do not promise more than the test command shows.
- Prefer "your assistant", "your project", "your policy".
- Examples use made-up names such as `client-alpha` and `project-nightingale`.

## Component inventory

Nothing built yet. To be listed here as components are added.
