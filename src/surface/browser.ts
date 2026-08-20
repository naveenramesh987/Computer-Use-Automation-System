import { Browser, chromium, Page } from "playwright";

type Role = Parameters<Page["getByRole"]>[0];

// Opens a browser window on screen, so a user could look at or
// take over the same window later if needed.
export async function launch(): Promise<{ browser: Browser; page: Page }> {
  const browser = await chromium.launch({
    headless: false,
  });
  const page = await browser.newPage();
  return { browser, page };
}

export type Observation = {
  url: string;
  title: string;
  ariaSnapshot: string;
};

// Reads what's currently on the page: its title, its URL, and a simple
// text list of everything on it (buttons, text fields, links, etc.).
export async function observe(page: Page): Promise<Observation> {
  const url = page.url();
  const title = await page.title();
  const ariaSnapshot = await page.locator("body").ariaSnapshot();
  return { url, title, ariaSnapshot };
}

// Clicks something on the page. You identify it the same way a screen
// reader would: its type ("button", "link"...) and its visible text.
export async function click(
  page: Page,
  role: Role,
  name: string,
): Promise<void> {
  await page.getByRole(role, { name }).click();
}

// Types text into a field on the page, identified the same way.
export async function fill(
  page: Page,
  role: Role,
  name: string,
  value: string,
): Promise<void> {
  await page.getByRole(role, { name }).fill(value);
}
