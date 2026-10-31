# Design

Status: planned. Visual brand assets are pending from the owner. Nothing below sets a logo, colour palette or typeface.

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
Entry would match in this project:
  12 files, 3 directories
  Warning: this name is short and common. Matches may block ordinary work.
Add it? [y/N]
```

## Web conventions (for any page or owner view)

These follow the owner's shared project standards:

- **Info buttons.** Extra explanation hides behind an "i" button that reveals it, so the page stays uncluttered.
- **Light and dark.** A toggle using a sun and moon icon. Default follows the system setting.
- **Brand.** Logos, colours and templates come from the owner's brand assets folder. Pending; ask before any visual work.
- **Tokens.** Colour, type scale, spacing (4/8 px scale), radii and motion are defined once as design tokens and used everywhere.
- **Accessibility.** WCAG 2.2 AA: semantic HTML, full keyboard operation with a visible focus indicator, contrast of at least 4.5:1 for text, targets of at least 24×24 px, `prefers-reduced-motion` respected.
- **States.** Every screen handles loading, empty, error, success and disabled.
- **Responsive.** Mobile-first, checked at about 375, 768 and 1280 px.

## Writing guidelines

- Use the glossary terms in `docs/PRD.md` and one term per concept: "entry", "policy", "guard", "filter", "isolation".
- Describe each layer by what it does and what it covers. Do not promise more than the test command shows.
- Prefer "your assistant", "your project", "your policy".
- Examples use made-up names such as `client-alpha` and `project-nightingale`.

## Component inventory

Nothing built yet. To be listed here as components are added.
