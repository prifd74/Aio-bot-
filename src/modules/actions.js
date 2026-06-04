

const axios = require('axios');
const {
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ThumbnailBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ComponentType,
    MessageFlags
} = require('discord.js');

const OWNER_ID       = '796001480406466601';
const SPECIAL_TARGET = '';

const ACTIONS_PER_PAGE = 10;

const ACTIONS = {
    hug: {
        verb: 'hugs', emoji: '🤗', color: 0xFF69B4, category: 'Affectionate',
        apis: [
            { provider: 'nekosbest', endpoint: 'hug' },
            { provider: 'otakugifs', endpoint: 'hug' },
            { provider: 'hmtai',     endpoint: 'hug' },
            { provider: 'nekoslife', endpoint: 'hug' },
        ],
    },
    kiss: {
        verb: 'kisses', emoji: '💋', color: 0xFF1493, category: 'Affectionate',
        apis: [
            { provider: 'nekosbest', endpoint: 'kiss' },
            { provider: 'otakugifs', endpoint: 'kiss' },
            { provider: 'hmtai',     endpoint: 'kiss' },
            { provider: 'nekoslife', endpoint: 'kiss' },
        ],
    },
    cuddle: {
        verb: 'cuddles', emoji: '💕', color: 0xFF69B4, category: 'Affectionate',
        apis: [
            { provider: 'nekosbest', endpoint: 'cuddle' },
            { provider: 'otakugifs', endpoint: 'cuddle' },
            { provider: 'hmtai',     endpoint: 'cuddle' },
            { provider: 'nekoslife', endpoint: 'cuddle' },
        ],
    },
    pat: {
        verb: 'pats', emoji: '🥰', color: 0xFFD700, category: 'Affectionate',
        apis: [
            { provider: 'nekosbest', endpoint: 'pat' },
            { provider: 'otakugifs', endpoint: 'pat' },
            { provider: 'hmtai',     endpoint: 'pat' },
            { provider: 'nekoslife', endpoint: 'pat' },
        ],
    },
    handhold: {
        verb: 'holds hands with', emoji: '🤝', color: 0xFFA07A, category: 'Affectionate',
        apis: [
            { provider: 'nekosbest', endpoint: 'handhold' },
            { provider: 'otakugifs', endpoint: 'handhold' },
        ],
    },
    nuzzle: {
        verb: 'nuzzles', emoji: '🐾', color: 0xFF69B4, category: 'Affectionate',
        apis: [
            { provider: 'nekosbest', endpoint: 'nuzzle' },
            { provider: 'otakugifs', endpoint: 'nuzzle' },
            { provider: 'hmtai',     endpoint: 'nuzzle' },
        ],
    },
    feed: {
        verb: 'feeds', emoji: '🍡', color: 0xFFB347, category: 'Affectionate',
        apis: [
            { provider: 'nekosbest', endpoint: 'feed' },
            { provider: 'otakugifs', endpoint: 'feed' },
            { provider: 'hmtai',     endpoint: 'feed' },
        ],
    },
    lick: {
        verb: 'licks', emoji: '👅', color: 0xFF6EB4, category: 'Affectionate',
        apis: [
            { provider: 'hmtai',     endpoint: 'lick' },
            { provider: 'otakugifs', endpoint: 'lick' },
            { provider: 'nekoslife', endpoint: 'lizard' },
        ],
    },
    nom: {
        verb: 'noms', emoji: '😋', color: 0xFFA500, category: 'Affectionate',
        apis: [
            { provider: 'nekosbest', endpoint: 'nom' },
            { provider: 'hmtai',     endpoint: 'nom' },
        ],
    },
    flirt: {
        verb: 'flirts with', emoji: '😏', color: 0xFF4081, category: 'Affectionate',
        apis: [
            { provider: 'otakugifs', endpoint: 'flirt' },
            { provider: 'hmtai',     endpoint: 'flirt' },
        ],
    },

    poke: {
        verb: 'pokes', emoji: '👉', color: 0x87CEEB, category: 'Playful',
        apis: [
            { provider: 'nekosbest', endpoint: 'poke' },
            { provider: 'otakugifs', endpoint: 'poke' },
            { provider: 'hmtai',     endpoint: 'poke' },
            { provider: 'nekoslife', endpoint: 'poke' },
        ],
    },
    boop: {
        verb: 'boops', emoji: '👆', color: 0xDDA0DD, category: 'Playful',
        apis: [
            { provider: 'nekosbest', endpoint: 'boop' },
        ],
    },
    tickle: {
        verb: 'tickles', emoji: '🤣', color: 0xFFEC8B, category: 'Playful',
        apis: [
            { provider: 'nekosbest', endpoint: 'tickle' },
            { provider: 'otakugifs', endpoint: 'tickle' },
            { provider: 'hmtai',     endpoint: 'tickle' },
        ],
    },
    wave: {
        verb: 'waves at', emoji: '👋', color: 0x98FB98, category: 'Playful',
        apis: [
            { provider: 'nekosbest', endpoint: 'wave' },
            { provider: 'otakugifs', endpoint: 'wave' },
            { provider: 'hmtai',     endpoint: 'wave' },
        ],
    },
    wink: {
        verb: 'winks at', emoji: '😉', color: 0xFFD700, category: 'Playful',
        apis: [
            { provider: 'nekosbest', endpoint: 'wink' },
            { provider: 'otakugifs', endpoint: 'wink' },
            { provider: 'hmtai',     endpoint: 'wink' },
        ],
    },
    highfive: {
        verb: 'high-fives', emoji: '🙌', color: 0x32CD32, category: 'Playful',
        apis: [
            { provider: 'nekosbest', endpoint: 'highfive' },
            { provider: 'otakugifs', endpoint: 'highfive' },
        ],
    },
    dance: {
        verb: 'dances with', emoji: '💃', color: 0xC71585, category: 'Playful',
        apis: [
            { provider: 'otakugifs', endpoint: 'dance' },
            { provider: 'hmtai',     endpoint: 'dance' },
            { provider: 'nekosbest', endpoint: 'dance' },
        ],
    },
    chase: {
        verb: 'chases', emoji: '🏃', color: 0xFF6347, category: 'Playful',
        apis: [
            { provider: 'otakugifs', endpoint: 'chase' },
            { provider: 'hmtai',     endpoint: 'run' },
        ],
    },
    yeet: {
        verb: 'yeets', emoji: '🤸', color: 0xFF4500, category: 'Playful',
        apis: [
            { provider: 'otakugifs', endpoint: 'yeet' },
            { provider: 'hmtai',     endpoint: 'throw' },
        ],
    },
    throw: {
        verb: 'throws something at', emoji: '🎯', color: 0xFF8C00, category: 'Playful',
        apis: [
            { provider: 'hmtai',     endpoint: 'throw' },
            { provider: 'otakugifs', endpoint: 'throw' },
        ],
    },

    blush: {
        verb: 'blushes at', emoji: '😊', color: 0xFFB6C1, category: 'Emotional',
        apis: [
            { provider: 'nekosbest', endpoint: 'blush' },
            { provider: 'otakugifs', endpoint: 'blush' },
            { provider: 'hmtai',     endpoint: 'blush' },
        ],
    },
    smile: {
        verb: 'smiles at', emoji: '😄', color: 0xFFD700, category: 'Emotional',
        apis: [
            { provider: 'nekosbest', endpoint: 'smile' },
            { provider: 'otakugifs', endpoint: 'smile' },
            { provider: 'hmtai',     endpoint: 'smile' },
        ],
    },
    stare: {
        verb: 'stares at', emoji: '👀', color: 0x9370DB, category: 'Emotional',
        apis: [
            { provider: 'nekosbest', endpoint: 'stare' },
            { provider: 'otakugifs', endpoint: 'stare' },
            { provider: 'hmtai',     endpoint: 'stare' },
        ],
    },
    cry: {
        verb: 'cries at', emoji: '😢', color: 0x4169E1, category: 'Emotional',
        apis: [
            { provider: 'nekosbest', endpoint: 'cry' },
            { provider: 'otakugifs', endpoint: 'cry' },
            { provider: 'hmtai',     endpoint: 'cry' },
        ],
    },
    laugh: {
        verb: 'laughs at', emoji: '😂', color: 0xFFD700, category: 'Emotional',
        apis: [
            { provider: 'otakugifs', endpoint: 'laugh' },
            { provider: 'hmtai',     endpoint: 'laugh' },
        ],
    },
    pout: {
        verb: 'pouts at', emoji: '😤', color: 0xFF6347, category: 'Emotional',
        apis: [
            { provider: 'nekosbest', endpoint: 'pout' },
            { provider: 'otakugifs', endpoint: 'pout' },
            { provider: 'hmtai',     endpoint: 'pout' },
        ],
    },
    panic: {
        verb: 'panics near', emoji: '😱', color: 0xFF0000, category: 'Emotional',
        apis: [
            { provider: 'hmtai',     endpoint: 'panic' },
            { provider: 'otakugifs', endpoint: 'panic' },
        ],
    },
    think: {
        verb: 'thinks about', emoji: '🤔', color: 0x778899, category: 'Emotional',
        apis: [
            { provider: 'hmtai',     endpoint: 'think' },
            { provider: 'otakugifs', endpoint: 'think' },
        ],
    },
    facepalm: {
        verb: 'facepalms at', emoji: '🤦', color: 0x808080, category: 'Emotional',
        apis: [
            { provider: 'otakugifs', endpoint: 'facepalm' },
            { provider: 'hmtai',     endpoint: 'facepalm' },
        ],
    },
    shrug: {
        verb: 'shrugs at', emoji: '🤷', color: 0xB8B8B8, category: 'Emotional',
        apis: [
            { provider: 'otakugifs', endpoint: 'shrug' },
            { provider: 'hmtai',     endpoint: 'shrug' },
        ],
    },

    slap: {
        verb: 'slaps', emoji: '👋', color: 0xFF4500, category: 'Aggressive',
        apis: [
            { provider: 'nekosbest', endpoint: 'slap' },
            { provider: 'otakugifs', endpoint: 'slap' },
            { provider: 'hmtai',     endpoint: 'slap' },
            { provider: 'nekoslife', endpoint: 'slap' },
        ],
    },
    bite: {
        verb: 'bites', emoji: '😬', color: 0xFF6347, category: 'Aggressive',
        apis: [
            { provider: 'nekosbest', endpoint: 'bite' },
            { provider: 'otakugifs', endpoint: 'bite' },
            { provider: 'hmtai',     endpoint: 'bite' },
        ],
    },
    punch: {
        verb: 'punches', emoji: '👊', color: 0xDC143C, category: 'Aggressive',
        apis: [
            { provider: 'nekosbest', endpoint: 'punch' },
            { provider: 'otakugifs', endpoint: 'punch' },
            { provider: 'hmtai',     endpoint: 'punch' },
        ],
    },
    kick: {
        verb: 'kicks', emoji: '🦵', color: 0xFF4500, category: 'Aggressive',
        apis: [
            { provider: 'nekosbest', endpoint: 'kick' },
            { provider: 'otakugifs', endpoint: 'kick' },
            { provider: 'hmtai',     endpoint: 'kick' },
        ],
    },
    shoot: {
        verb: 'shoots', emoji: '🔫', color: 0x708090, category: 'Aggressive',
        apis: [
            { provider: 'nekosbest', endpoint: 'shoot' },
            { provider: 'hmtai',     endpoint: 'shoot' },
        ],
    },
    bonk: {
        verb: 'bonks', emoji: '🔨', color: 0xD2691E, category: 'Aggressive',
        apis: [
            { provider: 'otakugifs', endpoint: 'bonk' },
            { provider: 'hmtai',     endpoint: 'bonk' },
        ],
    },
    stab: {
        verb: 'stabs', emoji: '🗡️', color: 0x8B0000, category: 'Aggressive',
        apis: [
            { provider: 'hmtai',     endpoint: 'stab' },
            { provider: 'otakugifs', endpoint: 'stab' },
        ],
    },
    bully: {
        verb: 'bullies', emoji: '😈', color: 0x4B0082, category: 'Aggressive',
        apis: [
            { provider: 'hmtai',     endpoint: 'bully' },
            { provider: 'otakugifs', endpoint: 'bully' },
        ],
    },

    greet: {
        verb: 'greets', emoji: '👋', color: 0x32CD32, category: 'Greeting',
        apis: [
            { provider: 'otakugifs', endpoint: 'greet' },
            { provider: 'hmtai',     endpoint: 'greet' },
        ],
    },
    salute: {
        verb: 'salutes', emoji: '🫡', color: 0x4169E1, category: 'Greeting',
        apis: [
            { provider: 'hmtai',     endpoint: 'salute' },
            { provider: 'otakugifs', endpoint: 'salute' },
        ],
    },
    handshake: {
        verb: 'shakes hands with', emoji: '🤜', color: 0xA0522D, category: 'Greeting',
        apis: [
            { provider: 'hmtai',     endpoint: 'handshake' },
            { provider: 'otakugifs', endpoint: 'handshake' },
        ],
    },
    bow: {
        verb: 'bows to', emoji: '🙇', color: 0x9370DB, category: 'Greeting',
        apis: [
            { provider: 'nekosbest', endpoint: 'bow' },
            { provider: 'otakugifs', endpoint: 'bow' },
            { provider: 'hmtai',     endpoint: 'bow' },
        ],
    },
};

