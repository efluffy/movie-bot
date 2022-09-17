var { Client, Intents } = require('discord.js');
var fs = require('fs');
var conf = require('./conf.json');
var auth = require('./auth.json');
var CronJob = require('cron').CronJob;
const { exec } = require("child_process");
const http = require("http");
const path = require("path");

const hostname = conf.hostname;
const port = conf.port;

var movieList = [];
var currInx = 0;
var channel = {};
var htmlHeader = `<html><head><title>Movie Bot List</title></head><body bgcolor="#000000" text="#69696"><pre>`;
var htmlFooter = `</pre></body></html>`;

var client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

var cron = new CronJob({
	cronTime: conf.movieTime,
	onTick: pickMovie,
	start: false,
	timeZone: 'America/New_York'
});

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

function pickMovie() {
	if(movieList.length == 1) {
		channel.send("Please add more than one movie for random picks!");
		return;
	}
	movieList.sort((a, b) => {
		return b.votes - a.votes;
	});
	var top = [];
	var max = (movieList.length < 5) ? movieList.length : 5;
	for(var i = 1; i <= max; i++) {
		top.push(movieList[i]);
	}
	var choice = top[ getRandomInt(max) ];
	channel.send("Random movie for this week is: " + choice['title'] + "!");
	var toRem = choice['id'];
	for( var i = 0; i < movieList.length; i++) {
		if (movieList[i].id == toRem) {
			movieList.splice(i, 1);
		}
	}
	var list = getList();
	channel.send("Movie " + toRem + " picked, removing!" + "\n" + list);
	writeOut();
}

function fWidth(strLen, width) {
	var t = width - strLen;
	var out = "";
	while (t-- > 0) {
		out += ' ';
	}
	return out;
}

function getList() {
	var reply = "IDs | Votes | Movie\n-------------------\n";
	movieList.forEach(function(movie){
		var wId = movie['id'].length;
		var wVt = movie['votes'].length;
		reply = reply + movie['id'] + fWidth(wId, 4) + "| " + movie['votes'] + fWidth(wVt, 6) + "| " + movie['title'] + "\n";
	});
	/* reply = '```' + reply + '```'; */
	return reply;
}

function addList(movie) {
	currInx++;
	var obj = { "id": currInx.toString(), "votes": "0", "title": movie };
	movieList.push(obj);
	writeOut();
}

function writeOut() {
	var content = "";
	movieList.forEach(function(movie) {
		content = content + movie['id'] + "┐" + movie['votes'] + "┐" + movie['title'] + "\n";
	});
	content = content.trim();
	fs.writeFile(conf.saveFile, content, err => {
		if (err) {
			console.error(err);
		}
	});
}


client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
	fs.readFile(conf.saveFile, function(err, buf) {
		var bufSerialized = buf.toString();
		var lines = bufSerialized.split('\n');
		lines.forEach(function(line){
			var obj = {};
			var arr = line.split("┐");
			obj['id'] = arr[0];
			obj['votes'] = arr[1];
			obj['title'] = arr[2];
			if(obj['title'] != undefined) {
				movieList.push(obj);
			}
		});
		if(lines.length != 1) {
			currInx = Math.max.apply(Math, movieList.map(function(obj) { return obj.id; }));
		}
		movieList.sort((a, b) => {
			return b.votes - a.votes;
		});
		channel = client.channels.cache.get(conf.channel);
		cron.start();
	});
});

client.on('messageCreate', msg => {
	if (msg.toString().substring(0, 1) == '!') {
		var args = msg.toString().substring(1).split(' ');
		var cmd = args[0];
		switch(cmd) {
			case 'help':
				fs.readFile(conf.helpFile, function(err, buf) {
					var bufSerialized = buf.toString();
					msg.reply('```' + bufSerialized + '```');
				});
				break;
				
			case 'list':
				var reply = conf.externalHost;
				msg.reply(reply);
				break;
				
			case 'wherebot':
				exec("hostname", (err, stdout, stderr) => {
					msg.reply(stdout);
				});
				break;
				
			case 'select':
				pickMovie();
				break;
				
			case 'add':
				var toAdd = msg.toString().substring(5);
				var add = 1;
				for( var i = 0; i < movieList.length; i++) {
					if( movieList[i]['title'].replace(/\s/g, '').toLowerCase() == toAdd.replace(/\s/g, '').toLowerCase() ) {
						msg.reply("Movie already in list.");
						add = 0;
						break;
					}
				}
				if (add == 1) {
					addList(toAdd);
					var reply = conf.externalHost;
					msg.reply("Movie " + toAdd + " added!" + "\n" + reply);
				}
				break;
				
			case 'rem':
				var toRem = msg.toString().substring(5);
				for( var i = 0; i < movieList.length; i++) {
					if (movieList[i].id == toRem) {
						movieList.splice(i, 1);
					}
				}
				var reply = conf.externalHost;
				msg.reply("Movie " + toRem + " removed!" + "\n" + reply);
				writeOut();
				break;
				
			case 'vote':
				movieList = movieList.map(obj => {
					if (obj.id == args[1]) {
						return {...obj, votes: (parseInt(obj.votes) + 1).toString()};
					}
					return obj;
				});
				movieList.sort((a, b) => {
					return b.votes - a.votes;
				});
				var reply = conf.externalHost;
				msg.reply("Vote recorded!" + "\n" + reply);
				writeOut();
				break;
		}
	}
});

