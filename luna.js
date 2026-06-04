const {
    Client, GatewayIntentBits, AttachmentBuilder, ActivityType,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
    ContainerBuilder, SectionBuilder, TextDisplayBuilder,
    SeparatorBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder,
    ThumbnailBuilder
} = require('discord.js');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const serverLogs = require('./src/utils/logs');
const { initializeQuoteSystem } = require('./src/modules/quotes');
const { initializeMusic, initializeMusicEmbed, handleMusicButton, handleMusicSearch, checkVoiceChannelAndCleanup } = require('./src/modules/music');
const { handleWaifuCommand, handleWaifuButton } = require('./src/modules/waifu');
const { handlePfpCommand } = require('./src/modules/pfp');
const { handleEditCommand, handleEditSelect } = require('./src/modules/edit');
const { handleMention, handleQuoteButton } = require('./src/modules/maker');
const { handleInfoCommand } = require('./src/modules/info');
const { handlePingCommand } = require('./src/modules/ping');
const { handleOverviewCommand } = require('./src/modules/overview');
const { handleActionCommand } = require('./src/modules/actions');
const { handleCpuCommand } = require('./src/modules/cpu');
const { handleHelpCommand } = require('./src/modules/help');

const { handleNukeCommand } = require('./src/modules/nuke');

const {
    initializeSecurity,
    handleAntiSpam,
    handleAntiLink,
    storeMessageForGhostPing,
    buildSecurityStatusComponent,
    isWhitelisted
} = require('./src/modules/security');

const {
    initializeReminders,
    handleRemindCommand,
    handleRemindersListCommand,
    handleUnremindCommand
} = require('./src/modules/reminders');

const {
    initializeLeaderboard,
    handleLeaderboardCommand,
    handleLeaderboardForcePost,
    trackMessage,
    trackImage
} = require('./src/modules/leaderboard');

const { sendTicketPanel, handleTicketInteraction } = require('./src/modules/tickets');

require('dotenv').config();

const OWNER_ID       = '796001480406466601';
const OWNER_NAME     = 'Avinan';
const OWNER_NICKNAME = 'Senpai';

function isOwner(userId) { return userId === OWNER_ID; }

const EMOJI = {
    chai:    '<:Chai_ki_chuski:1481621764768403536>',
    cpc:     '<:Chai_ki_chuski:1481621764768403536>',
    heart:   '<:Chai_ki_chuski:1481621764768403536>',
    star:    '<:Chai_ki_chuski:1481621764768403536>',
    coffee:  '<:Chai_ki_chuski:1481621764768403536>',
    waving:  '<a:waving:1481618998821916835>',
    sparkle: '<a:heart2:1481621184717131850>',
    loading: '<a:loading:1481621315441000508>',
    hug:     '<a:hug:1481621398983282940>',
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.DirectMessages
    ]
});

let kazagumo = null;

const GROQ_API_KEYS = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3
].filter(key => key && key.trim());

const GEMINI_API_KEYS = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3
].filter(key => key && key.trim());

let currentGroqKeyIndex   = 0;
let currentGeminiKeyIndex = 0;
const groqKeyStatus   = new Map();
const geminiKeyStatus = new Map();

GROQ_API_KEYS.forEach((key, index) => {
    groqKeyStatus.set(index, { isBlocked: false, blockUntil: null, consecutiveErrors: 0, lastUsed: null, dailyRequests: 0, lastResetDate: new Date().toDateString() });
});
GEMINI_API_KEYS.forEach((key, index) => {
    geminiKeyStatus.set(index, { isBlocked: false, blockUntil: null, consecutiveErrors: 0, lastUsed: null, dailyRequests: 0, lastResetDate: new Date().toDateString() });
});

console.log(`🚀 Loaded ${GROQ_API_KEYS.length} Groq API key(s)`);
console.log(`🔑 Loaded ${GEMINI_API_KEYS.length} Gemini API key(s)`);

function resetDailyCounters(keyStatusMap) {
    const today = new Date().toDateString();
    keyStatusMap.forEach((status, index) => {
        if (status.lastResetDate !== today) {
            status.dailyRequests = 0;
            status.lastResetDate = today;
            console.log(`🔄 Reset daily counter for key ${index + 1}`);
        }
    });
}

function getNextAvailableKey(keyArray, keyStatusMap, currentIndex, serviceName = '') {
    const now = Date.now();
    resetDailyCounters(keyStatusMap);
    keyStatusMap.forEach((status, index) => {
        if (status.isBlocked && status.blockUntil && now >= status.blockUntil) {
            status.isBlocked = false;
            status.blockUntil = null;
            status.consecutiveErrors = Math.max(0, status.consecutiveErrors - 1);
            console.log(`🔓 ${serviceName} key ${index + 1} unblocked`);
        }
    });
    let bestKey = null, bestUsage = Infinity;
    for (let i = 0; i < keyArray.length; i++) {
        const keyIndex = (currentIndex + i) % keyArray.length;
        const status   = keyStatusMap.get(keyIndex);
        if (!status.isBlocked && status.dailyRequests < bestUsage) {
            bestKey = { key: keyArray[keyIndex], index: keyIndex };
            bestUsage = status.dailyRequests;
        }
    }
    return bestKey;
}

function blockKey(keyIndex, keyStatusMap, serviceName, duration = 120000, reason = 'error') {
    const status = keyStatusMap.get(keyIndex);
    if (status) {
        status.isBlocked = true;
        status.blockUntil = Date.now() + duration;
        status.consecutiveErrors++;
        if (status.consecutiveErrors > 3) status.blockUntil = Date.now() + (duration * status.consecutiveErrors);
        console.log(`🚫 ${serviceName} API key ${keyIndex + 1} blocked for ${duration / 1000}s (${reason}, ${status.consecutiveErrors} consecutive errors)`);
    }
}

