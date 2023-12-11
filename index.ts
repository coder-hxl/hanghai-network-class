import xCrawl, { XCrawlConfig, ElementHandle, Page } from 'x-crawl'

const xCrawlConfig: XCrawlConfig = {
  maxRetry: 3,
  enableRandomFingerprint: false,
  crawlPage: {
    puppeteerLaunch: {
      headless: false,
      executablePath:
        'C://Program Files//Google//Chrome//Application//chrome.exe',
      protocolTimeout: 7200000
    }
  },
  timeout: 600000
}

const pageConfig = {
  url: 'https://gzmtu.o-learn.cn/',
  viewport: { width: 1920, height: 1080 }
}

xCrawl(xCrawlConfig)
  .crawlPage(pageConfig)
  .then(async (res) => {
    const { page } = res.data

    await page.waitForSelector('.page-home-index-content-nav-list-item', {
      timeout: 240000
    })
    console.log(`-------------- 等待登录结束 --------------`)

    // 进入在线学习
    await page
      .$$('.page-home-index-content-nav-list-item')
      .then(async (elHandles) => {
        const btn = await elHandles[1].$('.nav-children > a')
        return btn?.click()
      })
    await page.waitForSelector('.course-name', { timeout: 240000 })
    await sleep()

    // 获取课程
    const courseInfoList: {
      id: number
      name: string
      state: boolean
    }[] = await page.$$eval(
      '.online-study-in-the-course-learning-course-item',
      (elList) =>
        elList.map((item, index) => {
          const name =
            item.querySelector<HTMLDivElement>('.course-name')?.innerText ?? ''
          const state = !!item
            .querySelector<HTMLDivElement>(
              '.course-ware-content .course-details-item'
            )
            ?.innerText?.includes('100')

          return { id: ++index, name, state }
        })
    )
    const unfinishedCourseList = courseInfoList.filter((item) => !item.state)

    console.log(
      `共 ${courseInfoList.length} 门课程, 剩余 ${unfinishedCourseList.length} 门未完成`
    )
    console.log(unfinishedCourseList)

    // 处理未完成的课程
    for (const course of unfinishedCourseList) {
      const { id, name } = course

      handleCourse(id, name)

      await sleep(10000)
    }
  })

async function handleCourse(id: number, name: string) {
  const coursePageResult = await xCrawl(xCrawlConfig).crawlPage(pageConfig)
  const { browser, page } = coursePageResult.data

  await page.waitForSelector('.page-home-index-content-nav-list-item', {
    timeout: 240000
  })
  console.log(`-------------- ${name} - 等待登录结束 --------------`)

  // 进入在线学习
  await page
    .$$('.page-home-index-content-nav-list-item')
    .then(async (elHandles) => {
      const btn = await elHandles[1].$('.nav-children > a')
      return btn?.click()
    })
  await page.waitForSelector('.course-name', { timeout: 240000 })

  // 翻到对应的位置
  const carouselCount = Math.ceil(id / 4) - 1
  if (carouselCount >= 1) {
    await page
      .$$('.el-carousel__indicators .el-carousel__button')
      .then((btn) => btn[carouselCount].hover())
  }

  // 进入课程
  const enterCourseBtn = await page.$$(
    '.online-study-in-the-course-learning-course-item .course-ware-content .course-details-title'
  )
  await enterCourseBtn[id - 1].click()

  // 获取课程页
  await sleep(3000)
  const coursePage = await browser
    .pages()
    .then((pages) => pages[pages.length - 1])
  coursePage.setViewport({ width: 1920, height: 1080 })

  await coursePage.waitForSelector(
    "div[class='course_chapter clearfix ng-scope']",
    { timeout: 240000 }
  )
  const chapterElHandleList = await coursePage.$$(
    "div[class='course_chapter clearfix ng-scope']"
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
    const unfinishedSegmentElHandleList = []
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
      const res = await playSegmentVideo(coursePage, item)

      if (res) {
        // 拿到当前的 File 和 Video
        const navBarElHandles = await coursePage.$$('.courseware_menu_item')
        const fileElHandleIndexs: number[] = []
        const otherVideoElHandleIndexs: number[] = []
        try {
          await coursePage.$$eval('.courseware_menu_item .item_name', (els) => {
            els.splice(1).forEach((el, i) => {
              el.textContent === '文档' || el.textContent === '资料'
                ? fileElHandleIndexs.push(i + 1)
                : otherVideoElHandleIndexs.push(i + 1)
            })
          })
        } catch {}

        // file
        for (const i of fileElHandleIndexs) {
          await navBarElHandles[i].click()
          await sleep()
        }

        // other video
        for (const i of otherVideoElHandleIndexs) {
          await playSegmentVideo(coursePage, navBarElHandles[i])
        }
      }
    }
  }
}

async function playSegmentVideo(
  coursePage: Page,
  unfinishedSegmentElHandle: ElementHandle<Element>
) {
  // 点击对应小节
  await unfinishedSegmentElHandle.click()

  try {
    await coursePage.waitForSelector('video', { timeout: 6000 })

    // 设置视频静音
    await coursePage.$eval('video', (videoEl) => (videoEl.muted = true))

    // 等待视频播放完毕
    await coursePage.waitForSelector('.layui-layer-dialog', {
      timeout: 18000000
    })

    // 关闭弹窗
    await coursePage.waitForSelector('.layui-layer-dialog', {
      timeout: 18000000
    })

    await coursePage.click('.layui-layer-dialog .layui-layer-close')

    return true
  } catch (error) {
    return false
  }
}

async function sleep(timeout = 1000) {
  return await new Promise((r) => setTimeout(r, timeout))
}
