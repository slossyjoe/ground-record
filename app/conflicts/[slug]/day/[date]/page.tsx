import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/report-view";
import { UkraineRecord } from "@/components/ukraine-record";
import catalog from "@/data/equipment.json";
import type { Equipment } from "@/lib/equipment";
import { getBaseline, getConflict, getConflicts, getMedia, getReport, reportDates } from "@/lib/data";

export function generateStaticParams() {
  const params: { slug: string; date: string }[] = [];
  for (const conflict of getConflicts()) {
    for (const date of reportDates()) {
      if (getReport(conflict.id, date)) params.push({ slug: conflict.id, date });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; date: string }>;
}): Promise<Metadata> {
  const { slug, date } = await params;
  const conflict = getConflict(slug);
  return { title: conflict ? `${conflict.name} · ${date}` : "Record" };
}

export default async function DayPage({
  params,
}: {
  params: Promise<{ slug: string; date: string }>;
}) {
  const { slug, date } = await params;
  const conflict = getConflict(slug);
  const report = conflict ? getReport(conflict.id, date) : null;
  if (!conflict || !report) notFound();
  const baseline = report.baseline ?? getBaseline(conflict.id);
  if (!baseline) notFound();
  if (conflict.id === "russia-ukraine") return <UkraineRecord date={date} />;
  return (
    <ReportView
      conflict={conflict}
      report={report}
      baseline={baseline}
      dates={reportDates().filter((day) => getReport(conflict.id, day))}
      activeDate={date}
      usingArchive
      media={date === reportDates()[0] ? getMedia(conflict.id) : []}
      catalog={catalog as Equipment[]}
      latestHref={conflict.id === "russia-ukraine" ? "/" : `/conflicts/${conflict.id}`}
    />
  );
}
