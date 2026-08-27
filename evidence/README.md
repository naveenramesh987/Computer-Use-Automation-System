# Evidence

Real recorded runs, referenced from `REPORT.md` and the demo path in `README.md`. These match
the exact commands in `README.md`'s "Try it" section, run for real.

- **`discover-qy2uEmTh/`**: a real LLM driven discovery run for `lookup-member-balance`.
  `log.jsonl` is the step by step action log. `result.json` is the final trajectory and
  outputs. This run produced `artifacts/lookup-member-balance.discovered.json`.
- **`discover-Wpkuehru/`**: the same, for `open-sub-account`. Produced
  `artifacts/open-sub-account.discovered.json`.
- **`replay-l44EI02X/`**: a deterministic replay of `lookup-member-balance` for a real member.
  Success, balance extracted correctly.
- **`replay-jFKDEGJo/`**: the same artifact, replayed for a member ID that doesn't exist.
  Business outcome (`MEMBER_NOT_FOUND`), not a crash, plus `final-state.png`, a screenshot of
  the page at the exact moment that was detected.
- **`replay-IZCv08XE/`**: a replay of `open-sub-account` with a deposit below the minimum.
  Business outcome (`VALIDATION_ERROR`), not a crash.
- **`replay-fWGVS5AR/`**: a replay that hit the safety policy's irreversible action block and
  paused for a human. `intervention.json` shows the request a person acted on
  (`createdAt`/`resolvedAt`), and `intervention-step-8.png` is the live page at the moment it
  paused. The human completed the actual button click in the live browser before resuming, and
  the same still-running process finished with `success` afterward. See `REPORT.md` section 5
  for how the resume mechanism this demonstrates actually works.

Everything here has been checked for leaked credentials (see `REPORT.md` section 6).
`demo1234` is the mock app's own fixed, harmless local dev password, not a real secret.
