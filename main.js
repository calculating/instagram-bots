const fs = require('fs').promises

const puppeteer = require('puppeteer-extra')
const puppeteerDevices = require('puppeteer').devices
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const UserAgentOverride = require('puppeteer-extra-plugin-stealth/evasions/user-agent-override')
const ReplPlugin = require('puppeteer-extra-plugin-repl')

let database = {
  username: '',
  password: '',
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
      await fs.writeFile(__dirname + '/data/cookies.json', JSON.stringify(array))
    },
  },
}

let sleep = time => new Promise(resolve => setTimeout(resolve, time))

let random = (min, max) => min + (max - min) * (Math.random() + Math.random() + Math.random()) / 3

let pageEliminatePopUps = async page => {
  let [buttonRefuseWebApp] = await page.$x('//*[@role="dialog"]//div[div/h2[contains(., "Home screen")]]/div/button[contains(., "Cancel")]')
  if (buttonRefuseWebApp) {
    buttonRefuseWebApp.tap()
    await sleep(random(1000, 1500))
  }

  let [buttonRefuseNotifications] = await page.$x('//*[@role="dialog"]//div[div/h2[contains(., "Turn on Notifications")]]/div/button[contains(., "Not Now")]')
  if (buttonRefuseNotifications) {
    buttonRefuseNotifications.tap()
    await sleep(random(1000, 1500))
  }

  let [buttonRefuseApp] = await page.$x('//div[div/button[contains(., "Use the App")]]/div/button[contains(., "Not Now")]')
  if (buttonRefuseApp) {
    buttonRefuseApp.tap()
    await sleep(random(1000, 1500))
  }
}

let pageGoToSelfProfile = async (page, username) => {
  let [link] = await page.$x(`//div[position()=5]/a[@href="/${username}/"]`)
  link.tap()
  await sleep(random(2000, 3000))
}

let pageGoToFollowingFromProfile = async (page, username) => {
  let [link] = await page.$x(`//ul/li[position()=3]/a[@href="/${username}/following/"]`)
  link.tap()
  await sleep(random(2000, 3000))
}

let pageUnfollowFirstAtFollowing = async page => {
  let [button] = await page.$x('//div/button[text()="Following"]')
  if (button) {
    button.tap()
    await sleep(random(1000, 1500))

    let [buttonUnfollow] = await page.$x('//*[@role="dialog"]//div/button[text()="Unfollow"]')
    buttonUnfollow.tap()
    await sleep(random(2000, 3000))
  }
}

let stealth = StealthPlugin()
stealth.enabledEvasions.delete('user-agent-override')
puppeteer.use(stealth)

puppeteer.use(UserAgentOverride({
  userAgent: puppeteerDevices['Pixel 2'].userAgent.replace(/Chrome\/[^ ]+/, 'Chrome/85.0.4182.0'),
  locale: 'en-US,en;q=0.9',
  platform: 'Linux aarch64',
}))

puppeteer.use(ReplPlugin())

puppeteer.launch({
  headless: false,
  defaultViewport: puppeteerDevices['Pixel 2'].viewport,
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
    buttonLogInPage.tap()
    await sleep(random(1000, 1500))

    await page.type('input[name="username"]', database.username, { delay: random(75, 100) })
    await sleep(random(500, 1000))

    await page.type('input[name="password"]', database.password, { delay: random(75, 100) })
    await sleep(random(500, 1000))

    let [buttonLogIn] = await page.$x('//button[contains(., "Log In")]')
    buttonLogIn.tap()
    await sleep(random(5000, 7500))

    let [buttonSaveInfo] = await page.$x('//button[contains(., "Save Info")]')
    if (buttonSaveInfo) {
      buttonSaveInfo.tap()
      await sleep(random(2000, 3000))
    }
  }

  await pageEliminatePopUps(page)

  await pageGoToSelfProfile(page, database.username)

  await pageEliminatePopUps(page)

  await pageGoToFollowingFromProfile(page, database.username)

  while (true) {
    await pageUnfollowFirstAtFollowing(page)
    await sleep(random(45 * 60e3, 60 * 60e3))
  }

  /*
  let [fileChooser] = await Promise.all([
    page.waitForFileChooser(),
    page.tap('[aria-label="New Post"]'),
  ])
  await fileChooser.accept([])
  */

  let dimensions = await page.evaluate(() => {
    return {
      innerWidth,
      innerHeight,
      outerWidth,
      outerHeight,
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
      deviceScaleFactor: window.devicePixelRatio,
      userAgent: navigator.userAgent,
    }
  })
  console.log('Dimensions:', dimensions)

  // await page.screenshot({ path: 'data/test-screenshot.png' })
  await browser.close()
})