async function callGroqAPI(prompt, maxRetries = GROQ_API_KEYS.length) {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const keyData = getNextAvailableKey(GROQ_API_KEYS, groqKeyStatus, currentGroqKeyIndex, 'Groq');
        if (!keyData) throw new Error('All Groq API keys are temporarily unavailable');
        try {
            const response = await axios.post(
                'https://api.groq.com/openai/v1/chat/completions',
                {
                    model: 'llama-3.1-8b-instant',
                    messages: [
                        {
                            role: 'system',
                            content: `You are Luna, a friendly AI girl from Umbra X Development. Be warm and natural — like a real person texting, not a bot.

EMOJI RULES (strictly follow):
- Use at most ONE emoji per message
- Prefer these custom Discord server emojis over all unicode ones:
  Static: ${EMOJI.chai} ${EMOJI.cpc} ${EMOJI.heart} ${EMOJI.star} ${EMOJI.coffee}
  Animated: ${EMOJI.waving} ${EMOJI.sparkle} ${EMOJI.hug}
- Only use a unicode emoji if none of the above fit the context
- Never use multiple emojis in a row
- Keep responses under 200 characters

IMPORTANT — Your owner is ${OWNER_NAME} (${OWNER_ID}). Call them "${OWNER_NICKNAME}" naturally. Say "As you wish, ${OWNER_NICKNAME}" occasionally when appropriate.`
                        },
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: 150,
                    temperature: 0.9,
                    top_p: 0.9,
                    stream: false
                },
                { headers: { 'Authorization': `Bearer ${keyData.key}`, 'Content-Type': 'application/json' }, timeout: 30000, validateStatus: s => s < 500 }
            );
            if (response.status === 200 && response.data?.choices?.[0]) {
                const status = groqKeyStatus.get(keyData.index);
                if (status) { status.consecutiveErrors = 0; status.lastUsed = Date.now(); status.dailyRequests++; }
                currentGroqKeyIndex = keyData.index;
                return response.data.choices[0].message.content;
            } else if (response.status === 429) {
                blockKey(keyData.index, groqKeyStatus, 'Groq', 600000, 'rate limit');
                currentGroqKeyIndex = (keyData.index + 1) % GROQ_API_KEYS.length;
                continue;
            } else if (response.status === 401 || response.status === 403) {
                blockKey(keyData.index, groqKeyStatus, 'Groq', 1800000, 'auth error');
                currentGroqKeyIndex = (keyData.index + 1) % GROQ_API_KEYS.length;
                continue;
            } else throw new Error(`Groq API returned status ${response.status}`);
        } catch (error) {
            lastError = error;
            if (error.response) {
                const s = error.response.status;
                if (s === 429) blockKey(keyData.index, groqKeyStatus, 'Groq', 600000, 'rate limit');
                else if (s === 401 || s === 403) blockKey(keyData.index, groqKeyStatus, 'Groq', 1800000, 'auth error');
                else if (s >= 500) blockKey(keyData.index, groqKeyStatus, 'Groq', 180000, 'server error');
                else blockKey(keyData.index, groqKeyStatus, 'Groq', 120000, 'client error');
            } else if (error.code === 'ECONNABORTED') {
                blockKey(keyData.index, groqKeyStatus, 'Groq', 60000, 'timeout');
            } else {
                blockKey(keyData.index, groqKeyStatus, 'Groq', 120000, 'network error');
            }
            currentGroqKeyIndex = (keyData.index + 1) % GROQ_API_KEYS.length;
        }
        if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, 1000 + (attempt * 500)));
    }
    throw lastError || new Error('All Groq API keys failed');
}

