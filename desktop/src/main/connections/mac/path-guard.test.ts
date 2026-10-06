import path from "node:path";
import { describe, expect, it } from "vitest";
import { expandTilde, isInside } from "./path-guard";

// path.win32 runs on every OS, so Windows path rules are covered by the macOS and Linux test runs too.
const win = path.win32;
const inWin = (root: string, target: string) => isInside(root, target, win);

describe("isInside with Windows paths", () => {
	const root = "C:\\Users\\Ada\\Workspace";

	it("accepts the root itself and anything below it", () => {
		expect(inWin(root, root)).toBe(true);
		expect(inWin(root, "C:\\Users\\Ada\\Workspace\\notes\\a.txt")).toBe(true);
		expect(inWin(root, `${root}\\`)).toBe(true);
	});

	it("is case-insensitive like NTFS", () => {
		expect(inWin(root, "c:\\users\\ada\\workspace\\A.TXT")).toBe(true);
	});

	it("rejects siblings that share a name prefix", () => {
		expect(inWin(root, "C:\\Users\\Ada\\Workspace2\\a.txt")).toBe(false);
		expect(inWin(root, "C:\\Users\\Ada")).toBe(false);
	});

	it("rejects other drives, UNC shares and traversal", () => {
		expect(inWin(root, "D:\\Users\\Ada\\Workspace\\a.txt")).toBe(false);
		expect(inWin(root, "\\\\server\\share\\Workspace\\a.txt")).toBe(false);
		expect(inWin(root, win.resolve(root, "..\\Other\\a.txt"))).toBe(false);
		expect(inWin(root, win.resolve(root, "sub\\..\\..\\x"))).toBe(false);
	});

	it("does not mistake a folder named ..something for traversal", () => {
		expect(inWin(root, "C:\\Users\\Ada\\Workspace\\..hidden\\a.txt")).toBe(true);
	});

	it("handles forward slashes and drive roots", () => {
		expect(inWin(root, win.resolve(root, "sub/file.txt"))).toBe(true);
		expect(inWin("C:\\", "C:\\Windows")).toBe(true);
		expect(inWin("C:\\", "D:\\")).toBe(false);
	});
});

describe("isInside with POSIX paths", () => {
	it("keeps the same rules", () => {
		const posix = path.posix;
		expect(isInside("/home/a/ws", "/home/a/ws/x/y", posix)).toBe(true);
		expect(isInside("/home/a/ws", "/home/a/ws2/x", posix)).toBe(false);
		expect(isInside("/home/a/ws", "/home/a/ws/..hidden", posix)).toBe(true);
		expect(isInside("/home/a/ws", "/home/a", posix)).toBe(false);
	});
});

describe("expandTilde", () => {
	it("expands ~, ~/ and ~\\ against the home folder", () => {
		expect(expandTilde("~", "/h")).toBe("/h");
		expect(expandTilde("~/docs", "/h")).toBe(path.join("/h", "docs"));
		expect(expandTilde("~\\docs", "/h")).toBe(path.join("/h", "docs"));
		expect(expandTilde("~other", "/h")).toBe("~other");
		expect(expandTilde("a/b", "/h")).toBe("a/b");
	});
});
