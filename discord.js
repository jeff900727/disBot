const { Client } = require('discord.js');
const ytdl = require('ytdl-core');
const { token } = require('./token.json');
const { prefix } = require('./config.json');
const client = new Client();
const ytsr = require('ytsr');
const { getFilters } = require('ytsr');
const { validateID } = require('ytdl-core');
const YouTube = require("youtube-sr").default;
songInfo='';
// 建立一個類別來管理 Property 及 Method
class Music {

    constructor() {
        this.isPlaying = {};
        this.queue = {};


        this.connection = {};


        this.dispatcher = {};
    }

    async join(msg) {


        if (msg.member.voice.channel !== null) {

            this.connection[msg.guild.id] = await msg.member.voice.channel.join();
        } else {
            msg.channel.send('請先進入語音頻道');
        }

    }

    async play(msg) {

        // 語音群的 ID
        const guildID = msg.guild.id;

        if (!this.connection[guildID]) {
            this.connection[msg.guild.id] = await msg.member.voice.channel.join();
        }

        if (this.connection[guildID].status === 4) {
            msg.channel.send('請先將機器人 `!!join` 重新加入頻道');
            return;
        }

        // 處理字串，將 !!p 字串拿掉，只留下 YouTube 網址
        const musicURL = msg.content.replace(`${prefix}p`,'').trim();
        if(msg.content.indexOf('youtu')>-1){
            try {

                // 取得 YouTube 影片資訊
                const res = await ytdl.getInfo(musicURL);
                const info = res.videoDetails;

                if (!this.queue[guildID]) {
                    this.queue[guildID] = [];
                }

                this.queue[guildID].push({
                    name: info.title,
                    url: musicURL
                });

                if (this.isPlaying[guildID]) {
                    msg.channel.send(`歌曲加入隊列：${info.title}`);
                } else {
                    this.isPlaying[guildID] = true;
                    this.playMusic(msg, guildID, this.queue[guildID][0]);
                }

            } catch(e) {
                console.log(e);
            }
        }else{ 
            try{
                const results = await YouTube.search(musicURL, {
                    safeSearch: true
                });
                songInfo = await ytdl.getInfo(`https://youtu.be/${results[0].id}`);
                const info = songInfo.videoDetails
                if (!this.queue[guildID]) {
                    this.queue[guildID] = [];
                }

                this.queue[guildID].push({
                    name:info.title,
                    url:info.video_url
                });
                if (this.isPlaying[guildID]) {
                    msg.channel.send(`歌曲加入隊列：${info.title}`);
                } else {
                    this.isPlaying[guildID] = true;
                    this.playMusicforString(msg, guildID, this.queue[guildID][0]);
                }
            }catch(e) {
                console.log(e);
            }
        }
    }

    playMusic(msg, guildID, musicInfo) {

        // 提示播放音樂
        msg.channel.send(`播放你媽的驪歌：${musicInfo.name}`);

        // 播放音樂
        this.dispatcher[guildID] = this.connection[guildID].play(ytdl(musicInfo.url, { filter: 'audioonly' }));

        // 把音量降 50%
        this.dispatcher[guildID].setVolume(0.5);

        // 移除 queue 中目前播放的歌曲
        this.queue[guildID].shift();

        // 歌曲播放結束時的事件
        this.dispatcher[guildID].on('finish', () => {

            // 如果隊列中有歌曲
            if (this.queue[guildID].length > 0) {
                this.playMusic(msg, guildID, this.queue[guildID][0]);
            } else {
                this.isPlaying[guildID] = false;
                msg.channel.send('沒歌了SB');
            }

        });
    }
    playMusicforString(msg, guildID, musicInfo) {

        msg.channel.send(`播放你媽的驪歌：${musicInfo.name}`);

        this.dispatcher[guildID] = this.connection[guildID].play(ytdl(musicInfo.url, { filter: 'audioonly' }));

        this.dispatcher[guildID].setVolume(0.5);

        this.queue[guildID].shift();

        this.dispatcher[guildID].on('finish', () => {

            if (this.queue[guildID].length > 0) {
                this.playMusicforString(msg, guildID, this.queue[guildID][0]);
            } else {
                this.isPlaying[guildID] = false;
                msg.channel.send('沒歌了SB');
            }

        });

    }

    resume(msg) {

        if (this.dispatcher[msg.guild.id]) {
            msg.channel.send('恢復播放');

            // 恢復播放
            this.dispatcher[msg.guild.id].resume();
        }

    }

    pause(msg) {

        if (this.dispatcher[msg.guild.id]) {
            msg.channel.send('暫停播放');

            // 暫停播放
            this.dispatcher[msg.guild.id].pause();
        }

    }

    skip(msg) {

        if (this.dispatcher[msg.guild.id]) {
            msg.channel.send('跳過目前歌曲');

            // 跳過歌曲
            this.dispatcher[msg.guild.id].end();
        }

    }

    nowQueue(msg) {

        // 如果隊列中有歌曲就顯示
        if (this.queue[msg.guild.id] && this.queue[msg.guild.id].length > 0) {
            // 字串處理，將 Object 組成字串
            const queueString = this.queue[msg.guild.id].map((item, index) => `[${index+1}] ${item.name}`).join();
            msg.channel.send(queueString);
        } else {
            msg.channel.send('目前隊列中沒有歌曲');
        }

    }

    leave(msg) {

        // 如果機器人在頻道中
        if (this.connection[msg.guild.id] && this.connection[msg.guild.id].status === 0) {

            // 如果機器人有播放過歌曲
            if (this.queue.hasOwnProperty(msg.guild.id)) {

                // 清空播放列表
                delete this.queue[msg.guild.id];

                // 改變 isPlaying 狀態為 false
                this.isPlaying[msg.guild.id] = false;
            }

            // 離開頻道
            this.connection[msg.guild.id].disconnect();
        } else {
            msg.channel.send('機器人未加入任何頻道');
        }

    }
}

const music = new Music();

// 當 Bot 接收到訊息時的事件
client.on('message', async (msg) => {

    // 如果發送訊息的地方不是語音群（可能是私人），就 return
    if (!msg.guild) return;

    // !!join
    if (msg.content === `${prefix}join`) {

        music.join(msg);
    }

    // 如果使用者輸入的內容中包含 !p
    if (msg.content.indexOf(`${prefix}p`>1)) {


        if (msg.member.voice.channel) {


            await music.play(msg);
        } else {

            msg.reply('你要先進來智障');
        }
    }

    // !!resume
    if (msg.content === `${prefix}resume`) {

        
        music.resume(msg);
    }

    // !!pause
    if (msg.content === `${prefix}pause`) {

        
        music.pause(msg);
    }

    // !!skip
    if (msg.content === `${prefix}skip`) {

        
        music.skip(msg);
    }

    // !!queue
    if (msg.content === `${prefix}queue`) {

        
        music.nowQueue(msg);
    }

    // !!leave
    if (msg.content === `${prefix}leave`) {

        
        music.leave(msg);
    }
     
});

// 連上線時的事件
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.login(token);