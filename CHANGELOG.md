# Changelog

All notable changes to OpenDot are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Quick ask: a global shortcut (Option+Space on a Mac, Alt+Space on Windows) opens a small floating bar from any app. Ask
  SuperDot or `@` a Dot, watch the answer stream in, answer tool approvals inline, and open the chat in OpenDot. Configurable
  in Settings → Quick ask.
- Windows 10 and 11 (x64) support: an installer and a portable zip, a **This PC** connection (files, shell through
  Git for Windows, screenshots, clipboard, notifications, opening apps and links), keys encrypted with Windows DPAPI,
  and Windows builds and tests in CI.

### Fixed

- Dots granted This Mac now really get the file and shell tools (`read`, `ls`, `grep`, `find`, `write`, `edit`, `bash`).
- This Mac, Google Workspace and Microsoft 365 list their tools on the Connections screen.

### Changed

- The lead assistant is called SuperDot everywhere. Existing installs with the default name are renamed automatically.

## [0.1.0] - 2026-10-05

The first public version of OpenDot.

### Added

- A WhatsApp-style Mac app with Dots on the left and the chat on the right, light and dark.
- Create a Dot from a one-sentence description; its name, look and personality stream in live.
- Any model: Anthropic, OpenAI, Google, xAI, OpenRouter, Groq, Mistral, DeepSeek, local models through Ollama,
  LM Studio, llama.cpp or vLLM, and any compatible URL.
- Connections: Google Workspace, Microsoft 365, This Mac (files, shell, Calendar, Reminders, Contacts, Notes, screen,
  clipboard, notifications) and unlimited MCP servers, with catalog and JSON import.
- Always-on Dots with watchers for mail, calendars, files, folders, web pages, RSS, MCP resources, schedules and a
  local webhook, plus budgets.
- SuperDot, which asks the right Dots in parallel and answers with sources.
- Dot Links: permission rules between Dots with schedules, rate limits and approvals.
- Privacy: data in `~/.opendot`, keys in the macOS Keychain, PII masking for cloud models, approvals for risky tools.
- Memory per Dot and a shared "About me".
- Streaming replies everywhere.
- Unsigned DMG builds for Apple silicon and Intel in CI.

[Unreleased]: https://github.com/athulsreekumar/opendot/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/athulsreekumar/opendot/releases/tag/v0.1.0
