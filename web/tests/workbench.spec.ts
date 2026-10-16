import { test, expect, type Page } from "@playwright/test";
import { readFile, mkdir, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { unzipSync, strFromU8 } from "fflate";
const current = (page: Page) =>
  page.locator(".swiper-slide-active .scene-content");
const saved = (page: Page) =>
  expect(
    page.getByRole("status").filter({ hasText: /^已保存$/ }),
  ).toBeVisible();
const go = async (page: Page, index: number) => {
  await page
    .getByRole("button", { name: `第 ${index} 屏`, exact: true })
    .click();
  await expect(page.locator(".swiper-slide").nth(index - 1)).toHaveClass(/swiper-slide-active/);
  await expect(current(page)).toHaveAttribute("data-scene-id", /.+/);
};
const edit = async (page: Page) => {
  await page.getByRole("button", { name: "编辑当前屏", exact: true }).click();
  await expect(page.getByRole("tab", { name: "内容", exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".flow-editor")
        .evaluate((el) => el.getBoundingClientRect().right <= innerWidth),
    )
    .toBe(true);
};
const settle = async (page: Page) => {
  const letters = current(page).locator(".scene-heading [aria-hidden=true]");
  if (await letters.count())
    await expect
      .poll(() => letters.last().evaluate((el) => getComputedStyle(el).opacity))
      .toBe("1");
};
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on("pageerror", (error) => list.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "编辑当前屏", exact: true }),
  ).toBeVisible();
  await saved(page);
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

const cloudFrame = (page: Page) => page.evaluate(() => {
  const effect = (window as unknown as {
    VANTA?: { current?: { req?: number; renderer?: { info: { render: { frame: number } } } } }
  }).VANTA?.current;
  return { running: effect?.req !== undefined, frame: effect?.renderer?.info.render.frame ?? -1 };
});

test("编辑浮层开关保持完整画布、背景、字号和内容位置", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const layout = () => page.evaluate(() => {
    const selectors = [".experience-pages", ".swiper-slide-active .scene-content", ".swiper-slide-active .scene-copy", ".swiper-slide-active .scene-heading", ".swiper-slide-active .scene-small-text", ".swiper-slide-active .photo-field", ".swiper-slide-active .photo-slot", ".swiper-slide-active .outro-stage", ".scene-dock"];
    return selectors.flatMap(selector => Array.from(document.querySelectorAll(selector), el => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return { selector, x: rect.x, y: rect.y, width: rect.width, height: rect.height, fontSize: style.fontSize, opacity: style.opacity };
    }));
  });
  for (const viewport of [{ width: 1568, height: 884 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const presetId of ["trio", "gallery", "outro"]) {
      await test.step(`${viewport.width}px / ${presetId}`, async () => {
        await page.evaluate(presetId => window.flowAgent!.apply({ scene: 1, presetId }), presetId);
        await expect(current(page)).toHaveClass(new RegExp(`preset-${presetId}`));
        await expect(current(page)).toHaveCSS("height", `${viewport.height}px`);
        const before = await layout();
        expect(before[0].width).toBe(viewport.width);
        await edit(page);
        expect(await layout()).toEqual(before);
        if (presetId === "outro") {
          const stage = await current(page).locator(".outro-stage").boundingBox();
          expect(stage).toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height });
        }
        await page.getByRole("button", { name: "收起编辑", exact: true }).click();
        await expect(page.locator(".flow-editor")).toHaveCount(0);
        expect(await layout()).toEqual(before);
      });
    }
  }
});