async function fetchActionGif(apis) {
    for (const { provider, endpoint } of apis) {
        try {
            let url = null;

            if (provider === 'nekosbest') {
                const res = await axios.get(
                    `https://nekos.best/api/v2/${endpoint}?amount=1`,
                    { timeout: 8000 }
                );
                url = res.data?.results?.[0]?.url;
            }

            else if (provider === 'otakugifs') {
                const res = await axios.get(
                    `https://api.otakugifs.xyz/gif?reaction=${endpoint}`,
                    { timeout: 8000 }
                );
                url = res.data?.url;
            }

            else if (provider === 'nekoslife') {
                const res = await axios.get(
                    `https://nekos.life/api/v2/img/${endpoint}`,
                    { timeout: 8000 }
                );
                url = res.data?.url;
            }

            else if (provider === 'hmtai') {
                const res = await axios.get(
                    `https://hmtai.hatsunia.de/v2/${endpoint}`,
                    { timeout: 8000 }
                );
                url = res.data?.url;
            }

            else if (provider === 'purrbot') {
                const res = await axios.get(
                    `https://purrbot.site/api/img/sfw/${endpoint}/gif`,
                    { timeout: 8000 }
                );
                url = res.data?.link;
            }

            if (url) return url;

        } catch (_) {
        }
    }

    return null;
}