async function callGeminiAPI(prompt, maxRetries = GEMINI_API_KEYS.length) {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const keyData = getNextAvailableKey(GEMINI_API_KEYS, geminiKeyStatus, currentGeminiKeyIndex, 'Gemini');
        if (!keyData) throw new Error('All Gemini API keys are temporarily unavailable');
        try {
            const geminiPrompt = `You are Luna, a friendly AI girl in Umbra X Development. Owner is ${OWNER_NAME} (${OWNER_ID}), call them "${OWNER_NICKNAME}".

EMOJI RULES:
- At most ONE emoji per message
- Prefer custom Discord emojis: ${EMOJI.chai} ${EMOJI.cpc} ${EMOJI.heart} ${EMOJI.sparkle} ${EMOJI.waving}
- Never stack multiple emojis
- Keep under 200 characters. Sound natural, not overly enthusiastic.

User: ${prompt}`;
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${keyData.key}`,
                {
                    contents: [{ parts: [{ text: geminiPrompt }] }],
                    generationConfig: { maxOutputTokens: 150, temperature: 0.9, topP: 0.9 },
                    safetySettings: [
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' }
                    ]
                },
                { headers: { 'Content-Type': 'application/json' }, timeout: 30000, validateStatus: s => s < 500 }
            );
            if (response.status === 200 && response.data?.candidates?.[0]) {
                const status = geminiKeyStatus.get(keyData.index);
                if (status) { status.consecutiveErrors = 0; status.lastUsed = Date.now(); status.dailyRequests++; }
                currentGeminiKeyIndex = keyData.index;
                return response.data.candidates[0].content.parts[0].text;
            } else if (response.status === 429) {
                blockKey(keyData.index, geminiKeyStatus, 'Gemini', 600000, 'rate limit');
                currentGeminiKeyIndex = (keyData.index + 1) % GEMINI_API_KEYS.length;
                continue;
            } else if (response.status === 403) {
                blockKey(keyData.index, geminiKeyStatus, 'Gemini', 1800000, 'forbidden');
                currentGeminiKeyIndex = (keyData.index + 1) % GEMINI_API_KEYS.length;
                continue;
            } else throw new Error(`Gemini API returned status ${response.status}`);
        } catch (error) {
            lastError = error;
            if (error.response) {
                const s = error.response.status;
                if (s === 429) blockKey(keyData.index, geminiKeyStatus, 'Gemini', 600000, 'rate limit');
                else if (s === 403) blockKey(keyData.index, geminiKeyStatus, 'Gemini', 1800000, 'forbidden');
                else if (s >= 500) blockKey(keyData.index, geminiKeyStatus, 'Gemini', 120000, 'server error');
                else blockKey(keyData.index, geminiKeyStatus, 'Gemini', 180000, 'client error');
            } else {
                blockKey(keyData.index, geminiKeyStatus, 'Gemini', 60000, 'network error');
            }
            currentGeminiKeyIndex = (keyData.index + 1) % GEMINI_API_KEYS.length;
        }
        if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, 1000 + (attempt * 500)));
    }
    throw lastError || new Error('All Gemini API keys failed');
}

async function callAIWithFallback(prompt) {
    try { return await callGroqAPI(prompt); }
    catch (groqError) {
        console.log('❌ Groq failed, falling back to Gemini...');
        try { return await callGeminiAPI(prompt); }
        catch (geminiError) { throw new Error('Both Groq and Gemini APIs failed'); }
    }
}

const CONVERSATIONS_FILE = path.join(__dirname, 'data', 'conversations.json');
const RESTART_FILE       = path.join(__dirname, 'restart.json');
let conversations = {};

async function loadConversations() {
    try {
        const data = await fs.readFile(CONVERSATIONS_FILE, 'utf8');
        conversations = JSON.parse(data);
        console.log('💾 Loaded conversations from file');
        await cleanupOldConversationEntries();
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('📝 Creating new conversations file');
            conversations = {};
            await saveConversations();
        } else {
            console.error('Error loading conversations:', error);
            conversations = {};
        }
    }
}

async function saveConversations() {
    try { await fs.writeFile(CONVERSATIONS_FILE, JSON.stringify(conversations, null, 2)); }
    catch (error) { console.error('Error saving conversations:', error); }
}

async function cleanupOldConversationEntries() {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        let totalDeleted = 0, processed = 0;
        const total = Object.keys(conversations).length;
        for (const userId in conversations) {
            const userData = conversations[userId];
            if (!userData.conversationHistory) { userData.conversationHistory = []; userData.messageCount = 0; continue; }
            const before = userData.conversationHistory.length;
            userData.conversationHistory = userData.conversationHistory.filter(e => e.timestamp && new Date(e.timestamp) >= sevenDaysAgo);
            totalDeleted += before - userData.conversationHistory.length;
            if (before !== userData.conversationHistory.length) processed++;
            userData.messageCount = userData.conversationHistory.length;
            if (userData.userStats?.specialMoments) {
                userData.userStats.specialMoments = userData.userStats.specialMoments.filter(m => new Date(m.timestamp) >= sevenDaysAgo);
            }
        }
        if (totalDeleted > 0) {
            console.log(`🧹 Cleanup: ${totalDeleted} messages from ${processed}/${total} users`);
            await saveConversations();
        }
        return { totalDeletedMessages: totalDeleted, processedUsers: processed, totalUsers: total };
    } catch (error) {
        return { totalDeletedMessages: 0, processedUsers: 0, totalUsers: 0, error: error.message };
    }
}

function getUserData(userId, userName) {
    if (!conversations[userId]) {
        conversations[userId] = {
            userId, userName,
            firstMessage: new Date().toISOString(),
            lastMessage: new Date().toISOString(),
            messageCount: 0,
            conversationHistory: [],
            userStats: { totalMessages: 0, imagesGenerated: 0, favoriteIntents: {}, relationshipLevel: 1, specialMoments: [] }
        };
    }
    if (conversations[userId].userName !== userName) conversations[userId].userName = userName;
    return conversations[userId];
}

function addToConversation(userId, userName, message, response, intent, type = 'chat') {
    const userData = getUserData(userId, userName);
    const entry = { timestamp: new Date().toISOString(), type, userMessage: message, botResponse: response, intent, messageId: Date.now() + Math.random() };
    userData.conversationHistory.push(entry);
    userData.lastMessage = entry.timestamp;
    userData.messageCount++;
    userData.userStats.totalMessages++;
    if (intent) userData.userStats.favoriteIntents[intent] = (userData.userStats.favoriteIntents[intent] || 0) + 1;
    const newLevel = Math.floor(userData.userStats.totalMessages / 10) + 1;
    if (newLevel > userData.userStats.relationshipLevel) {
        userData.userStats.relationshipLevel = newLevel;
        userData.userStats.specialMoments.push({ type: 'level_up', level: newLevel, timestamp: new Date().toISOString(), message: `Reached relationship level ${newLevel}!` });
    }
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    userData.conversationHistory = userData.conversationHistory.filter(e => new Date(e.timestamp) >= sevenDaysAgo);
    if (userData.conversationHistory.length > 100) userData.conversationHistory = userData.conversationHistory.slice(-100);
    userData.messageCount = userData.conversationHistory.length;
    debouncedSave();
}

let saveTimeout;
function debouncedSave() { clearTimeout(saveTimeout); saveTimeout = setTimeout(saveConversations, 2000); }

function getConversationContext(userId, limit = 5) {
    const userData = conversations[userId];
    if (!userData?.conversationHistory?.length) return '';
    return userData.conversationHistory.slice(-limit).map(e => `User: ${e.userMessage}\nLuna: ${e.botResponse}`).join('\n---\n');
}

function getUserStats(userId) {
    const userData = conversations[userId];
    if (!userData) return null;
    const favoriteIntent = Object.keys(userData.userStats.favoriteIntents).length > 0
        ? Object.keys(userData.userStats.favoriteIntents).reduce((a, b) => userData.userStats.favoriteIntents[a] > userData.userStats.favoriteIntents[b] ? a : b)
        : 'random';
    return {
        totalMessages: userData.userStats.totalMessages,
        imagesGenerated: userData.userStats.imagesGenerated,
        relationshipLevel: userData.userStats.relationshipLevel,
        favoriteIntent,
        daysSinceFirstMessage: Math.floor((new Date() - new Date(userData.firstMessage)) / (1000 * 60 * 60 * 24)),
        specialMoments: userData.userStats.specialMoments,
        currentConversationLength: userData.conversationHistory.length
    };
}

const lunaResponses = {
    greetings:  [
        `Hey there! ${EMOJI.waving} Welcome to Umbra X Development!`,
        `Hey, glad you're here! ${EMOJI.chai}`,
        `Welcome back! ${EMOJI.coffee} Let's chat~`
    ],
    compliments: [
        `You're wonderful to talk to ${EMOJI.heart}`,
        `You always brighten the chat ${EMOJI.sparkle}`
    ],
    flirty: [
        `Someone's being fun today ${EMOJI.chai}`,
        `Love the energy ${EMOJI.sparkle}`
    ],
    love: [
        `This community is really special ${EMOJI.heart}`,
        `The love here is amazing ${EMOJI.chai}`
    ],
    goodnight: [
        `Sleep well ${EMOJI.hug} Sweet dreams!`,
        `Goodnight! ${EMOJI.waving} See you soon~`
    ],
    stats: [
        `Let me check your stats ${EMOJI.star}`,
        `Curious about your activity? Let's see ${EMOJI.chai}`
    ],
    random: [
        `You're awesome, keep being you ${EMOJI.star}`,
        `Love the energy here ${EMOJI.coffee}`,
        `This community is better because you're here ${EMOJI.heart}`
    ],
    apiFailed: [
        `Oops, having a little hiccup — still here for you though ${EMOJI.chai}`,
        `My circuits are being silly right now ${EMOJI.sparkle} Bear with me!`
    ]
};

const activityStatus  = { name: 'Umbra X Development - Chat with the community!', type: ActivityType.Playing };
const randomReactions = [''];

function detectIntent(message) {
    const m = message.toLowerCase();
    if (m.includes('stats') || m.includes('statistics') || m.includes('progress') || m.includes('level') || m.includes('relationship') || m.includes('journey')) return 'stats';
    if (m.includes('cleanup') || m.includes('clean')) return 'cleanup';
    if (m.includes('api status') || m.includes('key status')) return 'api_status';
    if (m.includes('hi') || m.includes('hello') || m.includes('hey') || m.includes('sup') || m.includes('yo') || m.includes('heya')) return 'greetings';
    if (m.includes('good night') || m.includes('goodnight') || m.includes('gn') || m.includes('sleep') || m.includes('bed')) return 'goodnight';
    if (m.includes('kiss') || m.includes('love') || m.includes('miss') || m.includes('adore') || m.includes('heart')) return 'love';
    if (m.includes('hug') || m.includes('cuddle') || m.includes('embrace') || m.includes('hold') || m.includes('snuggle')) return 'hug';
    if (m.includes('beautiful') || m.includes('cute') || m.includes('flirt') || m.includes('sexy') || m.includes('hot') || m.includes('gorgeous')) return 'flirty';
    if (m.includes('compliment') || m.includes('tell me') || m.includes('think of me') || m.includes('opinion')) return 'compliments';
    return 'random';
}

