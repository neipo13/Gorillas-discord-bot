require('dotenv').config(); // used to hide our token

const Discord = require('discord.js');
const client = new Discord.Client();
const prefix = '!';
var message = null;
var gameEmbed = null;

var userA = null;
var userB = null;


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
		} else {
            message.edit(`Aw nuts, challenge from ${userA} has been rejected by ${userB} :disappointed:`);
		}
	})
	.catch(collected => {
	});
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
});


client.login(process.env.TOKEN);