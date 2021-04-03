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
var defaultBoard="🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🌞🟦🟦🟦🟦🟦🟦🟦🟦🟦\n🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦\n🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦\n🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦\n🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦\n🟦🏢🟦🦧🏢🟦🏢🏢🟦🟦🟦🟦🟦🟦🟦🦧🟦🟦🟦🟦\n🟦🏢🏢🏢🏢🏢🏢🏢🟦🟦🟦🟦🟦🏢🏢🏢🏢🟦🟦🟦\n🏢🏢🏢🏢🏢🏢🏢🏢🏢🏢🏢🏢🏢🏢🏢🏢🏢🏢🏢🏢\n🏢🏢🏢🏢🏢🏢🏢🏢🏢🏢🏢🏢🏢🏢🏢🏢🏢🏢🏢🏢";
const boardWidth = 20;
const boardHeight = 9;
const blockSize = 10; // just for translating positions to emoji tile/blocks

var board = [];

// game play vars

const gravity = 3;
const dt = 0.01; // sec to wait
var shooting = false;
const snooze = s => new Promise(resolve => setTimeout(resolve, s * 1000)); // sleep helper for anim
const getGridPos = p => Math.floor(p/blockSize);


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

    if(command === 'challenge'){
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
    else if(command === 'shoot'){
        var angle = 165;
        var power = 60;
        var dir = 1;

        shoot(aX, aY, angle, power, dir);
    }
});

function updateEmbedMessage(){
    var emb = new Discord.MessageEmbed(gameEmbed.embeds[0]);
    emb.fields[0] = {name : 'Board' , value : boardString()};
    gameEmbed.edit(emb);
}


async function shoot(x, y, angle, pow, dir){
    shooting = true;
    console.log("SHOOTING!");
    // initial shot position
    var sX = (x * blockSize) + (blockSize/2); // start it in the center of the block 
    var sY = (y * blockSize) - (blockSize/2);
    var lastX = sX;
    var lastY = sY;
    var lastGridX = getGridPos(lastX);
    var lastGridY = getGridPos(lastY);

    //angle in rads for inital vel calc
    var rad = angle / 180 * Math.PI;
    
    //initial velocity
    var vX = Math.cos(rad) * pow * dir;
    var vY = -Math.sin(rad) * pow;

    // some tracking vars
    var hit = false;
    var miss = false;

    while(!hit && !miss){
        // store last position (for when we hit something to place the boom in the right spot)
        lastX = sX;
        lastY = sY;
        lastGridX = getGridPos(lastX);
        lastGridY = getGridPos(lastY);
        // update positions
        sX += vX * dt;
        sY -= vY * dt;
        // update velocities
        vY += gravity * dt * dt;
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
        // check if we need to update the message with the new shot position
        if(hit){
            console.log(`HIT:${gridX}|${gridY}`);
            board[(boardWidth * lastGridY) +  lastGridX] = '🟦';
            board[(boardWidth * gridY) +  gridX] = '💥';
            updateEmbedMessage();
        }
        else if (miss){
            console.log(`MISS:${gridX}|${gridY}`);
            board[(boardWidth * lastGridY) +  lastGridX] = '🟦';
            updateEmbedMessage();
        }
        else if (newGridPos){
            // if we arent at the start, replace the old spot with sky
            if(x != gridX && y != gridY){
                board[(boardWidth * lastGridY) +  lastGridX] = '🟦';
            }            
            board[(boardWidth * gridY) +  gridX] = '🍌';
            console.log(`${gridX}|${gridY}`);
            updateEmbedMessage();
        }
        // await dt
        await snooze(dt);
    }
    shooting = false;
    console.log("DONE!");
}


client.login(process.env.TOKEN);