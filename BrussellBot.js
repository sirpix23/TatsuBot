//Run this with node to run the bot.

var commands = require("./bot/commands.js");
var mod = require("./bot/mod.js");
var config = require("./bot/config.json");
var games = require("./bot/games.json");
var versioncheck = require("./bot/versioncheck.js");
var discord = require("discord.js");
/*var cleverbot = require("./bot/cleverbot.js").cleverbot;*/
var colors = require("./bot/styles.js");
var db = require("./bot/db.js");
//==others
var mysql = require("mysql");                       //node-mysql lib
var mysql_db = require("./bot/mysql.js");               //mysql helper class
var async = require("async");                       //node-async lib
var moment = require('moment');                     //Moment.js lib
var rss_config = require("./bot/rss_settings.json");    //rss config file for bot
var Stopwatch = require('statman-stopwatch');

checkConfig();

var lastExecTime = {};
setInterval(() => lastExecTime = {},3600000);
commandsProcessed = 0, talkedToTimes = 0;
show_warn = config.show_warn, debug = config.debug;

var bot = new discord.Client({maxCachedMessages: 50});
bot.on("warn", m=>{ if (show_warn) console.log(colors.cWarn(" WARN ") + m); });
bot.on("debug", m=>{ if (debug) console.log(colors.cDebug(" DEBUG ") + m); });

bot.on("ready", () => {
	bot.forceFetchUsers();
	bot.setPlayingGame(games[Math.floor(Math.random() * (games.length))]);
	console.log(colors.cGreen("BrussellBot is ready!") + " Listening to " + bot.channels.length + " channels on " + bot.servers.length + " servers");
	versioncheck.checkForUpdate(resp => {
		if (resp !== null) console.log(resp);
	});
});

bot.on("disconnected", () => {
	console.log(colors.cRed("Disconnected") + " from Discord");
	commandsProcessed = 0, talkedToTimes = 0, lastExecTime = {};
	setTimeout(() => {
		console.log("Attempting to log in...");
		bot.login(config.email, config.password, function(err, token) {
			if (err) { console.log(err); process.exit(0); }
			if (!token) { console.log(colors.cWarn(" WARN ") + "Failed to re-connect"); process.exit(0); }
		});}, 20000);
});

bot.on("message", msg => {
	if (msg.channel.isPrivate && msg.author.id != bot.user.id && (/(^https?:\/\/discord\.gg\/[A-Za-z0-9]+$|^https?:\/\/discordapp\.com\/invite\/[A-Za-z0-9]+$)/.test(msg.content))) carbonInvite(msg); //accept invites sent in a DM
	if (msg.channel.isPrivate && /^(help|how do I use this\??)$/i.test(msg.content)) commands.commands["help"].process(bot, msg);
	if (msg.author.id == config.admin_id && msg.content.startsWith("(eval) ")) { evaluateString(msg); return; } //bot owner eval command
	if (msg.mentions.length !== 0 && !msg.channel.isPrivate) {
		/*if (msg.isMentioned(bot.user) && msg.content.startsWith("<@" + bot.user.id + ">")) {
			if (ServerSettings.hasOwnProperty(msg.channel.server.id)) { if (ServerSettings[msg.channel.server.id].ignore.indexOf(msg.channel.id) === -1) {
				cleverbot(bot, msg); talkedToTimes += 1;
			}} else { cleverbot(bot, msg); talkedToTimes += 1; }
		}*/
		if (msg.content.indexOf("<@" + config.admin_id + ">") > -1) {
			if (config.send_mentions) {
				var owner = bot.users.get("id", config.admin_id);
				if (owner.status != "online") bot.sendMessage(owner, msg.channel.server.name + " > " + msg.author.username + ": " + msg.cleanContent);
			}
		}
	}
	if (!msg.content.startsWith(config.command_prefix) && !msg.content.startsWith(config.mod_command_prefix)) return;
	if (msg.author.id == bot.user.id) return;
	if (msg.content.indexOf(" ") == 1 && msg.content.length > 2) { msg.content = msg.content.replace(" ", ""); }
	if (!msg.channel.isPrivate && !msg.content.startsWith(config.mod_command_prefix) && ServerSettings.hasOwnProperty(msg.channel.server.id)) {
		if (ServerSettings[msg.channel.server.id].ignore.indexOf(msg.channel.id) > -1) return;
	}
	var cmd = msg.content.split(" ")[0].replace(/\n/g, " ").substring(1).toLowerCase();
	var suffix = msg.content.replace(/\n/g, " ").substring(cmd.length + 2);
	if (msg.content.startsWith(config.command_prefix)) {
		if (commands.commands.hasOwnProperty(cmd)) execCommand(msg, cmd, suffix, "normal");
		else if (commands.aliases.hasOwnProperty(cmd)) {
			msg.content = msg.content.replace(/[^ ]+ /, config.command_prefix + commands.aliases[cmd] + " ");
			execCommand(msg, commands.aliases[cmd], suffix, "normal");
		}
	} else if (msg.content.startsWith(config.mod_command_prefix)) {
		if (cmd == "reload" && msg.author.id == config.admin_id) { reload(); bot.deleteMessage(msg); return; }
		if (mod.commands.hasOwnProperty(cmd)) execCommand(msg, cmd, suffix, "mod");
		else if (mod.aliases.hasOwnProperty(cmd)) {
			msg.content = msg.content.replace(/[^ ]+ /, config.mod_command_prefix + mod.aliases[cmd] + " ");
			execCommand(msg, mod.aliases[cmd], suffix, "mod");
		}
	}
});

