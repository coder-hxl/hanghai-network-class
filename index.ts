import xCrawl, { ElementHandle, Page } from "x-crawl";

const learnUrls: string[] = [];

for (const url of learnUrls) {
  const myXCrawl = xCrawl({
    maxRetry: 3,
    enableRandomFingerprint: false,
    crawlPage: {
      puppeteerLaunch: {
        headless: false,
        executablePath:
          "C://Program Files//Google//Chrome//Application//chrome.exe",
        protocolTimeout: 7200000,
      },
    },
    timeout: 600000,
  });

  myXCrawl
    .crawlPage({
      url: "https://gzmtu.o-learn.cn/",
      viewport: { width: 1920, height: 1080 },
    })
    .then(async (res) => {
      const { page } = res.data;

      await page.waitForSelector(".page-home-index-content-nav-list-item", {
        timeout: 240000,
      });
      console.log("-------------- 等待登录结束 --------------");

      const plateEls = await page.$$(".page-home-index-content-nav-list-item");
      const demand = await plateEls[1].$(".nav-children > a");
      await demand!.click();

      await page.waitForSelector(".course-details-title", {
        timeout: 240000,
      });
      const learnEls = await page.$$(".course-details-title");
      await learnEls[1].click();

      await new Promise((r) => setTimeout(r, 1000));

      const crawlPageSingleResult = await myXCrawl.crawlPage({
        url,
        cookies: [],
        viewport: { width: 1920, height: 1080 },
      });

      const learnPage = crawlPageSingleResult.data.page;

      await learnPage.waitForSelector(".course_chapter_list", {
        timeout: 240000,
      });
      const chapterListElHandle = await learnPage.$(".course_chapter_list");
      const chapterItemElHandle = await chapterListElHandle!.$$(
        ".course_chapter_item"
      );

      // 过滤掉完成的
      const unfinishedIndexs = await chapterListElHandle!.$$eval(
        ".section_status i",
        (iEls) => {
          const res: number[] = [];
          iEls.forEach((iEl, i) => {
            if (iEl.getAttribute("ng-switch-when") !== "2") {
              res.push(i);
            }
          });

          return res;
        }
      );
      const unfinishedChapterItemElHandle = unfinishedIndexs.map(
        (i) => chapterItemElHandle[i]
      );

      for (let i = 0; i < unfinishedChapterItemElHandle.length; i++) {
        await HandleChapterItem(learnPage, unfinishedChapterItemElHandle[i]);

        // 拿到当前的 PPT 和 Video
        const navBarElHandles = await learnPage.$$(".courseware_menu_item");
        const { pptElHandleIndexs, otherVideoElHandleIndexs } =
          await learnPage.$$eval(".courseware_menu_item .item_name", (els) => {
            const res: {
              pptElHandleIndexs: number[];
              otherVideoElHandleIndexs: number[];
            } = { pptElHandleIndexs: [], otherVideoElHandleIndexs: [] };

            els.splice(1).forEach((el, i) => {
              el.textContent === "文档"
                ? res.pptElHandleIndexs.push(i + 1)
                : res.otherVideoElHandleIndexs.push(i + 1);
            });

            return res;
          });

        console.log(
          navBarElHandles.length,
          pptElHandleIndexs,
          otherVideoElHandleIndexs
        );

        // PPT
        for (const i of pptElHandleIndexs) {
          await navBarElHandles[i].click();
          await new Promise((r) => setTimeout(r, 1000));
        }

        // other video
        for (const i of otherVideoElHandleIndexs) {
          await HandleChapterItem(learnPage, navBarElHandles[i]);
        }

        console.log(`---------- video ${i} success ----------`);
      }
    });
}

async function HandleChapterItem(
  learnPage: Page,
  unfinishedChapterItemElHandle: ElementHandle<Element>
) {
  // 点击对应播放视频
  await unfinishedChapterItemElHandle.click();

  try {
    await learnPage.waitForSelector("video", { timeout: 300000 });
    // 设置视频静音
    await learnPage.$eval("video", (videoEl) => (videoEl.muted = true));

    // 等待视频播放完毕
    await learnPage.waitForSelector(".layui-layer-dialog", {
      timeout: 18000000,
    });

    // 关闭弹窗
    await learnPage.waitForSelector(".layui-layer-dialog", {
      timeout: 18000000,
    });

    await learnPage.click(".layui-layer-dialog .layui-layer-close");
  } catch (error) {}
}
