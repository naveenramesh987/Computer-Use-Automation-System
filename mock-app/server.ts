import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cookieParser from "cookie-parser";
import {
  attachSession,
  createSession,
  destroySession,
  requireSession,
} from "./session.js";
import {
  searchMembers,
  isValidMemberId,
  findMember,
  openSubAccount,
} from "./data.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const baseUrl = new URL(
  process.env.MOCK_APP_BASE_URL ?? "http://localhost:4000",
);
const port = Number(baseUrl.port || 4000);

// Set up the web server: render EJS templates from the views folder, serve the
// stylesheet from public, and read form data and cookies from incoming requests.
const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(here, "views"));
app.use(express.static(path.join(here, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Landing page: send logged-in usernames to the member search page, everyone else to login.
app.get("/", attachSession, (req, res) => {
  res.redirect(req.session ? "/members" : "/login");
});

// Login page. If already logged in, skip straight to search instead of showing the form again.
app.get("/login", attachSession, (req, res) => {
  if (req.session) {
    res.redirect("/members");
    return;
  }

  const reason = typeof req.query.reason === "string" ? req.query.reason : null;
  res.render("login", {
    reason,
    error: null,
  });
});

// Handles the login form submission. Any username works; the password is fixed
// since this is a mock app with no real accounts.
app.post("/login", (req, res) => {
  const username = String(req.body.username ?? "").trim();
  const password = String(req.body.password ?? "");

  if (!username || password !== "demo1234") {
    res.status(401).render("login", {
      reason: null,
      error: "Invalid username or password.",
    });
    return;
  }

  createSession(res, username);
  res.redirect("/members");
});

// Signs the user out and forgets who was logged in.
app.get("/logout", (req, res) => {
  destroySession(req, res);
  res.redirect("/login");
});

// Member search page. Shows an empty search box on first visit, and a results
// table once someone has actually searched for something.
app.get("/members", requireSession, (req, res) => {
  const query = typeof req.query.query === "string" ? req.query.query : "";
  const results = query ? searchMembers(query) : [];

  res.render("search", {
    query,
    results,
    username: req.session!.username,
  });
});

// Member detail page. Finds out which of the four states member-detail.ejs
// should show: invalid id format, not found, locked, or found.
app.get("/members/:id", requireSession, (req, res) => {
  const id = req.params.id ?? "";

  if (!isValidMemberId(id)) {
    res.render("member-detail", { state: "invalid_format", id, member: null });
    return;
  }

  const member = findMember(id);
  if (!member) {
    res.render("member-detail", { state: "not_found", id, member: null });
    return;
  }

  if (member.status === "locked") {
    res.render("member-detail", { state: "locked", id, member: null });
    return;
  }

  res.render("member-detail", { state: "found", id, member });
});

// Shows the "open a sub-account" form. If the member doesn't exist or isn't
// active, go back to the member page instead of showing a broken form.
app.get("/members/:id/sub-account/new", requireSession, (req, res) => {
  const id = req.params.id ?? "";
  const member = findMember(id);

  if (!member || member.status !== "active") {
    res.redirect(`/members/${id}`);
    return;
  }

  res.render("new-sub-account", {
    member,
    error: null,
    accountType: "MONEY_MARKET",
    initialDeposit: "",
  });
});

// Handles the sub-account form submission. Checks if the input is valid before
// actually creating anything.
app.post("/members/:id/sub-account", requireSession, (req, res) => {
  const id = req.params.id ?? "";
  const member = findMember(id);

  if (!member || member.status !== "active") {
    res.redirect(`/members/${id}`);
    return;
  }

  const accountType = String(req.body.accountType ?? "");
  const depositRaw = String(req.body.initialDeposit ?? "");
  const deposit = Number(depositRaw);

  const validTypes = ["MONEY_MARKET", "CD", "YOUTH_SAVINGS"];
  let error: string | null = null;

  if (!validTypes.includes(accountType)) {
    error = "Please select a valid account type.";
  } else if (!depositRaw || Number.isNaN(deposit)) {
    error = "Initial deposit must be a number.";
  } else if (deposit < 25) {
    error = "Initial deposit must be at least $25.00.";
  }

  if (error) {
    res.status(422).render("new-sub-account", {
      member,
      error,
      accountType,
      initialDeposit: depositRaw,
    });
    return;
  }

  const subAccount = openSubAccount(member.id, accountType, deposit);
  res.render("confirmation", { member, subAccount });
});

app.listen(port, () => {
  console.log(`Mock bank app running at ${baseUrl.href}`);
  console.log(`Sign in with any username and password "demo1234".`);
});