function execCommand(msg, cmd, suffix, type) {
	try {
		commandsProcessed += 1;
		if (type == "normal") {
			if (!msg.channel.isPrivate) console.log(colors.cServer(msg.channel.server.name) + " > " + colors.cGreen(msg.author.username) + " > " + msg.cleanContent.replace(/\n/g, " ")); else console.log(colors.cGreen(msg.author.username) + " > " + msg.cleanContent.replace(/\n/g, " "));
			if (commands.commands[cmd].hasOwnProperty("cooldown")) {
				if (lastExecTime.hasOwnProperty(cmd)) {
					var id = msg.author.id;
					if (lastExecTime[cmd][id] != undefined) {
						var cTime = new Date();
						var leTime = new Date(lastExecTime[cmd][id]);
						leTime.setSeconds(leTime.getSeconds() + commands.commands[cmd].cooldown);
						if (cTime < leTime) { //if it is still on cooldow
							var left = (leTime.valueOf() - cTime.valueOf()) / 1000;
							if (msg.author.id != config.admin_id) { //admin bypass
								bot.sendMessage(msg, msg.author.username + ", you need to *cooldown* (" + Math.round(left) + " seconds)", function(erro, message) { bot.deleteMessage(message, {"wait": 6000}); });
								if (!msg.channel.isPrivate) bot.deleteMessage(msg, {"wait": 10000});
								return;
							}
						} else lastExecTime[cmd][id] = cTime;
					} else lastExecTime[cmd][id] = new Date();
				} else lastExecTime[cmd] = {};
			}
			commands.commands[cmd].process(bot, msg, suffix);
			if (!msg.channel.isPrivate && commands.commands[cmd].hasOwnProperty("deleteCommand")) {
				if (commands.commands[cmd].deleteCommand === true && ServerSettings.hasOwnProperty(msg.channel.server.id) && ServerSettings[msg.channel.server.id].deleteCommands == true) bot.deleteMessage(msg, {"wait": 10000});
			}
		} else if (type == "mod") {
			if (!msg.channel.isPrivate)
				console.log(colors.cServer(msg.channel.server.name) + " > " + colors.cGreen(msg.author.username) + " > " + colors.cBlue(msg.cleanContent.replace(/\n/g, " ").split(" ")[0]) + msg.cleanContent.replace(/\n/g, " ").substr(msg.cleanContent.replace(/\n/g, " ").split(" ")[0].length));
			else console.log(colors.cGreen(msg.author.username) + " > " + colors.cBlue(msg.cleanContent.replace(/\n/g, " ").split(" ")[0]) + msg.cleanContent.replace(/\n/g, " ").substr(msg.cleanContent.replace(/\n/g, " ").split(" ")[0].length));
			if (mod.commands[cmd].hasOwnProperty("cooldown")) {
				if (lastExecTime.hasOwnProperty(cmd)) {
					var id = msg.author.id;
					if (lastExecTime[cmd][id] != undefined) {
						var cTime = new Date();
						var leTime = new Date(lastExecTime[cmd][id]);
						leTime.setSeconds(leTime.getSeconds() + mod.commands[cmd].cooldown);
						if (cTime < leTime) { //if it is still on cooldown
							var left = (leTime.valueOf() - cTime.valueOf()) / 1000;
							if (msg.author.id != config.admin_id) { //admin bypass
								bot.sendMessage(msg, msg.author.username + ", you need to *cooldown* (" + Math.round(left) + " seconds)", function(erro, message) { bot.deleteMessage(message, {"wait": 6000}); });
								if (!msg.channel.isPrivate) bot.deleteMessage(msg, {"wait": 10000});
								return;
							}
						} else lastExecTime[cmd][id] = cTime;
					} else lastExecTime[cmd][id] = new Date();
				} else lastExecTime[cmd] = {};
			}
			mod.commands[cmd].process(bot, msg, suffix);
			if (!msg.channel.isPrivate && mod.commands[cmd].hasOwnProperty("deleteCommand")) {
				if (mod.commands[cmd].deleteCommand === true && ServerSettings.hasOwnProperty(msg.channel.server.id) && ServerSettings[msg.channel.server.id].deleteCommands == true) bot.deleteMessage(msg, {"wait": 10000});
			}
		} else return;
	} catch (err) { console.log(err.stack); }
}

