const fs = require('fs').promises
const https = require('https')
const readline = require('readline')

const WebSocket = require('ws')

let database = {
  serverData: {
    async get() {
      try {
        return JSON.parse(await fs.readFile(__dirname + '/data/serverData.json'))
      } catch (err) {
        return null
      }
    },
    async set(data) {
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

const request = async (...args) => new Promise((resolve, reject) => {
  let req = https.request(...args, res => {
    let chunks = []
    res.on('data', data => chunks.push(data))
    res.on('end', () => resolve(Buffer.concat(chunks)))
    res.on('error', reject)
  })
  req.on('error', reject)
  req.end()
})

const requestJson = async (...args) => JSON.parse(await request(...args))

const redditGeneratePost = async (subreddits = ['all']) => {
  let subreddit = subreddits[Math.floor(Math.random() * subreddits.length)]
  let sorting = 'hot' // best, hot, new, random, rising, top*, controversial*
  let time = 'week' // * = hour, day, week, month, year, all

  let res = await requestJson(`https://www.reddit.com/r/${subreddit}/hot/.json?raw_json=1&count=0&limit=10&t=${time}`, {
    headers: {
      'User-Agent': 'node.js:reddit-scraper:v0',
    },
  })

  let post = null
  for (let { data } of res.data.children)
    if (data.url && data.title) {
      post = {
        url: data.url,
        caption: data.title,
      }
      break
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
  log(r.data.children)
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
}).catch(log)
*/

let log = (...args) => {
  rl.output.write('\x1b[2K\r')
  console.log(...args)
  rl._refreshLine()
}

let wss = new WebSocket.Server({ port: 6000 })

let ws = null
let i = -1

wss.on('connection', newWs => {
  log('New connection')
  if (ws) ws.close()

  ws = newWs
  i = -1
  ws.on('message', data => {
    let message
    try {
      message = JSON.parse(data)
    } catch (e) {}
    if (message == null || typeof message !== 'object') {
      console.warn('Invalid packet received', data)
      return
    }
    log(message)

    if (message.t === 'ack') {
      if (message.i !== i)
        log(`Mismatch in acknowledgement index: expecting ${i} but received ${message.i}`)
      rl.prompt()
    }
  })
  ws.on('close', code => {
    log('Connection closed', code)
    ws = null
  })
})

let rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> ',
})

rl.prompt()

rl.on('line', line => {
  let [all, cmd, argsString] = line.match(/^([^\s]*)(?:\s+([^]*))?$/)
  let args = []
  if (argsString) {
    try {
      args = JSON.parse(`[${argsString}]`)
    } catch (err) {
      log('Invalid arguments')
      return
    }
  }
  if (!ws) {
    log('No connected client')
  } else {
    i++
    ws.send(JSON.stringify({ i, t: 'cmd', cmd, args }))
  }
})

rl.on('close', () => {
  console.log()
  process.exit(0)
})

setInterval(async () => {
  let serverData = (await database.serverData.get()) || {
    posts: [],
    redditGeneratePost: {
      enabled: false,
      queueMax: 3,
      waitTime: 24 * 60 * 60e3,
      subreddits: ['all'],
    },
  }

  let post = serverData.posts[0]
  if (post.time <= Date.now()) {
    serverData.posts.shift()
    if (!ws) {
      log('No connected client')
    } else {
      i++
      ws.send(JSON.stringify({ i, t: 'cmd', cmd: 'createPost', args: [post.url, post.caption] }))
    }
  }

  if (serverData.redditGeneratePost.enabled && serverData.posts.length < serverData.redditGeneratePost.queueMax) {
    let post = await redditGeneratePost(serverData.redditGeneratePost.subreddits)
    post.time = Date.now() + serverData.redditGeneratePost.waitTime
    serverData.posts.push(post)
    serverData.posts.sort((a, b) => a.time - b.time)
  }

  await database.serverData.set(serverData)
}, 60e3)