#!/usr/bin/env node
// Capture-only stand-in for real MCP servers (Fetch, GitHub, Filesystem, Notion): newline-delimited JSON-RPC over stdio.
// Usage: node fake-mcp.mjs <fetch|github|filesystem|notion>. The app talks to it exactly like a real MCP server.
import { createInterface } from "node:readline";

const profile = process.argv[2] ?? "fetch";
const str = (d) => ({ type: "string", description: d });
const RO = { readOnlyHint: true };
const WR = { readOnlyHint: false, destructiveHint: false };
const DE = { readOnlyHint: false, destructiveHint: true };
const t = (name, description, properties, annotations, required = []) => ({
	name,
	description,
	inputSchema: { type: "object", properties, required },
	annotations,
});

const PROFILES = {
	fetch: {
		tools: [t("fetch", "Fetch a URL and return its contents as markdown.", { url: str("URL to fetch") }, RO, ["url"])],
		call: () =>
			"# Best standing desks under $600 (2026)\n\nRidgeway Pro $549, dual motor, 275 lb. Alder Frame $429, dual motor, 220 lb. Northline Desk 2 $599, single motor, 185 lb, 42 dB.",
	},
	github: {
		tools: [
			t("list_pull_requests", "List pull requests in a repository.", { owner: str("Owner"), repo: str("Repo") }, RO, ["owner", "repo"]),
			t("get_pull_request", "Get a pull request with its diff summary.", { owner: str("Owner"), repo: str("Repo"), pullNumber: { type: "number" } }, RO, ["owner", "repo", "pullNumber"]),
			t("get_file_contents", "Read a file from a repository.", { owner: str("Owner"), repo: str("Repo"), path: str("Path") }, RO, ["owner", "repo", "path"]),
			t("create_pull_request_review", "Submit a review on a pull request.", { owner: str("Owner"), repo: str("Repo"), pullNumber: { type: "number" }, body: str("Review text") }, DE, ["owner", "repo", "pullNumber"]),
			t("add_issue_comment", "Comment on an issue or pull request.", { owner: str("Owner"), repo: str("Repo"), issueNumber: { type: "number" }, body: str("Comment") }, WR, ["owner", "repo", "issueNumber", "body"]),
			t("merge_pull_request", "Merge a pull request.", { owner: str("Owner"), repo: str("Repo"), pullNumber: { type: "number" } }, DE, ["owner", "repo", "pullNumber"]),
		],
		call: (name) =>
			name === "get_pull_request"
				? "#482 Debounce workspace search\nAuthor: leo-park · 3 files changed · +64 −12\nuseSearch.ts, SearchBox.tsx, useSearch.test.ts"
				: "ok",
	},
	filesystem: {
		tools: [
			t("read_file", "Read the contents of a file.", { path: str("File path") }, RO, ["path"]),
			t("list_directory", "List files in a directory.", { path: str("Directory path") }, RO, ["path"]),
			t("search_files", "Search for files by name.", { path: str("Root"), pattern: str("Pattern") }, RO, ["path", "pattern"]),
			t("write_file", "Create or overwrite a file.", { path: str("File path"), content: str("Content") }, DE, ["path", "content"]),
		],
		call: () => "ok",
	},
	notion: {
		tools: [
			t("search", "Search pages and databases.", { query: str("Query") }, RO, ["query"]),
			t("fetch_page", "Read a page.", { id: str("Page id") }, RO, ["id"]),
			t("create_page", "Create a page.", { title: str("Title"), content: str("Markdown") }, WR, ["title"]),
			t("update_page", "Update a page.", { id: str("Page id"), content: str("Markdown") }, WR, ["id"]),
		],
		call: () => "ok",
	},
};

const spec = PROFILES[profile] ?? PROFILES.fetch;
const send = (m) => process.stdout.write(`${JSON.stringify(m)}\n`);
createInterface({ input: process.stdin }).on("line", (line) => {
	let req;
	try {
		req = JSON.parse(line);
	} catch {
		return;
	}
	if (req.id === undefined) return;
	switch (req.method) {
		case "initialize":
			return send({ jsonrpc: "2.0", id: req.id, result: { protocolVersion: req.params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: profile, version: "1.0.0" } } });
		case "tools/list":
			return send({ jsonrpc: "2.0", id: req.id, result: { tools: spec.tools } });
		case "tools/call":
			return send({ jsonrpc: "2.0", id: req.id, result: { content: [{ type: "text", text: spec.call(req.params.name, req.params.arguments) }] } });
		case "ping":
			return send({ jsonrpc: "2.0", id: req.id, result: {} });
		default:
			return send({ jsonrpc: "2.0", id: req.id, error: { code: -32601, message: "Method not found" } });
	}
});
