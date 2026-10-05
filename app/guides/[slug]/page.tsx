import { notFound } from "next/navigation";
import { ContentPageView } from "@/components/pages/ContentPageView";
import { GUIDE_PAGES } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

const find = (slug: string) => GUIDE_PAGES.find((p) => p.path === `/guides/${slug}`);

export function generateStaticParams() {
	return GUIDE_PAGES.map((p) => ({ slug: p.path.split("/").pop() as string }));
}

export async function generateMetadata({ params }: Props) {
	const page = find((await params).slug);
	return page ? pageMetadata(page) : {};
}

export default async function GuidePage({ params }: Props) {
	const page = find((await params).slug);
	if (!page) notFound();
	return <ContentPageView page={page} />;
}