/* Event Listeners */
bot.on("serverNewMember", (objServer, objUser) => {
	if (config.non_essential_event_listeners && ServerSettings.hasOwnProperty(objServer.id) && ServerSettings[objServer.id].welcome != "none") {
		if (!objUser.username || !ServerSettings[objServer.id].welcome || !objServer.name) return;
		if (debug) { console.log("New member on " + objServer.name + ": " + objUser.username); }
		bot.sendMessage(objServer.defaultChannel, ServerSettings[objServer.id].welcome.replace(/\$USER\$/gi, objUser.username.replace(/@/g, '@\u200b')).replace(/\$SERVER\$/gi, objServer.name.replace(/@/g, '@\u200b')));
	}
});

bot.on("channelDeleted", channel => {
	if (channel.isPrivate) return;
	if (ServerSettings.hasOwnProperty(channel.server.id)) {
		if (ServerSettings[channel.server.id].ignore.indexOf(channel.id) > -1) {
			db.unignoreChannel(channel.id, channel.server.id);
			if (debug) console.log(colors.cDebug(" DEBUG ") + "Ignored channel was deleted and removed from the DB");
		}
	}
});

bot.on("userBanned", (objUser, objServer) => {
	if (config.non_essential_event_listeners && ServerSettings.hasOwnProperty(objServer.id) && ServerSettings[objServer.id].banAlerts == true) {
		console.log(objUser.username + colors.cRed(" banned on ") + objServer.name);
		if (ServerSettings[objServer.id].notifyChannel != "general") bot.sendMessage(ServerSettings[objServer.id].notifyChannel, "⚠ " + objUser.username.replace(/@/g, '@\u200b') + " was banned");
		else bot.sendMessage(objServer.defaultChannel, "⚠ " + objUser.username.replace(/@/g, '@\u200b') + " was banned");
		bot.sendMessage(objUser, "⚠ You were banned from " + objServer.name);
	}
});

bot.on("userUnbanned", (objUser, objServer) => {
	if (objServer.members.length <= 500 && config.non_essential_event_listeners) { console.log(objUser.username + " unbanned on " + objServer.name); }
});

bot.on("presence", (userOld, userNew) => {
	if (config.log_presence) {
		if ((userNew.status != userOld.status) && (userNew.game === null || userNew.game === undefined)) { console.log(colors.cDebug(" PRESENCE ") + userNew.username + " is now " + userNew.status);
		} else if (userNew.status != userOld.status) { console.log(colors.cDebug(" PRESENCE ") + userNew.username + " is now " + userNew.status + " playing " + userNew.game.name); }
	}
	if (config.non_essential_event_listeners) {
		if (userOld.username != userNew.username) {
			bot.servers.map((ser) => {
				if (ser.members.get("id", userOld.id) && ServerSettings.hasOwnProperty(ser.id) && ServerSettings[ser.id].nameChanges == true) {
					if (ServerSettings[ser.id].notifyChannel == "general") bot.sendMessage(ser, "`" + userOld.username.replace(/@/g, '@\u200b') + "` is now known as `" + userNew.username.replace(/@/g, '@\u200b') + "`");
					else bot.sendMessage(ServerSettings[ser.id].notifyChannel, "`" + userOld.username.replace(/@/g, '@\u200b') + "` is now known as `" + userNew.username.replace(/@/g, '@\u200b') + "`");
				}
			});
		}
	}
});

bot.on("serverDeleted", objServer => {
	console.log(colors.cUYellow("Left server") + " " + objServer.name);
});

