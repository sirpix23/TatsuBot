var fs = require('fs')
	,config = require("../bot/config.json");
ServerSettings = require('../db/servers.json');
Times = require('../db/times.json');
//Disabled = require('../db/disabled.json');
var inactive = []
	,whitelist = require('./config.json').whitelist;
	
var mysql_db = require('./mysql.js');
var async = require('async');
var Random = require("random-js");
var randEngine = new Random(Random.engines.mt19937().autoSeed());
var redis = require('redis');
var client = redis.createClient(); //creates a new client

//Timer for updating config files
var updatedS = false, updatedT = false/*, updatedD = false*/;
setInterval(() => {
	if (updatedS) {
		updatedS = false;
		updateServers();
	}
	if (updatedT) {
		updatedT = false;
		updateTimes();
	}
	/*if (updatedD) {
		updatedD = false;
		updateDisabled();
	}*/
}, 60000)

//Function for saving to disabled.json
/*
function updateDisabled() {
	fs.writeFile(__dirname + '/../db/disabled-temp.json', JSON.stringify(Disabled), error=>{
		if (error) console.log(error)
		else {
			fs.stat(__dirname + '/../db/disabled-temp.json', (err, stats)=>{
				if (err) console.log(err)
				else if (stats["size"] < 5) console.log('Prevented server settings database from being overwritten');
				else {
					fs.rename(__dirname + '/../db/disabled-temp.json', __dirname + '/../db/disabled.json', e=>{if(e)console.log(e)});
					if (debug) console.log(cDebug(" DEBUG ") + " Updated disabled.json");
				}
			});
		}
	})
}*/

//Function for saving to servers.json
function updateServers() {
	fs.writeFile(__dirname + '/../db/servers-temp.json', JSON.stringify(ServerSettings), error=>{
		if (error) console.log(error)
		else {
			fs.stat(__dirname + '/../db/servers-temp.json', (err, stats)=>{
				if (err) console.log(err)
				else if (stats["size"] < 5) console.log('Prevented server settings database from being overwritten');
				else {
					fs.rename(__dirname + '/../db/servers-temp.json', __dirname + '/../db/servers.json', e=>{if(e)console.log(e)});
					if (debug) console.log(cDebug(" DEBUG ") + " Updated servers.json");
				}
			});
		}
	})
}

//Function for saving to times.json
function updateTimes() {
	fs.writeFile(__dirname + '/../db/times-temp.json', JSON.stringify(Times), error=>{
		if (error) console.log(error)
		else {
			fs.stat(__dirname + '/../db/times-temp.json', (err, stats)=>{
				if (err) console.log(err)
				else if (stats["size"] < 5) console.log('Prevented times database from being overwritten');
				else {
					fs.rename(__dirname + '/../db/times-temp.json', __dirname + '/../db/times.json', e=>{if(e)console.log(e)});
					if (debug) console.log(cDebug(" DEBUG ") + " Updated times.json");
				}
			});
		}
	})
}

//Check if server is in times
exports.serverIsNew = function(server) {
	if (Times.hasOwnProperty(server.id)) return false;
	return true;
}

//Check if server is in server.json, if not add new configs
exports.addServer = function(server) {
	if (!server) return;
	if (!ServerSettings.hasOwnProperty(server.id)) {
		ServerSettings[server.id] = {"ignore":[],"banAlerts":false,"nameChanges":false,"welcome":"none","deleteCommands":false,"notifyChannel":"general","allowNSFW":false};
		updatedS = true;
	}
};

//Changes settings
exports.changeSetting = function(key, value, serverId) {
	if (!key || value == undefined || value == null || !serverId) return;
	switch (key) {
		case 'banAlerts':
			ServerSettings[serverId].banAlerts = value; break;
		case 'nameChanges':
			ServerSettings[serverId].nameChanges = value; break;
		case 'deleteCommands':
			ServerSettings[serverId].deleteCommands = value; break;
		case 'notifyChannel':
			ServerSettings[serverId].notifyChannel = value; break;
		case 'allowNSFW':
			ServerSettings[serverId].allowNSFW = value; break;
		case 'welcome':
			ServerSettings[serverId].welcome = value; break;
	}
	updatedS = true;
};

//Ignore channel
exports.ignoreChannel = function(channelId, serverId) {
	if (!channelId || !serverId) return;
	if (ServerSettings[serverId].ignore.indexOf(channelId) == -1) {
		ServerSettings[serverId].ignore.push(channelId);
		updatedS = true;
	}
};

