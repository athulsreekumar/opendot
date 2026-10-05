import type { CatalogEntry } from "@shared/types";
import context7 from "./context7.json";
import everything from "./everything.json";
import fetch from "./fetch.json";
import figma from "./figma.json";
import filesystem from "./filesystem.json";
import git from "./git.json";
import github from "./github.json";
import huggingface from "./huggingface.json";
import linear from "./linear.json";
import memory from "./memory.json";
import notion from "./notion.json";
import playwright from "./playwright.json";
import sentry from "./sentry.json";
import sequentialThinking from "./sequential-thinking.json";
import stripe from "./stripe.json";
import supabase from "./supabase.json";
import time from "./time.json";
import vercel from "./vercel.json";

export const CATALOG: CatalogEntry[] = [
	filesystem as unknown as CatalogEntry,
	memory as unknown as CatalogEntry,
	sequentialThinking as unknown as CatalogEntry,
	everything as unknown as CatalogEntry,
	fetch as unknown as CatalogEntry,
	git as unknown as CatalogEntry,
	time as unknown as CatalogEntry,
	playwright as unknown as CatalogEntry,
	context7 as unknown as CatalogEntry,
	github as unknown as CatalogEntry,
	notion as unknown as CatalogEntry,
	linear as unknown as CatalogEntry,
	sentry as unknown as CatalogEntry,
	figma as unknown as CatalogEntry,
	supabase as unknown as CatalogEntry,
	vercel as unknown as CatalogEntry,
	stripe as unknown as CatalogEntry,
	huggingface as unknown as CatalogEntry,
];
