# Nosca's website — first draft

The founder asked on 21 November for a first draft of the company's website, to show shareholders: the backstory (the name from the Irish *nasc*, a link; how Nosca came to be and how it was developed), examples of the product, space for sponsors, very good and very simple, and the dynamic style of Apple's product pages, where text appears and scenes play as you scroll.

It is published as a private claude.ai page: https://claude.ai/artifact/HLpFkRjS18rtHuZJABP1hJ. Only the owner can open it until it is shared from the page's Share menu.

## What is here

| Path | What it is |
|---|---|
| `index.html` | The page as published: a fragment (no `<html>` or `<body>`), the shape a claude.ai page takes. |
| `preview.html` | The same page as a whole document, for opening locally (`python3 -m http.server` in this folder, then `/preview.html`). |
| `assets/` | The 25 files the page uses: screenshots of the app at 780 × 1688 (WebP), and one short clip of the plus sheet opening. |
| `source/` | `src.html` (markup and CSS), `main.js` (the scroll engine), `qr.svg`, `ticks.svg`, and `build.py`, which writes `index.html` and `preview.html` from them. Also `brief.md` (every line of copy and every number, each with its source) and `storyboard.md` (each scene and how it moves). |

To change the page, edit `source/`, run `python3 website/source/build.py`, and republish `index.html` to the same page.

## How it is built

- **Fonts.** Instrument Sans (the business card's face) from Google Fonts. The system face (SF on an iPhone) for running text.
- **Colours.** White first. The card's olive and gold pinstripes open the page (the name) and close it (the footer). The gold rings are drawn from the mark's own geometry (`src/lib/brandmark.jsx`).
- **Scroll engine.** Hand-written, with no library and no external script; the page's host allows Google Fonts and nothing else. Each scene is a tall section around a sticky stage. One passive scroll listener writes its progress, and only transforms, opacity and SVG dashes animate.
- **Without motion.** Under Reduce Motion, on a short screen, or with JavaScript off, every scene is shown finished and in flow.
- **Tested** at 320, 390 and 1440 wide: no sideways scroll, no console errors.

## Placeholders the founder fills in

- **The story, beat 1:** Fionn's own three or four sentences: when and where Nosca began, and why it had to be built.
- **Contact email:** twice, under Partners and in the close.
- **Footer:** the registered company name.
- **Partners:** six empty frames, deliberately blank until a partner is signed.

## Not yet right

- **No real swing in any clip.** Every clip in the screenshots (Mark it up, Compare, a lesson's page) is the test suite's synthetic one: a green ground with a white disc. A real one or two would make those scenes. A swing or a forehand, filmed with consent, would be seeded into the mock and the screens re-shot.
- **The app's look has moved since.** The screenshots were taken from the app before the 21–22 November visual fixes landed, and are re-shot from the final build.
- **Every fact is from the repository.** The six sports, the 45 development cycles (29 Sep – 20 Nov), the 155 updates since September, the 1,554 automated checks, and the redesign around one behaviour on 19 September (PR #18). Nothing is invented. A fact we did not have is a placeholder.
