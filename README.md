# NextHalf

A football draft game with FIFA 15 style menus. Pick a competition, spin for a random team from it, draft one of their players, then choose where they play. You get **5 free rerolls** per draft. Once your XI is complete, you play the competition match by match.

## Play

No install. Download the folder (on GitHub: Code > Download ZIP, then extract it) and double-click `index.html`. It also works on GitHub Pages as-is.

It's built for phones too: the layout adapts to small screens, works with touch, and respects the notch and home bar. On iPhone or Android you can use Share > Add to Home Screen to launch it like an app.

## Modes

| Competition | 2025/26 | Retro 2014/15 |
| --- | --- | --- |
| Premier League | 20 clubs, one round of fixtures (19 matchdays) | 20 clubs from 2014/15 |
| Champions League | 36 clubs, 8-game league phase, play-off, then knockouts | 32 clubs, 8 groups of 4, then knockouts |
| World Cup | 16 nations, 4 groups, then knockouts | 2014 squads |

Your XI takes the place of the lowest-rated team in the competition.

## How it works

- **Draft:** spin, land on a team, pick a player, then tap a spot on the pitch. Green spots are natural (full rating), amber are similar (-3), red are out of position (-10).
- **Rerolls:** 5 per draft, free. A reroll re-spins the team for the current pick.
- **Team rating** is the average of your XI after position penalties. There's no chemistry.
- **Matches:** play live (about a minute per match at normal speed, with commentary, a ball tracker and other scores coming in), or quick sim / sim to the end. Speed can be set to slow, normal or fast, and you can pause.
- **Coins:** earned from every match (win 100, draw 40, loss 15) plus 1,000 for a trophy.
- **Store:** extra reroll packs (with coins or money) that kick in after your 5 free rerolls, and Remove Ads. Purchases currently run in demo mode: nothing is charged. Real billing needs a payment provider (for example Stripe) and a small server, or app store billing if NextHalf is wrapped as a phone app; the hook for it is `buy()` in `js/app.js`.
- **Ads:** banner slots on the season and match screens show NextHalf's own promos until a real ad network is connected. Remove Ads hides them.
- Results, coins and purchases are saved in the browser (local storage), per device.

Keyboard: arrows to move, Enter to select, Esc to go back, S to spin, R to reroll, P to pause a match, Q / E to switch tabs.

## Files

- `index.html` page shell
- `css/style.css` FIFA 15 style theme (and the retro theme)
- `js/data.js` formations and position rules
- `js/data-now.js` 2025/26 clubs and nations
- `js/data-retro.js` 2014/15 clubs and nations
- `js/app.js` draft, season and match logic

Player ratings are rough estimates for the game, not official data. Edit the data files to update squads or ratings.
