const fs = require('fs').promises
const fsSync = require('fs')
const https = require('https')
const path = require('path')

const WebSocket = require('ws')

const puppeteer = require('puppeteer-extra')

let stealth = require('puppeteer-extra-plugin-stealth')()
stealth.enabledEvasions.delete('user-agent-override')
puppeteer.use(stealth)

puppeteer.use(require('puppeteer-extra-plugin-stealth/evasions/user-agent-override')({
  userAgent: puppeteer.pptr.devices['Pixel 2'].userAgent.replace(/Chrome\/[^ ]+/, 'Chrome/85.0.4182.0'),
  locale: 'en-US,en;q=0.9',
  platform: 'Linux aarch64',
}))

puppeteer.use(require('puppeteer-extra-plugin-repl')())

let database = {
  username: '',
  password: '',
  server: 'localhost:6000',
  cookies: {
    async get() {
      try {
        return JSON.parse(await fs.readFile(__dirname + '/data/cookies.json'))
      } catch (err) {
        return []
      }
    },
    async set(array) {
      if (!Array.isArray(array))
        throw new Error('Cookies must be an array')
      try {
        await fs.mkdir(__dirname + '/data')
      } catch (err) {
        if (err.code !== 'EEXIST')
          throw err
      }
      await fs.writeFile(__dirname + '/data/cookies.json', JSON.stringify(array))
    },
  },
}

let sleep = time => new Promise(resolve => setTimeout(resolve, time))

let random = (min, max) => min + (max - min) * (Math.random() + Math.random() + Math.random()) / 3

let delay = async type => {
  if (type === 'veryFast') { // for general fast delays (e.g. get rid of animation)
    await sleep(random(500, 1000))
  } else if (type === 'fast') { // for general fast delays (e.g. get rid of animation)
    await sleep(random(1000, 1500))
  } else if (type === 'network') { // for delays with a simple network request (e.g. like)
    await sleep(random(2000, 3000))
  } else if (type === 'long') { // for longer delays that may need extra processing (e.g. log in)
    await sleep(random(5000, 7500))
  } else {
    throw new Error(`Invalid sleep delay '${type}'`)
  }
}

let downloadFile = (src, path) => new Promise((resolve, reject) => {
  let file = fsSync.createWriteStream(path)
  let req = https.get(src, res => {
    res.pipe(file)
    file.on('finish', () => file.close(resolve))
  }).on('error', err => {
    reject(err)
    fs.unlink(path).catch(() => {})
  })
})