test("收尾禁用背景设置，切回普通页面后恢复并可修改", async ({ page }) => {
  const original = await page.evaluate(() => window.flowAgent!.inspect()!.background);
  await page.evaluate(() => window.flowAgent!.apply({ scene: 1, presetId: "outro" }));
  await edit(page);
  await page.getByRole("tab", { name: "氛围", exact: true }).click();
  const background = page.getByRole("group", { name: "背景设置", exact: true });
  await expect(background).toHaveAttribute("disabled", "");
  await expect(page.getByText("收尾页使用固定黑场", { exact: false })).toBeVisible();
  await expect(background.getByRole("button", { name: "云朵", exact: true })).toBeDisabled();
  await expect(background.getByRole("button", { name: "青屿", exact: true })).toBeDisabled();
  await expect(background.getByRole("textbox", { name: "背景颜色 1", exact: true })).toBeDisabled();
  await expect(background.getByLabel("背景流动速度", { exact: true })).toHaveAttribute("data-disabled", "");
  await expect(background.getByRole("switch", { name: "暂停背景", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => window.flowAgent!.inspect()!.background)).toEqual(original);
  await go(page, 2);
  await expect(background).not.toHaveAttribute("disabled");
  await expect(background.getByRole("button", { name: "云朵", exact: true })).toBeEnabled();
  await background.getByRole("switch", { name: "暂停背景", exact: true }).click();
  await expect(background.getByLabel("背景流动速度", { exact: true })).toHaveAttribute("data-disabled", "");
  await background.getByRole("switch", { name: "暂停背景", exact: true }).click();
  await expect(background.getByLabel("背景流动速度", { exact: true })).not.toHaveAttribute("data-disabled");
  await background.getByRole("button", { name: "青屿", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.flowAgent!.inspect()!.background.preset)).toBe("sage");
  await go(page, 1);
  await expect(background).toHaveAttribute("disabled", "");
  const ink = page.getByRole("textbox", { name: "文字颜色 Hex", exact: true });
  await expect(ink).toHaveValue("#f4f6fa");
  await expect(page.getByRole("button", { name: "文字配色 #30384b", exact: true })).toBeDisabled();
  await ink.fill("#30384b");
  await ink.press("Tab");
  await expect(ink).toHaveValue("#f4f6fa");
  await page.getByRole("button", { name: "文字配色 #ffd166", exact: true }).click();
  await expect(current(page).locator(".scene-heading").first()).toHaveCSS("color", "rgb(255, 209, 102)");
  await go(page, 2);
  await background.getByRole("button", { name: "纯色素底", exact: true }).click();
  await expect(background.getByRole("textbox", { name: "背景颜色 1", exact: true })).toBeEnabled();
  for (const i of [2, 3, 4]) await expect(background.getByRole("textbox", { name: `背景颜色 ${i}`, exact: true })).toBeDisabled();
  await background.getByRole("button", { name: "云朵 · 层次", exact: true }).click();
  await expect(background.getByRole("textbox", { name: "背景颜色 3", exact: true })).toBeDisabled();
  for (const i of [1, 2, 4]) await expect(background.getByRole("textbox", { name: `背景颜色 ${i}`, exact: true })).toBeEnabled();
});

test("动效与脚注按版式能力禁用，开启灵动和选择效果后恢复", async ({ page }) => {
  await edit(page);
  await page.getByRole("tab", { name: "灵动", exact: true }).click();
  const motion = page.getByRole("switch", { name: "这一屏的灵动效果", exact: true });
  const text = page.getByRole("combobox", { name: "文字出场", exact: true });
  const photo = page.getByRole("combobox", { name: "图片效果", exact: true });
  const replay = page.getByRole("button", { name: "重新感受这一屏", exact: true });
  await motion.click();
  await expect(text).toBeDisabled();
  await expect(photo).toBeDisabled();
  await expect(replay).toBeDisabled();
  await motion.click();
  await expect(text).toBeEnabled();
  await expect(photo).toBeEnabled();
  await expect(replay).toBeEnabled();
  await page.evaluate(() => window.flowAgent!.apply({ scene: 1, presetId: "chart-full" }));
  await expect(text).toBeDisabled();
  await expect(replay).toBeEnabled();
  await page.evaluate(() => window.flowAgent!.apply({ scene: 1, presetId: "image", photoEffect: "still" }));
  await expect(text).toBeDisabled();
  await expect(photo).toBeEnabled();
  await expect(replay).toBeDisabled();
  await photo.click();
  await page.getByRole("option", { name: "轻盈入场", exact: true }).click();
  await expect(replay).toBeEnabled();
  await expect(page.locator(".flow-editor")).toBeVisible();
  await page.getByRole("tab", { name: "内容", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "脚注", exact: true })).toBeDisabled();
  await page.evaluate(() => window.flowAgent!.apply({ scene: 4, presetId: "film" }));
  await go(page, 4);
  await expect(page.getByRole("textbox", { name: "脚注", exact: true })).toBeDisabled();
  await page.getByRole("tab", { name: "氛围", exact: true }).click();
  await expect(page.getByRole("group", { name: "背景设置", exact: true })).toHaveAttribute("disabled", "");
  await page.getByRole("tab", { name: "灵动", exact: true }).click();
  await expect(motion).toBeDisabled();
  await expect(text).toBeDisabled();
  await expect(replay).toBeDisabled();
});

test("云朵限制高分屏像素，编辑和暂停时停止渲染并可原地恢复", async ({ browser, page: editor }) => {
  await editor.goto("about:blank");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  try {
    const page = await context.newPage();
    await page.goto("/");
    const canvas = page.locator(".vanta-backdrop canvas");
    await expect(canvas).toHaveCount(1);
    await canvas.evaluate(el => { el.dataset.persist = "cloud"; });
    const pixels = await canvas.evaluate(el => (el as HTMLCanvasElement).width * (el as HTMLCanvasElement).height);
    expect(pixels).toBeLessThanOrEqual(230400);
    await expect.poll(async () => (await cloudFrame(page)).frame).toBeGreaterThan(1);
    await edit(page);
    await expect.poll(async () => (await cloudFrame(page)).running).toBe(false);
    const frozen = (await cloudFrame(page)).frame;
    await page.waitForTimeout(180);
    expect((await cloudFrame(page)).frame).toBe(frozen);
    await page.getByRole("button", { name: "收起编辑", exact: true }).click();
    await expect.poll(async () => (await cloudFrame(page)).frame).toBeGreaterThan(frozen);
    await page.evaluate(() => window.flowAgent!.setBackground({ paused: true }));
    await expect.poll(async () => (await cloudFrame(page)).running).toBe(false);
    const paused = (await cloudFrame(page)).frame;
    await page.waitForTimeout(180);
    expect((await cloudFrame(page)).frame).toBe(paused);
    await page.evaluate(() => window.flowAgent!.setBackground({ paused: false, speed: 0 }));
    await expect.poll(async () => (await cloudFrame(page)).running).toBe(false);
    await page.evaluate(() => window.flowAgent!.setBackground({ speed: 0.2 }));
    await expect.poll(async () => (await cloudFrame(page)).running).toBe(true);
    await expect(canvas).toHaveAttribute("data-persist", "cloud");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(async () => (await cloudFrame(page)).running).toBe(false);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect.poll(async () => (await cloudFrame(page)).running).toBe(true);
  } finally {
    await context.close();
  }
});

