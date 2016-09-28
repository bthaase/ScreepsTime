var Clay = require('pebble-clay');
var clayConfig = require('./config');
var clay = new Clay(clayConfig);

var keys = require('message_keys');
console.log(JSON.stringify(keys, null, 2));

require('./gcolor');
var pako = require('./pako.js');

var xToken;
var prefix = 'https://screeps.com/api/';

var info = {};

var xhrRequest = function (url, type, callback) {
  var xhr = new XMLHttpRequest();
  xhr.onload = function () {
    callback(this.responseText);
  };
  xhr.open(type, url);
  xhr.send();
};

/* Convenience routine for making authorized requests to screeps. Needs to
 * replace X-Token if a new one was supplied in a response.
 * Credit to Dormando for this. https://github.com/screepers/pcreeps/blob/master/src/js/app.js
 */
var xhrScreepsRequest = function (url, type, callback, data) {
  var xhr = new XMLHttpRequest();
  xhr.onload = function () {
    var newToken = this.getResponseHeader('X-Token');
    if (newToken) xToken = newToken;
    
    try { var reply = JSON.parse(this.responseText); } catch(e) { var reply = this.responseText; }
    callback(reply);
  };
  xhr.open(type, url);
  if (type == "POST") xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
  if (xToken) {
    xhr.setRequestHeader('X-Username', xToken);
    xhr.setRequestHeader('X-Token', xToken);
  }
  if (data) {
      xhr.send(JSON.stringify(data));
  } else {
      xhr.send();
  }
};

var doScreepsLogin = function(callback) {
  xhrScreepsRequest(prefix + "auth/signin", 'POST', function(res) {
	  	console.log("LOGIN RESPONSE:");
      console.log(JSON.stringify(res, null, 2));
	  	xToken = res.token;
	  	callback(res.token ? true : false);
  }, { "email": localStorage.getItem('email'), "password": localStorage.getItem('password') });  
}

var doScreepsUnreadMessage = function(callback) {
	xhrScreepsRequest(prefix + "user/messages/unread-count", 'GET', function(res) {
		info.unreadMessages = (res.count ? res.count : 0);
		console.log("Unread Message: " + info.unreadMessages)
		callback();
	});
}

/*
var doScreepsAuthMe = function(callback) {
	xhrScreepsRequest(prefix + "auth/me", 'GET', function(res) {
		info.email = res.email;
		info.username = res.username;
		info.maxCpu = res.cpu;
		info.gclProgress = res.gcl;
		info.credits = res.credits;
		info.money = res.money;
		info.subscriptionTokens = res.subscriptionTokens;
		console.log("AuthMe: " + info.email);
		callback();
	});
}
*/

var decodeBase64 = function(s) {
    var e={},i,b=0,c,x,l=0,a,r='',w=String.fromCharCode,L=s.length;
    var A="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for(i=0;i<64;i++){e[A.charAt(i)]=i;}
    for(x=0;x<L;x++){
        c=e[s.charAt(x)];b=(b<<6)+c;l+=6;
        while(l>=8){((a=(b>>>(l-=8))&0xff)||(x<(L-2)))&&(r+=w(a));}
    }
    return r;
};

