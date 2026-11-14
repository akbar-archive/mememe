# Tech Meme Bot: PLAN

A bot that checks tech news every ~30 minutes, picks the headlines with the most meme potential, writes a meme for each using a free LLM, renders it on an imgflip template, and posts it to a Telegram channel.

Budget: **$0**. Everything runs on free tiers.

---

## 1. Stack

| Part | Choice | Why |
|---|---|---|
| Runtime | Node.js 20 + TypeScript | you already live here |
| Scheduler + hosting | GitHub Actions (cron) | free, no server to babysit |
| News source | RSS feeds + Reddit JSON | free, no API keys |
| RSS parsing | `rss-parser` | simple, handles most feeds |
| LLM | Gemini Flash (free tier) via `@google/genai` | free, fast, good enough for jokes |
| Meme rendering | imgflip `caption_image` API | free, uses popular templates |
| Posting | Telegram Bot API (`sendPhoto`) | free, easy, no approval process |
| Storage | `data/seen.json` committed back to the repo | no database needed |

---

## 2. News feeds

```ts
export const FEEDS = [
  "https://www.theverge.com/rss/index.xml",
  "https://techcrunch.com/feed/",
  "https://feeds.arstechnica.com/arstechnica/index",
  "https://www.wired.com/feed/rss",
  "https://www.engadget.com/rss.xml",
  "https://feeds.bbci.co.uk/news/technology/rss.xml",
  "https://hnrss.org/frontpage",
];

export const REDDIT = ["https://www.reddit.com/r/technology/.json?limit=25"];
```

Notes:
- Test every feed with `curl` before trusting it.
- Reddit needs a custom `User-Agent` header and sometimes blocks GitHub Actions IPs. If it 403s, drop it; the RSS feeds alone are plenty.

---

## 3. How one run works

```
cron fires (every 30 min)
  -> fetch all feeds in parallel (ignore any that fail)
  -> normalize items to { id, title, summary, link, source, publishedAt }
  -> drop items already in seen.json
  -> drop items older than 6 hours
  -> dedupe similar headlines (same story from 3 outlets)
  -> send remaining headlines to Gemini in ONE batch call for scoring
  -> keep top 1-2 with score >= 7 and safe = true
  -> for each winner:
       -> Gemini picks a template + writes captions
       -> imgflip renders the image
       -> Telegram posts photo + caption + source link
  -> add ALL fetched ids to seen.json (not just posted ones)
  -> commit seen.json back to the repo
```

---

## 4. Folder structure

```
meme-bot/
├── .github/workflows/run.yml
├── data/
│   └── seen.json
├── src/
│   ├── index.ts          # main run, glues everything
│   ├── config.ts         # feeds, thresholds, limits
│   ├── fetchNews.ts      # rss + reddit fetching and normalizing
│   ├── dedupe.ts         # seen.json + similar-headline filter
│   ├── score.ts          # gemini batch scoring
│   ├── makeMeme.ts       # gemini template pick + captions
│   ├── imgflip.ts        # template list + caption_image call
│   ├── telegram.ts       # sendPhoto
│   └── types.ts
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 5. Data formats

`types.ts`
```ts
export type NewsItem = {
  id: string;          // hash of link
  title: string;
  summary: string;
  link: string;
  source: string;
  publishedAt: string;
};

export type Scored = NewsItem & {
  score: number;       // 1-10 meme potential
  safe: boolean;       // false for tragedies, deaths, etc.
  angle: string;       // one-line idea for the joke
};

export type Meme = {
  templateId: string;
  captions: string[];  // one per text box
  postText: string;    // telegram caption
};
```

`data/seen.json`
```json
{ "ids": { "a1b2c3": "2026-11-14T09:00:00Z" } }
```
Prune entries older than 7 days on every run so the file doesn't grow forever.

---

## 6. Dedupe

1. **Exact:** `id = sha1(link)`, skip if in `seen.json`.
2. **Same story, different outlet:** lowercase the title, strip punctuation and stopwords, compare word sets. If overlap (Jaccard) > 0.5 with an item from the same run, keep only one.

Good enough. No embeddings needed.

---

## 7. Gemini prompts

### 7.1 Scoring (one call per run, all headlines at once)

```
You rate tech news headlines for meme potential.

For each headline return:
- score: 1-10 (10 = everyone in tech will laugh at this)
- safe: false if it involves death, injury, disasters, war, abuse, suicide,
  or real people suffering. Layoffs are safe only if the joke targets the
  company, never the workers.
- angle: one short line describing the joke

High scores: big tech drama, product fails, absurd pricing, AI hype,
CEO behavior, outages, "they did WHAT", relatable dev pain.
Low scores: routine funding rounds, minor updates, dry policy news.

Return JSON only: [{ "id": "...", "score": 0, "safe": true, "angle": "..." }]

Headlines:
{{list of id + title + summary}}
```

Use `responseMimeType: "application/json"` so you get clean JSON back.

### 7.2 Meme writing (one call per winner)

```
Make a meme about this tech news.

Headline: {{title}}
Summary: {{summary}}
Joke angle: {{angle}}

Pick ONE template from this list and write the text for each box.
Keep each box under 8 words. Be actually funny, not corporate funny.
No slurs, no attacks on regular people, punch up at companies and CEOs.

Templates (id, name, box_count):
{{top ~40 imgflip templates}}

