export const FEEDS = [
  "https://www.theverge.com/rss/index.xml",
  "https://techcrunch.com/feed/",
  "https://feeds.arstechnica.com/arstechnica/index",
  "https://www.wired.com/feed/rss",
  "https://www.engadget.com/rss.xml",
  "https://feeds.bbci.co.uk/news/technology/rss.xml",
  "https://hnrss.org/frontpage",
  // Reddit's .json endpoint 403s bots; its RSS feed does not.
  "https://www.reddit.com/r/technology/.rss",
];

export const CONFIG = {
  maxPostsPerRun: 1,
  minScore: 7,
  maxAgeHours: 6,
  seenTtlDays: 7,
  maxPostsPerDay: 12,
  similarityThreshold: 0.5,
  recentTemplatesToAvoid: 15, // roughly the last day of posts; leaves 60+ templates to pick from
};

export const PATHS = {
  seen: "data/seen.json",
  templates: "data/templates.json",
};

// Second safety layer behind the LLM's `safe` flag. Matched as whole words.
export const BLOCKLIST = [
  "killed", "kill", "kills", "dead", "death", "deaths", "dies", "died", "dying",
  "shooting", "shot", "suicide", "victim", "victims", "war", "attack", "attacks",
  "abuse", "abused", "murder", "terror", "terrorist", "bomb", "massacre",
  "injured", "injury", "disaster", "earthquake", "hurricane", "flood", "genocide",
  "rape", "assault", "hostage", "funeral", "overdose", "fatal",
];

// Hand-picked imgflip templates that suit tech jokes. Matched by name against get_memes.
export const CURATED_TEMPLATES = [
  "Drake Hotline Bling", "Distracted Boyfriend", "Two Buttons", "This Is Fine",
  "Expanding Brain", "Change My Mind", "UNO Draw 25 Cards", "Left Exit 12 Off Ramp",
  "Bernie I Am Once Again Asking For Your Support", "Running Away Balloon",
  "Disaster Girl", "Woman Yelling At Cat", "Gru's Plan", "Buff Doge vs. Cheems",
  "Batman Slapping Robin", "Always Has Been", "Mocking Spongebob",
  "Hide the Pain Harold", "One Does Not Simply", "Futurama Fry",
  "Waiting Skeleton", "Is This A Pigeon", "Trade Offer", "Monkey Puppet",
  "Sad Pablo Escobar", "Anakin Padme 4 Panel", "Tuxedo Winnie The Pooh",
  "Epic Handshake", "Clown Applying Makeup", "Roll Safe Think About It",
  "Ancient Aliens", "Surprised Pikachu", "Two guys on a bus", "Panik Kalm Panik",
  "Boardroom Meeting Suggestion", "Grandma Finds The Internet", "Leonardo Dicaprio Cheers",
  "They're The Same Picture", "X, X Everywhere", "Y'all Got Any More Of That",
  "Success Kid", "Laughing Leo", "Bike Fall",
  "Marked Safe From", "Squidward window", "0 days without (Lenny, Simpsons)",
  "You Guys are Getting Paid", "Absolute Cinema", "Oprah You Get A",
  "This Is Where I'd Put My Trophy If I Had One", "Megamind peeking", "They don't know",
  "Pawn Stars Best I Can Do", "Bell Curve", "Imagination Spongebob", "Spider Man Triple",
  "Evil Kermit", "Friendship ended", "Inhaling Seagull", "Three-headed Dragon",
  "Domino Effect", "Flex Tape", "All My Homies Hate", "No - Yes", "Scooby doo mask reveal",
  "Anime Girl Hiding from Terminator", "spiderman pointing at spiderman",
  "You know, I'm something of a scientist myself", "Blank Nut Button", "is this butterfly",
  "Two Paths", "Charlie Conspiracy (Always Sunny in Philidelphia)",
  "Gus Fring we are not the same", "The Scroll Of Truth", "I'm The Captain Now",
  "The Rock Driving", "Yo Dawg Heard You", "Bad Luck Brian", "Sleeping Shaq",
];
