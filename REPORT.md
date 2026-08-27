# Design Write-Up

## 1. Architecture

This project runs as one single program instead of several separate services. That is simpler
to build, and the project does not need anything bigger yet.

Main pieces:

- `mock-app/`: the fake bank app being automated.
- `src/surface/`: opens the browser, reads the page, clicks, types.
- `src/safety/`: the allowlist, and hiding sensitive data.
- `src/logging/`: saves what happened during a run.
- `src/artifact/`: the saved file format for a task, and the code that builds one.
- `src/replay/`: runs a saved task again, with no AI.
- `src/agent/`: the AI loop that figures out a task the first time.
- `src/escalation/`: lets a human pause a run and take over.
- `src/cli/`: the commands you actually run (`discover`, `replay`).

The most important choice: everything finds things on the page by their **role and visible
name** (like "button named Search"), never by CSS. So discovery, replay, and saving a task all
understand a page the same way.

The human handoff runs as a separate program (see section 5). It talks to the rest through a
shared file on disk. That is simple, and it is enough for what is needed here.

## 2. Artifact schema

A saved task ("artifact") is a JSON file, checked against a schema every time it loads, since
these files come from disk and could be wrong.

What's in it:

- **Steps**: an ordered list of actions: navigate, click, fill (type into something), or
  extract (read a value off the page).
- Each click or fill says which element it targets, and why that should keep working. That
  "why" comes from the AI's own explanation when it first found the task.
- A fill's value can be typed text, a placeholder filled in per run (like "whichever member ID
  you give me"), or a reference to a secret kept outside the file (see Safety).
- **Outcome rules**: known results, like "member not found," and whether each one is a normal
  answer, something to retry, or a real failure.
- A **success checkpoint**: one thing to check at the end to confirm the task worked.

Reading a value off the page works by finding an exact label on the page (like "Current Savings
Balance") and reading the cell next to it. An early version matched loosely and accidentally
matched the whole page instead of just that label, giving the wrong answer. Matching exactly
fixed it.

Each click is also marked `safe` or `irreversible`, using the same list the safety system uses
everywhere else.

## 3. Determinism & error handling

"Deterministic" means: run the same task twice, get the same steps every time, no AI guessing.
Replay is plain code, and it makes no AI calls at all.

A replay always ends one of four ways: **success** (with the data it collected), **business
outcome** (a normal result like "member not found"), **escalated** (needs a human), or
**failure** (something genuinely went wrong).

After every step, the system checks if the page matches a known outcome. If so, it stops there
instead of clicking around on an error page.

One real bug found during testing: if a step's target isn't on the page (say a search came back
empty, so there's nothing to click), that first looks like an error. But it's actually a normal
result, not a bug. Fix: catch that error, then check if it matches a known outcome before giving
up. That's what turns "no results" into a clean answer instead of a crash.

## 4. Heterogeneity & multi-tenant

Only one app had to be supported, but it's built to grow:

- Steps only ever refer to a role and a name, nothing tied to one page's code. So the same file
  format could work for a different kind of app (an old website with frames, even a desktop
  app) without changing the format. Not built, just designed for.
- Since values are filled in per run instead of hardcoded, a saved task recorded on one bank's
  app would often still work on another bank running the same software. Where it doesn't, a
  small override file could patch just the differences instead of recording it all again. Not
  built, just designed for.
- If a bank's app changes and a saved task stops matching, replay notices right away, since it
  checks the page at every step.

## 5. Escalation & handoff

Some actions shouldn't happen on their own, like something that can't be undone.

1. If a step is risky and hasn't been approved, replay stops and asks for a human.
2. It saves why it stopped, plus a screenshot.
3. The browser stays open and visible, so a human can use the same window.
4. A separate small page (the "operator console") lists anything waiting on a human.
5. The human clicks Resume, and the same run picks back up and finishes.

This was tested for real, twice: once with a small test file built just to trigger it, and once
with the real second task (opening a sub-account).

The operator console is very plain, just a basic page. The assignment says that's fine as long
as the pause-and-resume part is real, and it is: two separate programs share one file to make
it work.

It does not yet record exactly what the human changed, only that they resumed it.

## 6. Safety

- One config file lists which websites are allowed and which buttons count as risky. A person
  could read it without knowing how to code.
- Every action, everywhere in the system, gets checked against this same list. One place, not
  several copies of the same rule.
- Risky actions are blocked unless someone explicitly allows them, or a human approves them
  through the pause-and-resume flow.
- Exception: while the AI first figures out a task, a person is already watching, so risky
  actions are allowed there. Once saved and replayed later unattended, they're blocked again.

Two real problems were found and fixed:

1. Typed passwords were showing up in saved logs, because the system only checked field
   *names*, not field *labels*. Fixed by also checking the visible label.
2. A saved task file had a real password in it, in plain text. The fix: passwords are now kept
   outside the file, in local settings, and the task just says "use the password named X."

One limit: only a fixed list of sensitive-sounding words gets caught (password, pin, ssn, a few
others). Something sensitive with a different name would not get caught automatically.

## 7. Cuts

- Support for other kinds of apps (old websites, desktop apps) and reusing a task across
  different banks: designed for, not built.
- A way to give up on a paused task instead of resuming it: not built yet.
- Figuring out error cases automatically for a new task: right now these are written by hand.
- Automated tests for the full browser-and-AI flow: instead, tested by hand repeatedly against
  the real app (see `/evidence/`). The automated tests that exist check the safety rules, the
  data hiding, and the file format.
- A few optional extras the assignment mentioned weren't attempted to spend the time on the
  core pieces instead.
