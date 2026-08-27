# Evidence

Real recorded runs, referenced from `REPORT.md` and the demo path in `README.md`.

- **`discover-swmjePPs/`**: a real LLM driven discovery run for `lookup-member-balance`.
  `log.jsonl` is the step by step action log. `result.json` is the final trajectory and
  outputs. This run produced `artifacts/lookup-member-balance.discovered.json`.
- **`discover-Wpkuehru/`**: the same, for `open-sub-account`. Produced
  `artifacts/open-sub-account.discovered.json`.
- **`replay-F2nL6J06/`**: a deterministic replay of `lookup-member-balance` for a real member.
  Success, balance extracted correctly.
- **`replay-jPfBgUn0/`**: the same artifact, replayed for a member ID that doesn't exist.
  Business outcome (`MEMBER_NOT_FOUND`), not a crash, plus `final-state.png`, a screenshot of
  the page at the exact moment that was detected.
- **`replay-fWGVS5AR/`**: a replay that hit the safety policy's irreversible action block and
  paused for a human. `intervention.json` is the request a person acted on, and
  `intervention-step-8.png` is the live page at the moment it paused. See `REPORT.md` section 5
  for how the resume mechanism this demonstrates actually works.

Everything here has been checked for leaked credentials (see `REPORT.md` section 6).
`demo1234` is the mock app's own fixed, harmless local dev password, not a real secret.