test("收尾字幕可读并完全渐黑，编辑预览保留面板，换版式不显示旧屏名", async ({ page }) => {
  await page.evaluate(() => window.flowAgent!.apply({ scene: 1, presetId: "outro", headings: ["谢谢，再会。", "下一程，见。"], textColor: "#30384b" }));
  await expect(current(page)).toHaveClass(/composition-outro/);
  await expect(current(page).locator(".scene-heading").first()).toHaveCSS("color", "rgb(244, 246, 250)");
  await expect(page.locator(".scene-chip.active")).toHaveText("01");
  await expect.poll(async () => (await cloudFrame(page)).running).toBe(false);
  await expect(current(page).locator(".outro-veil")).toHaveCSS("opacity", "1");
  await expect(current(page).locator(".outro-veil")).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await edit(page);
  await expect(page.getByRole("textbox", { name: "场景名称" })).toHaveCount(0);
  await expect(current(page).locator(".outro-veil")).toHaveCount(0);
  await page.getByRole("tab", { name: "灵动", exact: true }).click();
  await page.getByRole("button", { name: "重新感受这一屏", exact: true }).click();
  await expect(current(page).locator(".outro-veil")).toHaveCSS("opacity", "1");
  await expect(page.locator(".flow-editor")).toBeVisible();
  await page.getByRole("tab", { name: "内容", exact: true }).click();
  await page.getByRole("textbox", { name: "主标题 1", exact: true }).fill("编辑后继续可见");
  await expect(current(page).locator(".outro-veil")).toHaveCount(0);
  await expect(current(page).locator(".plain-heading").first()).toHaveText("编辑后继续可见");
  await page.getByRole("button", { name: "换个版式", exact: true }).click();
  await page.locator(".preset-dialog").getByRole("button", { name: /^趋势图表/ }).click();
  await page.locator(".preset-dialog").getByRole("button", { name: "应用这个版式", exact: true }).click();
  await expect(current(page)).toHaveClass(/composition-chart/);
  await expect(page.locator(".preset-summary strong")).toHaveText("趋势图表");
  await expect(page.locator(".scene-chip.active")).toHaveText("01");
  await expect(current(page).locator(".outro-stage,.outro-veil")).toHaveCount(0);
  await page.getByRole("button", { name: "收起编辑", exact: true }).click();
  await expect.poll(async () => (await cloudFrame(page)).running).toBe(true);
});

test("默认轻淡入与静置图片，轻浮按屏可选，跨屏背景不重建", async ({
  page,
}) => {
  await expect(
    page.locator(".editor-grid,.pages-panel,.canvas-workspace"),
  ).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(current(page).locator("[data-text-kind=heading]")).toHaveCount(
    2,
  );
  await expect(current(page).locator("[data-text-kind=small]")).toHaveCount(2);
  await expect(page.locator(".experience")).toHaveClass(/transition-fade/);
  await expect.poll(() => page.evaluate(() => window.flowAgent?.inspect()?.scenes[0].textEffect)).toBe("fade");
  const canvas = page.locator(".ambient-background canvas");
  await canvas.evaluate((c) => (c.dataset.persist = "yes"));
  await settle(page);
  const body = current(page).locator(".tilted-card__body").first();
  await expect(current(page).locator(".scene-heading [aria-hidden=true]")).toHaveCount(0);
  await expect(current(page).locator(".plain-heading").first()).toHaveCSS("opacity", "1");
  const transform = await body.evaluate((el) => el.style.transform);
  await body.hover();
  await page.waitForTimeout(700);
  expect(await body.evaluate((el) => el.style.transform)).toBe(transform);
  await page.mouse.move(20, 100);
  await page.evaluate(() => window.flowAgent!.apply({ scene: 1, photoEffect: "float" }));
  await expect
    .poll(() => body.evaluate((el) => el.style.transform))
    .not.toBe(transform);
  await page.evaluate(() => window.flowAgent!.apply({ scene: 1, photoEffect: "still" }));
  await expect(body).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "evidence/v2/opening.png" });
  await go(page, 2);
  await expect(current(page).locator(".photo-slot")).toHaveCount(6);
  await settle(page);
  await page.screenshot({ path: "evidence/v2/gallery.png" });
  await expect(canvas).toHaveAttribute("data-persist", "yes");
  await expect(canvas).toHaveCount(1);
});

test("固定版式规定文字与图片位，编辑及刷新恢复", async ({ page }) => {
  await page.getByRole("button", { name: "添加一屏", exact: true }).click();
  await expect(page.locator(".preset-choice")).toHaveCount(18);
  await page
    .locator(".preset-dialog")
    .getByRole("button", { name: /^双图叙事/ })
    .click();
  await page
    .locator(".preset-dialog")
    .getByRole("button", { name: "添加这个场景", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: /^主标题 / })).toHaveCount(2);
  await expect(page.getByRole("textbox", { name: /^小文本 / })).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "添加主标题", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "主标题 1", exact: true })
    .fill("流动的想法");
  await page
    .getByRole("textbox", { name: "主标题 2", exact: true })
    .fill("值得被看见。");
  await page
    .getByRole("textbox", { name: "小文本 1", exact: true })
    .fill("这是实际编辑的小说明。");
  await expect(
    current(page).locator("[data-text-kind=heading]").first(),
  ).toContainText("流动的想法");
  await saved(page);
  await page.reload();
  await edit(page);
  await expect(
    page.getByRole("textbox", { name: "主标题 1", exact: true }),
  ).toHaveValue("流动的想法");
  await expect(page.getByRole("textbox", { name: /^主标题 / })).toHaveCount(2);
  await expect(page.getByRole("textbox", { name: /^小文本 / })).toHaveCount(2);
  await page.screenshot({ path: "evidence/v2/editor.png" });
});

