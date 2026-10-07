import { AlwaysOn } from "@/components/sections/AlwaysOn";
import { AnyModel } from "@/components/sections/AnyModel";
import { Connections } from "@/components/sections/Connections";
import { CreateDot } from "@/components/sections/CreateDot";
import { DotLinks } from "@/components/sections/DotLinks";
import { Faq } from "@/components/sections/Faq";
import { FinalCta } from "@/components/sections/FinalCta";
import { Hero } from "@/components/sections/Hero";
import { OpenSource } from "@/components/sections/OpenSource";
import { Organisation } from "@/components/sections/Organisation";
import { Privacy } from "@/components/sections/Privacy";
import { Statement } from "@/components/sections/Statement";
import { Streaming } from "@/components/sections/Streaming";
import { SuperBot } from "@/components/sections/SuperBot";
import { JsonLd } from "@/components/seo/JsonLd";
import { FEATURES } from "@/lib/features";
import { homeJsonLd } from "@/lib/seo";

export default function Home() {
	return (
		<>
			<JsonLd data={homeJsonLd()} />
			<Hero />
			<Statement />
			<CreateDot />
			<Organisation />
			<AlwaysOn />
			<SuperBot />
			<DotLinks />
			<Privacy />
			<AnyModel />
			<Connections />
			<Streaming />
			{FEATURES.openSource && <OpenSource />}
			<Faq />
			<FinalCta />
		</>
	);
}
