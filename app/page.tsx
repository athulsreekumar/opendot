import { AlwaysOn } from "@/components/sections/AlwaysOn";
import { AnyModel } from "@/components/sections/AnyModel";
import { Connections } from "@/components/sections/Connections";
import { CreateDot } from "@/components/sections/CreateDot";
import { DotLinks } from "@/components/sections/DotLinks";
import { FinalCta } from "@/components/sections/FinalCta";
import { Hero } from "@/components/sections/Hero";
import { OpenSource } from "@/components/sections/OpenSource";
import { Privacy } from "@/components/sections/Privacy";
import { Statement } from "@/components/sections/Statement";
import { Streaming } from "@/components/sections/Streaming";
import { SuperBot } from "@/components/sections/SuperBot";
import { FEATURES } from "@/lib/features";

export default function Home() {
	return (
		<>
			<Hero />
			<Statement />
			<CreateDot />
			<AlwaysOn />
			<SuperBot />
			<DotLinks />
			<Privacy />
			<AnyModel />
			<Connections />
			<Streaming />
			{FEATURES.openSource && <OpenSource />}
			<FinalCta />
		</>
	);
}