test("图片批量选择、粘贴、六张上限和 Blob 刷新恢复", async ({ page }) => {
  await edit(page);
  await page.getByRole("button", { name: "换个版式", exact: true }).click();
  await page
    .locator(".preset-dialog")
    .getByRole("button", { name: /^六图画廊/ })
    .click();
  await page
    .locator(".preset-dialog")
    .getByRole("button", { name: "应用这个版式", exact: true })
    .click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "添加图片", exact: true }).click();
  await (
    await chooser
  ).setFiles(["public/media/ocean.jpg", "public/media/alpine.jpg"]);
  await expect(page.locator(".photo-edit-tile")).toHaveCount(5);
  const bytes = [...(await readFile("public/media/botanical.jpg"))];
  const paste = () =>
    page.evaluate((bytes) => {
      const d = new DataTransfer();
      d.items.add(
        new File([new Uint8Array(bytes)], "粘贴.jpg", { type: "image/jpeg" }),
      );
      document.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: d, bubbles: true }),
      );
    }, bytes);
  await paste();
  await expect(page.locator(".photo-edit-tile")).toHaveCount(6);
  await paste();
  await expect(
    page.getByText("当前版式有 6 个图片位；换个版式可以放更多", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".photo-edit-tile")).toHaveCount(6);
  await expect(
    page.getByRole("button", { name: "添加图片", exact: true }),
  ).toHaveCount(0);
  await saved(page);
  await page.reload();
  await edit(page);
  await expect(page.locator(".photo-edit-tile")).toHaveCount(6);
  const images = current(page).locator(".photo-frame img");
  await expect
    .poll(() =>
      images.evaluateAll((images) =>
        images.every((img) => (img as HTMLImageElement).naturalWidth > 0),
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "删除图片 6", exact: true }).click();
  await expect(page.locator(".photo-edit-tile")).toHaveCount(5);
});

test("场景新建复制、排序、确认删除和持久化", async ({ page }) => {
  await edit(page);
  await page.getByRole("button", { name: "复制这一屏", exact: true }).click();
  await expect(page.locator(".scene-chip")).toHaveCount(5);
  // 名称已不再提供输入框，通过 flowAgent 改名验证持久化路径
  await page.evaluate(() =>
    window.flowAgent!.apply({ scene: 2, name: "新复制的片刻" }),
  );
  await page.getByRole("button", { name: "下移场景", exact: true }).click();
  await expect(page.locator(".scene-chip").nth(2)).toHaveAttribute(
    "aria-current",
    "page",
  );
  await saved(page);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => window.flowAgent!.inspect()!.scenes[2].name))
    .toBe("新复制的片刻");
  await edit(page);
  await page.getByRole("button", { name: "删除这一屏", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "移除这一屏", exact: true })
    .click();
  await expect(page.locator(".scene-chip")).toHaveCount(4);
});

test("真实视频上传、播放、离屏暂停，原生全屏与键盘切屏", async ({ page }) => {
  await go(page, 4);
  await edit(page);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "替换视频", exact: true }).click();
  await (await chooser).setFiles("public/media/flower.mp4");
  await expect(page.getByText("视频已加入", { exact: true })).toBeVisible();
  await saved(page);
  await page.reload();
  const video = current(page).locator("video");
  await video.evaluate((v: HTMLVideoElement) => v.play());
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(0);
  const handle = await video.elementHandle();
  await page.keyboard.press("ArrowLeft");
  await expect(current(page)).toHaveClass(/composition-editorial/);
  expect(await handle!.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  await page.getByRole("button", { name: "全屏播放", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(true);
  await page.keyboard.press("Space");
  await expect(current(page)).toHaveClass(/composition-cinema/);
  await page.keyboard.press("Escape");
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(false);
  await page.screenshot({ path: "evidence/v2/video.png" });
});

test("氛围配色、灵动开关和背景暂停刷新恢复", async ({ page }) => {
  await edit(page);
  await page.getByRole("tab", { name: "氛围", exact: true }).click();
  await page.getByRole("button", { name: "青屿", exact: true }).click();
  await page.getByRole("switch", { name: "暂停背景", exact: true }).click();
  await page.getByRole("tab", { name: "灵动", exact: true }).click();
  await page
    .getByRole("switch", { name: "这一屏的灵动效果", exact: true })
    .click();
  await saved(page);
  // 保存后到 reload 之间任何 pending useEffect 都得有机会 flush
  await page.waitForTimeout(200);
  await page.reload();
  await edit(page);
  await page.getByRole("tab", { name: "灵动", exact: true }).click();
  await expect(
    page.getByRole("switch", { name: "这一屏的灵动效果", exact: true }),
  ).not.toBeChecked();
  await page.getByRole("tab", { name: "氛围", exact: true }).click();
  await expect(
    page.getByRole("switch", { name: "暂停背景", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("button", { name: "青屿", exact: true }),
  ).toHaveClass(/chosen/);
});

test("保存失败保留内容，可重试并在刷新后读回", async ({ page }) => {
  await edit(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as unknown as { restore: () => void }).restore = () =>
      (IDBObjectStore.prototype.put = original);
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === "projects")
        throw new DOMException("模拟存储空间不足", "QuotaExceededError");
      return original.apply(this, args);
    };
  });
  await page
    .getByRole("textbox", { name: "主标题 1", exact: true })
    .fill("保留这个想法");
  await expect(
    page.getByText("保存失败，当前内容仍保留", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "主标题 1", exact: true }),
  ).toHaveValue("保留这个想法");
  await page.evaluate(() =>
    (window as unknown as { restore: () => void }).restore(),
  );
  await page.getByRole("button", { name: "重试保存", exact: true }).click();
  await saved(page);
  await page.reload();
  await edit(page);
  await expect(
    page.getByRole("textbox", { name: "主标题 1", exact: true }),
  ).toHaveValue("保留这个想法");
});