function buildActionListComponent(page = 0) {
    const categories = {};
    for (const [name, info] of Object.entries(ACTIONS)) {
        const cat = info.category || 'Other';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push({ name, info });
    }

    const allPages = [];
    let currentPageLines = [];
    let currentCat = null;
    let lineCount = 0;

    for (const [cat, entries] of Object.entries(categories)) {
        if (lineCount + 1 + entries.length > ACTIONS_PER_PAGE && currentPageLines.length > 0) {
            allPages.push(currentPageLines.join('\n'));
            currentPageLines = [];
            lineCount = 0;
            currentCat = null;
        }

        if (currentCat !== cat) {
            currentPageLines.push(`\n**${getCategoryEmoji(cat)} ${cat}**`);
            lineCount++;
            currentCat = cat;
        }

        for (const { name, info } of entries) {
            currentPageLines.push(`${info.emoji} \`${name}\``);
            lineCount++;

            if (lineCount >= ACTIONS_PER_PAGE) {
                allPages.push(currentPageLines.join('\n'));
                currentPageLines = [];
                lineCount = 0;
                currentCat = null;
            }
        }
    }

    if (currentPageLines.length > 0) allPages.push(currentPageLines.join('\n'));

    const totalPages = allPages.length;
    const safePage   = Math.max(0, Math.min(page, totalPages - 1));
    const pageContent = allPages[safePage] ?? '*No actions on this page.*';

    const container = new ContainerBuilder().setAccentColor(0xFF69B4);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## 🎌 Anime Action Commands`)
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(1)
    );
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `**Usage:** \`l.action <action> @user\`\n${pageContent}`
        )
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(1)
    );
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `-# 📄 Page ${safePage + 1} / ${totalPages}  •  ${Object.keys(ACTIONS).length} total actions  •  Umbra X Development`
        )
    );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`action_list_prev_${safePage}`)
            .setLabel('◀ Prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(safePage === 0),
        new ButtonBuilder()
            .setCustomId(`action_list_next_${safePage}`)
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(safePage >= totalPages - 1)
    );

    return {
        components: [container, row],
        flags: MessageFlags.IsComponentsV2,
        _meta: { page: safePage, totalPages },
    };
}

