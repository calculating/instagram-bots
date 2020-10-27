const fs = require('fs').promises
const https = require('https')
const path = require('path')
const readline = require('readline')
const url = require('url')

const WebSocket = require('ws')

let database = {
  serverData: { // TODO: this is done badly
    cache: null,
    async get() {
      if (this.cache) return this.cache
      try {
        this.cache = JSON.parse(await fs.readFile(__dirname + '/data/serverData.json'))
        return this.cache
      } catch (err) {
        return null
      }
    },
    async set(data) {
      this.cache = data
      try {
        await fs.mkdir(__dirname + '/data')
      } catch (err) {
        if (err.code !== 'EEXIST')
          throw err
      }
      await fs.writeFile(__dirname + '/data/serverData.json', JSON.stringify(data))
    },
  },
}

const { sleep, random, delay, downloadFile, requestJson } = require('./shared')

const redditGeneratePost = async (subreddits = ['all'], duplicatesToAvoid) => {
  let subreddit = subreddits[Math.floor(Math.random() * subreddits.length)]
  let sorting = 'hot' // best, hot, new, random, rising, top*, controversial*
  let time = 'week' // * = hour, day, week, month, year, all

  let res = await requestJson(`https://www.reddit.com/r/${subreddit}/hot/.json?raw_json=1&count=0&limit=25&t=${time}`, {
    headers: {
      'User-Agent': 'node.js:reddit-scraper:v0',
    },
  })

  let post = null
  for (let { data } of res.data.children) {
    if (data.title && data.url && ['.png', '.jpg', '.jpeg', '.gif', '.webm', '.mp4'].includes(path.extname(data.url)) && duplicatesToAvoid.every(duplicate => duplicate.url !== data.url)) {
      post = {
        url: data.url,
        caption: data.title,
      }
      break
    }
  }
  if (!post)
    throw new Error('No valid post found')

  return post
}

/*
requestJson('https://www.reddit.com/r/all/top.json?raw_json=1&count=0&limit=5&t=all', {
  headers: {
    'User-Agent': 'node.js:reddit-scraper:v0',
  },
}).then(r => {
  console.log(r.data.children)
  {
    kind: 't3',
    data: {
      approved_at_utc: null,
      subreddit: 'funny',
      selftext: '',
      author_fullname: 't2_tu7hd',
      saved: false,
      mod_reason_title: null,
      gilded: 18,
      clicked: false,
      title: 'Guardians of the Front Page',
      link_flair_richtext: [],
      subreddit_name_prefixed: 'r/funny',
      hidden: false,
      pwls: 6,
      link_flair_css_class: '',
      downs: 0,
      thumbnail_height: 58,
      top_awarded_type: null,
      hide_score: false,
      name: 't3_5gn8ru',
      quarantine: false,
      link_flair_text_color: 'dark',
      upvote_ratio: 0.97,
      author_flair_background_color: null,
      subreddit_type: 'public',
      ups: 283484,
      total_awards_received: 121,
      media_embed: {},
      thumbnail_width: 140,
      author_flair_template_id: null,
      is_original_content: false,
      user_reports: [],
      secure_media: null,
      is_reddit_media_domain: false,
      is_meta: false,
      category: null,
      secure_media_embed: {},
      link_flair_text: 'Best of 2016 Winner',
      can_mod_post: false,
      score: 283484,
      approved_by: null,
      author_premium: true,
      thumbnail: 'https://b.thumbs.redditmedia.com/ZF37c_fUuPPTootrtYGvCy5vpbcIPT3Feo3uGNNchfE.jpg',
      edited: false,
      author_flair_css_class: null,
      author_flair_richtext: [],
      gildings: [Object],
      post_hint: 'link',
      content_categories: null,
      is_self: false,
      mod_note: null,
      created: 1480988474,
      link_flair_type: 'text',
      wls: 6,
      removed_by_category: null,
      banned_by: null,
      author_flair_type: 'text',
      domain: 'i.imgur.com',
      allow_live_comments: true,
      selftext_html: null,
      likes: null,
      suggested_sort: null,
      banned_at_utc: null,
      url_overridden_by_dest: 'http://i.imgur.com/OOFRJvr.gifv',
      view_count: null,
      archived: true,
      no_follow: false,
      is_crosspostable: false,
      pinned: false,
      over_18: false,
      preview: [Object],
      all_awardings: [Array],
      awarders: [],
      media_only: false,
      can_gild: false,
      spoiler: false,
      locked: false,
      author_flair_text: null,
      treatment_tags: [],
      visited: false,
      removed_by: null,
      num_reports: null,
      distinguished: null,
      subreddit_id: 't5_2qh33',
      mod_reason_by: null,
      removal_reason: null,
      link_flair_background_color: '',
      id: '5gn8ru',
      is_robot_indexable: true,
      report_reasons: null,
      author: 'iH8myPP',
      discussion_type: null,
      num_comments: 4972,
      send_replies: true,
      whitelist_status: 'all_ads',
      contest_mode: false,
      mod_reports: [],
      author_patreon_flair: false,
      author_flair_text_color: null,
      permalink: '/r/funny/comments/5gn8ru/guardians_of_the_front_page/',
      parent_whitelist_status: 'all_ads',
      stickied: false,
      url: 'http://i.imgur.com/OOFRJvr.gifv',
      subreddit_subscribers: 33671279,
      created_utc: 1480959674,
      num_crossposts: 158,
      media: null,
      is_video: false
    }
  }
}).catch(console.log)
*/

