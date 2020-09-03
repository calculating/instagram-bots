const puppeteer = require('puppeteer-extra')
const puppeteerDevices = require('puppeteer').devices
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const UserAgentOverride = require('puppeteer-extra-plugin-stealth/evasions/user-agent-override')

let stealth = StealthPlugin()
stealth.enabledEvasions.delete('user-agent-override')
puppeteer.use(stealth)

puppeteer.use(UserAgentOverride({
  userAgent: puppeteerDevices['Pixel 2'].userAgent.replace(/Chrome\/[^ ]+/, 'Chrome/85.0.4182.0'),
  locale: 'en-US,en;q=0.9',
  platform: 'Linux aarch64',
}))

puppeteer.launch({
  headless: false,
  defaultViewport: puppeteerDevices['Pixel 2'].viewport,
}).then(async browser => {
  console.log('Opening Instagram')

  let page = await browser.newPage()
  await page.goto('https://www.instagram.com/')
  await page.waitFor(2000 * 1000)

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

  // console.log(await page.cookies())
  // await page.screenshot({ path: 'data/test-screenshot.png' })
  await browser.close()
})
