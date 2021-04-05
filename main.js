require('dotenv').config(); // used to hide our token

const Discord = require('discord.js');
const client = new Discord.Client();
const prefix = '!';


var gameMap = new Map(); // map of userid => gamedata

// hold discord info
var message = null;
var gameEmbed = null;
//users
var userA = null;
var userB = null;
var aX = -1;
var aY = -1;
var bX = -1;
var bY = -1;

// temp board state stuff
const boardWidth = 20;
const boardHeight = 9;
const blockSize = 10; // just for translating positions to emoji tile/blocks

var board = [];

// game play vars
const gravity = 30;
const dt = 0.1; // sec to wait
var gameStarted = false;
var shooting = false; // don't allow shots while we are already shooting
var winner = null;
var turnA = true; //flips back and forth for A/B turns
const snooze = s => new Promise(resolve => setTimeout(resolve, s * 1000)); // sleep helper for anim
const getGridPos = p => Math.floor(p/blockSize);
const acceptanceFitler = (reaction, user, requiredUserId) => ['✅', '⛔'].includes(reaction.emoji.name) && user.id === requiredUserId;

// I know I should const out the emoji to make it easier to replace & to check with variables but they are fun in the code blocks so they stay

function GameData(){
     // hold discord info
     this.message = null;
     this.gameEmbed = null;
     //users
     this.userA = null;
     this.userB = null;
     this.aX = -1;
     this.aY = -1;
     this.bX = -1;
     this.bY = -1;

     this.board = [];
     
     this.gameStarted = false;
     this.shooting = false; // don't allow shots while we are already shooting
     this.winner = null;
     this.turnA = true; //flips back and forth for A/B turns
}

function getGame(userid){
    if(!gameMap.has(userid)){
        gameMap.set(userid, new GameData());
    }
    return gameMap.get(userid);
    
}

function setGame(game){
    // have to set both as I don't think it will stay in sync otherwise
    gameMap.set(game.userA.id, game);
    gameMap.set(game.userB.id, game);
}

function clearGame(game){
    // have to remove both to not bring up this old game when a new one comes in
    gameMap.delete(game.userA.id);
    gameMap.delete(game.userB.id);
}

function fillBoard(game){
    // reset player position values in case this is a follow up game
    game.aX = -1;
    game.aY = -1;
    game.bX = -1;
    game.bY = -1;

    // super inefficient but who cares its still gonna run super fast because tis is tiny af & runs once

    // place the basic board
    for(var h = 0; h < boardHeight; h++){
        for(var w = 0; w < boardWidth; w++){
            game.board[(boardWidth * h) + w] = '🟦';
            if (h == 0 && w == 10){
                game.board[(boardWidth * h) + w] = '🌞';
            }
        }
    }

    // again loop for building gen
    for (var x = 0; x < boardWidth; x++){
        var randomHeight = getRandomIntRange(2, boardHeight-2);
        for(var y = randomHeight; y < boardHeight; y++){
            game.board[(boardWidth * y) + x] = '🏢';
        }
    }

    // userA spawn
    game.aX = getRandomIntRange(1, boardWidth/2);
    for (var h = 1; h < boardHeight - 2; h++){
        var location = game.board[(boardWidth * h) + game.aX];
        var below = game.board[(boardWidth * (h + 1)) + game.aX];
        if(location == '🟦' && below == '🏢'){
            game.aY = h;
            game.board[(boardWidth * h) + game.aX] = '🦧';
        }
    }

    // userB spawn
    game.bX = getRandomIntRange(boardWidth/2 + 1, boardWidth - 2);
    for (var h = 1; h < boardHeight - 2; h++){
        var location = game.board[(boardWidth * h) + game.bX];
        var below = game.board[(boardWidth * (h + 1)) + game.bX];
        if(location == '🟦' && below == '🏢'){
            game.bY = h;
            game.board[(boardWidth * h) + game.bX] = '🦧';
        }
    }
}

function boardString(game){
    var str = '';
    for(var h = 0; h < boardHeight; h++){
        for(var w = 0; w < boardWidth; w++){        
            var nxt = game.board[(boardWidth * h) + w];
            str += nxt;
        }
        str += '\n';
    }
    return str;
}


function setMessage(game, msg, challenger, acceptee){
    game.message = msg;
    game.userA = challenger;
    game.userB = acceptee;
    console.log(`Message set: ${msg} from ${game.userA} to ${game.userB}`);
}

