

const axios = require('axios');
const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');

const COOLDOWN_MS     = 30 * 1000;
const VOTE_DURATION   = 1 * 60 * 1000;
const WAIFU_API_URL   = 'https://api.waifu.im/images';
const NSFW_CHANNEL_ID = '1485271528378732564';

const SFW_TAGS = ['waifu', 'maid', 'uniform', 'selfies', 'genshin-impact', 'raiden-shogun', 'marin-kitagawa', 'mori-calliope', 'kamisato-ayaka'];

const NSFW_TAGS = ['waifu', 'maid', 'uniform', 'selfies', 'ero', 'ecchi', 'oppai', 'hentai', 'milf', 'ass', 'oral', 'paizuri', 'genshin-impact', 'raiden-shogun', 'marin-kitagawa'];

const FALLBACK_SOURCES = [
    { url: 'https://api.waifu.pics/sfw/waifu',   path: 'url' },
    { url: 'https://api.waifu.pics/sfw/neko',    path: 'url' },
    { url: 'https://api.waifu.pics/sfw/shinobu', path: 'url' },
    { url: 'https://api.waifu.pics/sfw/megumin', path: 'url' },
    { url: 'https://api.waifu.pics/sfw/cuddle',  path: 'url' },
    { url: 'https://api.waifu.pics/sfw/hug',     path: 'url' },
    { url: 'https://api.waifu.pics/sfw/pat',     path: 'url' },
    { url: 'https://api.waifu.pics/sfw/kiss',    path: 'url' },
    { url: 'https://nekos.best/api/v2/waifu',    path: 'results.0.url' },
    { url: 'https://nekos.best/api/v2/neko',     path: 'results.0.url' },
    { url: 'https://nekos.best/api/v2/kitsune',  path: 'results.0.url' },
];

const NSFW_FALLBACK_SOURCES = [
    { url: 'https://api.waifu.pics/nsfw/hentai', path: 'url' },
    { url: 'https://api.waifu.pics/nsfw/ass',  path: 'url' },
    { url: 'https://api.waifu.pics/nsfw/oral',  path: 'url' },
];

const cooldowns   = new Map(); 

const activePolls = new Map(); 

function resolvePath(obj, pathStr) {
    return pathStr.split('.').reduce((acc, key) => acc?.[key], obj);
}

async function tryWaifuIm(tag, nsfwParam) {
    const params = { IsNsfw: nsfwParam };
    if (tag) params.IncludedTags = tag;
    const response = await axios.get(WAIFU_API_URL, {
        params,
        timeout: 8000,
        headers: { 'User-Agent': 'LunaDiscordBot/1.0' }
    });
    const item = response.data?.items?.[0];
    if (!item) return null;
    return { url: item.url, tag: tag || 'waifu', isNsfw: item.isNsfw };
}

async function tryFallback(source) {
    const response = await axios.get(source.url, {
        timeout: 8000,
        headers: { 'User-Agent': 'LunaDiscordBot/1.0' }
    });
    const url = resolvePath(response.data, source.path);
    if (!url || typeof url !== 'string') return null;
    return { url, tag: 'waifu', isNsfw: source.url.includes('nsfw') };
}

async function fetchWaifuImage(isNsfwChannel = false) {
    const tagPool   = isNsfwChannel ? NSFW_TAGS : SFW_TAGS;
    const nsfwParam = isNsfwChannel ? Math.random() < 0.5 : false;
    const shuffled  = [...tagPool].sort(() => Math.random() - 0.5);

    

    for (let i = 0; i < Math.min(4, shuffled.length); i++) {
        try {
            const result = await tryWaifuIm(shuffled[i], nsfwParam);
            if (result) { console.log('✅ [Waifu] waifu.im tag:' + shuffled[i]); return result; }
        } catch (e) { console.warn('⚠️ [Waifu] waifu.im tag "' + shuffled[i] + '" failed: ' + e.message); }
    }

    

    try {
        const result = await tryWaifuIm(null, nsfwParam);
        if (result) { console.log('✅ [Waifu] waifu.im no-tag fallback'); return result; }
    } catch (e) { console.warn('⚠️ [Waifu] waifu.im no-tag failed: ' + e.message); }

    

    for (let i = 4; i < shuffled.length; i++) {
        try {
            const result = await tryWaifuIm(shuffled[i], nsfwParam);
            if (result) { console.log('✅ [Waifu] waifu.im tag:' + shuffled[i] + ' (deep retry)'); return result; }
        } catch (e) { console.warn('⚠️ [Waifu] waifu.im tag "' + shuffled[i] + '" failed: ' + e.message); }
    }

    

    const fallbacks = isNsfwChannel
        ? [...NSFW_FALLBACK_SOURCES, ...FALLBACK_SOURCES]
        : FALLBACK_SOURCES;
    const shuffledFallbacks = [...fallbacks].sort(() => Math.random() - 0.5);

    for (const source of shuffledFallbacks) {
        try {
            const result = await tryFallback(source);
            if (result) { console.log('✅ [Waifu] fallback: ' + source.url); return result; }
        } catch (e) { console.warn('⚠️ [Waifu] fallback ' + source.url + ' failed: ' + e.message); }
    }

    console.error('❌ [Waifu] All strategies exhausted');
    return null;
}

