# Nosca's website

Four pages about Nosca for shareholders, partners and anyone meeting the app for the first time: **Home** (the olive business card at the size of a screen), **Product** (the app in full), **Story** (the dark green card: the name, how it was built, what we stand for) and **Partners**.

It is launched with the app, as a folder of the same deploy: `https://nosca.netlify.app/about/` (the old address, `nosca-pilot-2.netlify.app`, builds the same and hands a visitor on to the new one). `npm run build` builds the app and then runs `node website/build.mjs --out dist/about`. Every link is relative, and the two app links (`../`, `../install`) reach the app beside it.

## To change it

| Path | What it is |
|---|---|
| `BRIEF.md` | The founder's words and the rules the site is held to. Read it first. |
| `API.md` | The shared foundation: the classes, the motion attributes, how a page is built. |
| `src/pages/*.html` | One file a page (no `<html>` or `<head>`; `src/partials/shell.html` adds them). |
| `src/css/site.css`, `src/js/site.js` | The foundation every page shares. `src/css/<page>.css` and `src/js/<page>.js` are a page's own. |
| `src/css/palette.css` | The app's club colours and their lighter half. Written by `scripts/club-palette.py` from the same numbers the app uses; never edit it by hand. |
| `assets/` | Screenshots of the app at 780 × 1688 (WebP), the mark, `seq/` (frames of the app in use, which the scroll plays like a film) and `photo/` (the photographs, with their credits). `MANIFEST.json` says what each still shows. |
| `vendor/`, `fonts/` | GSAP, ScrollTrigger, SplitText and Lenis; Instrument Sans (the business card's face) and Instrument Serif (for the Irish word, a pull-quote, a numeral), both under the Open Font Licence. All served from the site itself. Nothing loads from another domain. |
| `tools/` | `cap.cjs` photographs the built pages (stills, motion frames, measurements); `seq/` makes the image sequences from a mock build of the app. |
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
- **Colour.** The business card is the art direction: its green, white, one quiet warm off-white, and gold only as a line, a numeral or small capitals. A sport's colour shows inside its own screen.
- **Motion.** The scroll plays the page like a film, and it is never needed: with Reduce Motion on or JavaScript off every page shows whole and still.
- **The screenshots are the app.** They are shot from the real build against demo data (the names are fictional) and re-shot when the app's look changes.

## What the founder can add

- A contact email (`site.config.json`, `contactEmail`): Partners' close becomes "Partner with Nosca." with the address, and Home's close carries it, once it is there. While it is empty no address shows anywhere.
- The story's first beat in his own words: when and where Nosca began, and why.
- A real swing or forehand of his own, filmed with consent, for the clips inside the app's screens. They show a putting green seen from above today (a stock clip with no one to read as a customer); Story's plus sheet and register and Product's plus sheet are still shot from the app before 24 November's calmer keys, and want re-shooting from a build that has them.
- His own photographs, if he would rather than the licensed ones (`assets/photo/`, the manifest says which picture stands where).
- Partner marks, as they sign.
