
const {
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ThumbnailBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags
} = require('discord.js');

function formatNumber(n) {
    if (!n && n !== 0) return '0';
    return n.toLocaleString();
}

function timeAgo(date) {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60)  return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)  return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)    return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30)     return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12)   return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
}

function discordTimestamp(date, format = 'F') {
    return `<t:${Math.floor(date.getTime() / 1000)}:${format}>`;
}

function getBoostLevel(tier) {
    const levels = { 0: 'None', 1: 'Level 1 🥉', 2: 'Level 2 🥈', 3: 'Level 3 🥇' };
    return levels[tier] || 'None';
}

function getVerificationLevel(level) {
    const levels = { 0: 'None', 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Very High' };
    return levels[level] ?? 'Unknown';
}

function getStatusEmoji(status) {
    const map = { online: '🟢', idle: '🟡', dnd: '🔴', offline: '⚫', invisible: '⚫' };
    return map[status] || '👤';
}

function getRoleColor(role) {
    if (!role || role.color === 0) return null;
    return `#${role.color.toString(16).padStart(6, '0').toUpperCase()}`;
}

function getActivityType(type) {
    const map = { 0: '🎮 Playing', 1: '📺 Streaming', 2: '🎵 Listening to', 3: '👀 Watching', 4: '', 5: '🏆 Competing in' };
    return map[type] ?? '📌';
}

async function handleServerInfo(message) {
    const guild = message.guild;
    if (!guild) {
        await message.reply({ content: '❌ This command only works in a server!', allowedMentions: { repliedUser: false } });
        return;
    }

    await message.channel.sendTyping();

    await guild.fetch();
    try { await guild.members.fetch(); } catch (_) {}

    const totalMembers = guild.memberCount;
    const botCount     = guild.members.cache.filter(m => m.user.bot).size;
    const humanCount   = totalMembers - botCount;

    const presenceAvailable = guild.members.cache.some(m => m.presence !== null && m.presence !== undefined);
    const onlineCount = presenceAvailable
        ? guild.members.cache.filter(m => m.presence?.status && m.presence.status !== 'offline').size
        : null;

    const textChannels  = guild.channels.cache.filter(c => c.type === 0).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
    const categories    = guild.channels.cache.filter(c => c.type === 4).size;
    const threads       = guild.channels.cache.filter(c => [11, 12].includes(c.type)).size;
    const totalChannels = guild.channels.cache.size;
    const stageChannels = guild.channels.cache.filter(c => c.type === 13).size;
    const forumChannels = guild.channels.cache.filter(c => c.type === 15).size;

    const roleCount = guild.roles.cache.size - 1; 
    const topRole   = guild.roles.cache
        .filter(r => r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .first();

    const emojiCount    = guild.emojis.cache.size;
    const animatedEmoji = guild.emojis.cache.filter(e => e.animated).size;
    const staticEmoji   = emojiCount - animatedEmoji;
    const stickerCount  = guild.stickers?.cache?.size ?? 0;

    const boostCount = guild.premiumSubscriptionCount || 0;
    const boostTier  = getBoostLevel(guild.premiumTier);

    const owner = await guild.fetchOwner().catch(() => null);

    const iconUrl   = guild.iconURL({ size: 256, extension: 'png' }) || null;
    const bannerUrl = guild.bannerURL({ size: 1024 }) || null;

    const niceFeatures = guild.features
        .map(f => f.toLowerCase().replace(/_/g, ' '))
        .filter(f => !['community', 'guild_onboarding', 'guild_onboarding_ever_enabled'].includes(f))
        .slice(0, 8)
        .join(', ');

    

    const container = new ContainerBuilder().setAccentColor(0xFF69B4);

    

    const headerSection = new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## 🏰 ${guild.name}\n` +
                `**ID** — \`${guild.id}\`\n` +
                `**Owner** — ${owner ? `<@${owner.id}>` : `\`${guild.ownerId}\``}\n` +
                `**Created** — ${discordTimestamp(guild.createdAt)} (${timeAgo(guild.createdAt)})\n` +
                `**Description** — ${guild.description || '*None*'}`
            )
        );
    if (iconUrl) headerSection.setThumbnailAccessory(new ThumbnailBuilder().setURL(iconUrl));
    container.addSectionComponents(headerSection);

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));

    

    const onlineLine = onlineCount !== null
        ? `\n**Online** — \`${formatNumber(onlineCount)}\``
        : `\n**Online** — \`N/A\` *(enable GuildPresences intent)*`;

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `### 👥 Members\n` +
            `**Total** — \`${formatNumber(totalMembers)}\`  ·  ` +
            `**Humans** — \`${formatNumber(humanCount)}\`  ·  ` +
            `**Bots** — \`${formatNumber(botCount)}\`` +
            onlineLine
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(1));

    

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `### 💬 Channels\n` +
            `**Total** — \`${formatNumber(totalChannels)}\`  ·  ` +
            `**Text** — \`${formatNumber(textChannels)}\`  ·  ` +
            `**Voice** — \`${formatNumber(voiceChannels)}\`\n` +
            `**Categories** — \`${formatNumber(categories)}\`  ·  ` +
            `**Threads** — \`${formatNumber(threads)}\`` +
            (stageChannels > 0 ? `  ·  **Stage** — \`${formatNumber(stageChannels)}\`` : '') +
            (forumChannels > 0 ? `  ·  **Forums** — \`${formatNumber(forumChannels)}\`` : '')
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(1));

    

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `### 🎭 Roles & Emojis\n` +
            `**Roles** — \`${formatNumber(roleCount)}\`  ·  ` +
            `**Top Role** — ${topRole ? `<@&${topRole.id}>` : '`None`'}\n` +
            `**Emojis** — \`${formatNumber(emojiCount)}\` ` +
            `(\`${staticEmoji}\` static · \`${animatedEmoji}\` animated)  ·  ` +
            `**Stickers** — \`${formatNumber(stickerCount)}\``
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(1));

    

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `### 🚀 Boosts & Security\n` +
            `**Boost Tier** — \`${boostTier}\`  ·  **Boosts** — \`${formatNumber(boostCount)}\`\n` +
            `**Verification** — \`${getVerificationLevel(guild.verificationLevel)}\`  ·  ` +
            `**NSFW Level** — \`${guild.nsfwLevel}\`  ·  ` +
            `**2FA Required** — \`${guild.mfaLevel === 1 ? 'Yes' : 'No'}\``
        )
    );

    

    if (niceFeatures) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(1));
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### ✨ Features\n\`${niceFeatures}\``)
        );
    }

    

    if (bannerUrl) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(bannerUrl).setDescription('Server banner')
            )
        );
    }

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `-# 🏰 ${guild.name}  ·  ${discordTimestamp(new Date(), 'T')}`
        )
    );

    await message.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false }
    });
}

