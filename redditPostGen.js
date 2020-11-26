const path = require('path')

const { request, requestJson } = require('./shared')
const hashtagsGen = require('./hashtagsGen')

const intoFileUrl = async (url, { image, video }) => {
  let extname = path.extname(url)

  if (image && ['.png', '.jpg', '.jpeg'].includes(extname)) {
    return url
  }

  if (video) {
    if (['.gif', '.webm', '.mp4'].includes(extname)) return url
    if (extname === '.gifv') return url.replace(/\.gifv$/, '.mp4')
    if (url.startsWith('https://v.redd.it/')) {
      let urls = null
      try {
        let playlistFile = await request(url + '/DASHPlaylist.mpd')
        urls = playlistFile.toString().match(/(?<=<BaseURL>)DASH_[0-9]+\.mp4(?=<\/BaseURL>)/g)
        if (!urls)
          throw new Error('URL not found in playlist')
      } catch (e) {
        return
      }

      let maxRes = 0
      let bestUrl = null
      for (let url of urls) {
        let res = parseInt(url.replace('DASH_', ''), 10)
        if (res <= maxRes) continue
        maxRes = res
        bestUrl = url
      }
      return url + '/' + bestUrl
    }
  }

  return null
}

const categories = {
  global: {
    excludeTitle: /instagram|reddit|post|title/i,
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
    filetypes: { video: true },
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
  mongusCity: {
    subreddits: ['AmongUs', 'AmongUsMemes'],
    excludeTitle: /\b(i|[wm]e|us)\b/i,
    requireFlairs: ['Humor', 'Meme', 'OC Meme'],
    caption: { type: 'title', credited: true },
    middleText: '*\n*\nFollow @mongus_city for fresh memes!\n\n🔎\nYour remaining tasks:\n✅Double Tap ⏫\n✅Upload comment data 💬\n✅Tag a friend 🏷️\n〰️〰️〰️\n*\n*',
    hashtagsList: '#amongus #amongusmeme #amongusgame #amongusart #amongusmemes #amongusespañol #amongusfanart #amongus #shitpost #amongusgame #amongusmeme #amongusmemes #amongusfanart #gaming #astronauts #crew #imposter #meme #mobile #gamememe #crewmates #multiplayer #multiplayergame #steamgame #steamgames #amongusart #amongusgameplay #amongusfunny #amongusmobile #amongusimposter #tasks #gamermeme #innersloth #us #vent #sus #amonguscosplay #amongusgreen #amonguspink #amongusorange #amongusyellow #amongus #amongusfunny #amonguswhite #amongusmemes #amongusmeme #amonguscomic #amongusfunny #amongusgameplay #amongusvideos #innersloth #redsus #impostor #meme #memes #funny #dankmemes #humor #amongus #shitpost #amongusgame #amongusmeme #amongusmemes #amongusfanart #gaming #astronauts #crew #imposter #meme #mobile #gamememe #crewmates #multiplayer #multiplayergame #steamgame #steamgames #amongusart #amongusgameplay #amongusfunny #amongusmobile #amongusimposter #tasks #gamermeme #innersloth #us #vent #sus'.split(' '),
  },
  justWildernessPlaces: {
    subreddits: ['EarthPorn'],
    removeTitle: /\[[^\]]*\][^]*$/,
    excludeTitle: /\b(i|you|[wmh]e|us|him|she|her|it|the[ym])\b/i,
    caption: { type: 'title', credited: true },
    middleText: '\nWould you go here?\nFollow us @just_wilderness_places\n',
    hashtagsKeywords: ['nature', 'travel'],
  },
  dogs: {
    subreddits: ['dogpictures'],
    sorting: 'top',
    caption: {
      type: 'random',
      options: [
        'Cutest face! 😍',
        '🐶🐶',
        'Daydreamin’ about treaties. 🍬',
        '😀😀',
        'I want them!! 😍',
        'So tiny 🥰',
        'Hey! That\'s me! 😍',
        'Look at this baby!! 😍😍',
        'That angelic look 😍😇',
        'Look at this cute baby 😍😍',
        'Who else loves this time of the year? ',
        'Will never get over these eyes! 😍😍',
        'Such a cute baby 😍😍',
        'Cozy time ☺️',
        'Look at that fluffy face 😍😍',
        'Such a cute little baby 😍😍',
        'How\'s the weekend going furrfriends 🥰',
        'A growing cutie 😍😍',
        'Tired after a long walk 😪',
        'Super adorable!! 😍😍',
        'How cute am I? 🥰',
        'Sweet like Watermelon Sugar 🍉',
        'Sweater weather🍂',
        'Hooman, you must gib me treats.',
        'The cutest brothers! 🥰',
        'Profile on Point 👌',
        'Furrfriends forever 🐾♥️',
        'Dogs are the cutest! 😍',
        '🥰🥰',
        'Look at this cutie 😍😍',
        'Look at this lovely ginger! 😍',
        'What do you mean by "we\'re out of treats" hooman🤨',
        'So tiny and cute! 😍😍',
        'Did you say food? 😋',
        'Such a cutie! 😍😍',
        '⚠️ BEWARE of very cute doggo that wants cuddles and kisses! 🧸',
        'Such a happy boi! 😄',
        'That goofy smile! 😍😍',
        'Hello furrfriends!',
        '💕💕',
        'Look deep in his eyes! 👀😍',
        '😴😴',
        'Puppy love ♥️♥️',
        'Those eyes 😍😍',
        'Those eyes!! 😍😍😍',
        'How adorable is this smile 😍😍',
        'Look at this small cutie 😍',
        'Gib me pets hooman!!',
        'Angel 👼',
        'What you lookin\' at?',
        'Look at that cute smile 😍😍',
        'How contagious is this cute smile!! 😍',
        'Hope this cute picture made you smile! 😍',
        'Is it too late for tongue out Tuesday?',
        'Look at those eyes 😍',
        'More pets please! 🥰',
        'Those blue eyes 😍😍',
        'Yes! More belly rubs 😄',
        'Yes, 10 pawtreats please 😋',
        'Double tap if this smile is contagious 🥰',
        'What do you mean we don’t get a vacation from our vacation? 😰',
        'That perfect face 😍',
        'Can I plz come out for pets and treats? 🥺',
        'Brother and sister love 🥰',
        'So photogenic 😍',
      ],
      credited: true,
    },
    hashtagsKeywords: ['dogs'],
  },
}