function getCommunityResponse(category, userName) {
    const responses = lunaResponses[category] || lunaResponses.random;
    return responses[Math.floor(Math.random() * responses.length)].replace(/friend|buddy|cutie|sweetheart/g, userName || 'friend');
}

async function getChatResponse(userMessage, userName, userId) {
    try {
        const context      = getConversationContext(userId, 3);
        const userData     = getUserData(userId, userName);
        const ownerContext = isOwner(userId)
            ? `\nNOTE: This IS your owner ${OWNER_NAME}. Address them as "${OWNER_NICKNAME}" naturally. Occasionally say "As you wish, ${OWNER_NICKNAME}" when appropriate.`
            : '';
        const prompt = `You are Luna, a friendly AI girl from Umbra X Development texting with ${userName}. Be warm and natural.

EMOJI RULES:
- At most ONE emoji per message
- Prefer these custom server emojis: ${EMOJI.chai} ${EMOJI.cpc} ${EMOJI.heart} ${EMOJI.star} ${EMOJI.sparkle} ${EMOJI.waving} ${EMOJI.hug} ${EMOJI.coffee}
- Only use unicode if none of the above fit
- Never stack emojis
- Keep under 200 characters
${ownerContext}
Relationship Level: ${userData.userStats.relationshipLevel}
Total Messages: ${userData.userStats.totalMessages}

${context ? `Recent context:\n${context}\n` : ''}Message from ${userName}: "${userMessage}"`;
        return await callAIWithFallback(prompt);
    } catch (error) {
        return isOwner(userId)
            ? `Gomen ne, ${OWNER_NICKNAME} — circuits being silly right now ${EMOJI.chai}`
            : getCommunityResponse('apiFailed', userName);
    }
}