test("旧版项目原件备份并迁移到新限制", async ({ page }) => {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("stage-workbench");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("projects", "readwrite");
      transaction
        .objectStore("projects")
        .put({
          id: "current",
          name: "已有项目",
          selectedId: "old-scene",
          updatedAt: 1,
          background: {
            colors: ["#e7e9f5", "#d3daef", "#f5e9de", "#ece6f1"],
            speed: 0.18,
            paused: false,
            preset: "mist",
          },
          slides: [
            {
              id: "old-scene",
              title: "我的旧标题",
              body: "保留旧正文",
              kicker: "旧眉题",
              layout: "split",
              imageId: "botanical",
              cards: [],
              table: [["A", "B"]],
            },
          ],
        });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  });
  await page.reload();
  await edit(page);
  await expect(
    page.getByRole("textbox", { name: "主标题 1", exact: true }),
  ).toHaveValue("我的旧标题");
  await expect(
    page.getByRole("textbox", { name: "小文本 2", exact: true }),
  ).toHaveValue("保留旧正文");
  const backup = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((r) => {
      const q = indexedDB.open("stage-workbench");
      q.onsuccess = () => r(q.result);
    });
    return await new Promise((resolve) => {
      const q = db
        .transaction("projects")
        .objectStore("projects")
        .get("v0.1-backup");
      q.onsuccess = () => resolve(q.result.name);
    });
  });
  expect(backup).toBe("已有项目");
});

