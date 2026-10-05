import { notFound } from "next/navigation";
import { isPoseName } from "@/components/mascot/poses";
import { DevOdi } from "./DevOdi";

export const dynamic = "force-dynamic";
export const metadata = { title: "Odi showcase (dev)", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
	// Dev-only route. ENABLE_DEV_ODI=1 lets us screenshot it against a production build (never set on deploy).
	if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_ODI !== "1") notFound();
	const sp = await searchParams;
	const render = isPoseName(sp.render) ? sp.render : sp.render === "head" ? "head" : null;
	const size = Math.min(Math.max(Number(sp.size) || 1024, 64), 2048);
	return <DevOdi render={render} size={size} />;
}