const Puppet = class {
  constructor() {
    this.browser = null
    this.context = null
    this.page = null

    this.cookies = {
      loaded: false,
      interval: null,
    }
    this.status = null
  }

  // basic browser/session initiation functions
  async launch(headless = true) {
    if (this.browser)
      await this.close()

    this.browser = await puppeteer.launch({
      headless,
      defaultViewport: puppeteer.pptr.devices['Pixel 2'].viewport,
      args: ['--window-size=500,875'],
    })

    console.log('Opening Instagram')

    this.context = await this.browser.createIncognitoBrowserContext()
    this.page = await this.context.newPage()
  }

  async load() {
    clearInterval(this.cookies.interval)

    // TODO: better database system?
    await this.page.setCookie(...await database.cookies.get())

    this.cookies.loaded = true
    this.cookies.interval = setInterval(async () => {
      await database.cookies.set(await this.page.cookies())
    }, 60e3)

    await this.page.goto('https://www.instagram.com/')
    await delay('network')
  }

  async close() {
    clearInterval(this.cookies.interval)

    if (this.page) {
      if (this.cookies.loaded)
        await database.cookies.set(await this.page.cookies())
      await this.browser.close()
    }

    this.browser = null
    this.context = null
    this.page = null

    this.cookies.loaded = false
    this.cookies.interval = null
    this.status = null
  }

  // xPath and base interaction functions
  async select(xPathExpression, { required = true, first = false, all = false, source = this.page } = {}) {
    let elements = await source.$x(xPathExpression)
    if (all)
      return elements
    if (elements.length > 1 && !first)
      throw new Error(`Multiple elements found for XPath expression '${xPathExpression}'`)
    if (elements.length === 0 && required)
      throw new Error(`No element found for XPath expression '${xPathExpression}'`)
    return elements[0] || null
  }

  async tap(xPathExpression, delayType = false, config = {}) {
    config.all = false
    let element = await this.select(xPathExpression, config)
    if (element) {
      await element.tap()
      if (delayType) await delay(delayType)
    }
    return !!element
  }

  async type(xPathExpression, content, delayType = null, config = {}) {
    config.all = false
    let element = await this.select(xPathExpression, config)
    if (element) {
      await element.type(content, { delay: random(75, 100) })
      if (delayType) await delay(delayType)
    }
    return !!element
  }

  // main actions
  async login(username, password) {
    if (!await this.tap('//button[contains(., "Log In")]', 'fast', { required: false })) return
    await this.type('//input[@name="username"]', username, 'veryFast')
    await this.type('//input[@name="password"]', password, 'veryFast')
    await this.tap('//button[contains(., "Log In")]', 'long')
    await this.tap('//button[contains(., "Save Info")]', 'network', { required: false })
  }

  async eliminatePopUps() {
    await this.tap('//*[@role="dialog"]//div[div/h2[contains(., "Home screen")]]/div/button[contains(., "Cancel")]', 'fast', { required: false })
    await this.tap('//*[@role="dialog"]//div[div/h2[contains(., "Turn on Notifications")]]/div/button[contains(., "Not Now")]', 'fast', { required: false })
    await this.tap('//div[div/button[contains(., "Use the App")]]/div/button[contains(., "Not Now") or //*[@aria-label="Close"]]', 'fast', { required: false })
  }

  async backButton() {
    await this.tap('//header//*[@aria-label="Back"]', 'network')
  }

  async postComment(content) {
    await this.type('//form/textarea[contains(@aria-label, "Add a comment")]', content, 'fast')
    await this.tap('//form/button[text()="Post"]', 'network')
  }

  async postDelete() {
    await this.tap('//*[@aria-label="More options"]', 'fast')
    await this.tap('//div/button[text()="Delete"]', 'fast')
    await this.tap('//div/button[text()="Delete"]', 'network')
  }

  async postGetMediaSrc() {
    let media = await this.select('//article/div/div[@role="button"]//img | //article/div/div//*[img]/video')

    return media.evaluate(node => node.getAttribute('src'))
  }

  async postGetCaption() {
    let caption = await this.select('//article/div/div/div[position()=1]/div[position()=1]/div[position()=1][a[position()=1]]/span', { required: false })
    if (!caption) return null

    await this.tap('span/button[text()="more"]', null, { source: caption, required: false })

    return caption.evaluate(node => node.innerText)
  }

  async goToSelfProfile() {
    await this.tap('//div[position()=5]/a/span/img', 'network')
  }

  async goToFollowersFromProfile() {
    await this.tap('//ul/li[position()=2]/a[contains(., "followers")]', 'network')
  }

  async goToFollowingFromProfile() {
    await this.tap('//ul/li[position()=3]/a[contains(., "following")]', 'network')
  }

  async unfollowFirstAtFollowing() {
    if (await this.tap('//div/button[text()="Following"]', 'fast', { required: false }))
      await this.tap('//*[@role="dialog"]//div/button[text()="Unfollow"]', 'network')
  }

  async goToOldestPostFromProfile() {
    let oldestPost = null
    while (true) {
      let oldestKnownPost = await this.select('(//article/div[position()=1]/div/div[position()=last()]/div/a)[last()]')

      let { y } = await oldestKnownPost.boundingBox()
      if (y <= 600) {
        oldestPost = oldestKnownPost
        break
      }

      await this.page.mouse.wheel({ deltaY: random(300, 500) })
      await delay('network')
    }
    await oldestPost.tap()
    await delay('network')
  }

  async followAtProfile() {
    await this.tap('//span/button[text()="Follow" or text()="Follow Back"]', 'network', { required: false })
  }

  async createPost(path, caption) {
    let fileChooserPromise = this.page.waitForFileChooser()

    await this.tap('//*[@aria-label="New Post"]')

    let fileChooser = await fileChooserPromise
    await fileChooser.accept([path])
    await delay('network')

    await this.tap('//div/button[text()="Next"]', 'fast')

    if (caption)
      await this.page.type('//textarea[contains(@aria-label, "Write a caption")]', caption, 'veryFast')

    await this.tap('//div/button[text()="Share"]', 'long')
  }

  async cyclePost() {
    await this.goToSelfProfile(database.username)
    await this.goToOldestPostFromProfile()

    let src = await this.postGetMediaSrc()
    let caption = await this.postGetCaption()

    // hope that the CDN servers aren't equipped with bot detectors...
    // TODO: https://github.com/puppeteer/puppeteer/issues/299
    let path = `data/tmp-file${path.extname(src)}`
    await downloadFile(src, path)

    await this.postDelete()
    await this.createPost(path, caption)
  }

  async browseHomepage() {
    // TODO: better way to determine if a post should be liked
    let shouldLikePost = username => {
      return /^[a-z]{6,16}$/.test(username)
    }

    let lastUsername = null
    while (true) {
      let posts = await this.page.$x('//article[@role="presentation"][div/section//button//*[@aria-label="Like"]]')
      let post = null
      let likeButton = null
      let commentButton = null
      for (let currentPost of posts) {
        let [currentLikeButton] = await currentPost.$x('div/section//button//*[@aria-label="Like"]')
        let [currentCommentButton] = await currentPost.$x('div/section//button//*[@aria-label="Comment"]')
        let { y } = await currentLikeButton.boundingBox()
        if (y > 600) break
        post = currentPost
        likeButton = currentLikeButton
        commentButton = currentCommentButton
      }

      if (post) {
        let [usernameLink] = await post.$x('header/div/div/div/a')
        let username = await usernameLink.evaluate(node => node.innerHTML)
        console.log(`Found post by ${username}`)

        if (lastUsername !== username && shouldLikePost(username)) {
          console.log('Post liked')
          lastUsername = username
          await likeButton.tap()
          await delay('network')

          if (Math.random() < 0.5) {
            await commentButton.tap()
            await delay('network')

            await this.postComment('yes')

            await this.backButton()
            await delay('network')
          }
        }
      }

      await this.page.mouse.wheel({ deltaY: random(300, 500) })
      await delay('network')
    }
  }

  // debug function
  async debugRepl() {
    await this.page.repl()
  }
}

