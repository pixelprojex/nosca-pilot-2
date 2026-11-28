# Fixtures: real coaching clips for the app's own screens

The clips a player's lessons carry when the website's pictures of the app are made (`tools/feed-demo.cjs`, and the
screenshots once they are re-shot): real sport, filmed the way a coach films it on a phone, never from a drone. No
face is the subject of any of them, and nobody in them is named or presented as a Nosca coach, player or customer:
inside the app the lesson belongs to a demo player with a fictional name. VP9 webm (the browser the pictures are made
in plays no H.264), no sound, the phone's own colours; each `.jpg` is a still of its clip, used as a lesson's photo.

| Files | What it is | Source | Author | Licence | Fetched | What was done |
|---|---|---|---|---|---|---|
| `swing.webm`, `swing.jpg` | A full swing on a fairway, filmed upright at hip height, the golfer from the shoulders down; 8 s, 720 × 1280 | https://www.pexels.com/video/man-playing-golf-6541846/ | Kampus Production | Pexels Licence (https://www.pexels.com/license/) | 2026-11-28 | the first 8 s, 720 wide, sound removed |
| `chip.webm`, `chip.jpg` | An iron behind the ball in the rough, then the chip; 8 s, 720 × 1280 | https://www.pexels.com/video/close-up-shot-of-a-person-playing-golf-6541671/ | Kampus Production | Pexels Licence | 2026-11-28 | the first 8 s, sound removed |
| `putt.webm`, `putt.jpg` | A putting stroke filmed low, side-on to the ball, feet and putter; 8 s, 1280 × 720 | https://www.pexels.com/video/a-person-playing-golf-9362374/ | Mikhail Nilov | Pexels Licence | 2026-11-28 | 8 s from 2 s, 1280 wide, sound removed |
| `forehand.webm`, `forehand.jpg` | Forehands from the baseline of an indoor clay court, side-on; 6 s, 1280 × 676 | https://www.pexels.com/video/a-man-playing-tennis-5740603/ | cottonbro studio | Pexels Licence | 2026-11-28 | the first 6 s, 1280 wide, sound removed (the player is small in the frame; a venue's lettering stands on the back wall) |
| `rider.webm`, `rider.jpg` | A rider and a grey horse over a pole of a practice fence, head-on; 6 s, 1280 × 720 | https://mixkit.co/free-stock-video/equestrian-jumping-a-horse-over-obstacles-45835/ | utaem2022 / Mixkit | Mixkit Stock Video Free License (https://mixkit.co/license/#videoFree) | 2026-11-28 | the whole clip, sound removed |

The mock build's clip for the app's e2e suites stays `scripts/e2e/fixtures/clip.webm`; these are for the website only.