function setAwaitAcceptance(game){
    game.message.awaitReactions((reaction, user) => acceptanceFitler(reaction, user, game.userB.id), { max: 1, time: 60000, errors: ['time'] })
	.then(collected => {
		const reaction = collected.first();

		if (reaction.emoji.name === '✅') {
			game.message.edit(`Ooooooo it's on, challenge from ${game.userA} has been accepted by ${game.userB}. Setting up game...`);
            game.message.reactions.removeAll();
            startGame(game);
		} else {
            game.message.edit(`Aw nuts, challenge from ${game.userA} has been rejected by ${game.userB} :disappointed:`);
		}
	})
	.catch(collected => {
	});
}


async function startGame(game){
    game.gameStarted = true;
    fillBoard(game);
    var emb = new Discord.MessageEmbed()
	.setColor('#0099ff')
	.setTitle(`Gorillas ${game.userA.username} vs ${game.userB.username}`) // if you put just user here it puts the user id (<@1234567891011>)
	.setDescription(`${game.userA}'s turn`)
	.addFields(
		{ name: 'Board', value: boardString(game) },
	)
	.setTimestamp()
	.setFooter('`!shoot pow x angle y` to shoot on your turn');
    game.gameEmbed = await game.message.channel.send(emb);
}


client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
    if (!msg.content.startsWith(prefix) || msg.author.bot) return;

    const authorid = msg.author.id;
    const game = getGame(authorid);
    console.log(`Message for game between ${game.userA} & ${game.userB}`);

    const args = msg.content.slice(prefix.length).trim().split(' ');
    const command = args.shift().toLowerCase();

    if(command === 'challenge' && !game.gameStarted){
        var challengedUser = msg.mentions.users.first();
        if(challengedUser == null || challengedUser == undefined){
            msg.reply("you forgot to tag someone to challenge 🙉 @ tag your opponent!");
            return;
        }
        // var existingGame = gameMap.has(challengedUser.id);
        // if(existingGame) return; // cant accept a game if youre already in one
        msg.channel.send(`${msg.author} has issued a challenge to ${challengedUser}`)
        .then((m) => setMessage(game, m, msg.author, challengedUser))
        .then(() => game.message.react('✅'))
        .then(() => game.message.react('⛔'))
        .then(() => setAwaitAcceptance(game));
    }
    else if(command === 'shoot' && game.gameStarted && !game.shooting){
        
        // set values for current player's turn
        var author = msg.author.id;
        var validAuthor = false;
        var dir = 1;
        var x = 0;
        var y = 0;
        if(game.turnA && author == game.userA.id){
            validAuthor = true;
            dir = 1;
            x = game.aX;
            y = game.aY;
        }
        else if(!game.turnA && author == game.userB.id){
            validAuthor = true;
            dir = -1;
            x = game.bX;
            y = game.bY;
        }
        if(!validAuthor ) return;
        // set angle & pow
        var angle = -1;
        var power = -1;
        var lookingFor = '';
        //loop the args
        for(var i = 0; i < args.length; i++){
            var str = args[i].toLowerCase();
            if(str.includes('pow')){
                lookingFor = 'p';
            }
            else if (str.includes('ang')){
                lookingFor = 'a';
            }
            else if (lookingFor != ''){
                //check if this is a #, & set the value based on lookingFor if it is
                var isNumber = !isNaN(str);
                if (isNumber && lookingFor == 'p'){
                    power = parseFloat(str);
                    lookingFor = '';
                }
                else if (isNumber && lookingFor == 'a'){
                    angle = parseFloat(str);
                    lookingFor = '';
                }
            }
        }
        if(angle < 0 || power < 0 || angle > 90 || power > 100){
            //invalid formatting or values
            return;
        }

        clearBooms(game);  // clear out explosion's from last shot
        shoot(game, x, y, angle, power, dir);
    }
});

function updateEmbedMessage(game){
    var emb = new Discord.MessageEmbed(game.gameEmbed.embeds[0]);
    emb.fields[0] = {name : 'Board' , value : boardString(game)};
    game.gameEmbed.edit(emb);
}

function endTurn(game){    
    game.turnA = !game.turnA; // end the turn    
    var emb = new Discord.MessageEmbed(game.gameEmbed.embeds[0]);
    if(turnA){
        emb.setDescription(`${game.userA}'s turn`);
    }
    else{
        emb.setDescription(`${game.userB}'s turn`)
    }
    game.gameEmbed.edit(emb);
}