let pageEliminatePopUps = async page => {
  let [buttonRefuseWebApp] = await page.$x('//*[@role="dialog"]//div[div/h2[contains(., "Home screen")]]/div/button[contains(., "Cancel")]')
  if (buttonRefuseWebApp) {
    await buttonRefuseWebApp.tap()
    await sleep(random(1000, 1500))
  }

  let [buttonRefuseNotifications] = await page.$x('//*[@role="dialog"]//div[div/h2[contains(., "Turn on Notifications")]]/div/button[contains(., "Not Now")]')
  if (buttonRefuseNotifications) {
    await buttonRefuseNotifications.tap()
    await sleep(random(1000, 1500))
  }

  let [buttonRefuseApp] = await page.$x('//div[div/button[contains(., "Use the App")]]/div/button[contains(., "Not Now") or //*[@aria-label="Close"]]')
  if (buttonRefuseApp) {
    await buttonRefuseApp.tap()
    await sleep(random(1000, 1500))
  }
}

let pageBackButton = async page => {
  let [button] = await page.$x('//header//*[@aria-label="Back"]')
  await button.tap()
  await sleep(random(2000, 3000))
}

let pagePostComment = async (page, content) => {
  let [textarea] = await page.$x('//form/textarea[contains(@aria-label, "Add a comment")]')
  await textarea.type(content, { delay: random(75, 100) })
  await sleep(random(1000, 1500))

  let [button] = await page.$x('//form/button[text()="Post"]')
  await button.tap()
  await sleep(random(2000, 3000))
}

