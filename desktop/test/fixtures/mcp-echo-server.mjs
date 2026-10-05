#!/usr/bin/env node
// Minimal MCP stdio server: newline-delimited JSON-RPC 2.0. Tools: echo, delete_everything (destructive, for approval tests).
import { createInterface } from "node:readline";

const rl = createInterface({ input: process.stdin });
const send = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);
const tools = [
	{
		name: "echo",
		description: "Echo text back",
		inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
		annotations: { readOnlyHint: true },
	},
	{
		name: "delete_everything",
		description: "Pretend to delete everything",
		inputSchema: { type: "object", properties: {} },
		annotations: { destructiveHint: true },
	},
];
rl.on("line", (line) => {
	let req;
	try {
		req = JSON.parse(line);
	} catch {
		return;
	}
	if (req.id === undefined) return;
	switch (req.method) {
		case "initialize":
			return send({
				jsonrpc: "2.0",
				id: req.id,
				result: {
					protocolVersion: req.params?.protocolVersion ?? "2025-06-18",
					capabilities: { tools: {} },
					serverInfo: { name: "echo", version: "1.0.0" },
				},
			});
		case "tools/list":
			return send({ jsonrpc: "2.0", id: req.id, result: { tools } });
		case "tools/call": {
			const { name, arguments: args } = req.params;
			const text = name === "echo" ? String(args?.text ?? "") : "deleted nothing (fixture)";
			return send({ jsonrpc: "2.0", id: req.id, result: { content: [{ type: "text", text }] } });
		}
		case "ping":
			return send({ jsonrpc: "2.0", id: req.id, result: {} });
		default:
			return send({ jsonrpc: "2.0", id: req.id, error: { code: -32601, message: "Method not found" } });
	}
});
