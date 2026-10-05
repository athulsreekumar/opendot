import { ContentPageView } from "@/components/pages/ContentPageView";
import { DOWNLOAD_PAGE } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(DOWNLOAD_PAGE);

export default function DownloadPage() {
	return <ContentPageView page={DOWNLOAD_PAGE} />;
}
