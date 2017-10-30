'use strict';

var http = require('http');
var util = require('util');
var Stream = require('stream').Stream;
var crypto = require('crypto');
var request = require('request');
var url = require('url');
var querystring = require('querystring');

/**
* @param {Object} [options] Options object
* @param {String} [options.callback] Callback URL for the hub
* @param {String} [options.secret] Secret value for HMAC signatures
* @param {String} [options.client_id] Twitch Client ID
* @return {Object} A TwitchWebSub server object
*/
module.exports.server = function (options) {
	return new TwitchWebSub(options);
};

/**
* @constructor
* @param {Object} [options] Options object
* @param {String} [options.callback] Callback URL for the hub
* @param {String} [options.secret] Secret value for HMAC signatures
* @param {String} [options.client_id] Twitch Client ID
*/
function TwitchWebSub (options) {
	Stream.call(this);

	options = options || {};

	this.secret = options.secret || "I hate my life and don't care if people spoof requests from Twitch.";
	this.client_id = options.client_id || '';
	this.hub = "https://api.twitch.tv/helix/webhooks/hub";
	this.twitch_callback = options.callback || '';

	if (this.client_id === "") throw new Error("How rude! Introducing yourself with a *clientid* before requesting data from Twitch.");
	if (this.twitch_callback === "") throw new Error("Twitch can't really call you back if you don't give them a *callback*... Duh.");
}
util.inherits(TwitchWebSub, Stream);

TwitchWebSub.prototype.listen = function () {
	var args = Array.prototype.slice.call(arguments);
	this.port = args[0];

	this.server = http.createServer(this._onREQ.bind(this));
	this.server.on('error', this._onError.bind(this));
	this.server.on('listening', this._onListening.bind(this));

	this.server.listen.apply(this.server, args);
};

/**
* @param {String} topic Helix endpoint
*/
TwitchWebSub.prototype.subscribe = function (topic) {
	this._setSUB('subscribe', topic);
};

/**
* @param {String} topic Helix endpoint
*/
TwitchWebSub.prototype.unsubscribe = function (topic) {
	this._setSUB('unsubscribe', topic);
};

/**
* @param {String} mode 'subscribe' || 'unsubscribe'
* @param {String} topic Helix endpoint
*/
TwitchWebSub.prototype._setSUB = function (mode, topic) {
	var twitch_callback = this.twitch_callback + (this.twitch_callback.replace(/^https?:\/\//i, '').match(/\//) ? '' : '/') + (this.twitch_callback.match(/\?/) ? '&' : '?') + 'topic=' + encodeURIComponent(topic) + '&hub=' + encodeURIComponent(this.hub);

	this._secret = crypto.createHmac('sha256', this.secret).update(topic).digest('hex');
	request.post({
		url: this.hub,
		headers: {
			"Client-ID": this.client_id
		},
		form: {
			'hub.callback': twitch_callback,
			'hub.mode': mode,
			'hub.topic': topic,
			'hub.lease_seconds': this.lease_seconds || 864000,
			'hub.secret': this._secret
		}
	}, (err, res, body) => {
		if (err) {
			return this.emit('denied', {
				topic: topic,
				error: err
			});
		}

		if (res.statusCode !== 202 && res.statusCode !== 204) {
			err = new Error(`Invalid response status ${res.statusCode}`);
			err.body = (body || '').toString();
			return this.emit('denied', {
				topic: topic,
				error: err
			});
		}
	});
};

/**
* @event
* @param {Object} req HTTP Request object
* @param {Object} res HTTP Response object
*/
TwitchWebSub.prototype._onREQ = function (req, res) {
	switch (req.method) {
		case 'GET':
			return this._onGET(req, res);
		case 'POST':
			return this._onPOST(req, res);
		default:
			return this._ERR(req, res, 405, 'Method Not Allowed');
	}
};

/**
* @event
* @param {Error} error Error object
*/
TwitchWebSub.prototype._onError = function (error) {
	if (error.syscall === 'listen') error.message = `[${error.code}] Failed to start on port ${this.port}`;
	this.emit('error', error);
};

/**
* @event
*/
TwitchWebSub.prototype._onListening = function () {
	this.emit('listen');
};

/**
* @param {Object} req HTTP Request object
* @param {Object} res HTTP Response object
*/
TwitchWebSub.prototype._onPOST = function(req, res) {
	var params = url.parse(req.url, true, true);
	var topic = params && params.query && params.query.topic;
	var hub = params && params.query && params.query.hub;

	if (!topic) return this._sendError(req, res, 400, 'Bad Request');
	if (this.secret && !req.headers['x-hub-signature']) return this._sendError(req, res, 403, 'Forbidden');
	var signature = req.headers['x-hub-signature'].split('=')[1];

	var body = '';
	req.on('data', function (data) {
		body += data;

		// 50 * Math.pow(10, 6) - 50MB Max
		if (body.length > 50000000) req.connection.destroy();
	});

	req.on('end', (function () {
		if (crypto.createHmac('sha256', this._secret).update(body).digest('hex') !== signature) {
			res.writeHead(202, { 'Content-Type': 'text/plain; charset=utf-8' });
			return res.end();
		}

		res.writeHead(204, { 'Content-Type': 'text/plain; charset=utf-8' });
		res.end();

		this.emit('feed', {
			topic: topic,
			hub: hub,
			callback: 'http://' + req.headers.host + req.url,
			feed: body,
			headers: req.headers
		});
	}).bind(this));
};

/**
* @param {Object} req HTTP Request object
* @param {Object} res HTTP Response object
*/
TwitchWebSub.prototype._onGET = function (req, res) {
	var data;

	var params = url.parse(req.url, true, true);
	if (!params.query['hub.topic'] || !params.query['hub.mode']) return this._ERR(req, res, 400, 'Bad Request');

	switch (params.query['hub.mode']) {
		case 'denied':
			data = {
				topic: params.query['hub.topic'],
				hub: params.query.hub
			};
			res.writeHead(200, {
				'Content-Type': 'text/plain'
			});
			res.end(params.query['hub.challenge'] || 'ok');
			break;
		case 'subscribe':
		case 'unsubscribe':
			data = {
				lease: Number(params.query['hub.lease_seconds'] || 0) + Math.round(Date.now() / 1000),
				topic: params.query['hub.topic'],
				hub: params.query.hub
			};
			res.writeHead(200, { 'Content-Type': 'text/plain' });
			res.end(params.query['hub.challenge']);
			break;
		default:
			return this._ERR(req, res, 403, 'Forbidden');
	}

	this.emit(params.query['hub.mode'], data);
};

/**
* @param {Object} req HTTP Request object
* @param {Object} res HTTP Response object
* @param {Int32} code HTTP response status
* @param {String} message Error message to display
*/
TwitchWebSub.prototype._ERR = function (req, res, code, message) {
	res.writeHead(code, { 'Content-Type': 'text/html' });
	res.end(`
		<!DOCTYPE html>
		<html>
			<head>
				<meta charset="utf-8"/>
				<title>TwitchWebSub - ${code} ${message}</title>
			</head>
			<body>
				<h1>TwitchWebSub - ${code} ${message}</h1>
			</body>
		</html>`);
};