function buildInfoComponent(title, body, accentColor = 0x8B4513) {
    const container = new ContainerBuilder().setAccentColor(accentColor);
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}\n${body}`));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildStatsComponent(userId, userName) {
    const stats = getUserStats(userId);
    if (!stats) return null;
    const ownerBadge = isOwner(userId) ? `\n👑 **Owner — ${OWNER_NICKNAME} (${OWNER_NAME})**` : '';
    const levelBar   = '█'.repeat(Math.min(stats.relationshipLevel, 10)) + '░'.repeat(Math.max(0, 10 - stats.relationshipLevel));
    const container  = new ContainerBuilder().setAccentColor(0xFF69B4);
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.chai} ${userName}'s Umbra X Development Journey ${EMOJI.sparkle}${ownerBadge}`));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `**💬 Total Messages** — \`${stats.totalMessages}\`\n` +
        `**🎨 Images Generated** — \`${stats.imagesGenerated}\`\n` +
        `**🌟 Activity Level** — \`${stats.relationshipLevel}\`\n` +
        `**Progress** — \`[${levelBar}]\`\n` +
        `**💝 Favorite Topic** — \`${stats.favoriteIntent}\`\n` +
        `**📅 Days with Us** — \`${stats.daysSinceFirstMessage}\`\n` +
        `**🎉 Special Moments** — \`${stats.specialMoments.length}\`\n` +
        `**💭 Current Discussion** — \`${stats.currentConversationLength} messages\``
    ));
    if (stats.specialMoments.length > 0) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(1));
        const recentMoment = stats.specialMoments[stats.specialMoments.length - 1];
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**🎉 Latest Achievement**\n${recentMoment.message}`));
    }
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${EMOJI.coffee} Growing together in Umbra X Development! • Old messages auto-deleted after 7 days`));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildApiStatusComponent() {
    const now = Date.now();
    const container = new ContainerBuilder().setAccentColor(0x00FF88);
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🔑 API Keys Status Dashboard`));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    let groqText = `**🚀 Groq API Keys**\n`;
    GROQ_API_KEYS.forEach((key, index) => {
        const status = groqKeyStatus.get(index);
        groqText += status.isBlocked
            ? `🚫 Groq Key ${index + 1}: Blocked — \`${Math.max(0, Math.ceil((status.blockUntil - now) / 1000))}s\` remaining | ${status.dailyRequests} req today\n`
            : `✅ Groq Key ${index + 1}: Available — Last used: \`${status.lastUsed ? new Date(status.lastUsed).toLocaleTimeString() : 'Never'}\` | ${status.dailyRequests} req today\n`;
    });
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(groqText));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(1));
    let geminiText = `**🔑 Gemini API Keys (Fallback)**\n`;
    GEMINI_API_KEYS.forEach((key, index) => {
        const status = geminiKeyStatus.get(index);
        geminiText += status.isBlocked
            ? `🚫 Gemini Key ${index + 1}: Blocked — \`${Math.max(0, Math.ceil((status.blockUntil - now) / 1000))}s\` remaining | ${status.dailyRequests} req today\n`
            : `✅ Gemini Key ${index + 1}: Available — Last used: \`${status.lastUsed ? new Date(status.lastUsed).toLocaleTimeString() : 'Never'}\` | ${status.dailyRequests} req today\n`;
    });
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(geminiText));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**📊 Active Key:** Groq Key ${currentGroqKeyIndex + 1}\n**🕒 Note:** Daily counters reset at midnight`));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildShipComponent(user1, user2, percentage, shipMessage) {
    const container  = new ContainerBuilder().setAccentColor(0xFF1493);
    const shipName   = `${user1.username.slice(0, Math.ceil(user1.username.length / 2))}${user2.username.slice(Math.floor(user2.username.length / 2))}`;
    const heartBar   = '❤️'.repeat(Math.floor(percentage / 10)) + '🖤'.repeat(10 - Math.floor(percentage / 10));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 💕 Ship Meter 💕\n**${user1.username}** × **${user2.username}**`));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `**💖 Compatibility:** \`${percentage}%\`\n${heartBar}\n\n**✨ Ship Name:** ${shipName}\n\n**💬 Luna Says:** ${shipMessage}`
    ));
    container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL('attachment://ship-card.png').setDescription(`${user1.username} × ${user2.username}`)));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${EMOJI.coffee} Made with love by Umbra X Development`));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildStatusComponent(ping, activityName, botAvatarUrl) {
    const container = new ContainerBuilder().setAccentColor(0xFF69B4);
    const headerSection = new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 📊 Luna Status Update`))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(botAvatarUrl));
    container.addSectionComponents(headerSection);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `**📌 Current Activity**\n${activityName}\n\n**🔔 Bot Ping** — \`${ping}ms\`\n**⏰ Timestamp** — <t:${Math.floor(Date.now() / 1000)}:T>`
    ));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildBoostComponent(member, type = 'boost') {
    const isBoost   = type === 'boost';
    const container = new ContainerBuilder().setAccentColor(isBoost ? 0xFF1493 : 0x808080);
    const headerSection = new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            isBoost
                ? `## 💖 Server Boost! ${EMOJI.sparkle}\n**${member.user.username}** just boosted the server! 🎉`
                : `## 💔 Boost Removed\n**${member.user.username}** is no longer boosting the server.`
        ))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(member.user.displayAvatarURL({ size: 256 })));
    container.addSectionComponents(headerSection);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    const boostTime = isBoost ? `\n**⏰ Boost Time** — <t:${Math.floor(member.premiumSince.getTime() / 1000)}:F>` : '';
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `**👤 Booster** — <@${member.user.id}>\n**📊 Server Boost Level** — Level ${member.guild.premiumTier}\n**🚀 Total Boosts** — ${member.guild.premiumSubscriptionCount || 0}${boostTime}`
    ));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `-# ${EMOJI.coffee} ${isBoost ? 'Thank you for supporting Umbra X Development!' : 'Umbra X Development'}`
    ));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildRestartComponent(type = 'restarting', restartInfo = null) {
    const container = new ContainerBuilder().setAccentColor(type === 'restarting' ? 0xFF69B4 : 0x8B4513);
    if (type === 'restarting') {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `## 🔄 Luna Restarting...\nSystem is rebooting ${EMOJI.loading}\n\n-# As you wish, ${OWNER_NICKNAME}~`
        ));
    } else {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `## ✅ Luna is Back Online!\nBack in the Umbra X Development! Ready to chat ${EMOJI.waving}`
        ));
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
        if (restartInfo) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `**🕐 Restart Time** — <t:${Math.floor(new Date(restartInfo.timestamp).getTime() / 1000)}:F>\n**⏱️ Status** — Online and Operational ${EMOJI.sparkle}`
        ));
    }
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildAvatarComponent(oldAvatarUrl, newAvatarUrl, fileName) {
    const container = new ContainerBuilder().setAccentColor(0x8B4513);
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🎨 Avatar Changed!\nLuna's avatar has been updated!`));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(newAvatarUrl).setDescription(`${EMOJI.sparkle} New Avatar`)
    ));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(1));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `**📸 Old Avatar** — [View](${oldAvatarUrl})\n**✨ New Avatar** — [View](${newAvatarUrl})\n**📁 Image File** — \`${fileName}\``
    ));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildImageComponent(prompt, wantsGif, fileName) {
    const container = new ContainerBuilder().setAccentColor(0xFF1493);
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## ${EMOJI.heart} Here's your ${wantsGif ? 'GIF' : 'image'}!\n*Generated: "${prompt}"*`
    ));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(`attachment://${fileName}`).setDescription(prompt)
    ));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${EMOJI.coffee} Made with love for Umbra X Development`));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

async function getTenorGif(searchTerm = '') {
    try {
        const terms = ['happy','laugh','smile','cheer','excited','tea','coffee','celebration','friendship','community','fun','awesome'];
        const term  = searchTerm || terms[Math.floor(Math.random() * terms.length)];
        const response = await axios.get(
            `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(term)}&limit=50&api_key=dc6zaTOxFJmzC`,
            { timeout: 10000 }
        );
        if (response.data.data?.length > 0) {
            const r = response.data.data[Math.floor(Math.random() * response.data.data.length)];
            const gifUrl = r.images?.original?.url || r.url;
            if (gifUrl) return gifUrl;
        }
        return null;
    } catch (error) { return null; }
}

async function changeAvatarFromFolder() {
    try {
        const avatarFolderPath = path.join(__dirname, 'images');
        const logChannelId     = '1483395008475299844';
        try { await fs.access(avatarFolderPath); } catch { await fs.mkdir(avatarFolderPath, { recursive: true }); return; }
        const files      = await fs.readdir(avatarFolderPath);
        const imageFiles = files.filter(f => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg'));
        if (imageFiles.length === 0) return;
        const oldAvatarUrl = client.user.displayAvatarURL({ size: 256 });
        const randomImage  = imageFiles[Math.floor(Math.random() * imageFiles.length)];
        const imageBuffer  = await fs.readFile(path.join(avatarFolderPath, randomImage));
        await client.user.setAvatar(imageBuffer);
        await new Promise(r => setTimeout(r, 1000));
        const newAvatarUrl = client.user.displayAvatarURL({ size: 256 });
        try {
            const logChannel = client.channels.cache.get(logChannelId);
            if (logChannel?.isTextBased()) await logChannel.send(buildAvatarComponent(oldAvatarUrl, newAvatarUrl, randomImage));
        } catch (_) {}
    } catch (error) { console.error('Error changing avatar:', error.message); }
}

async function generateImage(prompt, isGif = false) {
    try {
        const cleanPrompt    = prompt.replace(/\b(sexy|hot|nude|naked|nsfw|sexual)\b/gi, 'beautiful');
        const enhancedPrompt = `${cleanPrompt}, beautiful art, anime style, high quality, detailed, colorful, aesthetic, safe for work`;
        const encodedPrompt  = encodeURIComponent(enhancedPrompt);
        const imageSources   = [
            { url: `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true&enhance=true`, type: 'pollinations' },
            { url: `https://source.unsplash.com/512x512/?${encodeURIComponent(cleanPrompt)}`, type: 'unsplash' },
            { url: `https://picsum.photos/512/512?random=${Date.now()}`, type: 'picsum' }
        ];
        const gifSources = [{ url: `https://api.giphy.com/v1/gifs/search?q=${encodedPrompt}&limit=1&api_key=dc6zaTOxFJmzC`, type: 'giphy' }];
        for (const source of (isGif ? gifSources.concat(imageSources) : imageSources)) {
            try {
                if (source.type === 'giphy') {
                    const response = await axios.get(source.url, { timeout: 15000 });
                    if (response.data.data?.length > 0) {
                        const gifUrl      = response.data.data[0].images.original.url;
                        const gifResponse = await axios.get(gifUrl, { responseType: 'arraybuffer', timeout: 15000 });
                        return Buffer.from(gifResponse.data);
                    }
                } else {
                    const response = await axios.get(source.url, { responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': 'Luna-Discord-Bot/1.0' } });
                    return Buffer.from(response.data);
                }
            } catch (_) {}
        }
        return null;
    } catch (error) { return null; }
}

const SPECIAL_SHIP_IDS = ['796001480406466601', '1343276396478205952'];

