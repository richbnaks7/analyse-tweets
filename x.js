const puppeteer = require('puppeteer');
const fs = require('fs');
const moment = require('moment');
const toxicity = require('@tensorflow-models/toxicity');
require('@tensorflow/tfjs');

const BASE_URL = 'https://x.com/';
const LOGIN_URL = 'https://x.com/i/flow/login';
const USERNAME_URL = (username) =>  `https://x.com/${username}`

let browser = null;
let page = null;

/**
 * Formats a given date string into a standardized 'YYYY-MM-DD' format.
 *
 * @param {string} theDate - The date string to be formatted.
 * @return {string} The formatted date string in 'YYYY-MM-DD' format.
 */
const formatDate = (theDate) => {
	if (theDate.startsWith('Joined')) {
	  theDate = theDate.substring(7);
	}
	
	if (!theDate.includes(' 20')) {
	  const currentYear = moment().year();
	  theDate = `${theDate} ${currentYear}`;
	}
  
	// Add a day to the date string if it's just a month and year
	if (!theDate.includes(' ')) {
	  theDate = `${theDate} 1`;
	}
  
	let formattedDate = moment(theDate).format('YYYY-MM-DD');
	return formattedDate;
};

/**
 * Formats a given number string by converting it to a float value.
 * If the number string ends with 'M', it is assumed to be in millions and is converted accordingly.
 *
 * @param {string} number - The number string to be formatted.
 * @return {number} The formatted number as a float value.
 */
const formatNumber = (number) => {
	if(number.endsWith('M')){
		number = number.substring(0, number.length - 1);
		number = number + '000000';
	}
	return parseFloat(number);
};

/**
 * Initializes the browser and navigates to the base URL.
 *
 * @return {Promise<void>} A promise that resolves when the initialization is complete.
 */
const initialize = async () => {
	browser = await puppeteer.launch({
		headless : false,
		defaultViewport: {
			width: 1440,
			height: 900
		}
	});
	page = await browser.newPage();

	await page.goto(BASE_URL);
};

/**
 * Logs into a Twitter account using the provided username and password.
 *
 * @param {string} username - The Twitter username to log in with.
 * @param {string} password - The Twitter password to log in with.
 * @return {Promise<void>} A promise that resolves when the login is complete.
 */
const login = async (username, password) => {
	await page.goto(LOGIN_URL);
	await page.locator('div[aria-labelledby="modal-header"]').wait();
	await page.locator('input[autocomplete="username"]').fill(username, {delay: 100});
	await new Promise(resolve => setTimeout(resolve, 900));
	await page.keyboard.press('Enter');
	
	await page.waitForSelector('input[name="password"]');
	await new Promise(resolve => setTimeout(resolve, 900));
	await page.locator('input[name="password"]').fill(password, {delay: 100});
	await new Promise(resolve => setTimeout(resolve, 900));
	await page.keyboard.press('Enter');

	await page.locator('div[aria-label="Home timeline"]').wait();
};

/**
 * Retrieves a user's details from Twitter.
 *
 * @param {string} username - The Twitter username to retrieve details from.
 * @return {object} An object containing the user's details, including handle, full name, description, followings count, followers count, location, URL, and registration date.
 */
const getUser = async (username) => {

	let url = await page.url();

	if(url != USERNAME_URL(username)){
		await page.goto(USERNAME_URL(username));
	}
	await page.waitForSelector('div[data-testid="UserName"]');

	let details = await page.evaluate((username) => {
		return {
			handle: username,
			fullName: document.querySelector('div[data-testid="UserName"] span') ? document.querySelector('div[data-testid="UserName"] span').innerText : '',
			description: document.querySelector('div[data-testid="UserDescription"]') ? document.querySelector('div[data-testid="UserDescription"]').innerText : '',
			followingsCount: document.querySelector('a[href$="/following"] span') ? document.querySelector('a[href$="/following"] span').innerText : '',
			followersCount: document.querySelector('a[href$="/verified_followers"] span') ? document.querySelector('a[href$="/verified_followers"] span').innerText : '',
			location: document.querySelector('span[data-testid="UserLocation"]') ? document.querySelector('span[data-testid="UserLocation"]').innerText : '',
			url: document.querySelector('a[data-testid="UserUrl"]') ? document.querySelector('a[data-testid="UserUrl"]').innerText : '',
			registrationDate: document.querySelector('span[data-testid="UserJoinDate"]') ? document.querySelector('span[data-testid="UserJoinDate"]').innerText : '',
		}
	}, username);

	details.followingsCount = formatNumber(details.followingsCount.replace(' Following', ''));
	details.followersCount = formatNumber(details.followersCount.replace(' Followers', ''));
	if (details.registrationDate !== '') {
		details.registrationDate = formatDate(details.registrationDate);
	}


	fs.writeFileSync('./data/' + username + '.json', JSON.stringify(details, null, 2), 'utf-8');
	return details;
};

