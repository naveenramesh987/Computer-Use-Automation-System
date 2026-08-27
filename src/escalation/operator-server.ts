import "dotenv/config";
import express from "express";
import { listPendingInterventions, resolveIntervention } from "./controller.js";

const app = express();
const port = Number(process.env.OPERATOR_PORT ?? 4100);

// Lists every run currently paused and waiting on a human.
app.get("/", (_req, res) => {
  const interventions = listPendingInterventions();

  // Build one table row per pending intervention: which run, why it
  // stopped, a screenshot link, and a Resume button.
  const rows = interventions
    .map(
      (i) => `
        <tr>
          <td>${i.runId}</td>
          <td>${i.reason}</td>
          <td>step ${i.step}</td>
          <td><a href="/screenshot/${i.runId}">view screenshot</a></td>
          <td><form method="POST" action="/resume/${i.runId}"><button type="submit">Resume</button></form></td>
        </tr>`,
    )
    .join("");

  // Send the whole page: either "nothing pending" or the table of rows.
  res.send(`
    <html><body>
      <h1>Operator Console</h1>
      ${
        interventions.length === 0
          ? "<p>No pending interventions.</p>"
          : `<table border="1" cellpadding="6">
               <tr><th>Run</th><th>Reason</th><th>Stopped at</th><th>Evidence</th><th></th></tr>
               ${rows}
             </table>`
      }
    </body></html>
  `);
});

// Shows the screenshot captured at the moment this run paused.
app.get("/screenshot/:runId", (req, res) => {
  const intervention = listPendingInterventions().find((i) => i.runId === req.params.runId);
  if (!intervention) {
    res.status(404).send("Not found");
    return;
  }

  res.sendFile(intervention.screenshotPath, { root: process.cwd() });
});

// Resume button posts here: marks it resolved so the paused run continues.
app.post("/resume/:runId", (req, res) => {
  resolveIntervention(req.params.runId);
  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Operator console running at http://localhost:${port}`);
});
