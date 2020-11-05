const path = require('path')

const { requestJson } = require('./shared')
const hashtagsGen = require('./hashtagsGen')

const categories = {
  global: {
    excludeTitle: /instagram|reddit/i,
  },
  generic: {
    subreddits: ['all'],
  },
  memes: {
    subreddits: ['DeepFriedMemes'], // ['surrealmemes'],
    hashtagsKeywords: ['memes'],
  },
  tech: {
    subreddits: ['INEEEEDIT'],
    excludeFlairs: ['Mod Approved Shitpost'],
    hashtagsKeywords: ['tech'],
  },
  mensFashion: {
    subreddits: ['malefashion'],
    requireFlairs: ['WIWT'],
    caption: {
      type: 'random',
      options: ['Cop or not?', 'Good look?'],
    },
    hashtagsKeywords: ['mensfashion'],
  },
  travel: {
    subreddits: ['travel'],
    excludeTitle: /\b(i|you|[wmh]e|us|him|she|her|it|the[ym])\b/i,
    hashtagsKeywords: ['travel'],
  },
}

const generatePost = async (category, duplicatesToAvoid) => {
  let categoryData = categories[category]
  if (!categoryData)
    throw new Error('Invalid category')

  let {
    subreddits,
    excludeTitle = null,
    requireFlairs = null,
    excludeFlairs = null,
    caption = 'title',
    hashtagsKeywords = [],
  } = categoryData

  let subreddit = subreddits[Math.floor(Math.random() * subreddits.length)]
  let sorting = 'hot' // best, hot, new, random, rising, top*, controversial*
  let time = 'week' // * = hour, day, week, month, year, all

  let res = await requestJson(`https://www.reddit.com/r/${subreddit}/${sorting}.json?raw_json=1&count=0&limit=25&t=${time}`, {
    headers: {
      'User-Agent': 'node.js:reddit-scraper:v0',
    },
  })

  let post = null
  for (let { data } of res.data.children) {
    if (!data.title || !data.url) continue

    if (!['.png', '.jpg', '.jpeg', '.gif', '.webm', '.mp4'].includes(path.extname(data.url))) continue
    if (duplicatesToAvoid.some(duplicate => duplicate.url === data.url)) continue

    if (categories.global.excludeTitle.test(data.title)) continue
    if (excludeTitle && excludeTitle.test(data.title)) continue
    if (excludeFlairs && excludeFlairs.includes(data.link_flair_text)) continue
    if (requireFlairs && !requireFlairs.includes(data.link_flair_text)) continue

    if (typeof caption === 'string')
      caption = { type: caption }

    let postCaption = data.title.trim()
    if (caption.type === 'random') {
      postCaption = caption.options[Math.floor(Math.random() * caption.options.length)]
    } else if (caption.type === 'credited') {
      postCaption = ''
      if (data.author !== '[deleted]')
        caption += ` (by ${data.author})`
    }

    let hashtags = []
    let maxPerKeyword = Math.ceil(30 / hashtagsKeywords.length)
    for (let keyword of hashtagsKeywords) {
      let ignoreError = err => {
        console.error(err)
        return []
      }

      let results = [].concat(...await Promise.all([
        hashtagsGen.allHashtag(keyword).catch(ignoreError),
        hashtagsGen.bestHashtags(keyword).catch(ignoreError),
        // hashtagsGen.topHashtags(keyword).catch(ignoreError),
      ]))

      let max = hashtags.length + maxPerKeyword

      hashtags.push(`#${keyword}`)
      while (hashtags.length < max) {
        if (results.length === 0) break
        let [result] = results.splice(Math.floor(Math.random() * results.length), 1)
        if (!hashtags.includes(result))
          hashtags.push(result)
      }
    }

    if (hashtags.length > 0)
      postCaption += `\n\n${hashtags.slice(0, 30).join(' ')}`

    post = {
      url: data.url,
      caption: postCaption,
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

module.exports = { categories, generatePost }