# research

A lightweight harness for hep-th research projects with Claude Code, inspired by
[get-physics-done](https://github.com/psi-oss/get-physics-done) but file-based and minimal.
Knowledge lives in the [LLMwiki](../LLMwiki) vault; continuity lives in each project's
`STATE.md`.

## Lifecycle

```
/new-project  <problem>     formulate with the wiki, plan verifiable steps, scaffold
/import-project <path>      onboard an existing draft/calculations/data into a project
/solve                      calculate → verify → notes/ → STATE.md   (repeat)
/pause                      checkpoint before ending a session
/resume-project [slug]      cold-start briefing in a new session, continue
/paper                      JHEP-style draft from established results
/revise <request>           flow-aware revision of the draft
```

Each project is `projects/<slug>/` with `PROJECT.md` (formulation, stable),
`STATE.md` (live state), `notes/` (per-step records), `calc/` (re-runnable scripts),
`paper/` (LaTeX). See `CLAUDE.md` for the full protocol.

Research projects themselves stay local: `projects/` is gitignored, so this repo tracks
only the generic harness. To adopt it, clone and edit the personal bits in `CLAUDE.md`
(the knowledge-vault path under *Knowledge protocol*, and the interaction language under
*Conventions*).