/**
 * Retrieves a specified number of tweets from a given Twitter username, 
 * including the tweet text, posted date, and toxicity analysis.
 *
 * @param {string} username - The Twitter username to retrieve tweets from.
 * @param {number} [count=10] - The number of tweets to retrieve. Default is 10.
 * @param {number} [threshold=0.8] - The toxicity threshold for analysis. Default is 0.8.
 * @return {Promise<Array<Object>>} An array of tweet objects containing the tweet text, posted date, and toxicity analysis.
 */
const getTweets = async (username, count = 10, threshold = 0.8) => {
	let url = await page.url();

	if(url != USERNAME_URL(username)){
		await page.goto(USERNAME_URL(username));
	}

	await page.waitForSelector('#accessible-list-0');

	let tweetsArray = await page.$$('article[data-testid="tweet"]');

	let lastTweetsArrayLength = 0;
	let tweets = []

	while(tweetsArray.length < count){
		await page.evaluate('window.scrollTo(0,document.body.scrollHeight)');
		await new Promise(resolve => setTimeout(resolve, 3000));

		tweetsArray = await page.$$('article[data-testid="tweet"]');

		if(lastTweetsArrayLength == tweetsArray.length) break;

		lastTweetsArrayLength = tweetsArray.length;
	}


   	for(let tweetElement of tweetsArray){
		let tweet = await tweetElement.$eval('div[data-testid="tweetText"]', element => element.innerText);
		let postedDate = await tweetElement.$eval('div[data-testid="User-Name"] a time', element => element.innerHTML);
		postedDate = formatDate(postedDate);
		let toxicityScore = await getToxicity(tweet, threshold);

		const analysis = toxicityScore
		.filter(element => element.results[0].match !== false)
		.map(element => JSON.stringify({
			[element.label]: {
				toxicity: element.results[0].match,
				probabilities: element.results[0].probabilities
			}
		}));

		tweets.push({
			tweet,
			postedDate,
			analysis,
		});
   	}

   	tweets = tweets.slice(0,count);

   	const existingData = fs.readFileSync(`./data/${username}.json`, 'utf8');
	const jsonData = JSON.parse(existingData);
	if (!jsonData.tweets) {
		jsonData.tweets = [];
	}
	jsonData.tweets.push(...tweets);
	
	fs.writeFileSync(`./data/${username}.json`, JSON.stringify(jsonData, null, 2), 'utf8');

   return tweets;
};

/**
 * Retrieves the toxicity analysis of a given tweet based on a specified threshold.
 *
 * @param {string} tweet - The text of the tweet to be analyzed.
 * @param {number} [threshold=0.8] - The minimum toxicity score required for a label to be considered a match.
 * @return {Promise<Array<Object>>} An array of objects containing the toxicity analysis results.
 */
const getToxicity = async (tweet, threshold = 0.8) => {
    const predictions = await toxicity.load(threshold).then(model => {
        const sentences = [tweet];
        return model.classify(sentences);
    });
    return predictions;
}

/**
 * Closes the browser instance.
 *
 * @return {Promise<void>} A promise that resolves when the browser is closed.
 */
const end = async () => {
	await browser.close()
}

module.exports = {
	initialize,
	login,
	getUser,
	getTweets,
	getToxicity,
	end
};