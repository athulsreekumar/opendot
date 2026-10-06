# Security policy

OpenDot runs AI assistants on your Mac with access to your files, mail, calendar and shell, so we take security
reports seriously. Thank you for helping keep OpenDot users safe.

## Reporting a vulnerability

**Please do not open a public issue, discussion or pull request for a security problem.**

Report it privately through GitHub:
**[Report a vulnerability](https://github.com/athulsreekumar/opendot/security/advisories/new)**
(Security tab, then "Report a vulnerability").

Please include:

- what an attacker could do, and what they need (a malicious MCP server, a crafted email, local access, …)
- steps to reproduce, ideally with a minimal proof of concept
- the OpenDot version or commit, and your macOS version
- any logs from `~/.opendot/logs/main.log` with personal data removed

## What to expect

| Step | Target |
|---|---|
| We acknowledge your report | within 3 working days |
| We confirm the issue and its severity | within 10 working days |
| We ship a fix | as fast as the severity requires; critical issues first |

We'll keep you updated, credit you in the release notes and the advisory unless you prefer to stay anonymous, and
coordinate the disclosure date with you. Please give us a reasonable time to ship a fix before disclosing publicly.

## Supported versions

OpenDot is young. Security fixes go into the latest release and `main`. Older releases are not patched, so please
update.

## What's in scope

Especially interesting areas:

- **Sandbox escapes**: a Dot reading or writing outside its workspace and the folders you allowed, or running a tool
  it wasn't granted.
- **Approval bypass**: a tool that changes things (send, delete, pay, `bash`, `write`) running without your approval.
- **Prompt injection with real impact**: content from an email, web page, file or MCP server making a Dot leak data
  or act against you.
- **Dot Links (RBAC)**: one Dot messaging another without a rule that allows it.
- **PII masking**: personal details reaching a cloud model unmasked when masking is on.
- **Secrets**: API keys or OAuth tokens leaving the macOS Keychain or appearing in logs, files or network traffic.
- **The Electron shell**: remote code execution, context isolation or IPC flaws.
- **The website** (opendot.live): anything beyond the usual low-impact findings.

## Out of scope

- Issues that need an already compromised Mac or a malicious user with full access to your account.
- A Dot doing something you explicitly approved or allowed with "Always allow".
- Vulnerabilities in third-party MCP servers, models or providers (please report those upstream).
- Missing hardening headers or best practices with no demonstrated impact.

## Our security model in short

- Everything OpenDot stores lives in `~/.opendot` on your Mac. API keys and tokens are encrypted with the macOS
  Keychain (`secrets.bin`).
- Each Dot only gets the connections and tools you grant it. File tools are confined to the Dot's workspace plus
  folders you add.
- Tools that change things ask for approval first, unless you choose "Always allow" for that Dot and tool.
- Personal details are masked before text reaches a cloud model and restored locally.
- Dots can only talk to each other where a Dot Links rule allows it, and every exchange is audited.