//Unignore channel
exports.unignoreChannel = function(channelId, serverId) {
	if (!channelId || !serverId) return;
	if (ServerSettings[serverId].ignore.indexOf(channelId) > -1) {
		ServerSettings[serverId].ignore.splice(ServerSettings[serverId].ignore.indexOf(channelId), 1);
		updatedS = true;
	}
};

//Disable Command
/*exports.disableCmd = function(suffix, serverId) {
	if (!suffix || !serverId) return;
	if (Disabled[serverId].disabledCmds.indexOf(suffix) == -1) {
		Disabled[serverId].disabledCmds.push(suffix);
		updatedD = true;
	}
};

//Enable Command
exports.enableCmd = function(suffix, serverId) {
	if (!suffix || !serverId) return;
	if (Disabled[serverId].disabledCmds.indexOf(suffix) > -1) {
		Disabled[serverId].disabledCmds.splice(Disabled[serverId].disabledCmds.indexOf(suffix), 1);
		updatedD = true;
	}
};*/

exports.checkServers = function(bot) {
	inactive = [];
	var now = Date.now();
	Object.keys(Times).map(id=>{
		if (!bot.servers.find(s=>s.id == id)) delete Times[id];
	});
	bot.servers.map(server=>{
		if (server == undefined) return;
		if (!Times.hasOwnProperty(server.id)) {
			console.log(cGreen("Joined server: ") + server.name);
			if (config.banned_server_ids && config.banned_server_ids.indexOf(server.id) > -1) {
				console.log(cRed("Joined server but it was on the ban list") + ": " + server.name);
				bot.sendMessage(server.defaultChannel, "This server is on the ban list");
				setTimeout(()=>{bot.leaveServer(server);},1000);
			} else {
				if (config.whitelist.indexOf(server.id) == -1) {
					var toSend = [];
					toSend.push("👋🏻 Hi! I'm **" + bot.user.username.replace(/@/g, '@\u200b') + "**");
					toSend.push("You can use `" + config.command_prefix + "help` to see what I can do. Mods can use `" + config.mod_command_prefix + "help` for mod commands.");
					toSend.push("Mod/Admin commands *including bot settings* can be viewed with `" + config.mod_command_prefix + "help`");
					toSend.push("For help, feedback, bugs, info, changelogs, etc. go to **<https://discord.gg/0xyZL4m5TyYTzVGY>**");
					bot.sendMessage(server.defaultChannel, toSend);
				}
				Times[server.id] = now;
				addServer(server);
			}
		} else if (config.whitelist.indexOf(server.id) == -1 && now - Times[server.id] >= 604800000) {
			inactive.push(server.id);
			if (debug) console.log(cDebug(" DEBUG ") + " " + server.name + '(' + server.id + ')' + ' hasn\'t used the bot for ' + ((now - Times[server.id]) / 1000 / 60 / 60 / 24).toFixed(1) + ' days.');
		}
	});
	updatedT = true;
	if (inactive.length > 0) console.log("Can leave " + inactive.length + " servers that don't use the bot");
	if (debug) console.log(cDebug(" DEBUG ") + " Checked for inactive servers");
};

//Remove inactive servers
exports.remInactive = function(bot, msg, delay) {
	if (!bot || !msg) return;
	if (inactive.length == 0) {
		bot.sendMessage(msg, 'Nothing to leave :)');
		return;
	}
	var cnt = 0, passedOver = 0, toSend = "__Left servers for inactivity:__", now1 = new Date();
	var remInterval = setInterval(()=>{
		var server = bot.servers.get('id', inactive[passedOver]);
		if (server) {
			toSend += '\n**' + (cnt+1) + ':** ' + server.name.replace(/@/g, '@\u200b') + ' (' + ((now1 - Times[inactive[passedOver]]) / 1000 / 60 / 60 / 24).toFixed(1) + ' days)';
			server.leave();
			console.log(cUYellow("Left server") + " " + server.name);
			if (Times.hasOwnProperty(server.id)) {
				delete Times[server.id];
				updatedT = true;
				if (debug) console.log(cDebug(" DEBUG ") + " Removed server from times.json");
			}
			cnt++;
		}
		delete Times[inactive[passedOver]];
		passedOver++;
		if (cnt >= 10 || passedOver >= inactive.length) {
			for (var i = 0; i < passedOver; i++) inactive.shift();
			if (cnt == 0) bot.sendMessage(msg, 'Nothing to leave :)');
			else bot.sendMessage(msg, toSend);
			clearInterval(remInterval);
			updatedT = true;
			return;
		}
	}, delay || 10000);
};

