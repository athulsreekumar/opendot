import { serializeJsonLd } from "@/lib/seo";

/** Server component that emits a JSON-LD <script>. The payload is escaped, see serializeJsonLd. */
export function JsonLd({ data }: { data: unknown }) {
	// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD must be raw; "<" is escaped by serializeJsonLd.
	return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
