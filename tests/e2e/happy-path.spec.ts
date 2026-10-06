import { expect, test, type Browser, type Page } from "@playwright/test";

/** "3 / 18" → 18. The counter is the source of truth for how many cues this participant has. */
async function totalCues(page: Page): Promise<number> {
  const text = await page.getByText(/^\d+ \/ \d+$/).first().textContent();
  return Number(text!.split("/")[1]);
}

/** Consent + demographics + the four questions, ending on the game intro. */
async function startAndSurvey(page: Page) {
  await page.goto("/start");
  await page.getByLabel("Yoshingiz").selectOption("25-34");
  await page.locator("#country").selectOption("UZ");
  await page.getByRole("checkbox", { name: /18 yoshdan/ }).check();
  await page.getByRole("button", { name: "Oʻyinni boshlash" }).click();
  await page.waitForURL("**/survey");
  await page.getByRole("textbox").fill("vijdon");
  await page.getByRole("button", { name: /Keyingi/ }).click();
  await page.getByText("Din / Eʼtiqod").click();
  await page.getByRole("button", { name: /Keyingi/ }).click();
  await page.getByText("Juda tez-tez").click();
  await page.getByRole("button", { name: /Keyingi/ }).click();
  await page.getByText("Ikkalasi teng darajada").click();
  await page.getByRole("button", { name: "Oʻyinga oʻtish" }).click();
  await page.waitForURL("**/game");
  await page.getByRole("button", { name: "Boshladik" }).click();
}

/** Plays every cue as fast as a keyboard can: no waits between cues (regression for lost input). */
async function playFast(page: Page): Promise<number> {
  const total = await totalCues(page);
  for (let i = 0; i < total; i++) {
    await page.keyboard.type(`javob${i}`);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter"); // empty 2nd field = "no more answers"
  }
  await page.waitForURL("**/results");
  return total;
}

async function playGame(page: Page): Promise<number> {
  await page.getByRole("button", { name: "Boshladik" }).click();
  const total = await totalCues(page);
  const cue = page.locator("h1[lang=uz]");
  for (let i = 0; i < total; i++) {
    await expect(cue).toBeVisible();
    const word = await cue.textContent();
    await expect(page.getByText(`${i + 1} / ${total}`, { exact: true })).toBeVisible();

    if (i === 2) {
      await page.getByRole("button", { name: "Bilmayman / tanish emas" }).click();
    } else if (i === 3) {
      await page.getByRole("button", { name: "Oʻtkazib yuborish" }).click();
    } else {
      // A one-letter answer is rejected with a friendly message.
      if (i === 0) {
        await page.locator("#r0").fill("a");
        await page.keyboard.press("Enter");
        await expect(page.getByRole("alert").filter({ hasText: "Bitta harf" })).toBeVisible();
      }
      await page.locator("#r0").fill(i % 2 ? "ezgulik" : "Oʻzbekiston");
      await page.keyboard.press("Enter");
      await expect(page.locator("#r1")).toBeFocused();
      await page.locator("#r1").fill("insof");
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter"); // empty third field = "no more answers"
    }
    if (i < total - 1) await expect(cue).not.toHaveText(word!);
  }
  await page.waitForURL("**/results");
  return total;
}

async function adminLogin(page: Page, path: string) {
  await page.goto(path);
  await page.locator("#admin-password").fill("e2e-admin-password");
  await page.locator("#admin-password").press("Enter");
}