//Leave server, delete from TImes.json
exports.handleLeave = function(server) {
	if (!server || !server.id) return;
	if (Times.hasOwnProperty(server.id)) {
		delete Times[server.id];
		updatedT = true;
		if (debug) console.log(cDebug(" DEBUG ") + " Removed server from times.json");
	}
};

//Add server to times.json if not in times
exports.addServerToTimes = function(server) {
	if (!server || !server.id) return;
	if (!Times.hasOwnProperty(server.id)) {
		Times[server.id] = Date.now();
		updatedT = true;
	}
};

//Add server to config if not in config
function addServer(server) {
	if (!server) return
	if (!ServerSettings.hasOwnProperty(server.id)) {
		ServerSettings[server.id] = {"ignore":[],"banAlerts":false,"nameChanges":false,"welcome":"none","deleteCommands":false,"notifyChannel":"general","allowNSFW":false};
		updatedS = true;
	}
}

//Updates timestamp
exports.updateTimestamp = function(server) {
	if (!server || !server.id) return;
	if (Times.hasOwnProperty(server.id)) {
		Times[server.id] = Date.now();
		updatedT = true;
	}
	if (inactive.indexOf(server.id) >= 0) inactive.splice(inactive.indexOf(server.id), 1);
};

//Add server to disabled.json if not in the disabled commands config
/*
exports.addServerToDisabled = function(server) {
	if (!server || !server.id) return;
	if (!Disabled.hasOwnProperty(server.id)) {
		Disabled[server.id] = {"disabledCmds":[]};
		updatedD = true;
	}
};

function addServerToDisabled(server) {
	if (!server || !server.id) return
	if (!Disabled.hasOwnProperty(server.id)) {
		Disabled[server.id] = {"disabledCmds":[]};
		updatedD = true;
	}
}
*/

//Redis add server to disabled keys

exports.disableCmd = function(suffix, serverId) {
	if (!serverId || !suffix) return;
	client.set("server:" + serverId + ":disabled:" + suffix, "disabled", function(err, reply) {
		console.log(suffix + " disabled on " + serverId);
	});
}

exports.enableCmd = function(suffix, serverId) {
	if (!serverId || !suffix) return;
	client.del("server:" + serverId + ":disabled:" + suffix, function(err, reply) {
		console.log(suffix + " enabled on " + serverId);
	});
}

exports.rss_handleLeave = function(server)
{
	async.waterfall([
		function doCheckId(done)
		{
			mysql_db.query("SELECT * FROM rss_feeds WHERE server_id = ?",server.id,function(err, results, fields){
				console.log(server.id);
				if(err)
				{
					console.error('DB Error!: ' + err.stack);
					done(new Error(err.stack));
					return;
				}
				else
				{
					if(results.length > 0)
					{
						done(null);
						return;
					}
					else
					{
						done(new Error("no rss for this server: "+server.name + " | " + server.id));
						return;
					}
				}
			});
		},
		function doDeleteQuery(done)
		{
			mysql_db.query("DELETE FROM rss_feeds WHERE server_id = ?",server.id,function(err, results){
				if(err)
				{
					console.error('DB Error!: ' + err.stack);
					done(new Error(err.stack));
					return;
				}
				else
				{
					done(null);
					return;
				}
			});
		}
	], function(err, res)
	{
		if(!err)
		{
			console.log("[RSSFeed] Removed RSS feeds from DB for: " + server.name + " | " + server.id);
        }
		else
		{
			console.log("[RSSFeed] " + err.message);
		}
	});
}


//Leveling & credits stuff
var expValue = randEngine.integer(10, 20), credValue = randEngine.integer(5, 10), currentLvl = 0, oldExp = 0, oldLvl = 0;

