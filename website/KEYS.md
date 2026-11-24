# The app's keys, as the site draws them

**Where this applies (23 Nov, round two):** inside a vignette of the app (`.app …`) and nowhere else. The site's own
grounds are three (the card's green, white, the rest off-white), its own key is the card's green or white, and no
club colour is a ground, a band, a panel or a heading on a page: `BRIEF.md` §3 and `API.md`. Where this file says
"the site's own UI", read "a vignette".

23 Nov, 17:10 UTC (points 4 and 5 are the app's final rule; the screenshots in `assets/` show it and are the truth where a vignette is in doubt). The founder's newest word; it replaces the "pale glyph tile inside a white tile" part of BRIEF §3 "THE LIGHTER HALF". Everything else in the brief stands.

> "the colors must be visually appealing … I do want fulfilled buttons throughout. I don't want just tiny circles and tiny icons. And the colors don't all need to be saturated dark colors. I want light colors too that also match the same color family. And make sure that it is classy and professional."

So in every vignette of the app, and in the site's own UI where a key appears:

1. **A key is filled.** Never a white tile with a small coloured icon square inside it, never colour that lives only in tiny discs and icons.
2. **The one action of a scene** (Log a lesson, Log it, Register on the live row, Send, Open Nosca) is the sport's DEEP lead: `var(--club-fairway)` for golf, white words, on a ledge a third deeper.
3. **A function key or tile** (the plus sheet's eight, the round keys on a lesson's peek and a player's file, Video · Photo · Voice) is filled with its function's LIGHT colour, the cloth tone `--club-<name>-mid`, with the word and the glyph in `--club-<name>-on` (the same hue, nearly black), on a ledge of `--club-<name>-mid-lip`. Golf's set: Register fairway · Capture navy · Tip gold (its cloth tone like the rest: `--club-gold-mid` with `--club-gold-on`, ledge `--club-gold-mid-lip`; the card's full gold stays for foil, rings and rules) · Drills plum · Add player olive · New group bottle · Competition saddle · Call off brick (its cloth tone with the brick's ink, like its neighbours; the deep brick is only the final destructive confirm on a sheet) · Message fairway · Profile olive · Move saddle · Video claret · Photo navy · Voice saddle.
4. **A quiet key** — a second button beside the action (New group beside Add player, Add to Home Screen beside Open Nosca, Just decline, Cancel · Reschedule) and an option chosen from (a focus area, a time, a day, a reason) — is the lead's PALE: `--club-fairway-tint` face, a ring of `--club-fairway-lip`, ink words, on a ledge a step deeper than the ring. There is no white key in the app any more. On a coloured or dark ground the site's own white key stays.
5. **A chosen answer** is the lead's CLOTH tone, a clear step stronger than the pale it was chosen from: `--club-fairway-mid` face, the word in `--club-fairway-on`, a ring and ledge of `--club-fairway-mid-lip`.
6. **A glyph tile leading a row** (Settings, Actions) and **a face with no picture** are the cloth tone with its ink: `--club-<name>-mid` + `--club-<name>-on`. Never a deep disc with white initials; never a near-white tint that reads as nothing.
7. **On a dark ground:** gold, white, `-mid` and `-tint` only.

The mix on any one screen: one deep key, several light filled keys in different colours of the family, white option keys, and the greys. Light and classy; a heritage paint chart, never a colouring book.

All of these are variables in `src/css/palette.css` (new today: `--club-<name>-on` and `--club-<name>-mid-lip`). The screenshots in `assets/` are being re-shot in this look by the lead under the same filenames.
