# Twitch WebSub Webhooks

[![Sub on Twitch](https://static-cdn.jtvnw.net/jtv_user_pictures/panel-51684790-image-2c23ef005f9a4731-320-320.png)](https://www.twitch.tv/modesttim/subscribe)

---
### Example

```sh
$ npm install
$ CLIENT_ID=YOUR_TWITCH_CLIENT_ID_HERE node examples/run.js
```

---
### Install from npm

```sh
$ npm install twitchwebsub
```

---
### Usage
Create a new **TwitchWebSub** server object

```javascript
var TwitchWebSub = require("twitchwebsub");
var WebSub = TwitchWebSub.server(options);

// Listen on port 9001
WebSub.listen(9001);
```

##### Options

| Key       | Type   | Description                                                                                 |
|-----------|--------|---------------------------------------------------------------------------------------------|
| callback  | string | url that twitch will call to get to this program                                   |
| client_id | string | Twitch API client id                                                                        |
| secret    | string | *Optional* - Default :: "I hate my life and don't care if people spoof requests from Twitch." |

---
### Events

| Key         | Parameters | Description                                     |
|-------------|------------|-------------------------------------------------|
| listen      |            | HTTP server is listening for connections.       |
| error       | err        | We've run into a problem.                       |
| denied      | data       | Subscription request was denied by Twitch       |
| subscribe   | data       | Successfully subscribed to a Topic              |
| unsubscribe | data       | Subscription was canceled by Twitch             |
| feed        | data       | Twitch sent us information about a subscription |

---
### Functions

`.listen(port)` - Listen for http requests on a given port  
`.subscribe(topic)` - Subscribe to a topic  
`.unsubscribe(topic)` - Unsubscribe from a topic  
`.on(event, callback)` - Listen for an event from twitch