function GColor(base) {
  var c = parseInt(base.replace(/^#/, ''), 16);
  if ( isNaN(c) ) return null;
  return c;
}

var doScreepsMemory = function(callback) {
	xhrScreepsRequest(prefix + "user/memory?path=pebble", 'GET', function(res) {
		if ( !res.ok ) {
			callback();
			return;
		}
		
		var unpacked = decodeBase64(res.data.substring(3));
		var charData = unpacked.split('').map(function(x) { return x.charCodeAt(0); });			
		var binData = new Uint8Array(charData);
		var data        = pako.inflate(binData);
		var strData     = String.fromCharCode.apply(null, new Uint16Array(data));
		
		var mem = JSON.parse(strData);
		console.log("Memory block downloaded and decoded from Screeps API");
    console.log(JSON.stringify(mem, null, 2));
       
    var r0 = mem[0] || {};
    var r1 = mem[1] || {};
    var r2 = mem[2] || {};
    var r3 = mem[3] || {};
    info.vibrate = mem['vibrate'] || 0;
        
    info.text = [r0.text, r1.text, r2.text, r3.text];
    info.progress = [r0.progress || null, r1.progress || null, r2.progress || null, r3.progress || null];
    info.textColor = [r0.textColor, r1.textColor, r2.textColor, r3.textColor];
    info.textSecondColor = [r0.textSecondColor, r1.textSecondColor, r2.textSecondColor, r3.textSecondColor];
    info.overColor = [r0.bgColor, r1.bgColor, r2.bgColor, r3.bgColor];
    info.underColor = [r0.bgSecondColor, r1.bgSecondColor, r2.bgSecondColor, r3.bgSecondColor];
    info.blink = [r0.blink, r1.blink, r2.blink, r3.blink];
    info.bold = [r0.bold, r1.bold, r2.bold, r3.bold];
    
    for ( var i = 0; i < 4; i++ ) {
      if ( info.progress[i] !== null ) info.progress[i] = Math.round(info.progress[i]);
      if ( info.textColor[i] ) info.textColor[i] = GColor(info.textColor[i]);
      if ( info.textSecondColor[i] ) info.textSecondColor[i] = GColor(info.textSecondColor[i]);
      if ( info.overColor[i] ) info.overColor[i] = GColor(info.overColor[i]);
      if ( info.underColor[i] ) info.underColor[i] = GColor(info.underColor[i]);
    }
    
		callback();
	});
}

function dispatchScreepsInfo() {  
  // TODO: .. Send appMessages
  var dict = {};
  if ( info.unreadMessages ) dict[keys["SCREEPS_MAIL"]] = info.unreadMessages;

  // Dispatch rows of data.
  for ( var i = 0; i < 4; i++ ) {
    dict[keys["SCREEPS_TEXT"] + i] = info.text[i];
    dict[keys["SCREEPS_PROGRESS"] + i] = info.progress[i];
    dict[keys["SCREEPS_TEXT_COLOR"] + i] = info.textColor[i];
    dict[keys["SCREEPS_TEXT2_COLOR"] + i] = info.textSecondColor[i];
    dict[keys["SCREEPS_UNDER_COLOR"] + i] = info.underColor[i];
    dict[keys["SCREEPS_OVER_COLOR"] + i] = info.overColor[i];
    dict[keys["SCREEPS_BLINK"] + i] = info.blink[i];
    dict[keys["SCREEPS_BOLD"] + i] = info.bold[i];
  }
  dict[keys["SCREEPS_VIBRATE"]] = info.vibrate;
  
  console.log("Sending screeps information to watch...");
  console.log(JSON.stringify(dict, null, 2));
  Pebble.sendAppMessage( dict, function() { 
    console.log("dispatchScreepsInfo: Sent to watch successfully.");
  }, function() {
    console.log("dispatchScreepsInfo: Failed to send to watch.");
  });
}

function getScreepsData() {
  var email = localStorage.getItem('email');
  var password = localStorage.getItem('password');
  
  if ( !email || !password ) {
    var dict = {};
    dict[keys["ALERT_MISSING_CONFIG"]] = 1;
    Pebble.sendAppMessage( dict, function() { 
      console.log("getScreepsData: Sent alarm to watch successfully.");
    }, function() {
      console.log("getScreepsData: Failed to send alarm to watch.");
    });    
    return console.log("Unable to getScreepsData(), missing email and/or password.");
  }
  
  info = {};
  doScreepsLogin(function(success) {
    info.loginSuccess = success;
    if ( success ) {
      doScreepsUnreadMessage(function() {
        doScreepsMemory(function() {
          dispatchScreepsInfo();
        });
      });
    } else {
      // TODO: Authentication failure, send notice to the watch.      
      info.text = ["Screeps.com", "Login Failed", "Check Settings"];
      dispatchScreepsInfo();
    }
  })
}

Pebble.addEventListener('ready', function(e) {
  console.log("Watchface is open!");
  
  getWeather();
  getScreepsData();
})

Pebble.addEventListener('appmessage', function(e) {
  var dict = e.payload;
  console.log("PKit received an appmessage.")
  
  if ( dict["REQUEST_WEATHER"] == 1 ) {
    console.log("Message was a weather request!");
    getWeather();
  } else if ( dict["REQUEST_SCREEPS_API"] == 1 ) {
    console.log("Message sent was a ScreepsAPI request!");
    getScreepsData();
  }
  
  console.log(JSON.stringify(dict, null, 2));
});

Pebble.addEventListener('webviewclosed', function(e) {
  console.log("PKit received webviewclosed");
  if ( e && !e.response ) return;
  
  var dict = clay.getSettings(e.response, false);
  
  console.log(JSON.stringify(dict, null, 2));
  console.log("Storing email in localStorage as '" + dict.CONFIG_EMAIL.value + "'");
  
  localStorage.setItem('email', dict.CONFIG_EMAIL.value);
  localStorage.setItem('password', dict.CONFIG_PASSWORD.value);  
  localStorage.setItem('use_weather', dict.CONFIG_USE_WEATHER.value);
  localStorage.setItem('use_fahrenheit', dict.CONFIG_USE_FAHRENHEIT.value);  
  localStorage.setItem('weather_api_key', dict.CONFIG_WEATHER_API_KEY.value);  
  localStorage.setItem('weather_cityid', dict.CONFIG_WEATHER_CITYID.value);  
  
  getWeather();
  getScreepsData();
});

function locationSuccess(pos) {
  var myAPIKey = localStorage.getItem('weather_api_key');
  var myCityID = localStorage.getItem('weather_cityid');
  var useFahrenheit = localStorage.getItem('use_fahrenheit');
  
  console.log("Location success, requesting from Openweathermap API...");
  if ( !myAPIKey ) {
    console.log("ERROR: Skipping weather send, no API key.");
    return Pebble.sendAppMessage({'WEATHER': 'No Weather API Key'});
  }
  
  // Construct URL
  var url = 'http://api.openweathermap.org/data/2.5/weather?id=' + myCityID + '&appid=' + myAPIKey;
  if ( pos ) url = 'http://api.openweathermap.org/data/2.5/weather?lat=' + pos.coords.latitude + '&lon=' + pos.coords.longitude + '&appid=' + myAPIKey;
  
  // Send request to OpenWeatherMap
  xhrRequest(url, 'GET', function(responseText) {
      var weatherData = JSON.parse(responseText);
    
      console.log(JSON.stringify(weatherData, null, 2));
      if ( weatherData.cod && weatherData.message ) {
        console.log("Weather problem, sending to watch.");
        var weatherMsg = weatherData.message;
      } else {
        console.log("Weather success, sending to watch.")      
        var c = Math.round(weatherData.main.temp - 273.15);
        var f = Math.round((weatherData.main.temp - 273.15) * 9 / 5 + 32);
        var weatherMsg = weatherData.name + " - " + (weatherData.weather[0].main) + " " + ( useFahrenheit ? f : c) + String.fromCharCode(176);
      }
    
      var dictionary = { 'WEATHER': weatherMsg };
      Pebble.sendAppMessage( dictionary, function() { 
        console.log("locationSuccess: Sent to watch successfully.");
      }, function() {
        console.log("locationSuccess: Failed to send to watch.");
      });
   });
}

function locationError(err) {
  console.log('Error requesting location!');
}

function getWeather() {
  console.log(localStorage.getItem('use_weather'));
  if ( localStorage.getItem('use_weather') == "False" || localStorage.getItem('use_weather') == "false" ) {
    console.log("PKit is skipping weather, disabled in settings.");
    return;
  }

  console.log("PKit is requesting weather...");
  
  var myCityID = localStorage.getItem('weather_cityid');
  if ( myCityID ) return locationSuccess(null);
  
  navigator.geolocation.getCurrentPosition(
    locationSuccess,
    locationError,
    {timeout: 15000, maximumAge: 60000}
  );
}