const Puppet = class {
  constructor(ws) {
    this.ws = ws
    this.wsCallbacks = {}
    this.i = 0

    this.token = null
    this.mode = 'puppet'

    ws.on('message', data => {
      if (typeof data !== 'string') {
        ws.close(1003)
        return
      }
      let message = null
      try {
        message = JSON.parse(data)
      } catch (e) {}
      if (message == null || typeof message !== 'object') {
        ws.close(1008)
        return
      }

      if (message.t === 'ack' && this.wsCallbacks[message.i]) {
        this.wsCallbacks[message.i](message.res)
        delete this.wsCallbacks[message.i]
      } else if (message.t === 'auth') {
        this.token = message.token
        this.mode = message.mode
      }
    })
  }

  // WebSocket functions
  async cmd(cmd, ...args) {
    let i = this.i++

    this.ws.send(JSON.stringify({ i, t: 'cmd', cmd, args }))

    return new Promise((resolve, reject) => {
      this.wsCallbacks[i] = resolve
      setTimeout(reject, 60e3, new Error('Timed out'))
    })
  }

  // basic browser/session initiation functions
  async launch(headless = true) {
    await this.cmd('launch', headless)
  }

  async load() {
    await this.cmd('load')
  }

  async close() {
    await this.cmd('close')
  }

  // xPath and base interaction functions
  async tap(xPathExpression, delayType = false, config = {}) {
    config.all = false
    let res = await this.cmd('tap', xPathExpression, false, config)
    if (res && delayType) await delay(delayType)
    return res
  }

  async type(xPathExpression, content, delayType = null, config = {}) {
    config.all = false
    let res = await this.cmd('type', xPathExpression, content, false, config)
    if (res && delayType) await delay(delayType)
    return res
  }

  // main actions
  async login() {
    this.cmd('login')
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
    return this.cmd('postGetCaption')
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
    return this.cmd('goToOldestPostFromProfile')
  }

  async followAtProfile() {
    await this.tap('//span/button[text()="Follow" or text()="Follow Back"]', 'network', { required: false })
  }

  async createPost(path, caption) {
    return this.cmd('createPost', path, caption)
  }

  /*async cyclePost() {
    await this.goToSelfProfile()
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

  async cycleAllPosts() {
    while (true) {
      await this.cyclePost()
      await sleep(random(45 * 60e3, 60 * 60e3))
    }
  }*/

  async unfollowAll() {
    await this.goToSelfProfile()
    await this.goToFollowingFromProfile()
    while (true) {
      await this.unfollowFirstAtFollowing()
      await sleep(random(45 * 60e3, 60 * 60e3))
    }
  }
}

let wss = new WebSocket.Server({ port: 6000 })

let puppets = []
wss.on('connection', async (ws, req) => {
  console.log('New connection')
  if (url.parse(req.url).pathname.replace(/\/+$/, '') === '/api/alpha') {
    let serverData = (await database.serverData.get()) || { accounts: {} }
    await database.serverData.set(serverData)

    let token = null // TODO: this is kinda bad?
    ws.on('message', data => {
      if (typeof data !== 'string') {
        ws.close(1003)
        return
      }
      let message = null
      try {
        message = JSON.parse(data)
      } catch (e) {}
      if (message == null || typeof message !== 'object') {
        ws.close(1008)
        return
      }
      console.log(message)

      let account = serverData.accounts[token]
      if (!account && message.t !== 'auth') {
        ws.close(1000)
        return
      }

      switch (message.t) {
        case 'auth':
          token = message.token
          break
        case 'queue.list':
          ws.send(JSON.stringify({
            t: 'queue.list',
            res: account.posts,
          }))
          break
        case 'queue.add':
          break
        case 'queue.set':
          account.posts[message.id][message.key] = message.value // TODO: improve this
          break
        case 'queue.delete':
          account.posts.splice(message.id, 1)
          ws.send(JSON.stringify({
            t: 'queue.list',
            res: account.posts,
          }))
          break
      }
    })
    return
  }

  let puppet = new Puppet(ws)
  puppets.push(puppet)
  ws.on('close', code => {
    console.log('Connection closed', code)
    let i = puppets.indexOf(puppet)
    if (i !== -1)
      puppets.splice(i, 1)
  })
})

setInterval(async () => {
  let serverData = (await database.serverData.get()) || { accounts: {} }
  await database.serverData.set(serverData)

  for (let puppet of puppets) {
    let account = serverData.accounts[puppet.token]
    if (!account) continue

    let post = account.posts[0]
    if (post.time <= Date.now()) {
      account.posts.shift()
      if (!ws) {
        console.log('No connected client')
      } else {
        i++
        puppet.createPost(post.url, post.caption)
      }
    }
  }

  for (let account of Object.values(serverData.accounts)) {
    if (account.redditGeneratePost.enabled && account.posts.length < account.redditGeneratePost.queueMax) {
      let post = await redditGeneratePost(account.redditGeneratePost.subreddits, account.posts)
      post.time = Date.now() + account.redditGeneratePost.waitTime
      account.posts.push(post)
      account.posts.sort((a, b) => a.time - b.time)
      console.log('Generated post', post)
    }
  }

  await database.serverData.set(serverData)
}, 20e3)