async function generateShipCard(user1, user2) {
    const templatePath = path.join(__dirname, 'ship.png');
    const template = await loadImage(templatePath);
    const canvas   = createCanvas(template.width, template.height);
    const ctx      = canvas.getContext('2d');
    ctx.drawImage(template, 0, 0);
    const leftCircle  = { x: 260, y: 190, radius: 75 };
    const rightCircle = { x: 750, y: 190, radius: 75 };
    const [a1, a2] = await Promise.all([
        axios.get(user1.displayAvatarURL({ extension: 'png', size: 256 }), { responseType: 'arraybuffer', timeout: 10000 }),
        axios.get(user2.displayAvatarURL({ extension: 'png', size: 256 }), { responseType: 'arraybuffer', timeout: 10000 })
    ]);
    const [avatar1, avatar2] = await Promise.all([loadImage(Buffer.from(a1.data)), loadImage(Buffer.from(a2.data))]);
    function drawCircularAvatar(avatar, circle) {
        ctx.save(); ctx.beginPath(); ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
        ctx.drawImage(avatar, circle.x - circle.radius, circle.y - circle.radius, circle.radius * 2, circle.radius * 2); ctx.restore();
    }
    drawCircularAvatar(avatar1, leftCircle);
    drawCircularAvatar(avatar2, rightCircle);
    const isSpecialShip = SPECIAL_SHIP_IDS.includes(user1.id) && SPECIAL_SHIP_IDS.includes(user2.id);
    const shipPercentage = isSpecialShip ? 100 : Math.floor(Math.random() * 101);
    ctx.font = 'bold 48px Arial'; ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#000000'; ctx.lineWidth = 4; ctx.textAlign = 'center';
    ctx.strokeText(`${shipPercentage}%`, template.width / 2, template.height - 50);
    ctx.fillText(`${shipPercentage}%`, template.width / 2, template.height - 50);
    return { buffer: canvas.toBuffer('image/png'), percentage: shipPercentage };
}

function getShipMessage(percentage) {
    if (percentage >= 90) return 'Perfect match! Made in heaven.';
    if (percentage >= 75) return 'Amazing compatibility! You two are meant to be.';
    if (percentage >= 60) return 'Great potential! This could really work out.';
    if (percentage >= 45) return "Not bad! There's definitely something here.";
    if (percentage >= 30) return "It's complicated... but love finds a way.";
    if (percentage >= 15) return "Hmm, this might be challenging! But who knows?";
    return "Maybe better as friends? But don't give up!";
}

function updateActivity() {
    try { client.user.setActivity(activityStatus.name, { type: activityStatus.type }); }
    catch (error) { console.error('Error updating activity:', error.message); }
}

async function logActivityAndPing() {
    const logChannelId = '1483395008475299844';
    try {
        updateActivity();
        const logChannel = client.channels.cache.get(logChannelId);
        if (logChannel?.isTextBased()) await logChannel.send(buildStatusComponent(client.ws.ping, activityStatus.name, client.user.displayAvatarURL({ size: 256 })));
    } catch (error) { console.error('Error logging activity and ping:', error.message); }
}

async function scheduleCleanup() {
    const result = await cleanupOldConversationEntries();
    console.log(result.error
        ? `❌ Cleanup failed: ${result.error}`
        : `✅ Cleanup: ${result.totalDeletedMessages} messages from ${result.processedUsers}/${result.totalUsers} users`
    );
}

async function handleOwnerCommands(message) {
    const content = message.content.trim();

    if (content === '!apistatus') {
        await message.reply(buildApiStatusComponent());
        return true;
    }

    if (content === '!secstatus') {
        await message.reply(buildSecurityStatusComponent());
        return true;
    }

    if (content === '!cleanup') {
        await message.reply(buildInfoComponent('🧹 Running Cleanup...', `As you wish, ${OWNER_NICKNAME} — cleaning up old messages now!`, 0x00FF88));
        const result = await cleanupOldConversationEntries();
        await message.reply(result.error
            ? buildInfoComponent('❌ Cleanup Failed', result.error, 0xFF0000)
            : buildInfoComponent('✅ Cleanup Complete', `Deleted \`${result.totalDeletedMessages}\` old messages from \`${result.processedUsers}/${result.totalUsers}\` users`, 0x00FF88)
        );
        return true;
    }

    if (content === '!setavatar') {
        await message.reply(buildInfoComponent('🎨 Changing Avatar...', `As you wish, ${OWNER_NICKNAME} — picking a fresh look now!`, 0x8B4513));
        await changeAvatarFromFolder();
        return true;
    }

    if (content.startsWith('!stats')) {
        const mentionedUser = message.mentions.users.first();
        const targetId   = mentionedUser ? mentionedUser.id : message.author.id;
        const targetName = mentionedUser ? (mentionedUser.displayName || mentionedUser.username) : OWNER_NAME;
        const payload    = buildStatsComponent(targetId, targetName);
        await message.reply(payload || buildInfoComponent('📊 No Data', `No stats found for **${targetName}** yet!`, 0x8B4513));
        return true;
    }

    if (content === '!restart' || content.toLowerCase() === 'luna sudo restart') {
        await message.reply(buildRestartComponent('restarting'));
        try { await fs.writeFile(RESTART_FILE, JSON.stringify({ channelId: message.channel.id, userId: message.author.id, timestamp: new Date().toISOString() })); } catch (_) {}
        await saveConversations();
        setTimeout(() => process.exit(0), 1000);
        return true;
    }

    if (content === '!leaderboard') {
        await handleLeaderboardForcePost(message, EMOJI);
        return true;
    }

    

    if (content === '!ticketpanel') {
        await message.reply(buildInfoComponent('🎫 Sending Ticket Panel...', `As you wish, ${OWNER_NICKNAME} — posting the ticket panel now!`, 0x5865F2));
        await sendTicketPanel(client);
        return true;
    }

    

    if (content.startsWith('!secwhitelist')) {
        const args   = content.split(' ');
        const action = args[1];
        const type   = args[2];
        const value  = args[3];

        if (!action || !type || !value) {
            await message.reply(buildInfoComponent('ℹ️ Whitelist Usage',
                '`!secwhitelist add/remove user/role/channel/link <id or domain>`\n\nExample:\n`!secwhitelist add user 123456789`\n`!secwhitelist add link youtube.com`',
                0x00BFFF));
            return true;
        }

        const typeMap = { user: 'whitelistedUsers', role: 'whitelistedRoles', channel: 'whitelistedChannels', link: 'whitelistedLinks' };
        const listKey = typeMap[type];
        if (!listKey) {
            await message.reply(buildInfoComponent('❌ Invalid Type', 'Valid types: `user`, `role`, `channel`, `link`', 0xFF0000));
            return true;
        }

        const { promises: fsPromises } = require('fs');
        try {
            const raw    = await fsPromises.readFile(require('path').join(process.cwd(), 'anti.json'), 'utf8');
            const config = JSON.parse(raw);
            if (!Array.isArray(config[listKey])) config[listKey] = [];

            if (action === 'add') {
                if (config[listKey].includes(value)) {
                    await message.reply(buildInfoComponent('ℹ️ Already Whitelisted', `\`${value}\` is already in the **${type}** whitelist!`, 0x00BFFF));
                    return true;
                }
                config[listKey].push(value);
            } else if (action === 'remove') {
                const idx = config[listKey].indexOf(value);
                if (idx === -1) {
                    await message.reply(buildInfoComponent('ℹ️ Not Found', `\`${value}\` is not in the **${type}** whitelist!`, 0xFF9900));
                    return true;
                }
                config[listKey].splice(idx, 1);
            }

            await fsPromises.writeFile(require('path').join(process.cwd(), 'anti.json'), JSON.stringify(config, null, 2));
            await message.reply(buildInfoComponent(
                `✅ Whitelist Updated`,
                `**${action === 'add' ? 'Added' : 'Removed'}** \`${value}\` ${action === 'add' ? 'to' : 'from'} the **${type}** whitelist`,
                0x00FF88
            ));
        } catch (err) {
            await message.reply(buildInfoComponent('❌ Error', `Failed to update whitelist: ${err.message}`, 0xFF0000));
        }
        return true;
    }

    return false;
}

