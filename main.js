const Discord = require('discord.js');
const client = new Discord.Client();

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
  if (msg.content === 'ping') {
    msg.reply('pong');
  }
});

client.login('ODI3MzQ3MDM0NDMyMzM5OTc4.YGZs-A.DiITClVdc1Qj2Cj-4BkLGiOdZAw');