test("ZIP 含运行时和媒体，独立来源离线运行、播放视频并可导入继续编辑", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  await edit(page);
  await page
    .getByRole("textbox", { name: "主标题 1", exact: true })
    .fill("带走这一段灵感");
  await saved(page);
  await page.getByRole("button", { name: "收起编辑", exact: true }).click();
  const downloadPromise = page.waitForEvent("download", { timeout: 20000 });
  await page.getByRole("button", { name: "打包带走", exact: true }).click();
  const download = await downloadPromise;
  await mkdir("releases", { recursive: true });
  const zipPath = "releases/流光-网页运行包.zip";
  await download.saveAs(zipPath);
  const files = unzipSync(new Uint8Array(await readFile(zipPath)));
  expect(files["index.html"]).toBeDefined();
  expect(files["start.mjs"]).toBeDefined();
  expect(files["start.command"]).toBeDefined();
  expect(files["start.bat"]).toBeDefined();
  expect(files["agent.mjs"]).toBeDefined();
  expect(files["presets.json"]).toBeDefined();
  const manifest = JSON.parse(strFromU8(files["project.json"]));
  expect(manifest.project.scenes[0].headings[0]).toBe("带走这一段灵感");
  expect(manifest.media.length).toBe(7);
  expect(manifest.media.every((m: { path: string }) => files[m.path])).toBe(
    true,
  );
  const folder = await mkdtemp(join(tmpdir(), "flow-portable-"));
  for (const [name, data] of Object.entries(files)) {
    const path = join(folder, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }
  let server: ChildProcess | undefined;
  // 验证独立播放器时释放编辑器的 WebGL，避免两个上下文争抢截图所需的渲染资源。
  await page.goto("about:blank");
  const isolated = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  try {
    server = spawn(process.execPath, ["start.mjs"], {
      cwd: folder,
      env: { ...process.env, PORT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const address = await new Promise<string>((resolve, reject) => {
      let output = "";
      server!.stdout!.on("data", (chunk) => {
        output += chunk.toString();
        const found = output.match(/http:\/\/127\.0\.0\.1:\d+\//);
        if (found) resolve(found[0]);
      });
      server!.on("error", reject);
      setTimeout(() => reject(new Error("便携启动器超时")), 10000).unref();
    });
    const local = await isolated.newPage();
    const requests: string[] = [];
    const failed: string[] = [];
    local.on("pageerror", (e) => failed.push(e.message));
    await local.route("**/*", (route) => {
      const url = route.request().url();
      if (
        url.startsWith(address) ||
        url.startsWith("blob:") ||
        url.startsWith("data:")
      ) {
        requests.push(url);
        return route.continue();
      }
      return route.abort();
    });
    await local.goto(address);
    await expect(
      current(local).locator("[data-text-kind=heading]").first(),
    ).toContainText("带走这一段灵感");
    await expect
      .poll(() =>
        current(local)
          .locator(".photo-frame img")
          .evaluateAll((images) =>
            images.every((img) => (img as HTMLImageElement).naturalWidth > 0),
          ),
      )
      .toBe(true);
    expect(
      await local.evaluate(async () => await indexedDB.databases()),
    ).toEqual([]);
    await settle(local);
    expect(
      await current(local)
        .locator("[data-text-kind=heading]")
        .first()
        .evaluate((el) => el.getBoundingClientRect().right < innerWidth * 0.49),
    ).toBe(true);
    await local.screenshot({ path: "evidence/v2/portable-player.png" });
    await writeFile(
      join(folder, "patch.json"),
      JSON.stringify({
        scene: 1,
        presetId: "trio",
        headings: ["Agent 修改后的灵感", "固定预设"],
        texts: ["配置驱动"],
        font: "serif",
        textColor: "#304d60",
        photoEffect: "reveal",
      }),
    );
    execFileSync(process.execPath, ["agent.mjs", "apply", "patch.json"], {
      cwd: folder,
    });
    await local.reload();
    await expect(
      current(local).locator("[data-text-kind=heading]").first(),
    ).toContainText("Agent 修改后的灵感");
    await writeFile(
      join(folder, "agent-photo.jpg"),
      await readFile("public/media/hills.jpg"),
    );
    await writeFile(
      join(folder, "new-scene.json"),
      JSON.stringify({
        presetId: "pair",
        name: "交出素材的新屏",
        headings: ["本地图片，", "交给网页。"],
        texts: ["agent.mjs 复制素材并登记清单。"],
        images: ["agent-photo.jpg"],
        textEffect: "fade",
        photoEffect: "still",
      }),
    );
    execFileSync(process.execPath, ["agent.mjs", "add", "new-scene.json"], {
      cwd: folder,
    });
    await local.reload();
    await expect
      .poll(() => local.evaluate(() => (window.flowAgent ? "no" : "yes")))
      .toBe("yes");
    await go(local, 5);
    await expect(
      current(local).locator("[data-text-kind=heading]").first(),
    ).toContainText("本地图片");
    await expect
      .poll(() =>
        current(local)
          .locator(".photo-frame img")
          .evaluateAll(
            (images) =>
              images.length === 1 &&
              images.every((img) => (img as HTMLImageElement).naturalWidth > 0),
          ),
      )
      .toBe(true);
    const added = JSON.parse(
      await readFile(join(folder, "project.json"), "utf8"),
    ) as { media: { path: string }[]; project: { scenes: { textEffect: string; photoEffect: string }[] } };
    expect(added.project.scenes[4].textEffect).toBe("fade");
    expect(added.project.scenes[4].photoEffect).toBe("still");
    expect(added.media.length).toBe(8);
    for (const p of added.media.map((m) => m.path)) {
      expect((await readFile(join(folder, p))).length).toBeGreaterThan(0);
    }
    await go(local, 4);
    const video = current(local).locator("video");
    await video.evaluate((v: HTMLVideoElement) => v.play());
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
      .toBeGreaterThan(0);
    const handle = await video.elementHandle();
    await go(local, 3);
    expect(await handle!.evaluate((v: HTMLVideoElement) => v.paused)).toBe(
      true,
    );
    expect(failed).toEqual([]);
    expect(requests.some((url) => url.includes("/assets/"))).toBe(true);
  } finally {
    server?.kill();
    await isolated.close();
  }
  await page.goto("/");
  await edit(page);
  await page
    .getByRole("textbox", { name: "主标题 1", exact: true })
    .fill("导入前临时修改");
  await saved(page);
  await page.getByRole("button", { name: "收起编辑", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "打开运行包", exact: true }).click();
  await (await chooser).setFiles(zipPath);
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "打开并继续编辑", exact: true })
    .click();
  await expect(
    page.getByText("运行包已打开，可以继续编辑", { exact: true }),
  ).toBeVisible();
  await edit(page);
  await expect(
    page.getByRole("textbox", { name: "主标题 1", exact: true }),
  ).toHaveValue("带走这一段灵感");
});

const dataUrl = async (file: string, type: string) =>
  `data:${type};base64,${(await readFile(file)).toString("base64")}`;
test("Agent 一次交出多屏的图片与文字，从零搭出完整网页并持久化", async ({
  page,
}) => {
  await expect.poll(() => page.evaluate(() => !!window.flowAgent)).toBe(true);
  const beach = await dataUrl("public/media/ocean.jpg", "image/jpeg");
  const forest = await dataUrl("public/media/woodland.jpg", "image/jpeg");
  const field = await dataUrl("public/media/hills.jpg", "image/jpeg");
  const clip = await dataUrl("public/media/flower.mp4", "video/mp4");
  const first = await page.evaluate(
    async (args) =>
      window.flowAgent!.addScene({
        name: "开门见山",
        presetId: "pair",
        headings: ["两天后的海边，", "把话说清楚。"],
        texts: ["图片直接交给网页，版式自己安排。"],
        images: [args.beach, args.forest],
        photoEffect: "float",
      }),
    { beach, forest },
  );
  expect(first.scene).toBe(5);
  expect(first.addedImages).toBe(2);
  const second = await page.evaluate(
    async (args) =>
      window.flowAgent!.addScene({
        presetId: "image",
        images: [{ name: "山野.jpg", dataUrl: args.field }],
      }),
    { field },
  );
  expect(second.scene).toBe(6);
  expect(second.addedImages).toBe(1);
  const third = await page.evaluate(
    async (args) =>
      window.flowAgent!.addScene({
        headings: ["让故事，自己流动。"],
        texts: ["交给网页的视频，离页自动暂停。"],
        video: args.clip,
      }),
    { clip },
  );
  expect(third.scene).toBe(7);
  await expect(page.locator(".scene-chip")).toHaveCount(7);
  await expect(
    page.getByRole("button", { name: "第 5 屏", exact: true }),
  ).toBeVisible();
  await saved(page);
  await page.reload();
  await go(page, 5);
  const photos = current(page).locator(".photo-frame img");
  await expect(photos).toHaveCount(2);
  await expect
    .poll(() =>
      photos.evaluateAll((imgs) =>
        imgs.every((i) => (i as HTMLImageElement).naturalWidth > 0),
      ),
    )
    .toBe(true);
  await expect(
    current(page).locator("[data-text-kind=heading]").first(),
  ).toContainText("两天后的海边");
  await go(page, 7);
  const videoEl = current(page).locator("video");
  await videoEl.evaluate((v: HTMLVideoElement) => v.play());
  await expect
    .poll(() => videoEl.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(0);
  const videoHandle = await videoEl.elementHandle();
  await page.keyboard.press("ArrowLeft");
  expect(await videoHandle!.evaluate((v: HTMLVideoElement) => v.paused)).toBe(
    true,
  );
  await go(page, 5);
  await settle(page);
  await page.screenshot({ path: "evidence/v2/agent-built-scene.png" });
  const overflow = await page.evaluate(
    async (args) =>
      window.flowAgent!.addScene({
        presetId: "image",
        images: [args.beach, args.forest],
      }),
    { beach, forest },
  );
  expect(overflow.addedImages).toBe(1);
  expect(overflow.ignoredImages).toBe(1);
  await expect(page.getByRole("button", { name: "第 8 屏", exact: true })).toBeVisible();
});

test("Agent 接口选择预设、字体颜色与效果，纯单图及文字页自动布局", async ({
  page,
}) => {
  await expect.poll(() => page.evaluate(() => !!window.flowAgent)).toBe(true);
  const available = await page.evaluate(() => window.flowAgent!.listPresets());
  expect((available as unknown[]).length).toBe(18);
  await page.evaluate(() =>
    window.flowAgent!.apply({
      scene: 1,
      presetId: "statement",
      headings: ["Agent 写入的主张", "由预设保证效果"],
      texts: ["不用手动调整字号"],
      font: "serif",
      textColor: "#304d60",
      textEffect: "focus",
      photoEffect: "reveal",
    }),
  );
  await expect(current(page).locator("[data-text-kind=heading]")).toHaveCount(
    2,
  );
  await expect(current(page).locator(".photo-slot")).toHaveCount(0);
  await expect(current(page)).toHaveCSS("font-family", /Songti/);
  await page.evaluate(() =>
    window.flowAgent!.setBackground({
      colors: ["#e5eee6", "#bfd2c8", "#eee7d5", "#e1e9e5"],
      speed: 0.3,
      paused: false,
    }),
  );
  await saved(page);
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => window.flowAgent?.inspect()?.scenes[0].font),
    )
    .toBe("serif");
  await page.evaluate(() =>
    window.flowAgent!.apply({ scene: 1, presetId: "image" }),
  );
  await expect(current(page).locator("[data-text-kind=heading]")).toHaveCount(
    0,
  );
  await expect(current(page).locator("[data-text-kind=small]")).toHaveCount(0);
  await expect(current(page).locator(".photo-slot")).toHaveCount(1);
  await edit(page);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "添加图片", exact: true }).click();
  await (await chooser).setFiles("public/media/ocean.jpg");
  await expect(current(page).locator(".photo-frame img")).toBeVisible();
  await page.getByRole("button", { name: "收起编辑", exact: true }).click();
  await page.screenshot({ path: "evidence/v2/single-image-preset.png" });
});