function buildVoteBar(smash, pass) {
    const total = smash + pass;
    if (total === 0) return '`[░░░░░░░░░░]`  No votes yet!';

    const smashBlocks = Math.round((smash / total) * 10);
    const passBlocks  = 10 - smashBlocks;
    const smashPerc   = Math.round((smash / total) * 100);
    const passPerc    = 100 - smashPerc;

    return `🔥 \`${smashPerc}%\` ${'🟥'.repeat(smashBlocks)}${'🟦'.repeat(passBlocks)} \`${passPerc}%\` 💀`;
}

function buildWaifuComponent(waifuData, pollData, timeLeft = VOTE_DURATION) {
    const { url, tag, isNsfw }        = waifuData;
    const { smashVoters, passVoters } = pollData;
    const smashCount = smashVoters.size;
    const passCount  = passVoters.size;
    const totalVotes = smashCount + passCount;
    const secsLeft   = Math.ceil(Math.max(0, timeLeft) / 1000);

    const container = new ContainerBuilder().setAccentColor(0xFF69B4);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## 🌸 Waifu of the Moment${isNsfw ? '  🔞' : ''}\n` +
            `*Tag: \`${tag}\`*`
        )
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(1)
    );

    container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(url).setDescription('Waifu image')
        )
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(1)
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## 🗳️ Smash or Pass?\n` +
            `${buildVoteBar(smashCount, passCount)}\n\n` +
            `🔥 **Smash** — \`${smashCount}\`  ·  💀 **Pass** — \`${passCount}\`  ·  👥 **Total** — \`${totalVotes}\`\n` +
            `⏳ Voting closes in \`${secsLeft}s\`  ·  *Click again to undo your vote*`
        )
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(1)
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `-# 🌸 Powered by Luna  ·  One vote per user`
        )
    );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildResultsComponent(waifuData, pollData) {
    const { url, tag, isNsfw }        = waifuData;
    const { smashVoters, passVoters } = pollData;
    const smashCount = smashVoters.size;
    const passCount  = passVoters.size;
    const totalVotes = smashCount + passCount;

    let verdict, color;
    if (totalVotes === 0) {
        verdict = `🤷 **NO VOTES!** Nobody had the courage to judge her.`;
        color   = 0x808080;
    } else if (smashCount > passCount) {
        verdict = `🔥 **SMASH WINS!** The community has spoken — she's a smash!`;
        color   = 0xFF4500;
    } else if (passCount > smashCount) {
        verdict = `💀 **PASS WINS!** The community passed on this one.`;
        color   = 0x4169E1;
    } else {
        verdict = `⚖️ **TIE!** The community is completely split!`;
        color   = 0xFFD700;
    }

    const container = new ContainerBuilder().setAccentColor(color);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## 🏁 Voting Closed${isNsfw ? '  🔞' : ''} — Final Results`
        )
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(1)
    );

    container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(url).setDescription('Waifu image')
        )
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(1)
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `${verdict}\n\n` +
            `${buildVoteBar(smashCount, passCount)}\n\n` +
            `🔥 **Smash** — \`${smashCount}\`  ·  💀 **Pass** — \`${passCount}\`  ·  👥 **Total** — \`${totalVotes}\`\n` +
            `*Tag: \`${tag}\`*`
        )
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(1)
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `-# 🌸 Powered by Luna  ·  Voting has ended`
        )
    );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildVoteButtons(messageId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`waifu_smash_${messageId}`)
            .setLabel('🔥  Smash')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`waifu_pass_${messageId}`)
            .setLabel('💀  Pass')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled)
    );
}

async function closePoll(messageId, sentMessage, waifuData) {
    const poll = activePolls.get(messageId);
    if (!poll) return;

    activePolls.delete(messageId);

    try {
        const resultsPayload = buildResultsComponent(waifuData, poll);
        const disabledRow    = buildVoteButtons(messageId, true);
        await sentMessage.edit({
            ...resultsPayload,
            components: [...resultsPayload.components, disabledRow]
        });
    } catch (error) {
        console.error('❌ [Waifu] Failed to close poll:', error.message);
    }
}

