const twitter = require('./x');

(async () => {
    
    let handle;
    if (process.argv.length >= 3 && process.argv[2].startsWith('-h=')) {
        handle = process.argv[2].replace('-h=','');
    } else {
        console.log('Usage: node scrape.js -h=handle -n=numTweets -t=threshold -u=username:password');
        return false;
    }

    let numTweets = 10;
    if (process.argv.length >= 4 && process.argv[3].startsWith('-n=')) {
        numTweets = parseInt(process.argv[3].replace('-n=',''));
    }

    let threshold = 0.8;
    if (process.argv.length >= 5 && process.argv[4].startsWith('-t=')) {
        threshold = parseFloat(process.argv[4].replace('-t=',''));
    }

    let username = null, password = null;
    if (process.argv.length >= 6 && process.argv[5].startsWith('-u=')) {
        username = process.argv[5].replace('-u=','').split(':')[0];
        password = process.argv[5].replace('-u=','').split(':')[1];
    }


	await twitter.initialize();

    // if (username && password) {
	//     await twitter.login(username, password);
    // }

	await twitter.getUser(handle);
	await twitter.getTweets(handle, numTweets, threshold);

	await twitter.end();

})();