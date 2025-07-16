var { Client, Intents } = require('discord.js');
var fs = require('fs');
var conf = require('./conf.json');
var auth = require('./auth.json');
var imdbTop100 = require('./imdb_top_100.json');
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
	// First, remove any movies with 0 votes from the previous week
	var removedMovies = [];
	for(var i = movieList.length - 1; i >= 0; i--) {
		if(parseInt(movieList[i].votes) === 0) {
			removedMovies.push(movieList[i].title);
			movieList.splice(i, 1);
		}
	}
	
	if(removedMovies.length > 0) {
		channel.send("Removing movies with 0 votes: " + removedMovies.join(", "));
	}
	
	// Select a random movie from IMDB top 100 that's not already in the list
	var availableMovies = imdbTop100.filter(movie => {
		return !movieList.some(listMovie => 
			listMovie.title.replace(/\s/g, '').toLowerCase() === movie.replace(/\s/g, '').toLowerCase()
		);
	});
	
	if(availableMovies.length === 0) {
		channel.send("All IMDB top 100 movies are already in the list!");
		return;
	}
	
	var randomMovie = availableMovies[getRandomInt(availableMovies.length)];
	
	// Add the new movie with 0 votes
	currInx++;
	var newMovie = { "id": currInx.toString(), "votes": "0", "title": randomMovie };
	movieList.push(newMovie);
	
	channel.send("Added new movie from IMDB top 100: " + randomMovie + " (ID: " + currInx + ") with 0 votes");
	
	// Sort movies by votes (highest first)
	movieList.sort((a, b) => {
		return parseInt(b.votes) - parseInt(a.votes);
	});
	
	var list = conf.externalHost;
	channel.send("Weekly movie update complete!" + "\n" + list);
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
	var obj = { "id": currInx.toString(), "votes": "1", "title": movie };
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
			return parseInt(b.votes) - parseInt(a.votes);
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
					return parseInt(b.votes) - parseInt(a.votes);
				});
				var reply = conf.externalHost;
				msg.reply("Vote recorded!" + "\n" + reply);
				writeOut();
				break;
			case 'voterange':
				var range = args[1].split("-");
				var votes = [];
				if ( (range[1] - range[0]) > 10 ) {
					msg.reply("Stop trying to vote for more than 10 movies in a range you problem.");
					break;
				}
				for ( var i = range[0]; i <= range[1]; i++) {
					votes.push(i) ;
				}
				votes.forEach(doVote);
				function doVote(id) {
					movieList = movieList.map(obj => {
						if (obj.id == id) {
							return {...obj, votes: (parseInt(obj.votes) + 1).toString()};
						}
						return obj;
					});
				}
				movieList.sort((a, b) => {
					return parseInt(b.votes) - parseInt(a.votes);
				});
				var reply = conf.externalHost;
				msg.reply("Votes recorded!" + "\n" + reply);
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
    else {
	res.end();
    }

});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});

client.login(auth.token);
