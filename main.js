require('dotenv').config(); // used to hide our token

const Discord = require('discord.js');
const client = new Discord.Client();
const prefix = '!';

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
var turnA = true; //flips back and forth for A/B turns
const snooze = s => new Promise(resolve => setTimeout(resolve, s * 1000)); // sleep helper for anim
const getGridPos = p => Math.floor(p/blockSize);

// I know I should const out the emoji to make it easier to replace & to check with variables but they are fun in the code blocks so they stay


function fillBoard(){
    //reset player position values in case this is a follow up game
    aX = -1;
    aY = -1;
    bX = -1;
    bY = -1;
    // need better board generation but this flat land works for now
    for(var h = 0; h < boardHeight; h++){
        for(var w = 0; w < boardWidth; w++){
            board[(boardWidth * h) + w] = '🟦';
            // hacky temp board state setting
            if(h == 6 && w == 4){
                board[(boardWidth * h) + w] = '🦧';
                aX = w;
                aY = h;
            }
            else if (h == 6 && w == 14){
                board[(boardWidth * h) + w] = '🦧';
                bX = w;
                bY = h;
            }
            else if (h == 0 && w == 10){
                board[(boardWidth * h) + w] = '🌞';
            }
            else if(h > 6){
                board[(boardWidth * h) + w] = '🏢'
            }
        }
    }
}

function boardString(){
    var str = '';
    for(var h = 0; h < boardHeight; h++){
        for(var w = 0; w < boardWidth; w++){        
            var nxt = board[(boardWidth * h) + w];
            str += nxt;
        }
        str += '\n';
    }
    return str;
}


function setMessage(msg, challenger, acceptee){
    message = msg;
    userA = challenger;
    userB = acceptee;
    console.log(`Message set: ${msg} from ${userA} to ${userB}`);
}

function setAwaitAcceptance(){
    message.awaitReactions(acceptanceFitler, { max: 1, time: 60000, errors: ['time'] })
	.then(collected => {
		const reaction = collected.first();

		if (reaction.emoji.name === '✅') {
			message.edit(`Ooooooo it's on, challenge from ${userA} has been accepted by ${userB}. Setting up game...`);
            message.reactions.removeAll();
            startGame();
		} else {
            message.edit(`Aw nuts, challenge from ${userA} has been rejected by ${userB} :disappointed:`);
		}
	})
	.catch(collected => {
	});
}


async function startGame(){
    gameStarted = true;
    fillBoard();
    var emb = new Discord.MessageEmbed()
	.setColor('#0099ff')
	.setTitle(`Gorillas ${userA} vs ${userB}`)
	.setDescription(`${userA}'s turn`)
	.addFields(
		{ name: 'Board', value: boardString() },
	)
	.setTimestamp()
	.setFooter('`!shoot pow x angle y` to shoot on your turn');
    gameEmbed = await message.channel.send(emb);
}

const acceptanceFitler = (reaction, user) => {
	return ['✅', '⛔'].includes(reaction.emoji.name) && user.id === userB.id;
};

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
    if (!msg.content.startsWith(prefix) || msg.author.bot) return;

    const args = msg.content.slice(prefix.length).trim().split(' ');
    const command = args.shift().toLowerCase();

    if(command === 'challenge' && !gameStarted){
        var challengedUser = msg.mentions.users.first();
        if(challengedUser == null || challengedUser == undefined){
            msg.reply("you forgot to tag someone to challenge :facepalm:");
            return;
        }
        msg.channel.send(`${msg.author} has issued a challenge to ${msg.mentions.users.first()}`)
        .then((m) => setMessage(m, msg.author, challengedUser))
        .then(() => message.react('✅'))
        .then(() => message.react('⛔'))
        .then(() => setAwaitAcceptance());
    }
    else if(command === 'shoot' && gameStarted && !shooting){
        
        // set values for current player's turn
        var author = msg.author.id;
        var validAuthor = false;
        var dir = 1;
        var x = 0;
        var y = 0;
        if(turnA && author == userA.id){
            validAuthor = true;
            dir = 1;
            x = aX;
            y = aY;
        }
        else if(!turnA && author == userB.id){
            validAuthor = true;
            dir = -1;
            x = bX;
            y = bY;
        }
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

        clearBooms();  // clear out explosion's from last shot
        shoot(x, y, angle, power, dir);
    }
});

function updateEmbedMessage(){
    var emb = new Discord.MessageEmbed(gameEmbed.embeds[0]);
    emb.fields[0] = {name : 'Board' , value : boardString()};
    gameEmbed.edit(emb);
}

function clearBooms(){
    for(var h = 0; h < boardHeight; h++){
        for(var w = 0; w < boardWidth; w++){        
            var val = board[(boardWidth * h) + w];
            if(val === '🎆'){
                board[(boardWidth * h) + w] = '🟦';
            }
        }
    }
}

async function shoot(x, y, angle, pow, dir){
    shooting = true;
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
        var gridVal = board[(boardWidth * gridY) +  gridX];
        // ensure we didnt go too far
        if(gridX >= boardWidth || gridX < 0){
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
            if(x != gridX || y != gridY){
                board[(boardWidth * lastGridY) +  lastGridX] = '🟦';
            }            
            board[(boardWidth * gridY) +  gridX] = '🎆';
            updateEmbedMessage();
        }
        else if (miss){
            console.log(`MISS:${gridX}|${gridY}`);
            if(x != gridX || y != gridY){
                board[(boardWidth * lastGridY) +  lastGridX] = '🎆';
            }            
            updateEmbedMessage();
        }
        else if (newGridPos && (gridY >= 0 || lastGridY >= 0)){ //
            // if we arent at the start, replace the old spot with sky
            if(x != lastGridX || y != lastGridY){
                if(hitSun){
                    pastSun = true;
                    hitSun = false;
                    board[(boardWidth * lastGridY) +  lastGridX] = '🟦';
                }
                else if(pastSun){
                    board[(boardWidth * lastGridY) +  lastGridX] = '🌞';
                    hitSun = false;
                    pastSun = false;
                }
                else{
                    board[(boardWidth * lastGridY) +  lastGridX] = '🟦';
                }
            }            
            board[(boardWidth * gridY) +  gridX] = '🍌';
            console.log(`${gridX}|${gridY}`);
            // due to some 
            if(everyOther){
                updateEmbedMessage();
            }
            everyOther = !everyOther; // flip this over and over on non-essential draws
        }
        // await dt
        await snooze(dt * 3); // wait longer than simulation cause discord gets grumpy if you send too many message edits in a short period
    }
    shooting = false;
    turnA = !turnA; // end the turn
    console.log("DONE!");
}


client.login(process.env.TOKEN);