let pagePostDelete = async page => {
  let [buttonOptions] = await page.$x('//*[@aria-label="More options"]')
  buttonOptions.tap()
  await sleep(random(1000, 1500))

  let [buttonDelete] = await page.$x('//div/button[text()="Delete"]')
  buttonDelete.tap()
  await sleep(random(1000, 1500))

  let [buttonDeleteConfirm] = await page.$x('//div/button[text()="Delete"]')
  buttonDeleteConfirm.tap()
  await sleep(random(2000, 3000))
}

let pagePostDownloadImage = async (page, path) => {
  let [img] = await page.$x('//article/div/div[@role="button"]//img')
  await img.screenshot({ path, omitBackground: true })

  let [caption] = await page.$x('//article/div/div/div[position()=1]/div[position()=1]/div[position()=1][a[position()=1]]/span')
  if (!caption) return null

  let [buttonMore] = await caption.$x('span/button[text()="more"]')
  if (buttonMore)
    await buttonMore.tap()

  return caption.evaluate(node => node.innerText)
}

let pageGoToSelfProfile = async (page, username) => {
  let [link] = await page.$x(`//div[position()=5]/a[@href="/${username}/"]`)
  await link.tap()
  await sleep(random(2000, 3000))
}

let pageGoToFollowingFromProfile = async (page, username) => {
  let [link] = await page.$x(`//ul/li[position()=3]/a[@href="/${username}/following/"]`)
  await link.tap()
  await sleep(random(2000, 3000))
}

let pageUnfollowFirstAtFollowing = async page => {
  let [button] = await page.$x('//div/button[text()="Following"]')
  if (button) {
    await button.tap()
    await sleep(random(1000, 1500))

    let [buttonUnfollow] = await page.$x('//*[@role="dialog"]//div/button[text()="Unfollow"]')
    await buttonUnfollow.tap()
    await sleep(random(2000, 3000))
  }
}

let pageGoToOldestPostFromProfile = async page => {
  let oldestPost = null
  while (true) {
    let [oldestKnownPost] = await page.$x('(//article/div[position()=1]/div/div[position()=last()]/div/a)[last()]')

    let { y } = await oldestKnownPost.boundingBox()
    if (y <= 600) {
      oldestPost = oldestKnownPost
      break
    }

    await page.mouse.wheel({ deltaY: random(300, 500) })
    await sleep(random(2000, 3000))
  }
  await oldestPost.tap()
  await sleep(random(2000, 3000))
}

let pageFollowAtProfile = async page => {
  let [button] = await page.$x('//span/button[text()="Follow" or text()="Follow Back"]')
  if (button) {
    await button.tap()
    await sleep(random(2000, 3000))
  }
}

let pageCreatePost = async (page, path, caption) => {
  let [fileChooser] = await Promise.all([
    page.waitForFileChooser(),
    page.tap('[aria-label="New Post"]'),
  ])
  await fileChooser.accept([path])
  await sleep(random(2000, 3000))

  let [buttonNext] = await page.$x('//div/button[text()="Next"]')
  await buttonNext.tap()
  await sleep(random(1000, 1500))

  if (caption)
    await page.type('textarea[aria-label*="Write a caption"]', caption, { delay: random(75, 100) })
  await sleep(random(500, 1000))

  let [buttonShare] = await page.$x('//div/button[text()="Share"]')
  await buttonShare.tap()
  await sleep(random(5000, 7500))
}

