import { ContentPageView } from "@/components/pages/ContentPageView";
import { GUIDES_HUB } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(GUIDES_HUB);

export default function GuidesPage() {
	return <ContentPageView page={GUIDES_HUB} />;
}