const generatePost = async (category, duplicatesToAvoid) => {
  let categoryData = categories[category]
  if (!categoryData)
    throw new Error('Invalid category')

  let {
    subreddits,
    sorting = 'hot', // best, hot, new, random, rising, top*, controversial*
    removeTitle = null,
    excludeTitle = null,
    requireFlairs = null,
    excludeFlairs = null,
    filetypes = { image: true, video: false },
    middleText = '\n\n',
    caption = 'title',
    hashtagsList = [],
    hashtagsKeywords = [],
  } = categoryData

  if (typeof caption === 'string')
    caption = { type: caption }

  let subreddit = subreddits[Math.floor(Math.random() * subreddits.length)]
  let time = 'day' // * = hour, day, week, month, year, all

  let res = await requestJson(`https://www.reddit.com/r/${subreddit}/${sorting}.json?raw_json=1&count=0&limit=75&t=${time}`, {
    headers: {
      'User-Agent': 'node.js:reddit-scraper:v0',
    },
  })

  let post = null
  for (let { data } of res.data.children) {
    if (!data.title || !data.url) continue

    if (duplicatesToAvoid.some(duplicate => duplicate.id === data.id)) continue

    let title = data.title
    if (categories.global.excludeTitle.test(title)) continue
    if (removeTitle) title = title.replace(removeTitle, '')
    if (excludeTitle && excludeTitle.test(title)) continue
    if (excludeFlairs && excludeFlairs.includes(data.link_flair_text)) continue
    if (requireFlairs && !requireFlairs.includes(data.link_flair_text)) continue
    let sourceSize = data.preview?.images?.[0].source || { width: 1, height: 1 }
    if (sourceSize.height / sourceSize.width > 1.2 || sourceSize.height / sourceSize.width < 0.4) continue

    let fileUrl = await intoFileUrl(data.url, filetypes)
    if (fileUrl == null) continue

    let postCaption = []
    if (caption.type === 'random') {
      postCaption.push(caption.options[Math.floor(Math.random() * caption.options.length)])
    } else {
      postCaption.push(title.trim())
    }

    let hashtags = []
    let hashtagsAddFrom = (from, max, maxTotal = 30, shuffleMode = 'excludeFirst') => {
      from = from.slice()
      let added = 0
      while (added < max && hashtags.length < maxTotal) {
        if (from.length === 0) break
        let shuffled = shuffleMode === 'excludeFirst' ? added !== 0 : shuffleMode
        let hashtag = shuffled ? from.splice(Math.floor(Math.random() * from.length), 1)[0] : from.shift()
        if (hashtags.includes(hashtag)) continue
        hashtags.push(hashtag)
        added++
      }
      return added
    }

    if (hashtagsList.length > 0) {
      hashtagsAddFrom(hashtagsList, hashtagsKeywords.length === 0 ? 30 : 20, 30)
    }

    let maxPerKeyword = Math.ceil((30 - hashtags.length) / hashtagsKeywords.length)
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

      hashtagsAddFrom([`#${keyword}`, ...results], maxPerKeyword, 30)
    }

    if (middleText)
      postCaption.push(middleText)
    if (caption.credited && data.author !== '[deleted]')
      postCaption.push(`Credit: ${data.author}`)
    if (hashtags.length > 0)
      postCaption.push(hashtags.join(' '))

    post = {
      id: data.id,
      url: fileUrl,
      caption: postCaption.join('\n'),
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