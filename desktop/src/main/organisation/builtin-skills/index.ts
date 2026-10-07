// All built-in skills, as typed modules (no loose markdown files to package).
import { ADMIN_SKILLS } from "./admin";
import { DATA_SKILLS } from "./data";
import { DESIGN_SKILLS } from "./design";
import { ENGINEERING_SKILLS } from "./engineering";
import { FINANCE_SKILLS } from "./finance";
import { HR_SKILLS } from "./hr";
import { IT_SKILLS } from "./it";
import { LEGAL_SKILLS } from "./legal";
import { MARKETING_SKILLS } from "./marketing";
import { PRODUCT_SKILLS } from "./product";
import { SALES_SKILLS } from "./sales";
import { SECURITY_SKILLS } from "./security";
import { SHARED_SKILLS } from "./shared";
import { SUPPORT_SKILLS } from "./support";
import type { BuiltinSkill } from "./types";

export type { BuiltinSkill } from "./types";

export const SHARED_SKILL_IDS = SHARED_SKILLS.map((s) => s.id);

export const BUILTIN_SKILLS: BuiltinSkill[] = [
	...SHARED_SKILLS,
	...ENGINEERING_SKILLS,
	...PRODUCT_SKILLS,
	...DESIGN_SKILLS,
	...SECURITY_SKILLS,
	...IT_SKILLS,
	...DATA_SKILLS,
	...HR_SKILLS,
	...ADMIN_SKILLS,
	...FINANCE_SKILLS,
	...LEGAL_SKILLS,
	...MARKETING_SKILLS,
	...SALES_SKILLS,
	...SUPPORT_SKILLS,
];

const byId = new Map(BUILTIN_SKILLS.map((s) => [s.id, s]));
export const builtinSkillById = (id: string): BuiltinSkill | undefined => byId.get(id);
