var TwitchWebSub = require("../app.js");

var twitch_id = 51684790;
var twitch_topic = `https://api.twitch.tv/helix/users/follows?from_id=${twitch_id}`;

var WebSub = TwitchWebSub.server({
	callback: "https://0c3f4149.ngrok.io/",
	client_id: process.env.CLIENT_ID,
	secret: "pineapple"
});
var closingTime = false;

WebSub.listen(8080);

WebSub.on('denied', () => {
	console.log('DENIED', arguments);
	process.exit(2);
});

WebSub.on('error', () => {
	console.log('ERROR', arguments);
	process.exit(3);
});

WebSub.on('listen', () => {
	WebSub.on('subscribe', (d) => {
		console.log(`${d.topic} subscribed until ${(new Date(d.lease * 1000)).toLocaleString()}`);
	});

	WebSub.on('unsubscribe', (d) => {
		console.log(`${d.topic} unsubscribed.`);
		if (!closingTime) WebSub.subscribe(twitch_topic);
		if (closingTime) process.exit(0);
	});

	WebSub.subscribe(twitch_topic);

	WebSub.on('feed', (d) => {
		console.log("\n--[\x1b[34m New Feed Request \x1b[0m]------------------------------------")
		console.log(d);
	});
});

process.on('SIGINT', () => {
	closingTime = true;
	WebSub.unsubscribe(twitch_topic);
});
