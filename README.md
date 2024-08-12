# Analyse Tweets

================

A project to analyse tweets from Twitter without using the Twitter API. This project uses Tensorflow.js Toxicity Model to analyse the sentiment and toxicity of tweets.

## Getting Started

---

Install the dependencies: `npm install`

## Usage

---

The project can be run using the following command line prompts:

- `node scrape.js -h=handle -n=numTweets -t=threshold -u=username:password`
  - `-h`: the Twitter handle of the user to collect tweets from
  - `-n`: the number of tweets to collect (default: 10)
  - `-t`: the toxicity threshold for analysis (default: 0.8)
  - `-u`: the username and password for Twitter login (optional) //not yet fully working

### Example

```bash
node scrape.js -h=elonmusk -n=10 -t=0.9
```

This will collect 10 tweets from the Twitter handle `elonmusk` and analyse their sentiment and toxicity using a threshold of 0.9.

### Note

This project uses puppeteer to scrape tweets from Twitter, so it may be against Twitter's terms of service. Use at your own risk.
