# Spec 06 — Secrets, tool permissions, approvals, PII shield, audit

## 1. Threat model (short)

Protects: API keys/tokens at rest; user PII from **cloud** model providers; the user's machine from
unwanted agent actions (deletes, sends, shell); Dots from talking to each other without permission.
Does not protect against: a malicious MCP server the user installed (it runs with the user's rights; the UI warns),
or local malware with the user's privileges.

## 2. SecretStore (`src/main/security/secret-store.ts`, T11)

```ts
export class SecretStore {
	static create(file: string): Promise<SecretStore>; // <root>/secrets.bin
	available(): boolean;                              // safeStorage.isEncryptionAvailable()
	get(key: string): Promise<string | undefined>;
	set(key: string, value: string): Promise<void>;
	delete(key: string): Promise<void>;
	deletePrefix(prefix: string): Promise<void>;
	has(key: string): Promise<boolean>;
}
```
- File content = `safeStorage.encryptString(JSON.stringify(map))` written atomically with mode `0600`.
- In-memory cache after the first decrypt. Writes are serialised.
- `available() === false` → `set` throws `OpenDotError("SECRETS_UNAVAILABLE")`. **Never** fall back to plaintext.
- Key namespaces: `provider:<id>`, `conn:<connId>:<KEY>`, `oauth:<connId>`, `oauthclient:<connId>` (client id/secret),
  `pii:<dotId>` (vault key, §5.3).
- Logging: never log values. `log.ts` has a `redactSecrets(str)` helper that masks known secret values and
  `sk-…`/`Bearer …` patterns, and it is applied to every log line.

## 3. Tool PolicyEngine (`src/main/security/policy-engine.ts`, T25)

```ts
export interface ToolContext {
	dot: Dot; toolName: string; args: unknown;
	annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; openWorldHint?: boolean; idempotentHint?: boolean };
	connection?: Connection; // undefined for built-ins and OpenDot tools
}
export class PolicyEngine {
	decide(ctx: ToolContext): { decision: ToolDecision; reason: string; ruleSource: "dot-rule" | "always" | "connection-default" | "annotation" | "builtin" };
	rememberAlways(dotId: DotId, toolName: string): Promise<void>; // persisted in policy.json
	forget(dotId: DotId, toolName?: string): Promise<void>;
}
```

Decision order (first match wins):
1. Tool not granted (its connection is not in `dot.grants`, or it is a built-in without the mac feature) → `deny` "not granted".
2. `grant.toolRules[toolName]` exact match → that decision.
3. `grant.toolRules` pattern match (`*` wildcard, first match in insertion order).
4. Persisted "allow always" (`policy.json` for dotId + toolName) → `allow`.
5. `grant.defaultDecision`, if set.
6. Built-in table: `bash` → ask; `write`/`edit` → ask; `read`/`ls`/`grep`/`find` → allow; OpenDot tools: `list_dots` allow,
   `message_dot` → governed by link policy (spec 07), so `allow` here.
7. Annotation default (same logic as pi's documented Codex-style rule):
   `destructiveHint === true` → ask; `readOnlyHint === true` → allow; otherwise
   `(destructiveHint ?? true) || (openWorldHint ?? true)` → ask, else allow.

### 3.1 Policy extension (`src/main/runtime/extensions/policy.ts`)
```ts
pi.on("tool_call", async (event, ctx) => {
	const info = pi.getAllTools().find((t) => t.name === event.toolName);
	const d = deps.policy.decide({ dot, toolName: event.toolName, args: event.input, annotations: info?.annotations, connection: … });
	audit(…);
	if (d.decision === "allow") return;
	if (d.decision === "deny") return { block: true, reason: `Blocked by OpenDot: ${d.reason}` };
	const res = await deps.approvals.request({ kind: "tool", dotId: dot.id, toolName: event.toolName, args: event.input, title, detail }, ctx.signal);
	if (res === "allow-always") await deps.policy.rememberAlways(dot.id, event.toolName);
	if (res === "deny" || res === "expired") return { block: true, reason: "The user declined this action." };
});
```
Also enforces the files path guard (spec 05 §6.1) for `read|write|edit|ls|grep|find` *before* the decision.
Nested calls (`parentToolCallId` set, e.g. from codemode) go through the same handler, which is exactly what we want.

## 4. ApprovalBroker (`src/main/security/approval-broker.ts`)

```ts
export class ApprovalBroker {
	request(input: Omit<ApprovalRequest, "id" | "createdAt" | "expiresAt">, signal?: AbortSignal): Promise<"allow-once" | "allow-always" | "deny" | "expired">;
	respond(res: ApprovalResponse): void;
	pending(): ApprovalRequest[];
	cancelForDot(dotId: DotId): void; // on abort/dispose → resolves "deny"
}
```
- Emits `approval:requested` / `approval:resolved`. Expiry 5 min → `expired`. `signal` abort → `deny`.
- DotStatus is `waiting-approval` while pending.
- Title copy: tool → "<Dot> wants to <humanised tool>", e.g. "Inbox wants to send an email draft".
  `detail` = a pretty one-liner of the key args (to/subject; command; path), with the full args in `args`.
- When the window is unfocused, also show a native notification ("Inbox wants to send an email"; click → Approvals screen on it). Several within 10 s become one "N approvals waiting".
- The inbox (spec 10 §3.4) answers with `{ id, decision, reason?, editedArgs? }`. `reason` (deny) is appended to the block message the Dot reads.
  `editedArgs` (allow) is applied by the policy extension by mutating `event.input` in place, which pi supports for `tool_call`
  handlers; only fields the inbox exposes as editable are accepted, and the tool result gets a note listing the edited fields.
  Each resolution is written to the audit log as an `approval` entry (masked one-line summary, outcome, by you / rule / timeout).

## 5. PII shield

### 5.1 Detectors (`src/main/pii/detectors.ts`, T34)

```ts
export interface PiiSpan { type: PiiType; start: number; end: number; value: string }
export function detectPii(text: string, opts: { types: Set<PiiType>; customTerms: PiiSettings["customTerms"]; detectNames: boolean; defaultCountry?: CountryCode }): PiiSpan[];
```
| Type | Method |
|---|---|
| EMAIL | `/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi` |
| PHONE | `findPhoneNumbersInText(text, { defaultCountry, v2: true })` from libphonenumber-js. Keep only `isValid()` numbers. `defaultCountry` from `app.getLocaleCountryCode()` |
| CARD | `/\b(?:\d[ -]?){13,19}\b/g` then digits-only Luhn check, and length 13–19 |
| IBAN | `/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/g` + mod-97 == 1 |
| SSN | `/\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g` (US, dashed only) |
| IP | IPv4 `/\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g` excluding `127.*`, `0.0.0.0`; IPv6 via `net.isIP` on `/[0-9a-f:]{6,}/gi` candidates (exclude `::1`) |
| SECRET | `sk-[A-Za-z0-9_-]{20,}`, `sk-ant-[A-Za-z0-9_-]{20,}`, `gh[pousr]_[A-Za-z0-9]{36,}`, `xox[abprs]-[A-Za-z0-9-]{10,}`, `AKIA[0-9A-Z]{16}`, `AIza[0-9A-Za-z_-]{35}`, JWT `eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+`, PEM `-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----` |
| URL_CRED | `/\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@/gi` (user:pass@ in URLs) |
| PERSON | (a) `customTerms` of type PERSON, (b) if `detectNames`: `nlp(text).people().out("offsets")` from compromise, keeping names ≥ 2 tokens or capitalised single tokens ≥ 3 chars not in a stoplist of 200 common words |
| ADDRESS | customTerms of type ADDRESS only (no heuristic in v1) |
| CUSTOM | customTerms (case-insensitive, word-boundary, longest first) |

Overlap resolution: sort by start, then by length desc. Drop any span overlapping an already-kept span.
Ignore spans inside existing tokens `⟦…⟧`.

### 5.2 Defaults
`enabledTypes` = all except PERSON and ADDRESS (they still apply to customTerms). `detectNames=false`.

### 5.3 Vault (`src/main/pii/vault.ts`, T35)

One vault per Dot (covers its main session and link sessions):
```ts
export class PiiVault {
	static open(dotId: DotId, deps): Promise<PiiVault>;   // decrypt <root>/pii/<dotId>.vault (AES-256-GCM, key in SecretStore `pii:<dotId>`)
	tokenFor(span: { type: PiiType; value: string }): string; // same value+type → same token; new → ⟦TYPE_n⟧ (n per type, 1-based)
	valueOf(token: string): string | undefined;
	save(): Promise<void>;   // debounced 500 ms
	destroy(): Promise<void>; // on Dot delete / chat.clear
}
```
Token format: `⟦EMAIL_1⟧` (U+27E6 / U+27E7, rarely in natural text and survives models well). Normalise values
before lookup: emails lowercased; phones in E.164; cards and IBAN digits-only.
Key: 32 random bytes (base64) in SecretStore. File: `iv(12) | tag(16) | ciphertext` of the JSON `{ byToken, counters }`.

### 5.4 PiiService (`src/main/pii/pii-service.ts`)

```ts
export class PiiService {
	shouldRedact(dot: Dot): boolean; // "always" → true; "off" → false; "auto" → !models.isLocal(dot.model ?? default)
	redact(dotId: DotId, text: string): Promise<{ text: string; spans: PiiSpan[] }>;
	restore(dotId: DotId, text: string): string;          // replace every ⟦…⟧ known to the vault; unknown tokens left as-is
	restoreDeep<T>(dotId: DotId, value: T): T;             // walks objects/arrays, restores strings
	preview(text: string, dotId?: DotId): { redacted: string; items: … };
}
```

### 5.5 PII pi extension (`src/main/runtime/extensions/pii.ts`, T36) — the boundary

Principle: **the transcript on disk holds real values. Tokens exist only in what is sent to the provider.**

```ts
export function piiExtension(deps, dot): InlineExtension {
	return { name: "opendot-pii", factory: (pi) => {
		// 1. Outgoing: redact every text part of every message right before each LLM call.
		pi.on("context", async (event) => {
			if (!deps.pii.shouldRedact(currentDot())) return;
			const messages = await mapTextDeep(event.messages, (t) => deps.pii.redact(dot.id, t).then((r) => r.text));
			return { messages };
		});
		// 2. Model asked to call a tool with tokens → restore real values before policy + execution.
		pi.on("tool_call", (event) => { restoreInPlace(event.input, (t) => deps.pii.restore(dot.id, t)); });
		// 3. Model output → store real values in the transcript (message_end can replace the finalized message).
		pi.on("message_end", (event) => {
			if (event.message.role !== "assistant") return;
			return { message: mapAssistantText(event.message, (t) => deps.pii.restore(dot.id, t)) };
		});
	}};
}
```
- `mapTextDeep` handles user content (string or blocks), **custom messages** (`role: "custom"`, e.g. `opendot.events` and directory sections, spec 12/13), assistant `text` and `thinking` blocks, `toolCall.arguments` (so
  the provider sees tokens consistently in history), and toolResult `content` text blocks. Image blocks are untouched
  (documented limitation: images are not scanned).
- The system prompt is not part of `context` messages, so pi restores it. Persona text is user-authored config: run
  `redact` on the compiled system prompt too, via `before_agent_start` → mutate `systemPromptOptions` only if
  `shouldRedact` (spec 08 §3 notes where custom instructions go).
- Verified for pi 1.0.2: `MessageEndEventResult = { message?: AgentMessage }` ("must keep the original role").
  The event-mapper and history also call `pii.restore`, so display stays correct even if this hook is ever skipped.
- Streaming display: the event-mapper restores the **full** accumulated text on every update (spec 03 §5), so a token
  split across deltas is never shown half-restored.
- Count per turn: the `context` handler records `spans` for the newest user message → attach to that message's
  `ChatMessageView.pii` (types + count only) and write an audit entry `pii-redaction` (types and counts, no values).

### 5.6 What the user sees
- A shield badge 🛡 in the chat header when redaction is active for this Dot ("Private mode: PII is masked before it reaches
  <Provider>"). It is grey when off or when the provider is local.
- User bubbles that had PII show a small "🛡 3" chip. Hover → "Masked before sending: 2 emails, 1 phone".
- Settings → Privacy: toggle types, add custom terms, "Detect names (experimental)", and a live "Try it" box using `pii.preview`.

### 5.7 Test cases (T34 must include all)

Positive (must detect, type in brackets):
`john.doe+test@example.co.uk` [EMAIL] · `+1 415-555-2671` [PHONE] · `(415) 555-2671` with default US [PHONE] ·
`+44 20 7946 0958` [PHONE] · `4111 1111 1111 1111` [CARD] · `5500-0000-0000-0004` [CARD] · `GB82 WEST 1234 5698 7654 32` [IBAN] ·
`DE89370400440532013000` [IBAN] · `123-45-6789` [SSN] · `192.168.1.24` [IP] · `2001:db8::ff00:42:8329` [IP] ·
`sk-ant-api03-AbCdEf…(30 chars)` [SECRET] · `ghp_` + 36 alnum [SECRET] · `AKIAIOSFODNN7EXAMPLE` [SECRET] ·
`eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig_abc` [SECRET] · `https://bob:hunter2@db.example.com` [URL_CRED] ·
custom term "Athul Sreekumar" (PERSON) matched case-insensitively in "athul sreekumar said" [PERSON].

Negative (must NOT detect): `4111 1111 1111 1112` (bad Luhn) · `000-12-3456` · `127.0.0.1` · `version 1.2.3.4.5` ·
`call me at 5` · `user@localhost` · `10:30-11:45` · `2026-10-04` · a token `⟦EMAIL_1⟧` · `ISBN 978-3-16-148410-0` as PHONE.

Round-trip: `restore(redact(x)) === x` for 50 generated strings mixing all types. Determinism: the same email in two
messages → the same token.

## 6. Audit log (`store.audit`, viewer T40)

Write an `AuditEntry` for: every tool call decision (`tool-call` with decision + tool name, or `tool-blocked`), every
approval resolution, every link exchange and link block, PII redaction counts per turn, connection install/remove/enable,
and provider add/remove. `summary` and `data` never contain argument values. Store `argsHash` (sha256, first 12 hex chars)
so repeated calls can be correlated without storing content.