const server = http.createServer((req, res) => {
    console.log((req.headers['x-forwarded-for'] || req.connection.remoteAddress) + ' (' + req.headers['user-agent'] + ') ' + req.method + ' - ' + req.url);

    if (req.method == 'GET') {
		res.statusCode = 200;
		res.setHeader('Content-Type', 'text/html');
		res.write(htmlHeader + getList() + htmlFooter);
	    	res.end();
    }
});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});

client.login(auth.token);
=======
var { Client, Intents } = require('discord.js');
var fs = require('fs');
var conf = require('./conf.json');
var auth = require('./auth.json');
var CronJob = require('cron').CronJob;

var movieList = [];
var currInx = 0;
var channel = {};

var client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

var cron = new CronJob({
	cronTime: conf.movieTime,
	onTick: pickMovieWeighted,
	start: false,
	timeZone: 'America/New_York'
});

function randBetween(min, max) {
    return parseInt(Math.floor(Math.random() * (max - min) + min));
}

function shuffle(array) {
  var currentIndex = array.length,  randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
}

function pickMovieWeighted() {
	if(movieList.length == 1) {
		channel.send("Please add more than one movie for random picks!");
		return;
	}
	movieList = shuffle(movieList);
	weightSum = 0;
	for( var i = 0; i < movieList.length; i++ ) {
		weightSum += movieList[i].votes;
	}
	var rand = randBetween(0, weightSum);
	console.log(rand);
	var choice = {};
	for( var i = 0; i < movieList.length; i++ ) {
		if( rand < movieList[i].votes ) {
			choice = movieList[i];
			break;
		}
		rand -= movieList[i].votes;
	}
	channel.send("Random movie for this week is: " + choice['title'] + "!");
	var toRem = choice['id'];
	for( var i = 0; i < movieList.length; i++) {
		if (movieList[i].id == toRem) {
			movieList.splice(i, 1);
		}
	}
	movieList.sort((a, b) => {
		return b.votes - a.votes;
	});
	var list = getList();
	channel.send("Movie " + toRem + " picked, removing!" + "\n" + list);
	writeOut();
}


function fWidth(strLen, width) {
	var t = width - strLen;
	var out = "";
	while (t-- > 0) {
		out += ' ';
	}
	return out;
}

function getList() {
	var reply = "IDs | Votes | Movie\n-------------------\n";
	movieList.forEach(function(movie){
		var wId = movie['id'].length;
		var wVt = movie['votes'].length;
		reply = reply + movie['id'] + fWidth(wId, 4) + "| " + movie['votes'] + fWidth(wVt, 6) + "| " + movie['title'] + "\n";
	});
	reply = '```' + reply + '```';
	return reply;
}

function addList(movie) {
	currInx++;
	var obj = { "id": currInx.toString(), "votes": "0", "title": movie };
	movieList.push(obj);
	writeOut();
}

function writeOut() {
	var content = "";
	movieList.forEach(function(movie) {
		content = content + movie['id'] + "┐" + movie['votes'] + "┐" + movie['title'] + "\n";
	});
	content = content.trim();
	fs.writeFile(conf.saveFile, content, err => {
		if (err) {
			console.error(err);
		}
	});
}


client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
	fs.readFile(conf.saveFile, function(err, buf) {
		var bufSerialized = buf.toString();
		var lines = bufSerialized.split('\n');
		if(lines.length != 1) {
			currInx = lines.length;
		}
		lines.forEach(function(line){
			var obj = {};
			var arr = line.split("┐");
			obj['id'] = arr[0];
			obj['votes'] = arr[1];
			obj['title'] = arr[2];
			if(obj['title'] != undefined) {
				movieList.push(obj);
			}
		});
		movieList.sort((a, b) => {
			return b.votes - a.votes;
		});
		channel = client.channels.cache.get(conf.channel);
		cron.start();
	});
});

client.on('messageCreate', msg => {
	if (msg.toString().substring(0, 1) == '!') {
		var args = msg.toString().substring(1).split(' ');
		var cmd = args[0];
		switch(cmd) {
			case 'help':
				fs.readFile(conf.helpFile, function(err, buf) {
					var bufSerialized = buf.toString();
					msg.reply('```' + bufSerialized + '```');
				});
				break;
				
			case 'list':
				var reply = getList();
				msg.reply(reply);
				break;
				
			case 'select':
				pickMovieWeighted();
				break;
				
			case 'add':
				var toAdd = msg.toString().substring(5);
				var add = 1;
				for( var i = 0; i < movieList.length; i++) {
					if( movieList[i]['title'].replace(/\s/g, '').toLowerCase() == toAdd.replace(/\s/g, '').toLowerCase() ) {
						msg.reply("Movie already in list.");
						add = 0;
						break;
					}
				}
				if (add == 1) {
					addList(toAdd);
					var reply = getList();
					msg.reply("Movie " + toAdd + " added!" + "\n" + reply);
				}
				break;
				
			case 'rem':
				var toRem = msg.toString().substring(5);
				for( var i = 0; i < movieList.length; i++) {
					if (movieList[i].id == toRem) {
						movieList.splice(i, 1);
					}
				}
				currInx--;
				writeOut();
				var reply = getList();
				msg.reply("Movie " + toRem + " removed!" + "\n" + reply);
				break;
				
			case 'vote':
				movieList = movieList.map(obj => {
					if (obj.id == args[1]) {
						return {...obj, votes: (parseInt(obj.votes) + 1).toString()};
					}
					return obj;
				});
				movieList.sort((a, b) => {
					return b.votes - a.votes;
				});
				var reply = getList();
				msg.reply("Vote recorded!" + "\n" + reply);
				writeOut();
				break;
		}
	}
});

client.login(auth.token);