function getCategoryEmoji(category) {
    const map = {
        'Affectionate': '💖',
        'Playful':      '🎮',
        'Emotional':    '🎭',
        'Aggressive':   '⚔️',
        'Greeting':     '🤝',
        'Other':        '✨',
    };
    return map[category] || '✨';
}

async function attachPaginationCollector(message, reply) {
    const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120_000, 

        filter: (i) => i.user.id === message.author.id,
    });

    collector.on('collect', async (interaction) => {
        const [, , , dirRaw, pageRaw] = interaction.customId.split('_');
        const parts       = interaction.customId.split('_');
        const dir         = parts[2]; 
        const currentPage = parseInt(parts[3], 10);
        const newPage     = dir === 'next' ? currentPage + 1 : currentPage - 1;

        const built = buildActionListComponent(newPage);
        await interaction.update({
            components: built.components,
            flags: built.flags,
        });
    });

    collector.on('end', async () => {
        try {
            const built = buildActionListComponent(0);
            const row   = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('action_list_prev_0')
                    .setLabel('◀ Prev')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('action_list_next_0')
                    .setLabel('Next ▶')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
            built.components[1] = row;
            await reply.edit({ components: built.components });
        } catch (_) {}
    });
}

function buildActionComponent(sender, target, gifUrl, actionInfo) {
    const container = new ContainerBuilder().setAccentColor(actionInfo.color);

    const headerSection = new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## ${actionInfo.emoji} ${sender.displayName || sender.username} ${actionInfo.verb} ${target.displayName || target.username}!`
            )
        )
        .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(sender.displayAvatarURL({ size: 128 }))
        );
    container.addSectionComponents(headerSection);

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(1)
    );

    if (gifUrl) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(gifUrl)
                    .setDescription(`${sender.username} ${actionInfo.verb} ${target.username}`)
            )
        );
        container.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(1)
        );
    }

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `-# 💫 <@${sender.id}> ${actionInfo.verb} <@${target.id}> • Umbra X Development`
        )
    );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