async function handleWaifuButton(interaction) {
    const { customId, user, message } = interaction;

    if (!customId.startsWith('waifu_smash_') && !customId.startsWith('waifu_pass_')) return false;

    const isSmash   = customId.startsWith('waifu_smash_');
    const messageId = isSmash
        ? customId.slice('waifu_smash_'.length)
        : customId.slice('waifu_pass_'.length);

    const poll = activePolls.get(messageId);

    if (!poll) {
        await interaction.reply({ content: '⌛ This poll has already expired!', ephemeral: true });
        return true;
    }

    const userId       = user.id;
    const alreadySmash = poll.smashVoters.has(userId);
    const alreadyPass  = poll.passVoters.has(userId);

    if (isSmash) {
        if (alreadySmash) {
            poll.smashVoters.delete(userId);
            await interaction.reply({ content: '🔥 Removed your **Smash** vote!', ephemeral: true });
        } else {
            poll.passVoters.delete(userId);
            poll.smashVoters.add(userId);
            await interaction.reply({ content: '🔥 You voted **Smash**!', ephemeral: true });
        }
    } else {
        if (alreadyPass) {
            poll.passVoters.delete(userId);
            await interaction.reply({ content: '💀 Removed your **Pass** vote!', ephemeral: true });
        } else {
            poll.smashVoters.delete(userId);
            poll.passVoters.add(userId);
            await interaction.reply({ content: '💀 You voted **Pass**!', ephemeral: true });
        }
    }

    

    const timeLeft = poll.expiresAt - Date.now();
    try {
        const updatedPayload = buildWaifuComponent(poll.waifuData, poll, timeLeft);
        const voteButtons    = buildVoteButtons(messageId);
        await message.edit({
            ...updatedPayload,
            components: [...updatedPayload.components, voteButtons]
        });
    } catch (err) {
        console.error('❌ [Waifu] Failed to update vote display:', err.message);
    }

    return true;
}

async function handleWaifuCommand(message) {
    const userId        = message.author.id;
    const isNsfwChannel = message.channel.id === NSFW_CHANNEL_ID;
    const now           = Date.now();

    

    const lastUsed = cooldowns.get(userId);
    if (lastUsed && now - lastUsed < COOLDOWN_MS) {
        const remaining = Math.ceil((COOLDOWN_MS - (now - lastUsed)) / 1000);
        await message.reply({
            content: `⏳ Slow down! You can use \`l.waifu\` again in **${remaining}s**~`,
            allowedMentions: { repliedUser: false }
        });
        return;
    }

    cooldowns.set(userId, now);

    

    await message.channel.sendTyping();
    const waifuData = await fetchWaifuImage(isNsfwChannel);

    if (!waifuData) {
        cooldowns.delete(userId); 

        await message.reply({
            content: '❌ Couldn\'t fetch a waifu right now — the API might be having issues. Try again!',
            allowedMentions: { repliedUser: false }
        });
        return;
    }

    

    const pollData = {
        smashVoters: new Set(),
        passVoters:  new Set(),
        waifuData,
        expiresAt:   now + VOTE_DURATION
    };

    

    const initialPayload = buildWaifuComponent(waifuData, pollData, VOTE_DURATION);
    const placeholderRow = buildVoteButtons('placeholder');

    let sentMessage;
    try {
        sentMessage = await message.reply({
            ...initialPayload,
            components: [...initialPayload.components, placeholderRow],
            allowedMentions: { repliedUser: false }
        });
    } catch (err) {
        console.error('❌ [Waifu] Failed to send message:', err.message);
        cooldowns.delete(userId);
        return;
    }

    

    const realId = sentMessage.id;
    activePolls.set(realId, pollData);

    try {
        const correctPayload = buildWaifuComponent(waifuData, pollData, VOTE_DURATION);
        const correctButtons = buildVoteButtons(realId);
        await sentMessage.edit({
            ...correctPayload,
            components: [...correctPayload.components, correctButtons]
        });
    } catch (_) {}

    

    setTimeout(async () => {
        if (!activePolls.has(realId)) return;
        try {
            const poll        = activePolls.get(realId);
            const timeLeft    = poll.expiresAt - Date.now();
            const midPayload  = buildWaifuComponent(waifuData, poll, timeLeft);
            const midButtons  = buildVoteButtons(realId);
            await sentMessage.edit({
                ...midPayload,
                components: [...midPayload.components, midButtons]
            });
        } catch (_) {}
    }, VOTE_DURATION / 2);

    

    setTimeout(() => closePoll(realId, sentMessage, waifuData), VOTE_DURATION);
}

module.exports = { handleWaifuCommand, handleWaifuButton };
