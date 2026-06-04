

const fs   = require('fs').promises;
const path = require('path');
const {
    ContainerBuilder, TextDisplayBuilder,
    SeparatorBuilder, MessageFlags
} = require('discord.js');

const LEADERBOARD_FILE = path.join(process.cwd(), 'data', 'leaderboard.json');

let _lb     = { weekStart: null, scores: {} };
let _client = null;
let _loop   = null;

function getWeekStart() {
    const now  = new Date();
    const day  = now.getUTCDay();            

    const diff = now.getUTCDate() - day;     

    const sun  = new Date(now);
    sun.setUTCDate(diff);
    sun.setUTCHours(0, 0, 0, 0);
    return sun.toISOString();
}

function isNewWeek() {
    if (!_lb.weekStart) return true;
    return new Date(_lb.weekStart).toISOString() !== getWeekStart();
}

async function loadLeaderboard() {
    try {
        const raw = await fs.readFile(LEADERBOARD_FILE, 'utf8');
        _lb = JSON.parse(raw);
        console.log('🏆 Leaderboard loaded');
    } catch (err) {
        if (err.code === 'ENOENT') { _lb = { weekStart: getWeekStart(), scores: {} }; await saveLeaderboard(); }
        else { console.error('Error loading leaderboard:', err); _lb = { weekStart: getWeekStart(), scores: {} }; }
    }
}

async function saveLeaderboard() {
    try {
        await fs.mkdir(path.dirname(LEADERBOARD_FILE), { recursive: true });
        await fs.writeFile(LEADERBOARD_FILE, JSON.stringify(_lb, null, 2));
    } catch (err) { console.error('Error saving leaderboard:', err); }
}

function ensureUser(userId, userName) {
    if (!_lb.scores[userId]) {
        _lb.scores[userId] = { userName, messages: 0, images: 0 };
    } else if (_lb.scores[userId].userName !== userName) {
        _lb.scores[userId].userName = userName;
    }
}

function trackMessage(userId, userName) {
    ensureUser(userId, userName);
    _lb.scores[userId].messages++;
}

function trackImage(userId, userName) {
    ensureUser(userId, userName);
    _lb.scores[userId].images++;
}

function getTopUsers(limit = 10) {
    return Object.entries(_lb.scores)
        .map(([userId, data]) => ({
            userId,
            userName: data.userName,
            messages: data.messages || 0,
            images:   data.images   || 0,
            total:    (data.messages || 0) + (data.images || 0) * 2  

        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, limit);
}

const MEDALS = ['🥇', '🥈', '🥉'];

function buildLeaderboardComponent(top, weekStart, isAuto, EMOJI) {
    const container = new ContainerBuilder().setAccentColor(0xFFD700);
    const weekStartTs = Math.floor(new Date(weekStart).getTime() / 1000);

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## 🏆 Weekly Leaderboard ${EMOJI.sparkle}\n` +
        `Week of <t:${weekStartTs}:D>`
    ));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));

    if (top.length === 0) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `No activity recorded this week yet — go chat! ${EMOJI.waving}`
        ));
    } else {
        let board = '';
        top.forEach((user, i) => {
            const medal = MEDALS[i] || `**${i + 1}.**`;
            board += `${medal} **${user.userName}**\n` +
                     `　💬 \`${user.messages}\` messages  🎨 \`${user.images}\` images  ⭐ \`${user.total}\` pts\n\n`;
        });

        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(board.trim()));
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));

        

        if (top[0]) {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `👑 **This week's MVP: ${top[0].userName}** with \`${top[0].total}\` points!`
            ));
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(1));
        }
    }

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `-# ${EMOJI.coffee} Points: 1 per message • 2 per image generated • Resets every Sunday`
    ));

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildInfoComponent(title, body, accentColor = 0x8B4513) {
    const container = new ContainerBuilder().setAccentColor(accentColor);
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}\n${body}`));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

async function postWeeklyLeaderboard(EMOJI) {
    const channelId = process.env.LEADERBOARD_CHANNEL_ID;
    if (!channelId || !_client) return;

    try {
        const channel = _client.channels.cache.get(channelId);
        if (!channel?.isTextBased()) return;

        const top = getTopUsers(10);
        await channel.send(buildLeaderboardComponent(top, _lb.weekStart, true, EMOJI));
        console.log('🏆 Weekly leaderboard posted!');
    } catch (err) {
        console.error('Error posting leaderboard:', err.message);
    }
}

async function checkWeekReset(EMOJI) {
    if (!isNewWeek()) return;

    console.log('📅 New week detected — posting leaderboard and resetting scores');

    

    await postWeeklyLeaderboard(EMOJI);

    

    _lb = { weekStart: getWeekStart(), scores: {} };
    await saveLeaderboard();
}

async function handleLeaderboardCommand(message, EMOJI) {
    const top = getTopUsers(10);
    await message.reply(buildLeaderboardComponent(top, _lb.weekStart, false, EMOJI));
}

async function handleLeaderboardForcePost(message, EMOJI) {
    await postWeeklyLeaderboard(EMOJI);
    await message.reply(buildInfoComponent('✅ Posted', 'Weekly leaderboard posted to the leaderboard channel!', 0x00FF88));
}

async function initializeLeaderboard(client, EMOJI) {
    _client = client;
    await loadLeaderboard();

    

    _loop = setInterval(() => checkWeekReset(EMOJI), 60 * 60 * 1000);

    

    await checkWeekReset(EMOJI);

    console.log('🏆 Leaderboard system initialized!');
}

module.exports = {
    initializeLeaderboard,
    handleLeaderboardCommand,
    handleLeaderboardForcePost,
    trackMessage,
    trackImage
};