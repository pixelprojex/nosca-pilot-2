/* THE SIX SPORTS' AREAS — what a coach worked on in a lesson, one per
   area, verified against each sport's governing body (see CLAUDE.md:
   "Every sport's taxonomy is the real one"). Moved here verbatim from
   SPORTS in Nosca.jsx so that the app, the import function and the
   database read one list: scripts/import-areas-sql.mjs writes the
   import_areas block of supabase/nosca.sql from it, and `npm run check`
   fails when the two differ. Plain data, no imports: node reads it too. */
export const FOCUS = {
  golf: [
    { id: "swing", label: "Full swing", subs: ["Driver", "Fairway woods", "Hybrids", "Irons", "Wedges", "Ball striking", "Setup"] },
    { id: "pitch", label: "Pitching", subs: ["Distance control", "Trajectory", "Spin"] },
    { id: "chip", label: "Chipping", subs: ["Contact", "Landing spot", "Club choice"] },
    { id: "bunker", label: "Bunker play", subs: ["Greenside", "Fairway bunker", "Plugged lies"] },
    { id: "putt", label: "Putting", subs: ["Stroke", "Green reading", "Pace", "Short putts"] },
    { id: "course", label: "On course", subs: ["Playing lesson", "Course management", "Strategy", "Club selection"] },
    { id: "mental", label: "Mental game", subs: ["Routine", "Commitment", "Pressure"] },
    { id: "fitness", label: "Fitness", subs: ["Mobility", "Speed", "Stability"] },
    { id: "fitting", label: "Custom fitting", subs: ["Driver", "Irons", "Putter"] },
  ],
  tennis: [
    { id: "serve", label: "Serve", subs: ["First serve", "Second serve", "Toss", "Placement"] },
    { id: "return", label: "Return", subs: ["First-serve return", "Second-serve return", "Chip and charge"] },
    { id: "fh", label: "Forehand", subs: ["Topspin", "Slice", "Inside-out", "Contact point"] },
    { id: "bh", label: "Backhand", subs: ["Two-handed", "One-handed", "Slice", "Contact point"] },
    { id: "net", label: "Net game", subs: ["Volley", "Smash", "Approach", "Drop shot", "Lob"] },
    { id: "rally", label: "Rally", subs: ["Depth", "Height over the net", "Direction", "Consistency"] },
    { id: "move", label: "Movement", subs: ["Split step", "Footwork", "Recovery", "Court coverage"] },
    { id: "match", label: "Match play", subs: ["Tactics", "Point construction", "Physical", "Mental"] },
  ],
  rowing: [
    { id: "technique", label: "Technique", subs: ["Catch", "Drive", "Finish", "Recovery", "Blade work", "Balance"] },
    { id: "rhythm", label: "Rhythm & rating", subs: ["Ratio", "Rate", "Sequencing", "Length"] },
    { id: "racing", label: "Racing", subs: ["Starts", "Pieces", "Pacing", "Steering"] },
    { id: "erg", label: "Erg", subs: ["2k test", "5k", "30 min r20", "UT2", "UT1", "AT", "TR", "AN"] },
    { id: "sc", label: "S&C", subs: ["Weights", "Circuits", "Core", "Cross-training"] },
  ],
  squash: [
    { id: "drives", label: "Drives", subs: ["Straight drive", "Cross-court", "Length", "Width"] },
    { id: "volleys", label: "Volleys", subs: ["Straight volley", "Cross-court volley", "Taking it early"] },
    { id: "serve", label: "Serve & return", subs: ["Serve", "Return of serve"] },
    { id: "front", label: "Front court", subs: ["Drop", "Boast", "Lob", "Kill"] },
    { id: "move", label: "Movement", subs: ["Ghosting", "The T", "Footwork"] },
    { id: "tactics", label: "Tactics", subs: ["Length & width", "Pressure", "Court craft"] },
    { id: "physical", label: "Physical & mental", subs: ["Fitness", "Mental"] },
    { id: "games", label: "Games", subs: ["Conditioned games", "Match play", "Solo practice"] },
  ],
  padel: [
    { id: "net", label: "Net game", subs: ["Volleys", "Net position", "Transitions"] },
    { id: "overhead", label: "Overheads", subs: ["Bandeja", "Víbora", "Smash"] },
    { id: "lob", label: "Lob", subs: ["Defensive lob", "Attacking lob"] },
    { id: "wall", label: "Back wall", subs: ["Off the back wall", "Side wall", "Double wall"] },
    { id: "chiquita", label: "Chiquita", subs: ["Placement", "Approach"] },
    { id: "serve", label: "Serve & return", subs: ["Serve", "Return", "Serve & volley"] },
    { id: "defence", label: "Defence & tactics", subs: ["Back-court defence", "Tactics", "Footwork"] },
    { id: "match", label: "Match play", subs: ["Points", "Pairs", "Americano"] },
  ],
  equestrian: [
    { id: "flat", label: "Flatwork", subs: ["Walk", "Trot", "Canter", "Transitions", "Contact", "Bend", "Lateral work"] },
    { id: "dressage", label: "Dressage", subs: ["Test riding", "Centre line", "Circles & serpentines", "Accuracy"] },
    { id: "poles", label: "Pole work", subs: ["Trotting poles", "Canter poles", "Cavaletti"] },
    { id: "grid", label: "Gridwork", subs: ["Placing pole", "Cross", "One stride", "Related distances"] },
    { id: "sj", label: "Showjumping", subs: ["Course work", "Related distances", "Turns", "Rhythm"] },
    { id: "xc", label: "Cross-country", subs: ["Schooling", "Ditches & water", "Banks", "Undulating ground"] },
    { id: "hack", label: "Hacking", subs: ["Road sense", "Open ground"] },
    { id: "lunge", label: "Lunge", subs: ["Lunge lesson", "Long reining"] },
    { id: "seat", label: "Position & seat", subs: ["Rising trot", "Light seat", "Without stirrups", "Balance"] },
    { id: "care", label: "Horse care", subs: ["Tacking up", "Grooming", "Feeding", "Yard"] },
  ],
};
