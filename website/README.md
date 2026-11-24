# Nosca's website

Four pages about Nosca for shareholders, partners and anyone meeting the app for the first time: **Home** (the olive business card's world), **Product** (the app in full), **Story** (the dark green card's world: the name, how it was built, what we stand for) and **Partners**.

It is launched with the app, as a folder of the same Netlify site: `https://nosca-pilot-2.netlify.app/about/`. `npm run build` builds the app and then runs `node website/build.mjs --out dist/about`.

## To change it

| Path | What it is |
|---|---|
| `BRIEF.md` | The founder's words and the rules the site is held to. Read it first. |
| `API.md` | The shared foundation: the classes, the motion attributes, how a page is built. |
| `src/pages/*.html` | One file a page (no `<html>` or `<head>`; `src/partials/shell.html` adds them). |
| `src/css/site.css`, `src/js/site.js` | The foundation every page shares. `src/css/<page>.css` and `src/js/<page>.js` are a page's own. |
| `src/css/palette.css` | The app's club colours and their lighter half. Written by `scripts/club-palette.py` from the same numbers the app uses; never edit it by hand. |
| `assets/` | Screenshots of the app at 780 × 1688 (WebP), one short clip, the mark. `MANIFEST.json` says what each one shows. |
| `vendor/`, `fonts/` | GSAP, ScrollTrigger, SplitText and Lenis, and Instrument Sans (the business card's face), all served from the site itself. Nothing loads from another domain. |
| `site.config.json` | The app's address, the install guide's address and the contact email. |

```
node website/build.mjs            # builds website/dist/, with the kit page, for working on it
node website/build.mjs --watch    # the same, rebuilding on change
cd website/dist && python3 -m http.server 5800
```

Every URL the build writes is relative, so the site works at a domain's root or in a folder.

## Its own address

To give the site a domain of its own, add a second site in Netlify from this same repository with **Base directory** `website`, **Build command** `node build.mjs --out dist --release` and **Publish directory** `website/dist`, then point the domain at it. Nothing else changes.

## Rules it keeps

- **True or absent.** Every fact is from the repository or the founder: six sports, four roles, the development cycles and their dates, the checks that run before a release. A fact we do not have is left out; nothing on a page is a placeholder.
- **The name.** Nosca is an anglicised spelling of the Irish word *nascadh*, which means linking (the founder, 23 November). On a page: "From the Irish *nascadh*, linking." Never "nasc" alone, and no other origin.
- **Colour.** The business card's olive, dark green and gold, white first, and the app's club colours in their places: what acts is deep, what labels is pale. On a dark ground only gold, white and the lighter tones.
- **Motion.** Calm, and never needed: with Reduce Motion on or JavaScript off every page shows whole.
- **The screenshots are the app.** They are shot from the real build against demo data (the names are fictional) and re-shot when the app's look changes.

## What the founder can add

- A contact email (`site.config.json`, `contactEmail`): the Partners page and the footer show it once it is there.
- The story's first beat in his own words: when and where Nosca began, and why.
- A real swing or forehand, filmed with consent, for the clips in Mark it up and Compare (they are the test suite's synthetic clip today).
- Partner marks, as they sign.
