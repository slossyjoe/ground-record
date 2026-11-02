import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getFeeds } from "@/lib/data";
import { VERIFICATION_HELP, VERIFICATION_LABEL } from "@/lib/labels";
import type { Verification } from "@/lib/types";

export const metadata: Metadata = { title: "How to read this" };

export default function MethodPage() {
  const feeds = getFeeds();
  return (
    <>
    <SiteHeader />
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Method</p>
      <h1 className="mt-2 font-serif text-4xl">How to read Ground Record</h1>
      <div className="mt-6 space-y-4 text-base leading-7">
        <p>
          The public site opens on a full-screen map of the Russia–Ukraine war. Reports, casualty claims, equipment, and verified media open from that map. Other wars stay in the data files, marked so they do not appear on the front page. The record shows what each source said, with the source’s name and type. It does not decide which side is right, and it does not turn two numbers into one.
        </p>
        <p>
          Headlines come from public feeds. When a headline names a place, a death toll, a weapon count, or a change of control, that headline becomes a situation card. The number on the card is a number written in the headline. The app does not estimate a missing number. Wikipedia infobox lines are quoted and marked Reference. A Sample card remains only for a section that still has no sourced line. A dotted equipment name opens its specifications on this page. A camera pin is a GeoConfirmed photo or video: the file stays on the original post, and the card separates the date GeoConfirmed gives from the posting time, which is not copied here.
        </p>
      </div>

      <h2 className="mt-10 font-serif text-2xl">The four labels</h2>
      <ul className="mt-4 space-y-3">
        {(Object.keys(VERIFICATION_LABEL) as Verification[]).map((level) => (
          <li key={level} className="rounded-md border border-border bg-card p-4">
            <p className="font-medium">{VERIFICATION_LABEL[level]}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{VERIFICATION_HELP[level]}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 font-serif text-2xl">Why both sides are shown</h2>
      <p className="mt-4 leading-7">
        Armies and governments publish loss figures that do not match. A health office and a military may also be counting different people. Ground Record puts those claims next to each other and names who made each one. State news agencies are included on purpose, and their type is printed on the card, so a reader can see a government talking about its own war. They are not treated as neutral confirmation.
      </p>

      <h2 className="mt-10 font-serif text-2xl">Where the live lines come from</h2>
      <p className="mt-4 leading-7">
        Each update reads the feeds in <code>data/feeds.json</code>, asks Wikipedia for a short summary and for the infobox casualty and strength lines, and asks GDELT for recent articles. GDELT asks for one request every few seconds. This app waits, retries once after a pause, and saves the answer so the next run can reuse it. Place pins use the coordinate on the matching Wikipedia page. The Gaza Strip outline is the OpenStreetMap administrative boundary. ReliefWeb, ACLED, and the Uppsala Conflict Data Program stay quiet until you add a free login in <code>.env</code>. None of these is a paid key inside the app.
      </p>
      <ul className="mt-4 space-y-2 text-sm leading-6">
        {feeds.map((feed) => (
          <li key={feed.id}>
            <a href={feed.url}>{feed.name}</a>
            <span className="text-muted-foreground">
              {" "}
              · {feed.type} · {feed.country}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        Wikipedia summaries are other people’s writing. They are shown as quotations, with a link, under the Creative Commons Attribution-ShareAlike license.
      </p>

      <h2 className="mt-10 font-serif text-2xl">Korea</h2>
      <p className="mt-4 leading-7">
        The Korean War stopped with an armistice on 27 July 1953. There was no peace treaty. The page is included for that reason. It does not invent daily battles, daily casualties, or moving front lines. The line on the map is a rough sketch of the Demilitarized Zone for orientation.
      </p>

      <h2 className="mt-10 font-serif text-2xl">The front line</h2>
      <p className="mt-4 leading-7">
        The black line is an estimate built in this project from settlement markers in Wikipedia’s Russo-Ukrainian war map modules, which are published under CC BY-SA. A settlement marked contested, or a close pair of opposing settlements with no other marked settlement between them, pins the line. Those stretches are solid. Where the markers leave a gap, the line is dashed. Cells closer to a Russian-held marker than to a Ukrainian-held marker are tinted. Where two markers sit on opposite banks of the Dnipro, the Donets, or the Oskil, the vertex is moved onto that river’s OpenStreetMap centerline. The slider filters GeoConfirmed pins. It does not move the line, because this record stores one snapshot of the markers. Institute for the Study of War and DeepStateMap geometries are not used.
      </p>
      <p className="mt-4 leading-7">
        Unit symbols use the open-source milsymbol library and the APP-6 / MIL-STD-2525 shapes: a rectangle with an X for infantry, an oval for armor, a dot for artillery, an X and an oval for mechanized infantry, and the echelon marks II, III, and X. A rectangle is the frame used here for a Ukrainian unit. A diamond is the frame used here for a Russian unit. That follows the standard’s friendly and hostile frames so the sides can be told apart. It is not a verdict. A symbol is placed only where a geolocated source names that unit at the footage point. A unit that is only said to have shelled a target is not given the target’s coordinates.
      </p>

      <h2 className="mt-10 font-serif text-2xl">What this version leaves out</h2>
      <p className="mt-4 leading-7">
        Wikipedia’s list of ongoing armed conflicts is longer than the bundled set. Other wars in the data files are kept off the public map by setting <code>listed</code> to false. That is a choice about what this site shows, not a claim that those wars are over.
      </p>

      <h2 className="mt-10 font-serif text-2xl">Adding a conflict or a feed</h2>
      <p className="mt-4 leading-7">
        The list is a file, not code buried in the app. Open <code>data/conflicts.json</code>, copy one conflict’s block, change the id and the words, and copy <code>data/baselines/sudan.json</code> to a new file with the same id. Put sample material in the new file, or leave the lists empty and write a plain note. To follow another outlet, add one block to <code>data/feeds.json</code> with its name, what kind of outlet it is, and the RSS address. Then run the update again.
      </p>
      <p className="mt-4 leading-7">
        Optional logins go in a file named <code>.env</code>, copied from <code>.env.example</code>. ACLED adds dated events with coordinates. ReliefWeb adds humanitarian reports. UCDP adds research-dataset events. The app runs if those lines are empty.
      </p>
    </main>
    <SiteFooter />
    </>
  );
}
