# Ground Record

Ground Record is a small news desk for **active armed conflicts**. It keeps the source on every claim. It does not pick a side, and it does not turn two rival numbers into one “official” number.

You do not need to know how to code to run it.

The public site opens on a full-screen map of the **Russia–Ukraine** war. Headlines, casualty claims, equipment, and verified media open from the map. Other wars remain in `data/conflicts.json` with `"listed": false`. Set a war’s `listed` field to `true` when you want it rebuilt, then run the update with `UPDATE_ALL=1`.

## Run it on your computer

1. Install Node.js 20 or newer from [https://nodejs.org](https://nodejs.org) if you do not have it. To check, open a terminal and type `node -v`.
2. Open a terminal in this project folder. On Mac, that is often Terminal. On Windows, that is Command Prompt or PowerShell.
3. Type this and press Enter:

```bash
node scripts/run.mjs
```

The first time, it downloads the app’s libraries and then collects public headlines. That can take a few minutes. Leave the window open.

4. In your browser, open [http://localhost:4317](http://localhost:4317).

Press Ctrl+C in the terminal when you want to stop. Start it again later with the same command. The command refreshes the Ukraine record and then opens the site.

## Put it on the web, so a phone can open it

The site is a folder of plain pages. No database and no account are required to read it.

Recommended host: **GitHub Pages**. It is free, it has a normal web address, and it works in a phone browser. A small script in this project can rebuild the pages every day.

The public address is [https://slossyjoe.github.io/ground-record/](https://slossyjoe.github.io/ground-record/).

What you have to do:

1. Create a free account at [https://github.com](https://github.com) if you do not have one.
2. Create a new public repository and put this project in it.
3. In the repository, open Settings, then Pages, and choose **GitHub Actions** as the source.
4. Open the Actions tab and run the workflow named “Daily record” once. After that it runs every day at 06:00 UTC, and also whenever the main branch is updated.

The workflow sets `NEXT_PUBLIC_BASE_PATH` to `/ground-record` so the pages, pictures, map style, and unit symbols load from that address. Leave that variable empty when you run the site on your own computer.

Nothing else is required. You do not need a paid map key, a server, or an ACLED account. The workflow file is `.github/workflows/pages.yml`.

To build the pages yourself without GitHub, run `npm run build`. The finished site is the `out` folder. Any host that serves static files can use that folder.

## Sources used for Russia–Ukraine, and sources left out

Used, with the outlet’s type shown on each card: BBC, The Kyiv Independent, Kyiv Post, Ukrainska Pravda, Euromaidan Press, The New Voice of Ukraine, Meduza, Ukrinform (Ukrainian state), TASS (Russian state), Guardian, France 24, Deutsche Welle, NPR, Al Jazeera, UN News, the UN Human Rights Office feed, International Crisis Group, and GDELT when it answers. Wikipedia infobox lines and place coordinates are quoted. Mediazona’s public page description is quoted as a named-death count, not as an official total. GeoConfirmed’s public API supplies recent verified photo and video pins. The app links to the original post and does not download the file.

Left out because of terms or because no open feed exists:

- Institute for the Study of War and DeepStateMap control lines. Their terms do not allow copying the files into this map. The line on the map is calculated here from Wikipedia settlement markers and, where the markers sit on opposite banks, OpenStreetMap river centerlines.
- Oryx’s visually confirmed equipment lists. The site is a compiled catalog. Copying the whole list into this app would republish their work. Equipment here is only what a headline or a Wikipedia article names.
- Telegram channels, including the General Staff and the Russian Ministry of Defence. The preview pages load, but Telegram’s terms restrict automated collection. Their claims still appear when Ukrinform or TASS publishes them, and those cards are labeled state media.
- Reuters and AP. No working public RSS feed was available.
- ACLED and UCDP. They need a free account. Leave them blank, or add them in `.env` later.

## What you should see

- A full-screen map. The black line is a front estimate: solid where settlement markers pin it down, dashed where it is interpolated. The tint is the side closer to a Russian-held marker. Click a stretch for the settlements and sources behind it.
- Unit symbols in the APP-6 shapes (infantry, armor, artillery, and the rest). A symbol appears only where a geolocated source names that unit. Click it for the date, the caption, and the sources.
- A side panel, or a bottom sheet on a phone, with the day’s headlines, casualty claims, and equipment. The maps use [OpenFreeMap](https://openfreemap.org/) tiles. They do not need a key.
- Charts: one from the articles just fetched, and one that is clearly marked as a sample.
- Labels on every claim: who said it, the source, and how well it is checked.

At least the Ukraine, Sudan, and Gaza pages are filled in enough to click around. The other bundled conflicts use the same layout.

## What is real, and what is a sample

**Real, when the update can reach the internet**

- Headlines from the feeds listed in `data/feeds.json` (BBC, Al Jazeera, The Guardian, France 24, Deutsche Welle, NPR, UN News, International Crisis Group, Africanews, South China Morning Post, The Irrawaddy, Yonhap, Ukrinform, TASS, and Middle East Eye). ReliefWeb’s public RSS address did not return a usable feed without an approved app name, so it is not in the default list. The API is still supported if you add `RELIEFWEB_APPNAME`.
- Extra article links from [GDELT](https://www.gdeltproject.org/), which is free and does not need a key. The update waits several seconds between GDELT calls, retries once after a longer pause, and saves the answer so the next run can reuse it.
- Situation cards built from those headlines. A death toll, weapon count, or “seized / control” line is copied from the headline. If the number is not in the headline, the card does not invent one. The place pin uses the Wikipedia coordinate for a place the headline names.
- The background paragraph and the infobox casualty and strength lines, quoted from Wikipedia, under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- The Gaza Strip outline from OpenStreetMap, under the Open Database License. It is a boundary for orientation, not a control map.
- Reference pins for a few bases whose Wikipedia pages describe them as bases. They are not a report that anyone moved.

**Not used, because of the terms**

- Institute for the Study of War / Critical Threats Project control lines and shapefiles, including a copy hosted by a UN map server. Their terms require written permission before the files are copied into another map.
- DeepStateMap’s occupied-territory files and API. Their license limits redistribution. A third-party GitHub mirror of those files was not used either.

**Still sample**

- A Sample card remains only in a section where no headline and no infobox line was found. It is marked **Sample**. Do not quote it as news.
- The rough Korean Demilitarized Zone line is **Reference** geometry drawn for orientation. It is not a surveyed boundary and it is not a claim that the line moved.

If a feed fails, the site still opens and the bottom of each daily page says what failed.

## How a daily update works

`node scripts/run.mjs` calls `scripts/update-reports.mjs`, which:

1. Reads the conflict list and the feed list.
2. Downloads each feed and keeps articles whose titles match that conflict’s words.
3. Asks Wikipedia for a short summary and for infobox casualty and strength lines.
4. Asks GDELT for recent articles, waiting between calls and saving the answer.
5. Groups headlines about the same story, then copies figures and place names from those headlines onto the map and into the situation sections.
6. If you added optional logins, also asks ReliefWeb, ACLED, or UCDP.
7. Saves one file per conflict for today’s date in `data/reports/`, and a copy in `data/reports/latest/`.

The site reads those files. It does not need a database.

Matching titles from two different outlets can be marked **Multiple outlets**. That means the claim was widely published. It does not mean someone confirmed it on the ground.

State outlets, including Ukrinform and TASS, are included on purpose. Their type is printed on the card so you can see a government speaking about its own war.

## The labels

| Label | Meaning |
| --- | --- |
| Multiple outlets | More than one outlet in this pull published a closely matching account. |
| Single source | Only one outlet in this pull is carrying it. |
| Disputed | The accounts disagree. Both are shown. The page does not pick one. |
| Unverified | No independent check is attached. Sample cards are always unverified. |

There is a fuller explanation at [http://localhost:4317/method](http://localhost:4317/method) while the app is running.

## Korea

The Korean page is an **armistice**, not a day of battles. Fighting stopped on 27 July 1953 without a peace treaty, which is why it is on the list. The page does not invent daily casualties or troop movements.

## How the conflict list was chosen

The bundled list starts from wars the owner named (Ukraine, Gaza and Lebanon, Sudan, Myanmar, the Sahel, eastern DR Congo, Yemen and the Red Sea, and Korea) and from [Wikipedia’s list of ongoing armed conflicts](https://en.wikipedia.org/wiki/List_of_ongoing_armed_conflicts), including Somalia, Ethiopia, Syria’s later clashes, and the war Wikipedia describes between Iran, Israel, and the United States.

That Wikipedia list is longer. Nigeria, Haiti, Afghanistan, Pakistan, and others are not separate pages yet. You can add them. Leaving them out is a limit of this version, not a statement that they are over.

## Add a conflict

1. Open `data/conflicts.json`.
2. Copy one whole conflict block, including the curly braces.
3. Change `"id"` to a short name with dashes, such as `"nigeria"`. Change the name, the one-sentence description, the parties, and the words under `"matchTerms"`. Those words decide which headlines belong on the page. Use specific words. `"niger"` is safer than `"nigeria"` only if you mean the country Niger; the matcher does not treat `niger` as `nigeria`.
4. Copy `data/baselines/sudan.json` to `data/baselines/nigeria.json` (use your new id).
5. Replace the sample sentences, or empty the lists and leave a note that says you have no structured report yet.
6. Run `node scripts/run.mjs` again.

Party colors only separate groups on the map. They are not a verdict.

## Add a news feed

Open `data/feeds.json` and add a block:

```json
{
  "id": "my-paper",
  "name": "Name people will see",
  "type": "Private newspaper",
  "country": "Country",
  "url": "https://example.com/rss.xml"
}
```

Use a plain description of the outlet in `"type"`, such as `State news agency` or `Public broadcaster`. Then run the update again.

## Optional datasets (no key required to run the app)

Copy `.env.example` to a file named `.env` in this folder. Fill in only what you have. Do not share that file.

- **ACLED** — event locations and fatality counts. Create a free myACLED login, then set `ACLED_EMAIL` and `ACLED_PASSWORD`. Guide: [https://acleddata.com/api-documentation/getting-started](https://acleddata.com/api-documentation/getting-started)
- **ReliefWeb** — humanitarian reports. Request an app name and set `RELIEFWEB_APPNAME`. Guide: [https://apidoc.reliefweb.int/parameters#appname](https://apidoc.reliefweb.int/parameters#appname)
- **UCDP** — Uppsala’s conflict dataset. Request a token and set `UCDP_ACCESS_TOKEN`. Guide: [https://ucdp.uu.se/apidocs/](https://ucdp.uu.se/apidocs/)

If these are blank, the update says “not configured” and continues. Events that do come back are labeled as that dataset, single source, and they are not mixed into the sample casualty chart.

## If something goes wrong

- `node` is not recognized: install Node.js and open a new terminal.
- The page opens but headlines are empty: scroll to “What this pull did” on a conflict page. A feed may have blocked the request. The sample sections still show.
- Port 4317 is already in use: stop the other window with Ctrl+C, or change the port at the bottom of `scripts/run.mjs` (the number `4317` appears once).

## Project layout

- `app/` — the pages
- `data/conflicts.json` — the list of wars
- `data/baselines/` — sample and reference situation files
- `data/feeds.json` — public RSS feeds
- `data/reports/` — saved daily pulls
- `scripts/update-reports.mjs` — the collector
- `scripts/run.mjs` — the one command that installs, updates, and starts the site
