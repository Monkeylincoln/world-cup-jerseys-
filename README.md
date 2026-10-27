# NextHalf

A football draft game with FIFA 15 style menus. Pick a competition, spin for a random team from it, draft one of their players, then choose where they play. You get **3 free rerolls** per draft. Once your XI is complete, you play the competition match by match.

## Play

No install. Download the folder (on GitHub: Code > Download ZIP, then extract it) and double-click `index.html`. It also works on GitHub Pages as-is.

It's built for phones too: the layout adapts to small screens, works with touch, and respects the notch and home bar. On iPhone or Android you can use Share > Add to Home Screen to launch it like an app.

## Modes

| Competition | 2026/27 (FC 27 ratings) | Retro 2014/15 (FIFA 15 ratings) |
| --- | --- | --- |
| Premier League | 20 clubs, one round of fixtures (19 matchdays) | 20 clubs from 2014/15 |
| Champions League | 36 clubs, 8-game league phase, play-off, then knockouts | 32 clubs, 8 groups of 4, then knockouts |
| World Cup | 16 nations, 4 groups, then knockouts | 2014 squads |

Your XI takes the place of the lowest-rated team in the competition.

## How it works

- **Draft:** spin, land on a team, pick a player, then tap a spot on the pitch. Like Golazo, only players whose position you still need show up; anyone for a spot you've already filled is hidden. Green spots are natural (full rating), amber are similar (-3, only for players whose position isn't in your formation).
- **Rerolls:** 3 per draft, free. Rerolls you buy simply add to that count.
- **Team rating** is the average of your XI after position penalties. There's no chemistry.
- **Matches:** play live (about a minute per match at normal speed, with commentary, a ball tracker and other scores coming in), Quick Sim fast-forwards through the match in a few seconds, and Sim To End plays out the rest of the season instantly. Speed can be set to slow, normal or fast, and you can pause.
- **Coins:** earned only from season results: 500 for winning the Champions League, World Cup or Premier League, 200 for reaching a final, 100 for a semi-final or a Premier League top 4. Nothing per match.
- **Store:** rerolls (with coins or money), coin packs, and Remove Ads. Purchases currently run in demo mode: nothing is charged. Real billing needs a payment provider (for example Stripe) and a small server, or app store billing if NextHalf is wrapped as a phone app; the hook for it is `buy()` in `js/app.js`.
- **Ads:** banner slots on the season and match screens show NextHalf's own promos until a real ad network is connected. Remove Ads hides them.
- **Continue Draft:** the draft and season in progress are saved after every change, so closing the page (or a crash) never loses them.
- **Leaderboard:** My Squads ranks your finished drafts best-first (trophies, then how far you went, then rating). Tap one to see its XI.
- Results, coins, purchases and the draft in progress are saved in the browser (local storage), per device.

Keyboard: arrows to move, Enter to select, Esc to go back, S to spin, R to reroll, P to pause a match, Q / E to switch tabs.

## Files

- `index.html` page shell
- `css/style.css` FIFA 15 style theme (and the retro theme)
- `js/data.js` formations and position rules
- `js/data-now.js` 2026/27 clubs and nations (generated, see below)
- `js/data-retro.js` 2014/15 clubs and nations
- `js/app.js` draft, season and match logic

## Ratings

- **2026/27** squads and ratings come from EA SPORTS FC 27 (EA's official ratings data, snapshot 2026-09-12, via the community dataset [LakshmiKanth11/EA_FC_ANALYSIS](https://github.com/LakshmiKanth11/EA_FC_ANALYSIS)). Each club gets its top 16 players balanced by position; national teams take the best players of that nationality. The Premier League is the real 2026/27 division and the Champions League is the 2026/27 field, minus Sabah and Slovan Bratislava, which are not in FC 27. Regenerate with `python3 tools/gen_now.py <players.csv> js/data-now.js`.
- **Retro 2014/15** uses FIFA 15 ratings: launch Ultimate Team ratings ([kafagy/fifa-FUT-Data](https://github.com/kafagy/fifa-FUT-Data)), with keepers and a few missing players from FIFA 15 season data ([lbenz730/fifa_model](https://github.com/lbenz730/fifa_model)). Clubs and leagues that were not in FIFA 15 (Ludogorets, APOEL, Maribor, BATE, a few national-team-only players) keep estimated ratings. `tools/match.py` and `tools/alias_retro.json` do the name matching.
- The special TOTY card design is limited to the 13 players listed under `toty` in each data file.
