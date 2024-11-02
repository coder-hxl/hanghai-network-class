import { createCrawl, CreateCrawlConfig, Page, ElementHandle } from 'x-crawl'

const xCrawlConfig: CreateCrawlConfig = {
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
}

const pageConfig = {
  url: 'https://gzmtu.o-learn.cn/',
  viewport: { width: 0, height: 0 }
}

createCrawl(xCrawlConfig)
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
  const coursePageResult = await createCrawl(xCrawlConfig).crawlPage(pageConfig)
  const { browser, page } = coursePageResult.data

  await page.waitForSelector('.page-home-index-content-nav-list-item', {
    timeout: 600000
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
  // await coursePage.setViewport({ width: 1920, height: 1080 })

  // 等待弹窗, 并关闭 （如果进来时该小节已经完成才可能触发）
  try {
    await coursePage.waitForSelector('.el-overlay button', {
      timeout: 2000
    })

    // 关闭弹窗
    const messageBoxCloseBtnElHandle = await coursePage.$('.el-overlay button')
    await messageBoxCloseBtnElHandle?.click()
  } catch {}

  // 展开所有小节
  await coursePage.waitForSelector('.search-catalogue', { timeout: 10000 })
  const showBarIconElHandle = await coursePage!.$('.search-catalogue .fold-svg')
  // 需等待章节元素，不然点击展开无效
  await coursePage.waitForSelector('.three-content', { timeout: 10000 })
  // 默认是展示一个，需先隐藏再展示所有
  await showBarIconElHandle!.click()
  await sleep(1200)
  await showBarIconElHandle!.click()
  await sleep(1200)

  // 获取小节
  await coursePage.waitForSelector('.three-content', { timeout: 10000 })
  const barStateList = await coursePage.$$eval('.three-content', (elList) =>
    elList.map((item, i) => {
      const progressEl = item.querySelector(
        "div[class='el-progress el-progress--circle is-success']"
      )

      const name = item.querySelector('.three-name')?.textContent
      const state =
        progressEl?.getAttribute('aria-valuenow') ===
        progressEl?.getAttribute('aria-valuemax')

      return { i, name, state }
    })
  )

  console.log('每个小节的状态：', barStateList)

  // 未完成的小节
  const barElHandleList = await coursePage.$$('.three-content')
  const unfinishedBarList = barElHandleList
    .map((item, i) => ({ ...barStateList[i], elHandle: item }))
    .filter((item) => !item.state)

  for (const bar of unfinishedBarList) {
    console.log(`${name} - 处理第 ${bar.i + 1} 章 - ${bar.name}`)

    const barElHandle = bar.elHandle
    await barElHandle.click()

    /*
      根据页面内容做决定
        - 视频：播放
        - 其他：下一节
    */

    let isVideo = true
    try {
      await coursePage.waitForSelector('video', { timeout: 3000 })
    } catch (error) {
      isVideo = false
    }

    console.log(
      `${name} - 处理第 ${bar.i + 1} 章 - ${bar.name} ---- isVideo: ${isVideo}`
    )

    // 非视频
    if (!isVideo) {
      await sleep(random(3000, 1000))
      continue
    }

    const res = await handleVideo(coursePage)

    console.log(
      `${name} - 处理第 ${bar.i + 1} 章 - ${bar.name} ---- res: ${res}`
    )
  }
}

async function handleVideo(coursePage: Page) {
  try {
    await coursePage.waitForSelector('video', { timeout: 6000 })

    // 设置视频静音
    await coursePage.$eval('video', (videoEl) => (videoEl.muted = true))

    // 等待视频播放完毕
    // 等待弹窗, 并关闭
    await coursePage.waitForSelector('.el-overlay .el-message-box__header', {
      timeout: 18000000
    })

    // 关闭弹窗
    await coursePage.waitForSelector(
      '.el-overlay .el-message-box__header .el-message-box__headerbtn',
      { timeout: 10000 }
    )
    const messageBoxCloseBtnElHandle = await coursePage.$(
      '.el-overlay .el-message-box__header .el-message-box__headerbtn'
    )
    await messageBoxCloseBtnElHandle?.click()

    return true
  } catch (error: any) {
    console.log(error, error.message)

    return false
  }
}

async function sleep(timeout = 1000) {
  return await new Promise((r) => setTimeout(r, timeout))
}

function random(max: number, min = 0) {
  let result = Math.floor(Math.random() * max)

  while (result < min) {
    result = Math.floor(Math.random() * max)
  }

  return result
}