exports.addLvlCreds = function(serverId, userId, callback) {
	var profile = "profile:" + userId;
	var userLeveled = {};
	var newExpValue = 0;
	if (!userId) return;
	//If there is an cooldown for the user, skip adding exp
	client.get("cooldown:" + userId, function(err, reply) {

		//If reply is null, then set expire key and set exp, update global rankings
		if(!reply){
			//console.log("Giving EXP and credits");
			async.series([
				function(done){
					client.hget(profile, "exp", function(err, reply)
						{
							if(reply)
							{
								oldExp = reply;
								oldLvl = Math.floor(0.12 * Math.sqrt(oldExp));
							}
							else console.log("No exp");
							done(null);
							return;
						})
					},
				function(done){
					//console.log("incr exp");
					client.hincrby(profile, "exp", expValue, function(err,reply){ done(null); return; });
					
					var oldExpConv = parseInt(oldExp);
					var expValueConv = parseInt(expValue);
					newExpValue = oldExpConv + expValueConv;
					
					currentLvl = Math.floor(0.12 * Math.sqrt(newExpValue));
					
						if(currentLvl > oldLvl){
							//bot.sendMessage(msg, "You have obtained level 6!");
							console.log(userId + " has reached level " + currentLvl);
							userLeveled = {
								"id":userId,
								"level":currentLvl
							};
							
						}
					},
				function(done){
					//console.log("incr credits");
					client.hincrby(profile, "credits", credValue, function(err,reply){ done(null); return; }); 
					},
				function(done){
					//console.log("add ranking");
					client.sadd("userList", "ranking:" + userId, function(err,reply){ done(null); return; });
					},
				function(done){
					//console.log("set cd");
					client.set("cooldown:" + userId, "true", function(err,reply){ done(null); return; });
					},
				function(done){
					//console.log("expire cd");
					client.expire("cooldown:" + userId, 60, function(err,reply){ done(null); return; });
					}
			], function(err, res)
			{
				if(!err)
				{
					client.zadd("server:" + serverId + ":ranking", newExpValue, userId);
					client.zadd("global:ranking", newExpValue, userId);
					//done
					callback(userLeveled);
				}
			});
			
		}
	});
}	
exports.addExclude = function(userId){
	if (!userId) return;
	client.set("global:exclude:" + userId, "excluded", function(err, reply) {
		// reply if errors
		console.log(reply);
		console.log("Bot " + userId + " added to global exclusion list.");
	});
}

exports.getKeyExists = function(keyToCheck, callback){
	client.get(keyToCheck, function(err, reply) {
		var keyExists = false;
		if(reply) {
			//console.log("Key exists in database - " + keyToCheck);
			keyExists = true;
		}
		//console.log("The state of keyExists " + keyExists);
		callback(keyExists);
	});
}


	
exports.getLvl = function(userId, callback) {
	var profile = "profile:" + userId;
	var userStats = {};
	var userExp = 0, userLevel = 0, nextLevel = 0, nextExp = 0, previousExp = 0, neededExp = 0, currentExp = 0;
	if (!userId) return;
	async.series([
		function(done){
			//get all the exps needed and do calculation Remember add check for users with no exp
			client.hget(profile, "exp", function(err, reply){
				if(reply){
					userExp = reply;
					//console.log("userExp is: " + userExp);
				}
				done(null);
				return;
			});
		},
		function(done){
			userLevel = Math.floor(0.12 * Math.sqrt(userExp));
			nextLevel = userLevel + 1;
			previousExp = Math.floor(Math.pow((userLevel/0.12), 2));
			//console.log("previousExp is: " + previousExp);
			nextExp = Math.floor(Math.pow((nextLevel/0.12), 2)) - previousExp;
			currentExp = userExp - previousExp;
			//console.log("nextExp is: " + nextExp);
			//console.log("neededExp is: " + neededExp);
			done(null);
			return;
		},
		function(done){
			userStats = {
				"id":userId,
				"level":userLevel,
				"exp":currentExp,
				"nextlvlexp":nextExp,
				//"nextlevel":nextLevel
			};
			done(null);
			return;
		}
	], function(err, res)
	{
		if(!err)
		{
			callback(userStats);
		}
	});
}
//
exports.getRankings = function (serverId, userId, callback){
	if (!userId) return;
	var userRanks = {};
	var globalRankInt = 0, serverRankInt = 0;
	var globalRank = 0;
	var serverRank = 0;
	async.series([
		function(done){
			client.zrevrank("global:ranking", userId , function(err, reply) {
				if(reply) {
					if(reply == null){
					globalRankInt = 0;
					} else if(reply) {
						globalRank = reply;
						console.log("globalRank is: " + reply);
							globalRankInt = parseInt(globalRank) + 1;
					} else {
						globalRankInt = 1;
					}
				}
				done(null);
				return;
			});
		},
		function(done){
			client.zrevrank(serverId, userId , function(err, reply) {
				if(reply == null){
					serverRankInt = 0;
				} else if(reply) {
					serverRank = reply;
					console.log("serverRank is: " + reply);
						serverRankInt = parseInt(serverRank) + 1;
				} else {
					serverRankInt = 1;
				}
			done(null);
			return;
			});	
		},
		function(done){
			console.log("global ranking: " + globalRankInt);
			console.log("server ranking: " + serverRankInt);
			userRanks = {
				"id":userId,
				"globalRanking":globalRankInt,
				"serverRanking":serverRankInt
				//"nextlevel":nextLevel
			};
			done(null);
			return;
		}
	], function(err, res)
	{
		if(!err)
		{
			callback(userRanks);
		}
	});
}