/* Login */
console.log("Logging in...");
bot.login(config.email, config.password, function(err, token) {
	if (err) { console.log(err); setTimeout(() => { process.exit(1); }, 2000); }
	if (!token) { console.log(colors.cWarn(" WARN ") + "failed to connect"); setTimeout(() => { process.exit(0); }, 2000); }
});

function carbonInvite(msg) {
	if (msg) {
		if (debug) { console.log(colors.cDebug(" DEBUG ") + "Attempting to join: " + msg.content); }
		var cServers = [];
		bot.servers.map((srvr) => { cServers.push(srvr.id); });
		bot.joinServer(msg.content, function(err, server) {
			if (err) {
				bot.sendMessage(msg, "Failed to join: " + err);
				console.log(colors.cWarn(" WARN ") + err);
			} else if (cServers.indexOf(server.id) > -1) {
				console.log("Already in server " + server.name);
				bot.sendMessage(msg, "I'm already in that server!");
			} else {
				if (config.banned_server_ids && config.banned_server_ids.indexOf(server.id) > -1) {
					console.log(colors.cRed("Joined server but it was on the ban list") + ": " + server.name);
					bot.sendMessage(msg, "This server is on the ban list");
					bot.leaveServer(server); return;
				}
				console.log(colors.cGreen("Joined server: ") + " " + server.name);
				bot.sendMessage(msg, "Successfully joined " + server.name);
				var toSend = [];
				if (msg.author.id == '109338686889476096') { toSend.push("Hi! I'm **" + bot.user.username.replace(/@/g, '@\u200b') + "** and I was invited to this server through carbonitex.net."); }
				else { toSend.push("Hi! I'm **" + bot.user.username.replace(/@/g, '@\u200b') + "** and I was invited to this server by " + msg.author.username.replace(/@/g, '@\u200b') + "."); }
				toSend.push("You can use `" + config.command_prefix + "help` to see what I can do. Mods can use `" + config.mod_command_prefix + "help` for mod commands.");
				toSend.push("Mod/Admin commands __including bot settings__ can be viewed with `" + config.mod_command_prefix + "help`");
				toSend.push("For help / feedback / bugs/ testing / info / changelogs / etc. go to **https://discord.gg/0kvLlwb7slG3XCCQ**");
				bot.sendMessage(server.defaultChannel, toSend);
				db.addServer(server);
			}
		});
	}
}

function reload() {
	delete require.cache[require.resolve(__dirname + "/bot/config.json")];
	config = require(__dirname + "/bot/config.json");
	delete require.cache[require.resolve(__dirname + "/bot/games.json")];
	games = require(__dirname + "/bot/games.json");
	delete require.cache[require.resolve(__dirname + "/bot/commands.js")];
	try { commands = require(__dirname + "/bot/commands.js");
	} catch (err) { console.log(colors.cError(" ERROR ") + "Problem loading commands.js: " + err); }
	delete require.cache[require.resolve(__dirname + "/bot/mod.js")];
	try { mod = require(__dirname + "/bot/mod.js");
	} catch (err) { console.log(colors.cError(" ERROR ") + "Problem loading mod.js: " + err); }
	delete require.cache[require.resolve(__dirname + "/bot/versioncheck.js")];
	versioncheck = require(__dirname + "/bot/versioncheck.js");
	delete require.cache[require.resolve(__dirname + "/bot/styles.js")];
	colors = require(__dirname + "/bot/styles.js");
	delete require.cache[require.resolve(__dirname + "/bot/cleverbot.js")];
	/*cleverbot = require(__dirname + "/bot/cleverbot").cleverbot;
	delete require.cache[require.resolve(__dirname + "/bot/db.js")];*/
	db = require(__dirname + "/bot/db.js");
	console.log(colors.cBgGreen(" Module Reload ") + " Success");
}

function checkConfig() {
	if (config.email === null) { console.log(colors.cWarn(" WARN ") + "Email not defined"); }
	if (config.password === null) { console.log(colors.cWarn(" WARN ") + "Password not defined"); }
	if (config.command_prefix === null || config.command_prefix.length !== 1) { console.log(colors.cWarn(" WARN ") + "Prefix either not defined or more than one character"); }
	if (config.mod_command_prefix === null || config.mod_command_prefix.length !== 1) { console.log(colors.cWarn(" WARN ") + "Mod prefix either not defined or more than one character"); }
	if (config.admin_id === null) { console.log(colors.cYellow("Admin user's id not defined") + " in config"); }
	if (config.mal_user === null) { console.log(colors.cYellow("MAL username not defined") + " in config"); }
	if (config.mal_pass === null) { console.log(colors.cYellow("MAL password not defined") + " in config"); }
	if (config.weather_api_key === null) { console.log(colors.cYellow("OpenWeatherMap API key not defined") + " in config"); }
	if (config.osu_api_key === null) { console.log(colors.cYellow("Osu API key not defined") + " in config"); }
}

