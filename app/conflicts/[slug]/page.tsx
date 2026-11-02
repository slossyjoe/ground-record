import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/report-view";
import { UkraineRecord } from "@/components/ukraine-record";
import catalog from "@/data/equipment.json";
import type { Equipment } from "@/lib/equipment";
import { fallbackReport, getBaseline, getConflict, getConflicts, getMedia, getReport, reportDates } from "@/lib/data";

export function generateStaticParams() {
  return getConflicts().map((conflict) => ({ slug: conflict.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const conflict = getConflict(slug);
  return { title: conflict?.name ?? "Record" };
}

export default async function ConflictPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const conflict = getConflict(slug);
  if (!conflict) notFound();
  const report = getReport(conflict.id) ?? fallbackReport(conflict);
  const baseline = report.baseline ?? getBaseline(conflict.id);
  if (!baseline) notFound();
  if (conflict.id === "russia-ukraine") return <UkraineRecord />;
  return (
    <>
      {conflict.listed === false ? (
        <p className="mx-auto max-w-6xl px-4 pt-6 text-sm text-muted-foreground">
          This war is kept in the data files and is not on the public front page. The site currently shows the Russia–Ukraine record.
        </p>
      ) : null}
      <ReportView
        conflict={conflict}
        report={report}
        baseline={baseline}
        dates={reportDates().filter((date) => getReport(conflict.id, date))}
        activeDate={null}
        usingArchive={false}
        media={getMedia(conflict.id)}
        catalog={catalog as Equipment[]}
        latestHref={conflict.id === "russia-ukraine" ? "/" : `/conflicts/${conflict.id}`}
      />
    </>
  );
}
