# Design

Status: planned. The brand kit for Off-Limits is ready (see "Brand" below). No web page or owner view is built yet.

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
- **Tokens.** Colour, type scale, spacing (4/8 px scale), radii and motion are defined once as design tokens and used everywhere.
- **Accessibility.** WCAG 2.2 AA: semantic HTML, full keyboard operation with a visible focus indicator, contrast of at least 4.5:1 for text, targets of at least 24×24 px, `prefers-reduced-motion` respected.
- **States.** Every screen handles loading, empty, error, success and disabled.
- **Responsive.** Mobile-first, checked at about 375, 768 and 1280 px.

## Brand

Off-Limits is a product of Black Canyon Software. Its brand is defined in the owner's brand kit (`brands/off-limits/brand.toml` in the Brand Logos project) and its generated guide is `dist/off-limits/BRAND.md` there. That guide is the single source for which file does which job.

- **Mark:** the shared Black Canyon box, in the crimson brand colour. Initials "OL".
- **Type:** Libre Franklin (it was Nunito before brandkit 1.49.0). The kit's font file is `font/librefranklin.woff`, and it ships beside `template/fonts.css` in the full page set. Link that sheet; never name the typeface in our own CSS. The README banners already have the name drawn in it.
- **Colour:** never write a colour into our own code. Load the kit's `tokens.css` or `theme.css`. The core roles, light and dark:

| Role                         | Light     | Dark      |
| ---------------------------- | --------- | --------- |
| ink (text, headings)         | `#3f262c` | `#dfcacf` |
| accent (links, focus)        | `#be3355` | `#d45e7b` |
| brand and logo (fills, mark) | `#d15372` | `#d15372` |
| page                         | `#f0eff0` | `#131212` |
| card                         | `#fcfbfb` | `#1a1819` |
| line                         | `#dbd7d8` | `#2b2728` |

- **Status colours** (error, warning, success) are the kit's house colours, the same in every brand. Because this brand is itself crimson, an error is never told apart by colour alone: error and warning use the kit's shapes and edges as well.
- **Icons:** the kit's `ui/` set, which includes `icon-sun`, `icon-moon` and `icon-info` for the light/dark toggle and the info buttons above.

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
