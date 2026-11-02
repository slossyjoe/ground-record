import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <>
    <SiteHeader />
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-serif text-4xl">That page is not in the record.</h1>
      <p className="mt-4 text-lg leading-8">
        The conflict id in the address does not match a file in the conflict list.
      </p>
      <p className="mt-4">
        <Link href="/">Back to the map</Link>
      </p>
    </main>
    </>
  );
}
