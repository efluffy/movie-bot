const { Client, Intents } = require('discord.js');
const fs = require('fs');
const conf = require('./conf.json');
const auth = require('./auth.json'); 

var movieList = [];
var currInx = 0;

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

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
				var reply = getList();
				msg.reply("Movie " + toRem + " removed!" + "\n" + reply);
				break;
				
			case 'vote':
				movieList = movieList.map(obj => {
					if (obj.id == args[1]) {
						return {...obj, votes: (parseInt(obj.votes) + 1)};
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