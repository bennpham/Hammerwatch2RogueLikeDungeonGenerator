# In-game boot checklist

Generate a scenario, install it from the app (or with `npm run gen -- --install`), and start it from Hammerwatch 2's scenario list. Tick a row only after seeing it happen in the game, then change the matching DISCOVERY-LOG tag to IN-GAME.

| # | Check | Status |
|---|---|---|
| S1 | The scenario appears in the list once (not twice) after install | UNCHECKED |
| S2 | A new game starts in the town | UNCHECKED |
| P1 | Persistence ON: the character picker offers existing ARPG characters (pool 1000000) | UNCHECKED |
| P2 | Persistence OFF: a fresh character is created and stored in this scenario's save | UNCHECKED |
| T1 | The town loads with floor tiles and an unbroken wall ring, and nobody can walk out | UNCHECKED |
| T2 | Each shop stall opens its shop on use (`ShopArea`), with stock for that tier | UNCHECKED |
| T3 | The potion refill point refills potions | UNCHECKED |
| T4 | The day/night cycle is visible in town (`outside.env`) | UNCHECKED |
| T5 | The descent exit takes the party to floor 1 | UNCHECKED |
| T6 | A band portal is locked until its band has been reached, then works | UNCHECKED |
| F1 | Floor 1 spawns a random room of the chosen theme and size | UNCHECKED |
| F2 | Enemies match the floor's race and tier (`PlaceEnemies`) | UNCHECKED |
| F3 | A secondary (deeper) exit appears, and its heart-key door can be opened | UNCHECKED |
| F4 | The secondary exit leads to floor N+1 and arrives at its entrance | UNCHECKED |
| F5 | A floor's main exit leads back up and arrives at the previous floor's secondary exit | UNCHECKED |
| F6 | The last floor of a band leads back to town (return start) | UNCHECKED |
| F7 | Dying respawns the player at the town respawn point | UNCHECKED |
| F8 | The final floor ends the campaign (`EndOfCampaign`) | UNCHECKED |