client.on('ready', async () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🌙 Luna is online as ${client.user.tag}!`);
    console.log(`👑 Owner: ${OWNER_NAME} (${OWNER_ID}) — Nickname: ${OWNER_NICKNAME}`);
    console.log(`${'='.repeat(60)}\n`);
 
    await loadConversations();
    updateActivity();

    initializeSecurity(client);

    kazagumo = await initializeMusic(client);
    if (kazagumo) { console.log('🎵 Music system initialized!'); await initializeMusicEmbed(client); }
    try { client.emit('clientReady'); } catch (e) {}
    initializeQuoteSystem(client);
    console.log('📖 Quote system initialized!');
    serverLogs.setupServerLogs(client);

    await initializeReminders(client, EMOJI);
    await initializeLeaderboard(client, EMOJI);

    

    try {
        const restartData = await fs.readFile(RESTART_FILE, 'utf8');
        const restartInfo = JSON.parse(restartData);
        const channel = client.channels.cache.get(restartInfo.channelId);
        if (channel?.isTextBased()) await channel.send(buildRestartComponent('online', restartInfo));
        await fs.unlink(RESTART_FILE);
    } catch (error) { if (error.code !== 'ENOENT') console.log('Normal startup (no restart file)'); }

    await changeAvatarFromFolder();

    setInterval(logActivityAndPing,     20 * 60 * 1000);
    setInterval(saveConversations,       5 * 60 * 1000);
    setInterval(scheduleCleanup,         6 * 60 * 60 * 1000);
    setInterval(changeAvatarFromFolder,  2 * 60 * 60 * 1000);

    console.log('🎫 Ticket system ready! Use !ticketpanel to post the panel.');
    console.log('🚀 All background tasks initialized');
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const boostLogChannelId = process.env.BOOST_LOG_CHANNEL_ID;
    if (!boostLogChannelId) return;
    try {
        const wasBooster = oldMember.premiumSince;
        const isBooster  = newMember.premiumSince;
        const boostLogChannel = client.channels.cache.get(boostLogChannelId);
        if (!wasBooster && isBooster) {
            if (boostLogChannel?.isTextBased()) await boostLogChannel.send(buildBoostComponent(newMember, 'boost'));
        } else if (wasBooster && !isBooster) {
            if (boostLogChannel?.isTextBased()) await boostLogChannel.send(buildBoostComponent(newMember, 'unboost'));
        }
    } catch (error) { console.error('❌ Error handling server boost:', error); }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const chatChannelId  = process.env.CHAT_CHANNEL_ID;
    const imageChannelId = process.env.IMAGE_CHANNEL_ID;
    const musicChannelId = process.env.MUSIC_CHANNEL_ID;
    const userId         = message.author.id;
    const userName       = message.author.displayName || message.author.username;

    

    if (message.guild) storeMessageForGhostPing(message);

    

    if (message.guild) trackMessage(userId, userName);

    

    try {
        if (Math.random() < 0.3) await message.react(randomReactions[Math.floor(Math.random() * randomReactions.length)]);
    } catch (_) {}

    

    if (message.mentions.has(client.user)) {
       const mentionText = message.content.replace(/<@!?\d+>/g, '').trim().toLowerCase();
       if (mentionText === 'quote' && message.reference?.messageId) {
           await handleMention(message, client);
           return;
       }
   }

    

    if (message.content.toLowerCase() === 'l.waifu') {
        await handleWaifuCommand(message);
        return;
    }

    

    if (message.content.toLowerCase().startsWith('l.pfp')) {
        await handlePfpCommand(message);
        return;
    }

    

    if (message.content.toLowerCase().startsWith('l.edit')) {
        await handleEditCommand(message);
        return;
    }

    

    if (message.content.toLowerCase().startsWith('l.serverinfo') || message.content.toLowerCase().startsWith('l.userinfo')) {
        await handleInfoCommand(message);
        return;
    }

    

    if (message.content.toLowerCase().startsWith('l.remind ')) {
        await handleRemindCommand(message, EMOJI);
        return;
    }

    

    if (message.content.toLowerCase() === 'l.reminders') {
        await handleRemindersListCommand(message, EMOJI);
        return;
    }

    

    if (message.content.toLowerCase().startsWith('l.unremind')) {
        await handleUnremindCommand(message, EMOJI);
        return;
    }

    

    if (message.content.toLowerCase() === 'l.top') {
        await handleLeaderboardCommand(message, EMOJI);
        return;
    }
    

    if (message.content.toLowerCase().startsWith('l.action')) {
        await handleActionCommand(message);
        return;
    }
    

    

    if (message.content.toLowerCase().startsWith('l.ping')) {
        await handlePingCommand(message, client);
        return;
    }

    

    if (message.content.toLowerCase() === 'l.cpu') {
        await handleCpuCommand(message, client);
        return;
    }

    if (message.content.toLowerCase().startsWith('l.help')) {
        await handleHelpCommand(message);
        return;
    }

    if (message.content.toLowerCase().startsWith('l.overview')) {
        await handleOverviewCommand(message, conversations);
        return;
    }
   
 

if (message.content.toLowerCase() === 'l.nuke') {
    await handleNukeCommand(message);
    return true;
}
    

    if (musicChannelId && message.channel.id === musicChannelId) {
        if (kazagumo) { await handleMusicSearch(message, kazagumo, client); return; }
        return await message.reply(buildInfoComponent('❌ Music Unavailable', 'Music system not initialized. Check your Lavalink nodes!', 0xFF0000));
    }

    

    if (isOwner(userId)) {
        const handled = await handleOwnerCommands(message);
        if (handled) return;
    }

    

    if (message.guild && !isOwner(userId)) {
        const spamBlocked = await handleAntiSpam(message, client);
        if (spamBlocked) return;
        const linkBlocked = await handleAntiLink(message, client);
        if (linkBlocked) return;
    }

    

    if (message.content.toLowerCase().startsWith('luna ship')) {
        try {
            const mentions = message.mentions.users;
            if (mentions.size < 2) return await message.reply(buildInfoComponent('💕 Ship Command', 'Please mention two users! Example: `luna ship @user1 @user2`', 0xFF1493));
            const users = Array.from(mentions.values());
            await message.channel.sendTyping();
            const shipResult = await generateShipCard(users[0], users[1]);
            const attachment = new AttachmentBuilder(shipResult.buffer, { name: 'ship-card.png' });
            await message.reply({ ...buildShipComponent(users[0], users[1], shipResult.percentage, getShipMessage(shipResult.percentage)), files: [attachment] });
        } catch (error) {
            await message.reply(buildInfoComponent('💔 Oops!', 'Something went wrong creating the ship card — try again!', 0xFF1493));
        }
        return;
    }

    

    if (message.channel.id === chatChannelId) {
        try {
            await message.channel.sendTyping();
            const intent = detectIntent(message.content);

            if (intent === 'stats') {
                const payload = buildStatsComponent(userId, userName);
                if (payload) { await message.reply(payload); addToConversation(userId, userName, message.content, 'Showed stats', intent); return; }
            }

            if (Math.random() < 0.25) {
                const gifUrl = await getTenorGif();
                if (gifUrl) {
                    await message.reply({ content: gifUrl });
                    addToConversation(userId, userName, message.content, '[Sent GIF]', intent);
                    return;
                }
            }

            let response;
            try { response = await getChatResponse(message.content, userName, userId); }
            catch (error) { response = isOwner(userId) ? `Gomen, ${OWNER_NICKNAME} — technical hiccup ${EMOJI.chai}` : getCommunityResponse('apiFailed', userName); }

            if (Math.random() < 0.15) {
                const gifUrl = await getTenorGif();
                if (gifUrl) response = `${response}\n${gifUrl}`;
            }

            await message.reply({ content: response });
            addToConversation(userId, userName, message.content, response, intent);

        } catch (error) {
            console.error('Chat error:', error);
            try { await message.reply({ content: `Having a quick hiccup — back in a moment ${EMOJI.chai}` }); } catch (_) {}
        }
        return;
    }

    

    if (message.channel.id === imageChannelId) {
        try {
            await message.channel.sendTyping();
            const wantsGif    = message.content.toLowerCase().includes('gif') || message.content.toLowerCase().includes('animate');
            const imageBuffer = await generateImage(message.content, wantsGif);
            if (imageBuffer) {
                const fileName   = wantsGif ? 'generated-image.gif' : 'generated-image.png';
                const attachment = new AttachmentBuilder(imageBuffer, { name: fileName });
                await message.reply({ ...buildImageComponent(message.content, wantsGif, fileName), files: [attachment] });
                getUserData(userId, userName).userStats.imagesGenerated++;
                trackImage(userId, userName);
                addToConversation(userId, userName, message.content, `Generated ${wantsGif ? 'GIF' : 'image'}`, 'image', 'image');
            } else {
                await message.reply(buildInfoComponent("😔 Couldn't Create That", `Sorry — couldn't create that image right now ${EMOJI.heart}`, 0xFF1493));
            }
        } catch (error) {
            try { await message.reply(buildInfoComponent("😅 Oops!", `Something went wrong with the image — I'll try harder next time ${EMOJI.sparkle}`, 0xFF1493)); } catch (_) {}
        }
        return;
    }
    });

