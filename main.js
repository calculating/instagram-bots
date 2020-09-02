const puppeteer = require('puppeteer-extra')

const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

puppeteer.launch({ headless: true }).then(async browser => {
  console.log('Opening Instagram')

  let page = await browser.newPage()
  await page.goto('https://www.instagram.com')
  await page.waitFor(2000)

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

  // await page.screenshot({ path: 'screenshot.png', fullPage: true })
  await browser.close()
})