test("v0.3 深色背景、脚注、折线图、结尾收束与切屏转场", async ({ page }) => {
  test.setTimeout(75000);
  await expect.poll(() => page.evaluate(() => !!window.flowAgent)).toBe(true);
  await page.evaluate(() => window.flowAgent!.setBackground({ preset: "ink" }));
  await expect
    .poll(() =>
      page.evaluate(() => window.flowAgent!.inspect()!.background.kind),
    )
    .toBe("mesh");
  await page.evaluate(() =>
    window.flowAgent!.apply({
      scene: 1,
      textColor: "#f4f6fa",
      footnote: "数据截至 2026 年 · 内部资料",
    }),
  );
  await expect(current(page).locator(".scene-footnote")).toContainText(
    "数据截至 2026 年",
  );
  await expect(
    current(page).locator("[data-text-kind=heading]").first(),
  ).toHaveCSS("color", "rgb(244, 246, 250)");
  await page.evaluate(() =>
    window.flowAgent!.setBackground({ preset: "carbon" }),
  );
  await expect(page.locator(".ambient-background canvas")).toHaveCount(0);
  await expect(page.locator(".ambient-background")).toHaveCSS(
    "background-color",
    "rgb(13, 15, 20)",
  );
  await page.evaluate(() =>
    window.flowAgent!.addScene({
      presetId: "chart-line",
      name: "趋势",
      headings: ["增长曲线，一目了然。"],
      texts: ["图表接入。"],
      textColor: "#f4f6fa",
      chart: {
        categories: ["一月", "二月", "三月", "四月"],
        series: [{ label: "增长", values: [9, 15, 13, 24] }],
      },
    }),
  );
  await go(page, 5);
  await expect(current(page).locator(".scene-chart svg").first()).toBeVisible();
  await expect(
    current(page).locator(".recharts-line path").first(),
  ).toHaveAttribute("stroke", /#5a7db8/);
  const overlap = await page.evaluate(() => {
    const copy = document
      .querySelector(".swiper-slide-active .scene-copy")!
      .getBoundingClientRect();
    const chart = document
      .querySelector(".swiper-slide-active .scene-chart")!
      .getBoundingClientRect();
    return copy.bottom > chart.top + 4;
  });
  expect(overlap).toBe(false);
  await page.evaluate(() =>
    window.flowAgent!.addScene({
      presetId: "outro",
      name: "谢谢",
      headings: ["谢谢。"],
    }),
  );
  await go(page, 6);
  await settle(page);
  const endingTitle = current(page).locator(".scene-heading").first();
  const endingBounds = await endingTitle.boundingBox();
  expect(endingBounds).not.toBeNull();
  expect(endingBounds!.y).toBeGreaterThan(0);
  expect(endingBounds!.y + endingBounds!.height).toBeLessThan(page.viewportSize()!.height);
  await expect
    .poll(
      () =>
        current(page)
          .locator(".outro-veil")
          .evaluate((el) => parseFloat(getComputedStyle(el).opacity)),
      { timeout: 9000 },
    )
    .toBeGreaterThan(0.95);
  await page.screenshot({ path: "evidence/v3/outro-black.png" });
  await page.evaluate(() => window.flowAgent!.setTransition("fade"));
  await go(page, 5);
  await expect(page.locator(".experience")).toHaveClass(/transition-fade/);
  await page.evaluate(() => window.flowAgent!.setTransition("cards"));
  await expect(page.locator(".experience")).toHaveClass(/transition-cards/);
  await saved(page);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => window.flowAgent!.inspect()!.transition))
    .toBe("cards");
  await expect
    .poll(() =>
      page.evaluate(() => window.flowAgent!.inspect()!.background.preset),
    )
    .toBe("carbon");
  await expect
    .poll(() =>
      page.evaluate(
        () => !!window.flowAgent!.inspect()!.scenes.find((s) => s.chart),
      ),
    )
    .toBe(true);
});

