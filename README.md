# Draft 15

A football draft game with FIFA 15 style menus. Spin for a random club or national team, pick one of their players for each spot in your XI, and use your **5 free rerolls** whenever you don't like the team you landed on. Then take the squad through a knockout tournament.

## Play

No build step. Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
```

It also works as-is on GitHub Pages (Settings > Pages > deploy from branch, root folder).

## How it works

- **Setup:** pick a team pool (clubs, nations, or both) and a formation (4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 5-3-2).
- **Draft:** each empty spot gets a spin. You land on a team and choose one of its players. Tap any empty spot to change which position you're filling.
- **Rerolls:** 5 per draft, free. A reroll re-spins the team for the current pick.
- **Positions:** natural = full rating, similar position = -3 OVR, out of position = -10 OVR and no chemistry.
- **Chemistry:** up to 3 per player (33 max) from shared club, league and nation (FUT style thresholds).
- **Tournament:** Quarter-Final, Semi-Final and Final against real squads. Draws go to penalties. Results are saved under My Squads (browser local storage).

Keyboard: arrows to move, Enter to select, Esc to go back, S to spin, R to reroll, Q / E to switch tabs.

## Files

- `index.html` page shell
- `css/style.css` FIFA 15 style theme
- `js/data.js` teams, players, formations, position rules (edit this to add teams or update ratings)
- `js/app.js` game logic and screens

Player ratings are rough estimates for the game, not official data.
