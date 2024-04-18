import { createCrawl, ElementHandle, Page } from 'x-crawl'

const courseList = [
  {
    name: 'C#与.NET程序设计',
    state: false,
    url: 'https://gzmtulearning.o-learn.cn/learning/student/studentIndex.action#!/index/course/learn/courseware?courseId=ff80808189b9bea90189ba105d5a0c3d'
  },
  {
    name: '大学英语II',
    state: false,
    url: 'https://gzmtulearning.o-learn.cn/learning/student/studentIndex.action#!/index/course/learn/courseware/video?itemId=ff80808189b9bea90189bab1805e50b3&courseId=ff80808189b9bea90189bab17e25502d'
  },
  {
    name: '毛泽东思想和中国特色社会主义理论体系概论（上）',
    state: false,
    url: 'https://gzmtulearning.o-learn.cn/learning/student/studentIndex.action#!/index/course/learn/courseware/video?itemId=ff8080818a442d0c018a63f5dbaf0c4f&courseId=ff8080818a442d0c018a63f5d8d00b30'
  },
  {
    name: '计算机导论',
    state: false,
    url: 'https://gzmtulearning.o-learn.cn/learning/student/studentIndex.action#!/index/course/learn/courseware/video?itemId=ff80808189b9bea90189e2b9704f2a1c&courseId=ff80808189b9bea90189e2b96e3929b0'
  },
  {
    name: '高等数学Ⅱ',
    state: false,
    url: 'https://gzmtulearning.o-learn.cn/learning/student/studentIndex.action#!/index/course/learn/courseware/video?itemId=ff8080818a442d0c018a63f564f9095a&courseId=ff8080818a442d0c018a63f5627a087d'
  }
]

const selectCourseList = courseList.filter((item) => !item.state)
for (const course of selectCourseList) {
  const { name, url } = course

  const myXCrawl = createCrawl({
    maxRetry: 3,
    crawlPage: {
      puppeteerLaunchOptions: {
        headless: false,
        executablePath:
          'C://Program Files//Google//Chrome//Application//chrome.exe',
        protocolTimeout: 7200000
      }
    },
    timeout: 600000
  })

  myXCrawl
    .crawlPage({
      url: 'https://gzmtu.o-learn.cn/',
      viewport: { width: 1920, height: 1080 }
    })
    .then(async (res) => {
      const { page } = res.data

      await page.waitForSelector('.page-home-index-content-nav-list-item', {
        timeout: 240000
      })
      console.log(`-------------- ${name} - 等待登录结束 --------------`)

      const plateEls = await page.$$('.page-home-index-content-nav-list-item')
      const demand = (await plateEls[1].$(
        '.nav-children > a'
      )) as ElementHandle<HTMLAnchorElement>
      await demand.click()

      await page.waitForSelector('.course-details-title', {
        timeout: 240000
      })
      const learnEls = await page.$$('.course-details-title')
      await learnEls[1].click()

      await sleep()

      const crawlPageSingleResult = await myXCrawl.crawlPage({
        url,
        viewport: { width: 1920, height: 1080 }
      })

      const learnPage = crawlPageSingleResult.data.page

      await learnPage.waitForSelector(
        "div[ng-repeat='chapterObj in courseLearnCoursewareConfig.chapterList']",
        { timeout: 240000 }
      )
      const chapterElHandleList = await learnPage.$$(
        "div[ng-repeat='chapterObj in courseLearnCoursewareConfig.chapterList']"
      )
      for (let i = 0; i < chapterElHandleList.length; i++) {
        console.log(`${name} - 处理第 ${i + 1} 章`)

        const chapterElHandleItem = chapterElHandleList[i]
        chapterElHandleItem.click()
        await sleep()

        // 获取该章未完成的小节
        const segmentElHandleList = await chapterElHandleItem.$$(
          '.course_chapter_item'
        )
        const unfinishedSegmentElHandleList: ElementHandle<Element>[] = []
        for (const item of segmentElHandleList) {
          const state = await item.$eval('.section_status i', (el) =>
            el.getAttribute('ng-switch-when')
          )
          if (state !== '2') {
            unfinishedSegmentElHandleList.push(item)
          }
        }

        // 处理未完成的小节
        for (const item of unfinishedSegmentElHandleList) {
          const res = await playSegmentVideo(learnPage, item)

          if (res) {
            // 拿到当前的 File 和 Video
            const navBarElHandles = await learnPage.$$('.courseware_menu_item')
            const fileElHandleIndexs: number[] = []
            const otherVideoElHandleIndexs: number[] = []
            try {
              await learnPage.$$eval(
                '.courseware_menu_item .item_name',
                (els) => {
                  els.splice(1).forEach((el, i) => {
                    el.textContent === '文档' || el.textContent === '资料'
                      ? fileElHandleIndexs.push(i + 1)
                      : otherVideoElHandleIndexs.push(i + 1)
                  })
                }
              )
            } catch {}

            // file
            for (const i of fileElHandleIndexs) {
              await navBarElHandles[i].click()
              await sleep()
            }

            // other video
            for (const i of otherVideoElHandleIndexs) {
              await playSegmentVideo(learnPage, navBarElHandles[i])
            }
          }
        }
      }
    })
}

async function playSegmentVideo(
  learnPage: Page,
  unfinishedSegmentElHandle: ElementHandle<Element>
) {
  // 点击对应小节
  await unfinishedSegmentElHandle.click()

  try {
    await learnPage.waitForSelector('video', { timeout: 10000 })

    // 设置视频静音
    await learnPage.$eval('video', (videoEl) => (videoEl.muted = true))

    // 等待视频播放完毕
    await learnPage.waitForSelector('.layui-layer-dialog', {
      timeout: 18000000
    })

    // 关闭弹窗
    await learnPage.waitForSelector('.layui-layer-dialog', {
      timeout: 18000000
    })

    await learnPage.click('.layui-layer-dialog .layui-layer-close')

    return true
  } catch (error) {
    return false
  }
}

async function sleep(timeout = 1000) {
  return await new Promise((r) => setTimeout(r, timeout))
}
