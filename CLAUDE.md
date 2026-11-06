# CLAUDE.md: multi-agent-architecture

This repository is a **framework**: documentation, templates and one small command-line tool (`tooling/maa`). It describes how teams of AI agents deliver software. It contains no product.

## Rules for any agent editing this repository

1. Read `README.md` first, then `core/00-principles.md`. Every variant in `variants/` must stay consistent with `core/`; if a variant needs something `core/` does not allow, change `core/` first and say why in `core/CHANGELOG.md`.
2. Keep it generic. No product names, repository URLs, people's names, e-mail addresses or secrets anywhere except `00-distillation/`, which documents the pilot and is already scrubbed. Use placeholders in angle brackets: `<product>`, `<team>`, `<org>`.
3. Every rule must be traceable: cite the evidence section (`00-distillation/02-evidence-from-remitly.md §n`), a measured number, or label the rule `ASSUMPTION:` with the reason.
4. Plain English, British spelling, tables for anything with numbers, one recommendation per decision (the readers include non-technical owners).
5. Templates in `core/templates/` are copied verbatim by `maa init` and by the variant bootstrap instructions; change a template and the tool's tests in the same change.
6. `tooling/maa` is dependency-free Node 22 (ESM). Run its tests with `node --test tooling/maa/test` before reporting any change to it as done. Node is not necessarily on `PATH` on the pilot machine; the known location is recorded in `tooling/maa/README.md`.
7. Do not commit or push unless the owner asks. Never force-push.
