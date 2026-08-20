import path from "node:path";
import os from "node:os";
import { launch, observe, click, fill } from "./browser.js";

const baseUrl = process.env.MOCK_APP_BASE_URL ?? "http://localhost:4000";
const { browser, page } = await launch();

await page.goto(baseUrl);
await fill(page, "textbox", "Username", "jsmith");
await fill(page, "textbox", "Password", "demo1234");
await click(page, "button", "Sign In");
await page.waitForURL("**/members");

const afterLogin = await observe(page);
console.log("--- after login ---");
console.log(afterLogin.ariaSnapshot);

await fill(page, "textbox", "Member ID or Name", "12345");
await click(page, "button", "Search");

const searchResults = await observe(page);
console.log("--- search results ---");
console.log(searchResults.ariaSnapshot);

await click(page, "link", "View");
await page.waitForURL("**/members/12345");

const memberDetail = await observe(page);
console.log("--- member detail ---");
console.log(memberDetail.ariaSnapshot);

const screenshotPath = path.join(os.tmpdir(), "mock-app-smoke-test.png");
await page.screenshot({ path: screenshotPath });
console.log(`Screenshot saved to ${screenshotPath}`);

await browser.close();