async function handleUserInfo(message) {
    const guild = message.guild;

    await message.channel.sendTyping();

    

    const targetUser = message.mentions.users.first() || message.author;

    

    let fetchedUser;
    try {
        fetchedUser = await message.client.users.fetch(targetUser.id, { force: true });
    } catch {
        fetchedUser = targetUser;
    }

    

    if (guild) { try { await guild.members.fetch(); } catch (_) {} }

    

    let member = null;
    if (guild) {
        try { member = await guild.members.fetch(targetUser.id); } catch {  }
    }

    

    const avatarUrl = fetchedUser.displayAvatarURL({ size: 256, extension: 'png' });
    const bannerUrl = fetchedUser.bannerURL?.({ size: 1024 }) || null;

    

    const presence     = member?.presence ?? null;
    const status       = presence?.status ?? null;
    const statusEmoji  = status ? getStatusEmoji(status) : '👤';
    const activities   = presence?.activities ?? [];
    

    const mainActivity = activities.find(a => a.type !== 4) ?? null;
    const customStatus = activities.find(a => a.type === 4) ?? null;

    

    const roles = member?.roles.cache
        .filter(r => r.id !== guild?.id)
        .sort((a, b) => b.position - a.position) ?? null;
    const topRole    = roles?.first() ?? null;
    const roleColor  = getRoleColor(topRole);
    const accentColor = topRole?.color || 0xFF69B4;

    const roleList = roles?.size > 0
        ? [...roles.values()].slice(0, 10).map(r => `<@&${r.id}>`).join(' ')
        : 'None';
    const roleMore = (roles?.size ?? 0) > 10 ? ` *(+${roles.size - 10} more)*` : '';

    

    const KEY_PERMS = [
        ['Administrator',    'Administrator'],
        ['ManageGuild',      'Manage Server'],
        ['ManageMessages',   'Manage Messages'],
        ['ManageMembers',    'Manage Members'],
        ['BanMembers',       'Ban Members'],
        ['KickMembers',      'Kick Members'],
        ['MentionEveryone',  'Mention Everyone'],
        ['ManageChannels',   'Manage Channels'],
        ['ManageRoles',      'Manage Roles'],
        ['ManageWebhooks',   'Manage Webhooks'],
        ['ModerateMembers',  'Timeout Members'],
    ];
    const keyPerms = member
        ? KEY_PERMS.filter(([perm]) => member.permissions.has(perm)).map(([, label]) => label)
        : [];

    

    let acknowledgement = 'Member';
    if (fetchedUser.id === guild?.ownerId)                  acknowledgement = '👑 Server Owner';
    else if (member?.permissions.has('Administrator'))      acknowledgement = '🛡️ Administrator';
    else if (member?.permissions.has('ManageGuild'))        acknowledgement = '⚙️ Server Manager';
    else if (member?.permissions.has('ModerateMembers') ||
             member?.permissions.has('KickMembers'))        acknowledgement = '🔨 Moderator';
    else if (fetchedUser.bot)                               acknowledgement = '🤖 Bot';

    

    const flags   = fetchedUser.flags?.toArray() || [];
    const badgeMap = {
        Staff:                   '👨‍💼 Discord Staff',
        Partner:                 '🤝 Partner',
        Hypesquad:               '🏠 HypeSquad Events',
        HypeSquadOnlineHouse1:   '🏠 Bravery',
        HypeSquadOnlineHouse2:   '🏠 Brilliance',
        HypeSquadOnlineHouse3:   '🏠 Balance',
        BugHunterLevel1:         '🐛 Bug Hunter',
        BugHunterLevel2:         '🐛 Bug Hunter Gold',
        VerifiedBotDeveloper:    '👨‍💻 Verified Developer',
        ActiveDeveloper:         '👨‍💻 Active Developer',
        PremiumEarlySupporter:   '⭐ Early Supporter',
    };
    const badges = flags.map(f => badgeMap[f]).filter(Boolean);

    const displayName = member?.displayName || fetchedUser.username;

    

    const container = new ContainerBuilder().setAccentColor(accentColor);

    

    const headerSection = new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## ${statusEmoji} ${displayName}\n` +
                `**Username** — \`${fetchedUser.username}\`\n` +
                (member?.nickname ? `**Nickname** — \`${member.nickname}\`\n` : '') +
                `**ID** — \`${fetchedUser.id}\`\n` +
                `**Type** — \`${acknowledgement}\`` +
                (fetchedUser.bot ? `\n**Bot** — \`Yes\`` : '')
            )
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl));
    container.addSectionComponents(headerSection);

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));

    

    let datesContent =
        `### 📅 Dates\n` +
        `**Account Created** — ${discordTimestamp(fetchedUser.createdAt)} (${timeAgo(fetchedUser.createdAt)})`;
    if (member?.joinedAt) {
        datesContent += `\n**Joined Server** — ${discordTimestamp(member.joinedAt)} (${timeAgo(member.joinedAt)})`;
    }
    if (member?.premiumSince) {
        datesContent += `\n**Boosting Since** — ${discordTimestamp(member.premiumSince)} 🚀`;
    }
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(datesContent));

    

    if (status || customStatus || mainActivity) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(1));
        let presenceContent = `### ${statusEmoji} Presence\n`;
        if (status) presenceContent += `**Status** — \`${status}\`\n`;
        if (customStatus?.state) presenceContent += `**Custom Status** — ${customStatus.state}\n`;
        if (mainActivity) {
            const aType = getActivityType(mainActivity.type);
            presenceContent += `**${aType}** — ${mainActivity.name}`;
            if (mainActivity.details) presenceContent += `\n*${mainActivity.details}*`;
        }
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(presenceContent.trim()));
    }

    

    if (badges.length > 0) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(1));
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### 🏅 Badges\n${badges.join('  ·  ')}`
            )
        );
    }

    

    if (roles !== null && roles.size > 0) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(1));
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### 🎭 Roles (${roles.size})\n${roleList}${roleMore}` +
                (roleColor ? `\n**Colour** — \`${roleColor}\`` : '')
            )
        );
    }

    

    if (keyPerms.length > 0) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(1));
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### 🔐 Key Permissions\n\`${keyPerms.join('  ·  ')}\``
            )
        );
    }

    

    if (bannerUrl) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(bannerUrl)
                    .setDescription(`${displayName}'s banner`)
            )
        );
    }

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `-# 👤 ${fetchedUser.username}  ·  ${discordTimestamp(new Date(), 'T')}`
        )
    );

    await message.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false }
    });
}

async function handleInfoCommand(message) {
    const content = message.content.toLowerCase().trim();
    try {
        if (content.startsWith('l.serverinfo')) {
            await handleServerInfo(message);
        } else if (content.startsWith('l.userinfo')) {
            await handleUserInfo(message);
        }
    } catch (e) {
        console.error('❌ [Info] Error:', e.message);
        await message.reply({
            content: '❌ Something went wrong fetching that info — try again!',
            allowedMentions: { repliedUser: false }
        }).catch(() => {});
    }
}

module.exports = { handleInfoCommand };