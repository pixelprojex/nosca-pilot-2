# Nosca's website

One page about Nosca for shareholders, partners and anyone meeting the app for the first time (`index.html`), each
part answering one question: **what it is** (a still lake at sunrise under the deep green, "Coaching, linked.", Open
Nosca, and the coach's day in the app arriving once), **what the coach does** (a headline, a line, the app's own
screens), **what the player keeps** (oaks in a foggy dawn, and the app's feed in use, played in a phone), **for which
sports** (mist in low fields, then the six in their own words), **who made it and why** (steam off a lake under the
name, the moment every coach screen is judged against, climate) and **how to start** (the pilot, the two printed
cards). Its grounds are foggy mornings in one grade, ivory paper and the olive of the second card; its headlines are
the app's own title face; it is set like a heritage maker's printed programme, with gold only as a fine line, a seal
and a few small capitals. The header's anchors (Product · Story · Pilot) reach each part.
`product.html`, `story.html` and `partners.html` only send their old addresses on to the page (Partners is gone).

It is launched with the app, as a folder of the same deploy: `https://nosca.netlify.app/about/` (the old address, `nosca-pilot-2.netlify.app`, builds the same and hands a visitor on to the new one). `npm run build` builds the app and then runs `node website/build.mjs --out dist/about`. Every link is relative, and the two app links (`../`, `../install`) reach the app beside it.

## To change it

| Path | What it is |
|---|---|
| `BRIEF.md` | The founder's words and the rules the site is held to. Read it first. |
| `API.md` | The shared foundation: the classes, the motion attributes, how a page is built. |
| `src/pages/*.html` | One file a page (no `<html>` or `<head>`; `src/partials/shell.html` adds them). |
| `src/css/site.css`, `src/js/site.js` | The foundation every page shares. `src/css/<page>.css` and `src/js/<page>.js` are a page's own. |
| `src/css/palette.css` | The app's club colours and their lighter half. Written by `scripts/club-palette.py` from the same numbers the app uses; never edit it by hand. |
| `assets/` | Screenshots of the app at 780 × 1688 (WebP, shot from the app's own build: `tools/shoot.cjs`), the feed film (`feed-demo.mp4` and its poster), the mark, `seq/` (frames of the app in use, for the kit page only) and `photo/` (the photographs and the loops, with their credits). `MANIFEST.json` says what each still shows. |
| `vendor/`, `fonts/` | GSAP and SplitText (ScrollTrigger and Lenis are kept in `vendor/` but no longer loaded); Nosca Serif (the app's title face, Noto Serif Display extra-condensed bold: the same files as `src/fonts/`) for every headline, Instrument Sans (the business card's face) for every other word, and Instrument Serif's italic for the Irish word, the one quotation and the card's caption; all under the Open Font Licence (`OFL-*.txt`). All served from the site itself. Nothing loads from another domain. |
| `tools/` | `shoot.cjs` photographs every app screen the site uses from a mock build of the app, and `stills.py` turns the shots into `assets/*.webp` (`make.cjs` runs both); `feed-demo.cjs` films the app's feed in use; `lib.cjs` and `fixtures/db.cjs` are the harness they stand on (a mock build of the app, the e2e mock seeded with believable people, every lesson carrying the real coaching clips in `fixtures/`: a full swing, a chip, a putt, a forehand, a rider over a pole); `markup-plan.json` is where Mark it up's marks are drawn; `photos.py` writes every photograph's AVIF and every picture's blurred placeholder; `cap.cjs` photographs the built pages; `seq/` makes the image sequences. |
| `site.config.json` | The app's address, the install guide's address and the contact email. |

```
node website/tools/make.cjs stills  # after the app's look changes: a mock build of the app, every still from it (--only home,diary)
node website/tools/feed-demo.cjs    # the feed in use into assets/feed-demo.mp4 (--dist <build> reuses one; --sport tennis|equestrian)
python3 website/tools/photos.py   # AVIF and placeholders for a photograph or loop added to assets/photo/MANIFEST.json
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
- **Colour.** The two printed cards are the art direction: the deep bottle green and the olive, ivory paper (`#FAF7F0`) and a warmer ivory for rest (`#F2ECE0`) in place of white and grey, warm greys for quiet words, and gold only as a line, the seal, a numeral or a few small capitals. Every pair of words and ground reads 4.5:1 or more, on a loop at its brightest too. A sport's colour shows inside its own screen and as the dot beside its name.
- **Type and grid.** Headlines in Nosca Serif, the app's own title face, so the site and the app are one family; every other word Instrument Sans; labels in small capitals tracked wide. One scale, one measure (1240) for the header and every part, and on a desk one grid of twelve columns: the words in the first five, the app, the card and the list's second column from the seventh.
- **Loading.** Everything is on the site itself, and nothing is ever a blank box: each picture stands on its own blurred placeholder (a few hundred bytes inline), photographs come as AVIF or WebP at three widths, each loop's poster is its own first frame (the opening's preloaded), and a loop asks only for its metadata until it is near and starts only when it can play through.
- **Motion.** One mode on every device: the visitor's own scroll, untouched. Nothing is pinned and nothing moves with the scroll; each piece plays once, on its own clock, as it arrives, and nothing moves on after the scroll stops. With Reduce Motion on or JavaScript off the page shows whole and still.
- **The screenshots are the app.** They are shot from the real build against demo data (the names are fictional), every lesson carrying real side-on coaching clips, never a drone shot, and re-shot when the app's look changes (last: 28 November, the bold serif titles and the colour-family keys).

## What the founder can add

- A contact email (`site.config.json`, `contactEmail`): the pilot carries it once it is there. While it is empty no address shows anywhere.
- The story's first beat in his own words: when and where Nosca began, and why.
- A real swing or forehand of his own, filmed with consent, for the clips inside the app's screens. They carry licensed side-on clips today (`tools/fixtures/CREDITS.md`); a clip of his own goes in `tools/fixtures/` under the same name and the stills and the film are taken again.
- His own photographs, if he would rather than the licensed ones (`assets/photo/`, the manifest says which picture stands where).