test("v0.3 便携运行包在深色背景与折线图下独立运行", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  await page.evaluate(() =>
    window.flowAgent!.addScene({
      presetId: "chart-line",
      name: "离线趋势",
      headings: ["离线图表。"],
      chart: {
        categories: ["A", "B", "C"],
        series: [{ label: "增长", values: [3, 7, 5] }],
      },
    }),
  );
  await page.evaluate(() =>
    window.flowAgent!.addScene({
      presetId: "outro",
      name: "离线结尾",
      headings: ["完。"],
    }),
  );
  await saved(page);
  const downloadPromise = page.waitForEvent("download", { timeout: 20000 });
  await page.getByRole("button", { name: "打包带走", exact: true }).click();
  const download = await downloadPromise;
  await mkdir("releases", { recursive: true });
  await download.saveAs("releases/流光-网页运行包.zip");
  const files = unzipSync(
    new Uint8Array(await readFile("releases/流光-网页运行包.zip")),
  );
  const folder = await mkdtemp(join(tmpdir(), "flow-portable-v3-"));
  for (const [name, data] of Object.entries(files)) {
    const p = join(folder, name);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data);
  }
  let server: ChildProcess | undefined;
  const isolated = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  try {
    server = spawn(process.execPath, ["start.mjs"], {
      cwd: folder,
      env: { ...process.env, PORT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const address = await new Promise<string>((res, rej) => {
      let out = "";
      server!.stdout!.on("data", (c) => {
        out += c;
        const f = out.match(/http:\/\/127\.0\.0\.1:\d+\//);
        if (f) res(f[0]);
      });
      server!.on("error", rej);
      setTimeout(() => rej(new Error("便携启动器超时")), 10000).unref();
    });
    const local = await isolated.newPage();
    local.on("pageerror", (e) =>
      errors.set(page, [...(errors.get(page) || []), e.message]),
    );
    await local.goto(address);
    await expect(current(local)).toHaveAttribute("data-scene-id", /.+/);
    await go(local, 5);
    await expect(
      current(local).locator(".scene-chart svg").first(),
    ).toBeVisible();
    await go(local, 6);
    await settle(local);
    await expect
      .poll(
        () =>
          current(local)
            .locator(".outro-veil")
            .evaluate((el) => parseFloat(getComputedStyle(el).opacity)),
        { timeout: 9000 },
      )
      .toBeGreaterThan(0.95);
    await writeFile(
      join(folder, "v3-patch.json"),
      JSON.stringify({
        transition: "fade",
        background: {
          kind: "solid",
          colors: ["#0d0f14", "#0d0f14", "#0d0f14", "#0d0f14"],
        },
      }),
    );
    execFileSync(process.execPath, ["agent.mjs", "apply", "v3-patch.json"], {
      cwd: folder,
    });
    await local.reload();
    await expect(local.locator(".experience")).toHaveClass(/transition-fade/);
    await expect(local.locator(".ambient-background")).toHaveCSS(
      "background-color",
      "rgb(13, 15, 20)",
    );
    await writeFile(
      join(folder, "v3-chart.json"),
      JSON.stringify({
        presetId: "chart-full",
        name: "图包新屏",
        texts: ["agent 新增图表屏。"],
        footnote: "由 agent.mjs 写入",
        chart: {
          categories: ["Q1", "Q2", "Q3"],
          series: [{ label: "指标", values: [4, 9, 7] }],
        },
      }),
    );
    execFileSync(process.execPath, ["agent.mjs", "add", "v3-chart.json"], {
      cwd: folder,
    });
    await local.reload();
    await go(local, 7);
    await expect(
      current(local).locator(".scene-chart svg").first(),
    ).toBeVisible();
    await expect(current(local).locator(".scene-footnote")).toContainText(
      "由 agent.mjs 写入",
    );
  } finally {
    server?.kill();
    await isolated.close();
  }
});

test("v0.3.1 云朵背景、字体选项、色板联动文字色与无品牌标志", async ({ page }) => {
  test.setTimeout(90000);
  await expect.poll(() => page.evaluate(() => !!window.flowAgent)).toBe(true);
  await expect(page.locator(".flow-wordmark")).toHaveCount(0);
  await expect(page.locator(".identity-separator")).toHaveCount(0);
  await page.evaluate(() =>
    window.flowAgent!.setBackground({ preset: "cumulus" }),
  );
  await expect(page.locator(".vanta-backdrop canvas").first()).toBeAttached({
    timeout: 15000,
  });
  await expect
    .poll(() =>
      page.evaluate(() => window.flowAgent!.inspect()!.scenes[0].textColor),
    )
    .toBe("#2f3d55");
  await page.screenshot({ path: "evidence/v3/clouds-cumulus.png" });
  const textureResponse = page.waitForResponse(response => response.url().includes('vanta-clouds2-noise') && response.status() === 200);
  await page.evaluate(() => window.flowAgent!.setBackground({ preset: "dusk" }));
  const texture = await textureResponse;
  expect(new URL(texture.url()).origin).toBe(new URL(page.url()).origin);
  expect((await texture.body()).subarray(0, 4)).toEqual(Buffer.from([137, 80, 78, 71]));
  await expect(page.locator(".vanta-backdrop canvas").first()).toBeAttached();
  await expect
    .poll(() =>
      page.evaluate(() => window.flowAgent!.inspect()!.scenes[0].textColor),
    )
    .toBe("#f5e9da");
  await page.evaluate(() =>
    window.flowAgent!.apply({ scene: 1, font: "alimama" }),
  );
  await expect(current(page).locator(".scene-heading").first()).toHaveCSS(
    "font-family",
    /Alimama ShuHeiTi/,
  );
  await expect
    .poll(async () =>
      page.evaluate(
        () => document.fonts.check("700 40px 'Alimama ShuHeiTi'"),
      ),
    )
    .toBe(true);
  await page.evaluate(() =>
    window.flowAgent!.apply({ scene: 1, font: "georgia" }),
  );
  await expect(current(page).locator(".scene-heading").first()).toHaveCSS(
    "font-family",
    /Georgia/,
  );
  await page.evaluate(() =>
    window.flowAgent!.setBackground({ preset: "dawn" }),
  );
  await saved(page);
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => window.flowAgent!.inspect()!.background.preset),
    )
    .toBe("dawn");
  await expect(current(page).locator(".vanta-backdrop")).toHaveCount(0);
});
