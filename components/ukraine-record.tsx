import { MapDesk } from "@/components/map-desk";
import catalog from "@/data/equipment.json";
import type { Equipment } from "@/lib/equipment";
import { fallbackReport, getBaseline, getConflict, getFlot, getMedia, getReport, getUnits, reportDates } from "@/lib/data";

export function UkraineRecord({ date }: { date?: string | null }) {
  const conflict = getConflict("russia-ukraine");
  if (!conflict) {
    return <main className="mx-auto max-w-3xl px-4 py-16">The Russia–Ukraine record is missing from the data file.</main>;
  }
  const report = (date ? getReport(conflict.id, date) : getReport(conflict.id)) ?? fallbackReport(conflict);
  const baseline = report.baseline ?? getBaseline(conflict.id);
  if (!baseline) {
    return <main className="mx-auto max-w-3xl px-4 py-16">The daily file has not been built yet. Run node scripts/run.mjs.</main>;
  }
  const newest = reportDates()[0];
  return (
    <MapDesk
      conflict={conflict}
      report={report}
      baseline={baseline}
      dates={reportDates().filter((day) => getReport(conflict.id, day))}
      activeDate={date ?? null}
      media={!date || date === newest ? getMedia(conflict.id) : []}
      catalog={catalog as Equipment[]}
      flot={getFlot(conflict.id)}
      units={getUnits(conflict.id)}
      latestHref="/"
    />
  );
}