function endGame(game, suicide){
    var winner = game.turnA ? game.userA : game.userB;
    if(suicide){
        winner = game.turnA ? game.userB : game.userA;
        console.log("suicide!! winner is:" + (game.turnA ? "userB" : "userA"));
        game.message.channel.send(`Whoops 🙊`);
    }
    game.message.channel.send(`${winner} is the King of Kong`);
    clearGame(game);
}

function clearBooms(game){
    for(var h = 0; h < boardHeight; h++){
        for(var w = 0; w < boardWidth; w++){        
            var val = game.board[(boardWidth * h) + w];
            if(val === '💥'){
                game.board[(boardWidth * h) + w] = '🟦';
            }
        }
    }
}

async function shoot(game, x, y, angle, pow, dir){
    game.shooting = true;
    console.log("SHOOTING!");
    // initial shot position
    var sX = (x * blockSize); 
    var sY = (y * blockSize);
    var lastX = sX;
    var lastY = sY;
    var lastGridX = getGridPos(lastX);
    var lastGridY = getGridPos(lastY);

    //angle in rads for inital vel calc
    var rad = angle / 180 * Math.PI;
    
    //initial velocity
    var vX = Math.cos(rad) * pow * dir;
    var vY = -Math.sin(rad) * pow;
    console.log(`vx:${vX} vy:${vY}`);

    // some tracking vars
    var hit = false;
    var miss = false;
    var hitSun = false;
    var pastSun = false;
    var everyOther = false;

    console.log(`${lastGridX}|${lastGridY}`)

    while(!hit && !miss){
        // store last position (for when we hit something to place the boom in the right spot)
        lastX = sX;
        lastY = sY;
        lastGridX = getGridPos(lastX);
        lastGridY = getGridPos(lastY);
        // update positions
        sX += vX * dt;
        sY += vY * dt;
        // update velocities
        vY += (gravity * dt);
        // get new grid positions
        var gridX = getGridPos(sX);
        var gridY = getGridPos(sY);
        var newGridPos =  gridX != lastGridX || gridY != lastGridY;

        // get the board value at this grid pos for collision checks
        var gridVal = game.board[(boardWidth * gridY) +  gridX];
        // ensure we didnt go too far 
        if(gridX >= boardWidth || gridX < 0 || gridY > boardHeight){
            miss = true;
        }
        // check if we hit the opponent
        else if(gridVal == '🦧' && newGridPos){
            hit = true;
        }
        // check if we hit a wall
        else if(gridVal == '🏢'){
            miss = true;
        }
        else if (gridVal == '🌞'){
            hitSun = true;
        }
        // check if we need to update the message with the new shot position
        if(hit){
            console.log(`HIT:${gridX}|${gridY}`);
            if(x != lastGridX || y != lastGridY){
                game.board[(boardWidth * lastGridY) +  lastGridX] = '🟦';
            }            
            game.board[(boardWidth * gridY) +  gridX] = '💥';
            updateEmbedMessage(game);
            endGame(game, gridX == x && gridY == y);
            return;
        }
        else if (miss){
            console.log(`MISS:${gridX}|${gridY}`);
            if(x != gridX || y != gridY){
                game.board[(boardWidth * gridY) +  gridX] = '💥';
            } 
            if(x != lastGridX || y != lastGridY){
                game.board[(boardWidth * lastGridY) +  lastGridX] = '🟦';
            }            
            updateEmbedMessage(game);
        }
        else if (newGridPos && (gridY >= 0 || lastGridY >= 0)){ //
            // if we arent at the start, replace the old spot with sky
            if(x != lastGridX || y != lastGridY){
                if(hitSun){
                    pastSun = true;
                    hitSun = false;
                    game.board[(boardWidth * lastGridY) +  lastGridX] = '🟦';
                }
                else if(pastSun){
                    game.board[(boardWidth * lastGridY) +  lastGridX] = '🌞';
                    hitSun = false;
                    pastSun = false;
                }
                else{
                    game.board[(boardWidth * lastGridY) +  lastGridX] = '🟦';
                }
            }            
            game.board[(boardWidth * gridY) +  gridX] = '🍌';
            console.log(`${gridX}|${gridY}`);
            // due to some 
            if(everyOther){
                updateEmbedMessage(game);
            }
            everyOther = !everyOther; // flip this over and over on non-essential draws
        }
        // await dt
        await snooze(dt * 3); // wait longer than simulation cause discord gets grumpy if you send too many message edits in a short period
    }
    game.shooting = false;
    endTurn(game);
    console.log("DONE!");
}

function getRandomIntRange(min, max) {
    return Math.floor((Math.random() * (max-min)) + min);
  }


client.login(process.env.TOKEN);