Return JSON only:
{ "templateId": "...", "captions": ["...", "..."], "postText": "short caption for the post" }
```

Validate that `captions.length === box_count` for the chosen template. If not, retry once, then skip.

---

## 8. imgflip

- Sign up for a free imgflip account (the API needs username + password).
- `GET https://api.imgflip.com/get_memes` returns the top 100 templates with `box_count`. Cache it in the repo as `data/templates.json` and refresh it weekly, no need to fetch every run.
- Hand-pick ~40 templates that work for tech jokes (Drake, Distracted Boyfriend, Two Buttons, This Is Fine, Expanding Brain, etc.) so the LLM doesn't pick weird ones.
- Render:

```ts
const body = new URLSearchParams({
  template_id: meme.templateId,
  username: process.env.IMGFLIP_USER!,
  password: process.env.IMGFLIP_PASS!,
});
meme.captions.forEach((t, i) => body.append(`boxes[${i}][text]`, t));

const res = await fetch("https://api.imgflip.com/caption_image", { method: "POST", body });
const json = await res.json(); // json.data.url
```

---

## 9. Telegram

1. Create a bot with @BotFather and get the token.
2. Create a public channel and add the bot as admin.
3. Post:

```ts
await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chat_id: process.env.TG_CHANNEL,   // "@yourchannel"
    photo: imageUrl,                    // imgflip url works directly
    caption: `${meme.postText}\n\nsource: ${item.link}`,
  }),
});
```

---

## 10. GitHub Actions workflow

`.github/workflows/run.yml`
```yaml
name: meme-bot

on:
  schedule:
    - cron: "*/30 * * * *"
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: meme-bot
  cancel-in-progress: false

jobs:
  run:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run start
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          IMGFLIP_USER: ${{ secrets.IMGFLIP_USER }}
          IMGFLIP_PASS: ${{ secrets.IMGFLIP_PASS }}
          TG_TOKEN: ${{ secrets.TG_TOKEN }}
          TG_CHANNEL: ${{ secrets.TG_CHANNEL }}
          DRY_RUN: "false"
      - name: commit seen.json
        run: |
          git config user.name "meme-bot"
          git config user.email "meme-bot@users.noreply.github.com"
          git add data/seen.json
          git diff --staged --quiet || git commit -m "update seen [skip ci]"
          git push
```

Notes:
- **Make the repo public.** Actions minutes are unlimited on public repos, limited on private ones. Secrets stay hidden either way.
- GitHub cron can lag 10-30 min and skips runs under load. That's fine for memes.
- GitHub disables scheduled workflows after 60 days with no repo activity. The `seen.json` commits count as activity, so you're covered as long as it runs.
- `concurrency` stops two runs from fighting over `seen.json`.

---

## 11. Secrets

Repo -> Settings -> Secrets and variables -> Actions:

| Secret | Where to get it |
|---|---|
| `GEMINI_API_KEY` | aistudio.google.com |
| `IMGFLIP_USER` / `IMGFLIP_PASS` | imgflip.com signup |
| `TG_TOKEN` | @BotFather |
| `TG_CHANNEL` | `@yourchannelname` |

Also add `.env.example` with the same keys for local runs.

---

## 12. Config knobs (`config.ts`)

```ts
export const CONFIG = {
  maxPostsPerRun: 2,
  minScore: 7,
  maxAgeHours: 6,
  seenTtlDays: 7,
  maxPostsPerDay: 12,   // track in seen.json, stops spam on big news days
  dryRun: process.env.DRY_RUN === "true",
};
```

`DRY_RUN=true` logs the meme URL instead of posting. Use it locally until the jokes stop being cringe.

---

## 13. Safety rules (hardcoded, not just in the prompt)

- Skip any item where Gemini says `safe: false`.
- Keyword blocklist on the title as a second layer: `killed, dead, death, dies, shooting, suicide, crash victims, war, attack, abuse`, etc.
- Never put a real person's photo on a template. Text only.
- Always include the source link so it's clear it's commentary on real news.

---

## 14. Error handling

- One feed failing must not kill the run (`Promise.allSettled`).
- Gemini returns bad JSON: retry once, then skip that item.
- imgflip or Telegram fails: log it, don't mark that item as posted, but still mark it as seen so it doesn't loop forever.
- Wrap the whole run in try/catch and exit 0 so a single bad run doesn't spam failure emails. Use exit 1 only for missing secrets.

---

## 15. Milestones

**Day 1: skeleton**
- [ ] init repo, TS, `npm run start`
- [ ] `fetchNews.ts` prints normalized headlines from all feeds
- [ ] `seen.json` read/write + dedupe

**Day 2: brain**
- [ ] Gemini scoring returns valid JSON
- [ ] template list cached, Gemini picks template + captions
- [ ] imgflip renders, URL printed in dry run

**Day 3: ship**
- [ ] Telegram channel + bot posting works locally
- [ ] Actions workflow + secrets
- [ ] first real run, check the commit back works

**Later (optional)**
- [ ] post to X/Threads too
- [ ] manual approval mode: bot sends drafts to your DM with ✅/❌ buttons before posting to the channel
- [ ] track reactions on posts and feed the best ones back into the prompt as examples
- [ ] Uzbek/Russian captions version

---

## 16. Risks

| Risk | Fix |
|---|---|
| jokes are mid | tune prompts, add 5-10 example memes you like to the prompt |
| Gemini free tier rate limit | one batch scoring call per run keeps you way under it |
| feed URL dies | `allSettled` + check logs weekly |
| Reddit blocks Actions | drop Reddit, RSS is enough |
| bot memes something tragic | `safe` flag + keyword blocklist + approval mode if paranoid |
| free tier terms change | everything is swappable: Groq or Cloudflare Workers AI for the LLM |
