import { ContentPageView } from "@/components/pages/ContentPageView";
import { FEATURES_HUB } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(FEATURES_HUB);

export default function FeaturesPage() {
	return <ContentPageView page={FEATURES_HUB} />;
}