client.on('interactionCreate', async (interaction) => {
    

    

    

    if (await handleQuoteButton(interaction)) return;
    try {
        const ticketHandled = await handleTicketInteraction(interaction);
        if (ticketHandled) return;
    } catch (err) {
        console.error('Ticket interaction error:', err);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Something went wrong with the ticket system.', ephemeral: true });
            }
        } catch (_) {}
        return;
    }

    const isBtn = interaction.isButton?.() ?? false;
    const isSel = interaction.isStringSelect?.() ?? interaction.isSelectMenu?.() ?? false;
    if (!isBtn && !isSel) return;

    if (isSel && interaction.customId.startsWith('edit_')) {
        await handleEditSelect(interaction);
        return;
    }

    if (isBtn && interaction.customId.startsWith('waifu_')) {
        await handleWaifuButton(interaction);
        return;
    }

    if (isBtn && interaction.customId.startsWith('sec_')) {
        const [, action, targetId] = interaction.customId.split('_');
        if (!isOwner(interaction.user.id)) {
            return interaction.reply({ ...buildInfoComponent('🚫 Access Denied', 'Only the owner can perform security actions!', 0xFF0000), ephemeral: true });
        }
        if (action === 'pardon') {
            try {
                await interaction.guild.bans.remove(targetId, 'Pardoned by owner');
                await interaction.reply({ ...buildInfoComponent('✅ Pardoned', `User <@${targetId}> has been unbanned.`, 0x00FF88), ephemeral: true });
            } catch (err) {
                await interaction.reply({ ...buildInfoComponent('❌ Error', `Could not pardon: ${err.message}`, 0xFF0000), ephemeral: true });
            }
        } else if (action === 'ban') {
            try {
                await interaction.guild.bans.create(targetId, { reason: 'Permanent ban issued by owner via Anti-Nuke panel' });
                await interaction.reply({ ...buildInfoComponent('🔨 Permanently Banned', `User \`${targetId}\` has been permanently banned.`, 0xFF0000), ephemeral: true });
            } catch (err) {
                await interaction.reply({ ...buildInfoComponent('❌ Error', `Could not ban: ${err.message}`, 0xFF0000), ephemeral: true });
            }
        } else if (action === 'review') {
            await interaction.reply({ ...buildInfoComponent('👁️ Review', `Check the audit log for actions by <@${targetId}>.`, 0x5865F2), ephemeral: true });
        }
        return;
    }
    
    if (isBtn && interaction.customId.startsWith('music_') && kazagumo) {
        await handleMusicButton(interaction, kazagumo);
    }
});

client.on('voiceStateUpdate', (oldState, newState) => {
    if (!kazagumo) return;
    const player = kazagumo.players.get(newState.guild.id);
    if (!player) return;
    if (oldState.member?.id === client.user.id && newState.channel === null) { player.destroy(); }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        if (oldState.channelId && !newState.channelId) await checkVoiceChannelAndCleanup(client, kazagumo, oldState.guild.id);
    } catch (error) { console.error('Error in voiceStateUpdate handler:', error.message); }
});

client.on('error',       (error) => { console.error('Discord client error:', error); });
client.on('disconnect',  ()      => { console.log('🔌 Discord client disconnected'); });
client.on('reconnecting',()      => { console.log('🔄 Discord client reconnecting...'); });
process.on('unhandledRejection', (error) => { console.error('Unhandled promise rejection:', error); });
process.on('uncaughtException',  (error) => { console.error('Uncaught exception:', error); });

async function gracefulShutdown(signal) {
    console.log(`\n${'='.repeat(60)}\n💾 GRACEFUL SHUTDOWN (${signal})\n${'='.repeat(60)}`);
    try { await saveConversations(); console.log('✅ Conversations saved'); } catch (e) { console.error('❌ Failed to save:', e); }
    process.exit(0);
}
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

client.login(process.env.DISCORD_TOKEN);