test("landing → consent → questionnaire → game → results → delete my data", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "uz-Latn");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Maʼnaviyat");
  // Link previews: Open Graph image and a favicon.
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /opengraph-image/);
  await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute("href", /icon/);
  await page.getByRole("link", { name: "Boshlash" }).click();

  // Consent + demographics
  await page.waitForURL("**/start");
  const submit = page.getByRole("button", { name: "Oʻyinni boshlash" });
  await page.getByLabel("Yoshingiz").selectOption("under18");
  await expect(page.getByText("faqat 18 yosh va undan kattalar")).toBeVisible();
  await page.getByLabel("Yoshingiz").selectOption("25-34");
  await page.locator("#country").selectOption("UZ");
  await page.locator("#region").selectOption("tashkent_city");
  await page.locator("#background").selectOption("na");
  await expect(submit).toBeDisabled();
  // The consent checkbox has a real accessible name.
  await page.getByRole("checkbox", { name: /18 yoshdan/ }).check();
  await expect(submit).toBeEnabled();
  await submit.click();

  // Questionnaire
  await page.waitForURL("**/survey");
  await expect(page.getByText("Savol 1 / 4")).toBeVisible();
  await page.getByRole("textbox").fill("vijdon");
  await page.getByRole("button", { name: /Keyingi/ }).click();

  await expect(page.getByText("Savol 2 / 4")).toBeVisible();
  for (const option of ["Din / Eʼtiqod", "Axloq / Odob / Ichki qadriyatlar", "Madaniy meros / Anʼanalar"]) {
    await page.getByText(option).click();
  }
  await expect(page.getByText("3 / 3 tanlandi")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Boshqa" })).toBeDisabled();
  await page.getByRole("button", { name: /Keyingi/ }).click();

  await expect(page.getByText("Savol 3 / 4")).toBeVisible();
  await page.getByText("Juda tez-tez").click();
  await page.getByRole("button", { name: /Keyingi/ }).click();

  await expect(page.getByText("Savol 4 / 4")).toBeVisible();
  await page.getByText("Ikkalasi teng darajada").click();
  await page.getByRole("button", { name: "Oʻyinga oʻtish" }).click();

  // Game
  await page.waitForURL("**/game");
  const total = await playGame(page);
  expect(total).toBe(18);

  // Results
  await expect(page.getByRole("heading", { name: "Rahmat!" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Sizning javoblaringiz" })).toHaveAttribute("aria-selected", "true");
  const cueNav = page.getByRole("navigation", { name: "Sizning javoblaringiz" }).getByRole("button");
  await expect(cueNav).toHaveCount(total);
  await cueNav.nth(2).click();
  await expect(page.getByText("Tanish emas deb belgilandi", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Keyingi soʻz" }).click();
  await expect(page.getByText("Oʻtkazib yuborildi", { exact: true })).toBeVisible();
  // One participant: no percentages, just "not enough data yet".
  await cueNav.nth(0).click();
  await expect(page.getByText(/10 kishi javob bergach/)).toBeVisible();
  await expect(page.getByTestId("delete-code")).toHaveText(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

  // Word map: the concept node plus the cues this participant played.
  await page.getByRole("tab", { name: "Soʻzlar xaritasi" }).click();
  await expect(page.getByRole("img", { name: /xaritasi/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "maʼnaviyat" })).toBeVisible();
  await expect(page.getByText("Inson yoki jamiyatning axloqiy")).toBeVisible();

  await page.getByRole("tab", { name: "Savolnoma" }).click();
  await expect(page.getByRole("heading", { name: "Bogʻliq tushunchalar" })).toBeVisible();

  // Results survive a refresh (session cookie), then the participant deletes their data.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Rahmat!" })).toBeVisible();
  await page.goto("/about#delete");
  await page.getByRole("button", { name: "Maʼlumotlarimni oʻchirish" }).click();
  await page.getByRole("button", { name: "Ha, butunlay oʻchirilsin" }).click();
  await expect(page.getByText("Maʼlumotlaringiz oʻchirildi.")).toBeVisible();
  await page.goto("/results");
  await page.waitForURL("**/start");
});

test("fast typing never loses a cue, and the delete code works from another browser", async ({ page, browser }) => {
  await startAndSurvey(page);
  const total = await playFast(page);
  await expect(page.getByRole("navigation", { name: "Sizning javoblaringiz" }).getByRole("button")).toHaveCount(total);
  const code = (await page.getByTestId("delete-code").textContent())!;

  // "Play more words" starts a new round with unseen cues.
  await page.getByRole("button", { name: /Yana \d+ ta soʻz oʻynash/ }).click();
  await page.waitForURL("**/game");
  await expect(page.getByText(`1 / ${total}`, { exact: true })).toBeVisible();
  await page.goto("/results");

  // Another browser (no cookie): delete with the code, typed in lower case without dashes.
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto("/about#delete");
  await p2.getByLabel("Oʻchirish kodi").fill(code.toLowerCase().replace(/-/g, " "));
  await p2.getByRole("button", { name: "Shu kod bilan oʻchirish" }).click();
  await p2.getByRole("button", { name: "Ha, butunlay oʻchirilsin" }).click();
  await expect(p2.getByText("Maʼlumotlaringiz oʻchirildi.")).toBeVisible();
  await other.close();

  // The original browser's session is gone too.
  await page.goto("/results");
  await page.waitForURL("**/start");
});

test("language switcher changes the UI language", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("link", { name: "Play" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: "Русский" }).click();
  await expect(page.getByRole("link", { name: "Начать" })).toBeVisible();
});

test("admin requires the password, lists words and renders charts", async ({ page, request }) => {
  expect((await request.get("/api/admin/export?type=responses")).status()).toBe(401);
  await adminLogin(page, "/admin/words");
  await expect(page.getByRole("cell", { name: /erksevarlik/ })).toBeVisible();
  await expect(page.getByText("imloni tekshiring")).toBeVisible();
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: "Grafiklar" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByLabel("X oʻqi")).toBeVisible();
});

test("admin survey link: chosen words only, own word count, counted per link", async ({ page, browser }: { page: Page; browser: Browser }) => {
  await adminLogin(page, "/admin/links");
  await page.locator("#link-name").fill("E2E guruh");
  await page.locator("#link-n").fill("5");
  await page.getByRole("button", { name: "Tozalash" }).click();
  const chips = page.getByRole("group", { name: "Soʻzlar" }).getByRole("button");
  const chosen: string[] = [];
  for (let i = 0; i < 6; i++) {
    chosen.push((await chips.nth(i).textContent())!.replace("✓", "").trim());
    await chips.nth(i).click();
  }
  await expect(page.getByText("6 ta tanlandi")).toBeVisible();
  await page.getByRole("button", { name: "Havola yaratish" }).click();
  const url = (await page.locator("li").filter({ hasText: "E2E guruh" }).locator("code").textContent())!;
  expect(url).toMatch(/\/s\/[A-Za-z0-9]{8}$/);

  const visitor = await browser.newContext();
  const p = await visitor.newPage();
  await p.goto(new URL(url).pathname);
  await p.waitForURL((u) => u.pathname === "/");
  await expect(p.getByText("5 ta soʻzga")).toBeVisible();
  await startAndSurvey(p);
  expect(await totalCues(p)).toBe(5);
  for (let i = 0; i < 5; i++) {
    const cue = (await p.locator("h1[lang=uz]").textContent())!.trim();
    expect(chosen).toContain(cue);
    await p.locator("#r0").fill(`soz${i}`);
    await p.keyboard.press("Enter");
    await p.keyboard.press("Enter");
    if (i < 4) await expect(p.locator("h1[lang=uz]")).not.toHaveText(cue);
  }
  await p.waitForURL("**/results");
  await visitor.close();

  await page.reload();
  await expect(page.locator("li").filter({ hasText: "E2E guruh" })).toContainText("1 ishtirokchi · 1 tugatgan");
});