/*
puppeteer.launch({
  headless: false,
  defaultViewport: puppeteer.pptr.devices['Pixel 2'].viewport,
  args: ['--window-size=500,875'],
}).then(async browser => {
  console.log('Opening Instagram')

  let context = await browser.createIncognitoBrowserContext()

  let page = await context.newPage()

  await page.setCookie(...await database.cookies.get())
  setInterval(async () => {
    await database.cookies.set(await page.cookies())
  }, 1000)

  await page.goto('https://www.instagram.com/')
  await sleep(random(2000, 3000))

  let [buttonLogInPage] = await page.$x('//button[contains(., "Log In")]')
  if (buttonLogInPage) {
    await buttonLogInPage.tap()
    await sleep(random(1000, 1500))

    await page.type('input[name="username"]', database.username, { delay: random(75, 100) })
    await sleep(random(500, 1000))

    await page.type('input[name="password"]', database.password, { delay: random(75, 100) })
    await sleep(random(500, 1000))

    let [buttonLogIn] = await page.$x('//button[contains(., "Log In")]')
    await buttonLogIn.tap()
    await sleep(random(5000, 7500))

    let [buttonSaveInfo] = await page.$x('//button[contains(., "Save Info")]')
    if (buttonSaveInfo) {
      await buttonSaveInfo.tap()
      await sleep(random(2000, 3000))
    }
  }

  await pageEliminatePopUps(page)

  await sleep(48 * 60 * 60e3) // sleep forever

  while (true) {
    await pageGoToSelfProfile(page, database.username)
    await pageGoToOldestPostFromProfile(page)
    let caption = await pagePostDownloadImage(page, 'data/tmp-image.png')
    await pagePostDelete(page)
    await pageCreatePost(page, 'data/tmp-image.png', caption)
    await sleep(random(45 * 60e3, 60 * 60e3)) // 45-60 minutes
  }

  // await pageGoToSelfProfile(page, database.username)

  await pageGoToOldestPostFromProfile(page)

  // await pagePostFile(page, 'test.jpg', 'Hello')

  // await page.repl()

  let lastUsername = null
  while (true) {
    let posts = await page.$x('//article[@role="presentation"][div/section//button//*[@aria-label="Like"]]')
    let post = null
    let likeButton = null
    let commentButton = null
    for (let currentPost of posts) {
      let [currentLikeButton] = await currentPost.$x('div/section//button//*[@aria-label="Like"]')
      let [currentCommentButton] = await currentPost.$x('div/section//button//*[@aria-label="Comment"]')
      let { y } = await currentLikeButton.boundingBox()
      if (y > 600) break
      post = currentPost
      likeButton = currentLikeButton
      commentButton = currentCommentButton
    }

    if (post) {
      let [usernameLink] = await post.$x('header/div/div/div/a')
      let username = await usernameLink.evaluate(node => node.innerHTML)
      console.log(`Found post by ${username}`)

      if (lastUsername !== username && shouldLikePost(username)) {
        console.log('Post liked')
        lastUsername = username
        await likeButton.tap()
        await sleep(random(2000, 3000))

        if (Math.random() < 0.5) {
          await commentButton.tap()
          await sleep(random(2000, 3000))

          await pagePostComment(page, 'yes')

          await pageBackButton(page)
          await sleep(random(2000, 3000))
        }
      }
    }

    await page.mouse.wheel({ deltaY: random(300, 500) })
    await sleep(random(2000, 3000))
  }

  await sleep(48 * 60 * 60e3) // sleep forever

  await pageGoToSelfProfile(page, database.username)

  await pageEliminatePopUps(page)

  await pageGoToFollowingFromProfile(page, database.username)

  while (true) {
    await pageUnfollowFirstAtFollowing(page)
    await sleep(random(45 * 60e3, 60 * 60e3))
  }

  // await page.screenshot({ path: 'data/test-screenshot.png' })
  await browser.close()
})
*/

let puppet = new Puppet()
let ws = new WebSocket(`ws://${database.server}/`)

ws.on('open', () => {
  console.log('Connected to server')
})

ws.on('message', async data => {
  let message
  try {
    message = JSON.parse(data)
  } catch (e) {}
  if (message == null || typeof message !== 'object') {
    console.warn('Invalid packet received', data)
    return
  }
  console.log(message)

  let res = null

  if (message.t === 'cmd') {
    try {
      res = await (message.args ? puppet[message.cmd](...message.args) : puppet[message.cmd]())
    } catch (err) {
      console.log(err)
      res = err.message
    }
  }

  if (res != null)
    ws.send(JSON.stringify({ i: message.i, t: 'ack', res }))
  else
    ws.send(JSON.stringify({ i: message.i, t: 'ack' }))
})

ws.on('close', () => {
  console.log('Disconnected from server')
})

ws.on('error', console.error)