function evaluateString(msg) {
	if (msg.author.id != config.admin_id) { console.log(colors.cWarn(" WARN ") + "Somehow an unauthorized user got into eval!"); return; }
	var timeTaken = new Date();
	console.log("Running eval");
	var result;
	try { result = eval("try{" + msg.content.substring(7).replace(/\n/g, "") + "}catch(err){console.log(colors.cError(\" ERROR \")+err);bot.sendMessage(msg, \"```\"+err+\"```\");}");
	} catch (e) { console.log(colors.cError(" ERROR ") + e); bot.sendMessage(msg, "```" + e + "```"); }
	if (result && typeof result !== "object") {
		bot.sendMessage(msg,  "`Time taken: " + (timeTaken - msg.timestamp) + "ms`\n" + result);
		console.log("Result: " + result);
	}

}

setInterval(() => {
	bot.setPlayingGame(games[Math.floor(Math.random() * (games.length))]);
	if (debug) { console.log(colors.cDebug(" DEBUG ") + "Updated bot's game"); }
}, 800000); //change playing game every 12 minutes

//update RSS
if(rss_config.update_enable)
{
    setInterval(() => {
        console.log("[RSSFeed] Beginning Update loop");
        var sw = new Stopwatch(true);
        async.waterfall([
            function getUniqueUrls(done)
            {
                var url_array = [];
                //GET UNIQUE URLS FOR PULLING RSSES FROM, WE DO NOT WANT TO PULL MULTIPLE OF THE SAME!
                mysql_db.query("SELECT DISTINCT feed_url FROM rss_feeds",null,function(err, results, fields){
                    if(err)
                    {
                        console.error('DB Error!: ' + err.stack);
                        done(new Error(err.stack));
                        return;
                    }
                    else
                    {
                        results.forEach(function(element,index,array){
                            url_array.push(element.feed_url);
                            //console.log(element);
                        });
                        done(null, url_array);
                        return;
                    }
                });
            },
            function doGetSubChans(urls, done)
            {
                var chan_dict = {}; //dict, note the {} and not []
                //console.log(urls.length);
                //async flow is required because of stupid forEach
                //do note that since all urls are being processed together, the sequence will not be guaranteed
                //however we don't require a sequence, just the relationship between a URL and its subbed channels
                
                //process each url at the same time but keeping synchronous flow per url
                async.each(urls, function(url, done){
                    //perform select query for this url
                    chan_dict[url] = {};
                    async.parallel([
                        function doSelectChannelId(done){
                            mysql_db.query("SELECT channel_id FROM rss_feeds WHERE feed_url = ?",url,function(err, results, fields){
                                if(err)
                                {
                                    console.error('DB Error!: ' + err.stack);
                                    done(new Error(err.stack));
                                    return;
                                }
                                else
                                {
                                    var chan_list = [];
                                    //process each result at the same time but keeping synchronous flow per result
                                    async.each(results, function(channel, done)
                                    {
                                        //get channel_id and push it to the list
                                        chan_list.push(channel.channel_id);
                                        //end our synchronous loop for this result
                                        done(null);
                                        return;
                                    },function(err){
                                        //we have processed all our results! we should have all the ids for this url!
                                        if(err)
                                        {
                                            done(new Error("something went wrong when forming channel list!"));
                                            return;
                                        }
                                    });
                                    //finally, set the list as value for the dict using the url as its key
                                    chan_dict[url].channels = chan_list;
                                    //console.log("[RSSFeed] Channels for "+url+" - "+chan_list);
                                    //end our synchronous loop for this url
                                    done(null);
                                    return;
                                }
                            });
                        },
                        function doSelectLastPubDate(done){
                            mysql_db.query("SELECT DISTINCT last_updated_time_utc FROM rss_feeds WHERE feed_url = ?",url,function(err, results, fields){
                                if(err)
                                {
                                    console.error('DB Error!: ' + err.stack);
                                    done(new Error(err.stack));
                                    return;
                                }
                                else
                                {
                                    chan_dict[url].last_updated_time_utc = results[0].last_updated_time_utc;
                                    //end our synchronous loop for this url
                                    done(null);
                                    return;
                                }
                            });
                        }], 
                        function(err, res)
                        {
                            if(err) done(err);
                            else done(null);
                            return;
                        });
                },function(err){
                    //we have processed all our urls! we should have the complete dict now!
                    if(!err)
                    {
                        //console.log('urls processed: ' + Object.keys(chan_dict).length);
                        //pass this dict object over to the next function for processing within this waterfall
                        done(null, chan_dict);
                        return;
                    }
                });
            },
            function doGetSendRSS(chan_dict, done)
            {
                async.each(Object.keys(chan_dict), function(url, done)
                {
                    var channels_to_send = chan_dict[url].channels;  //list! not a string yet!
                    var actual_url = url.substring(1, url.length - 1);
                    var lastupdatedtime_unix = chan_dict[url].last_updated_time_utc;
                    
                    async.waterfall([
                        function fetchRSS(done)
                        {
                            //console.log("->fetchRSS");
                            var feed = require("feedparser");
                            var request = require("request");
                            var fparse = new feed();
                            var data = null;
                            
                            //tell the parser which URL to parse
                            request(actual_url).pipe(fparse);
                            
                            //catch if URL cannot be read
                            fparse.on('error', function(error){
                                done(new Error(error.message));
                                return;
                            });
                            
                            fparse.on('readable', function(){
                                var stream = this;
                                data = stream.read();
                                //done(null, stream.read());
                                return;
                            });
                            
                            fparse.on('end', function(){
                                //console.log("EOS: "+actual_url);
                                done(null, data);
                                return;
                            });
                        },
                        function sendRSSMessage(item, done)
                        {
                            if(!item)
                            {
                                done(new Error("Something went wrong!"));
                                return;
                            }
                            else
                            {
                                var pubdate_unix = moment(item.pubdate).unix();
                                //console.log(pubdate_unix + " LAST: " + lastupdatedtime_unix);
                                if(pubdate_unix > lastupdatedtime_unix)         //if there is an update, the pubdate should be more than the last updated!
                                {
                                    console.log("[RSSFeed] " + url + " needs updating!");
                                    async.each(chan_dict[url].channels, function(channel, done)
                                    {
                                        async.waterfall([
                                            function sendHeader(done)
                                            {
                                                bot.sendMessage(channel, ":clock3:"+item.pubdate).then(msg => done(null));
                                                return;
                                            },
                                            function sendBody(done)
                                            {
                                                bot.sendMessage(channel, ":newspaper: **"+item.title + "** - " + item.link, function() {
                                                    var text = htmlToText.fromString(item.description,{
                                                        wordwrap:true,
                                                        ignoreHref:true
                                                    });
                                                    bot.sendMessage(channel,text+"\n");                    
                                                });
                                                done(null);
                                                return;
                                            }
                                        ], function(err, res){return;});
                                        done(null);
                                        return;
                                    },function(err){
                                        //we have sent all our RSSes!
                                        if(!err)
                                        {
                                            //console.log("[RSSFeed] channels processed for: " + url);
                                            done(null, pubdate_unix);
                                            return;
                                        }
                                        else{
                                            console.log("[RSSFeed] shit happened!");
                                            done(err);
                                            return;
                                        }
                                    });
                                }
                                else
                                {
                                    console.log("[RSSFeed] " + url + " does not need updating!");
                                    done(null, pubdate_unix);
                                    return;
                                }
                            }
                        },
                        function updateLastUpdatedTime(pubdate_unix, done)
                        {
                            //console.log("->updateLastUpdatedTime");
                            mysql_db.query("UPDATE rss_feeds SET last_updated_time_utc = ? WHERE feed_url = ?",[pubdate_unix, url],function(err, result){
                                if(err)
                                {
                                    console.error('DB Error!: ' + err.stack);
                                    done(new Error(err.stack));
                                    return;
                                }
                                else
                                {
                                    //console.log("UPDATE Affected rows: "+result.affectedRows);
                                    done(null, "[RSSFeed] url db updated: "+url);
                                    return;
                                }
                            });
                        }
                    ],function(err,res){
                        if(err) done(err);
                        else done(null);
                        return;
                    });
                },function(err){
                    if(!err)
                    {
                        //done(null, chan_dict);
                        done(null);
                        return;
                    }
                });
            }
        ],function(err,res){
            if(!err){
                sw.stop();
                console.log("[RSSFeed] Done loop - elapsed: "+ Math.round(sw.read()) / 1000 + "s");
            }
        });           
    }, rss_config.update_duration);
}