async function buildRejectionComponent(sender, target) {
    const gifUrl = await fetchActionGif(ACTIONS.slap.apis).catch(() => null);

    const container = new ContainerBuilder().setAccentColor(0xFF4500);

    const headerSection = new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## 🚫 Hands off!`)
        )
        .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(target.displayAvatarURL({ size: 128 }))
        );
    container.addSectionComponents(headerSection);

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(1)
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `<@${sender.id}>, this person is **taken** 💢\n\nGo find your **own** girlfriend and use these commands on them!\nThis one's off-limits to everyone except their special someone 😤`
        )
    );

    if (gifUrl) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(gifUrl)
                    .setDescription('Rejected!')
            )
        );
    }

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(1)
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# 🚫 Action blocked • Umbra X Development`)
    );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildUsageHintComponent(actionName, actionInfo) {
    const container = new ContainerBuilder().setAccentColor(actionInfo.color);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ${actionInfo.emoji} \`l.action ${actionName}\`\n\nYou need to mention someone!\n\n**Usage:** \`l.action ${actionName} @user\``
        )
    );
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildUnknownActionComponent(tried) {
    const container = new ContainerBuilder().setAccentColor(0xFF4500);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ❓ Unknown action \`${tried}\`\n\nType \`l.action\` to see the full list of available actions!`
        )
    );
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

async function handleActionCommand(message) {
    try {
        const rawAfterPrefix = message.content.trim().slice('l.action'.length).trim();
        const args           = rawAfterPrefix.split(/\s+/).filter(Boolean);
        const actionName     = args[0]?.toLowerCase() ?? null;

        if (!actionName) {
            const built = buildActionListComponent(0);
            const reply = await message.reply(built);
            await attachPaginationCollector(message, reply);
            return;
        }

        const actionInfo = ACTIONS[actionName] ?? null;
        if (!actionInfo) {
            await message.reply(buildUnknownActionComponent(actionName));
            return;
        }

        const target = message.mentions.users.first() ?? null;
        if (!target) {
            await message.reply(buildUsageHintComponent(actionName, actionInfo));
            return;
        }

        const sender = message.author;

        if (target.id === SPECIAL_TARGET && sender.id !== OWNER_ID) {
            await message.reply(await buildRejectionComponent(sender, target));
            return;
        }

        await message.channel.sendTyping();
        const gifUrl = await fetchActionGif(actionInfo.apis);

        await message.reply(buildActionComponent(sender, target, gifUrl, actionInfo));

    } catch (error) {
        console.error('Action command error:', error.message);
        try {
            const container = new ContainerBuilder().setAccentColor(0xFF0000);
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## ❌ Something went wrong\nCouldn't perform that action right now — try again in a moment!`
                )
            );
            await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        } catch (_) {}
    }
}

module.exports = { handleActionCommand, ACTIONS };