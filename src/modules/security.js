

'use strict';

const fs   = require('fs');
const path = require('path');
const {
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ThumbnailBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    PermissionFlagsBits,
    ChannelType,
    AuditLogEvent
} = require('discord.js');

const ANTI_JSON_PATH = path.join(process.cwd(), 'anti.json');

let whitelistConfig = loadAntiJson();

function loadAntiJson() {
    try {
        const raw = fs.readFileSync(ANTI_JSON_PATH, 'utf8');
        const cfg = JSON.parse(raw);
        console.log('🛡️  [Security] anti.json loaded successfully');
        return cfg;
    } catch (err) {
        console.warn('⚠️  [Security] anti.json not found or invalid — using defaults');
        return {
            whitelistedUsers: [],
            whitelistedRoles: [],
            whitelistedChannels: [],
            whitelistedLinks: [],
            trustedBots: [],
            antiNuke:  { maxChannelDeletesPerMinute:3, maxChannelCreatesPerMinute:5, maxRoleDeletesPerMinute:3, maxRoleCreatesPerMinute:5, maxBansPerMinute:5, maxKicksPerMinute:5, maxWebhookCreatesPerMinute:3, punishmentAction:'ban' },
            antiSpam:  { maxMessagesPerWindow:6, windowMs:5000, maxDuplicates:4, duplicateWindowMs:10000, maxMentions:5, maxEmojis:15, maxLines:20, punishmentAction:'mute', muteDurationMs:300000, warnBeforePunish:true },
            antiRaid:  { joinThreshold:10, joinWindowMs:10000, punishmentAction:'kick', enableLockdown:true, lockdownDurationMs:300000 }
        };
    }
}

fs.watch(ANTI_JSON_PATH, (eventType) => {
    if (eventType === 'change') {
        whitelistConfig = loadAntiJson();
        console.log('🔄 [Security] anti.json reloaded (hot-reload)');
    }
});

const FEATURES = {
    ANTI_SPAM:       (process.env.SECURITY_ANTI_SPAM       ?? 'true') === 'true',
    ANTI_LINK:       (process.env.SECURITY_ANTI_LINK       ?? 'true') === 'true',
    ANTI_INVITE:     (process.env.SECURITY_ANTI_INVITE     ?? 'true') === 'true',
    ANTI_NUKE:       (process.env.SECURITY_ANTI_NUKE       ?? 'true') === 'true',
    ANTI_RAID:       (process.env.SECURITY_ANTI_RAID       ?? 'true') === 'true',
    ANTI_GHOST_PING: (process.env.SECURITY_ANTI_GHOST_PING ?? 'true') === 'true',
    LOG_CHANNEL:     process.env.SECURITY_LOG_CHANNEL_ID   ?? process.env.LOG_CHANNEL_ID ?? null,
    MOD_ROLE:        process.env.SECURITY_MOD_ROLE_ID      ?? null,
    MUTE_ROLE:       process.env.SECURITY_MUTE_ROLE_ID     ?? null,
    ALERT_OWNER_ID:  process.env.OWNER_ID                  ?? '796001480406466601',
};

const spamTracker     = new Map();

const nukeTracker     = new Map();

const raidTracker     = new Map();
const raidLockdowns   = new Set(); 

const ghostPingStore  = new Map();

const warnCounter     = new Map();

function isWhitelisted(member) {
    if (!member) return false;
    const cfg = whitelistConfig;
    if (cfg.whitelistedUsers?.includes(member.id)) return true;
    if (member.roles?.cache.some(r => cfg.whitelistedRoles?.includes(r.id))) return true;
    

    return false;
}

function isChannelWhitelisted(channelId) {
    return whitelistConfig.whitelistedChannels?.includes(channelId) ?? false;
}

function isLinkWhitelisted(url) {
    const allowed = whitelistConfig.whitelistedLinks ?? [];
    return allowed.some(domain => url.toLowerCase().includes(domain.toLowerCase()));
}

function getWarnCount(guildId, userId) {
    return warnCounter.get(guildId)?.get(userId) ?? 0;
}

function incrementWarn(guildId, userId) {
    if (!warnCounter.has(guildId)) warnCounter.set(guildId, new Map());
    const g = warnCounter.get(guildId);
    g.set(userId, (g.get(userId) ?? 0) + 1);
    return g.get(userId);
}

function buildSecurityAlert({ type, color, icon, title, description, fields = [], targetUser = null, footer = null }) {
    const container = new ContainerBuilder().setAccentColor(color ?? 0xFF0000);

    

    const headerText = `## ${icon} ${title}`;
    if (targetUser) {
        const section = new SectionBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerText))
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ size: 128 })));
        container.addSectionComponents(section);
    } else {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(headerText));
    }

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));

    

    if (description) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(description));
    }

    

    if (fields.length > 0) {
        const fieldText = fields.map(f => `**${f.name}** — ${f.value}`).join('\n');
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(fieldText));
    }

    

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    const ts = `<t:${Math.floor(Date.now() / 1000)}:F>`;
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# ${footer ?? '🛡️ Umbra X Development Security'} • ${ts}`)
    );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildNukeAlertWithActions(perpetrator, action, count) {
    const container = new ContainerBuilder().setAccentColor(0xFF0000);

    const section = new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## 🚨 ANTI-NUKE TRIGGERED\n**${perpetrator.user?.username ?? perpetrator.tag ?? 'Unknown'}** performed \`${count}x ${action}\` in rapid succession!`
            )
        )
        .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(
                perpetrator.user?.displayAvatarURL({ size: 128 }) ?? perpetrator.displayAvatarURL?.({ size: 128 }) ?? 'https://cdn.discordapp.com/embed/avatars/0.png'
            )
        );
    container.addSectionComponents(section);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `**👤 User** — <@${perpetrator.id}> (\`${perpetrator.id}\`)\n` +
            `**⚡ Action** — \`${action}\`\n` +
            `**🔢 Count** — \`${count}\`\n` +
            `**⏰ Time** — <t:${Math.floor(Date.now() / 1000)}:T>\n\n` +
            `🔨 **Automatic punishment applied immediately — no approval required.**`
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(1));
    container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`sec_pardon_${perpetrator.id}`).setLabel('🔓 Pardon').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`sec_ban_${perpetrator.id}`).setLabel('🔨 Permanent Ban').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`sec_review_${perpetrator.id}`).setLabel('👁️ Review Logs').setStyle(ButtonStyle.Secondary)
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# 🛡️ Umbra X Development Anti-Nuke • <t:${Math.floor(Date.now() / 1000)}:F>`)
    );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildRaidAlert(guild, joinCount, lockdown) {
    const container = new ContainerBuilder().setAccentColor(0xFF4500);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## 🚨 RAID DETECTED — ${guild.name}\n` +
            `**${joinCount}** members joined within the detection window!`
        )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `**🏰 Server** — ${guild.name}\n` +
            `**👥 Join Count** — \`${joinCount}\`\n` +
            `**🔒 Lockdown** — ${lockdown ? '`ACTIVATED`' : '`Not triggered`'}\n` +
            `**⏰ Time** — <t:${Math.floor(Date.now() / 1000)}:T>\n\n` +
            `${lockdown ? '⚠️ New members are temporarily prevented from sending messages.' : ''}`
        )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# 🛡️ Umbra X Development Anti-Raid • <t:${Math.floor(Date.now() / 1000)}:F>`)
    );
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildSpamWarn(member, reason, warnCount) {
    const container = new ContainerBuilder().setAccentColor(0xFFA500);
    const section = new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ⚠️ Spam Warning — <@${member.id}>`)
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(member.user.displayAvatarURL({ size: 128 })));
    container.addSectionComponents(section);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `**Reason** — ${reason}\n` +
            `**Warnings** — \`${warnCount}/3\`\n` +
            `**Status** — ${warnCount >= 3 ? '🚫 Muted' : '⚠️ Warned'}`
        )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# 🛡️ Umbra X Development Anti-Spam`)
    );
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

async function sendSecurityLog(client, payload) {
    try {
        if (!FEATURES.LOG_CHANNEL) return;
        const ch = client.channels.cache.get(FEATURES.LOG_CHANNEL);
        if (ch?.isTextBased()) await ch.send(payload);
    } catch (err) {
        console.error('❌ [Security] Failed to send log:', err.message);
    }
}

async function muteUser(member, durationMs, reason) {
    try {
        if (member.moderatable) {
            await member.timeout(durationMs, reason);
            console.log(`🔇 [Security] Muted ${member.user.tag} for ${durationMs / 1000}s — ${reason}`);
            return true;
        }
    } catch (err) {
        console.error(`❌ [Security] Failed to mute ${member.user?.tag}:`, err.message);
    }
    return false;
}

async function kickUser(member, reason) {
    try {
        if (member.kickable) {
            await member.kick(reason);
            console.log(`👢 [Security] Kicked ${member.user?.tag} — ${reason}`);
            return true;
        }
    } catch (err) {
        console.error(`❌ [Security] Failed to kick:`, err.message);
    }
    return false;
}

async function banUser(guild, userId, reason) {
    try {
        await guild.bans.create(userId, { reason, deleteMessageSeconds: 86400 });
        console.log(`🔨 [Security] Banned ${userId} — ${reason}`);
        return true;
    } catch (err) {
        console.error(`❌ [Security] Failed to ban:`, err.message);
    }
    return false;
}

const URL_REGEX     = /https?:\/\/[^\s]+/gi;
const INVITE_REGEX  = /(?:discord\.gg|discord(?:app)?\.com\/invite|dsc\.gg|invite\.gg)\/[a-zA-Z0-9\-]+/gi;
const SCAM_KEYWORDS = ['free nitro', 'steam gift', 'airdrop', 'claim your', 'click here to claim', 'limited offer', 'bit.ly', 'tinyurl'];

async function handleAntiSpam(message, client) {
    if (!FEATURES.ANTI_SPAM) return false;
    if (isWhitelisted(message.member)) return false;
    if (isChannelWhitelisted(message.channel.id)) return false;

    const { guild, author, content, channel } = message;
    const guildId = guild.id;
    const userId  = author.id;
    const cfg     = whitelistConfig.antiSpam;
    const now     = Date.now();

    if (!spamTracker.has(guildId)) spamTracker.set(guildId, new Map());
    const guildMap = spamTracker.get(guildId);

    if (!guildMap.has(userId)) guildMap.set(userId, { timestamps: [], contents: [], warned: false });
    const userData = guildMap.get(userId);

    

    userData.timestamps = userData.timestamps.filter(t => now - t < cfg.windowMs);
    userData.timestamps.push(now);

    

    userData.contents = userData.contents.filter(e => now - e.time < cfg.duplicateWindowMs);
    userData.contents.push({ text: content, time: now });

    let violation = null;

    

    if (userData.timestamps.length >= cfg.maxMessagesPerWindow) {
        violation = `Sending messages too fast (\`${userData.timestamps.length}/${cfg.maxMessagesPerWindow}\` in ${cfg.windowMs / 1000}s)`;
    }

    

    if (!violation) {
        const dupCount = userData.contents.filter(e => e.text === content).length;
        if (dupCount >= cfg.maxDuplicates) {
            violation = `Sending duplicate messages (\`${dupCount}x\` same message)`;
        }
    }

    

    if (!violation) {
        const mentionCount = message.mentions.users.size + message.mentions.roles.size;
        if (mentionCount > cfg.maxMentions) {
            violation = `Mention flood (\`${mentionCount}/${cfg.maxMentions}\` mentions)`;
        }
    }

    

    if (!violation) {
        const cleanedForEmoji = content
            .replace(/<@[!&]?\d+>/g, '')
            .replace(/<#\d+>/g, '')
            .replace(/<a?:[a-zA-Z0-9_]+:\d+>/g, '')
            .replace(/\d/g, '');

        const customEmojiCount  = (content.match(/<a?:[a-zA-Z0-9_]+:\d+>/g) ?? []).length;
        const unicodeEmojiCount = (cleanedForEmoji.match(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu) ?? []).length;
        const totalEmojiCount   = customEmojiCount + unicodeEmojiCount;

        if (totalEmojiCount > cfg.maxEmojis) {
            violation = `Emoji flood (\`${totalEmojiCount}/${cfg.maxEmojis}\` emojis)`;
        }
    }

    

    if (!violation) {
        const lineCount = content.split('\n').length;
        if (lineCount > cfg.maxLines) {
            violation = `Message wall (\`${lineCount}/${cfg.maxLines}\` lines)`;
        }
    }

    if (!violation) return false;

    try { await message.delete(); } catch (_) {}

    const warns = incrementWarn(guildId, userId);

    

    try {
        await author.send(buildSecurityAlert({
            type: 'spam', color: 0xFFA500, icon: '⚠️',
            title: `Spam Warning — ${guild.name}`,
            description: `You were warned for: **${violation}**\n\nThis is warning **${warns}/3**. Continued violations will result in a mute.`,
            footer: '☕ Umbra X Development Security'
        }));
    } catch (_) {}

    await sendSecurityLog(client, buildSpamWarn(message.member, violation, warns));

    

    if (warns >= 3 && cfg.punishmentAction === 'mute') {
        await muteUser(message.member, cfg.muteDurationMs, `Anti-Spam: ${violation}`);
        warnCounter.get(guildId)?.set(userId, 0);
    }

    

    try {
        const alert = await channel.send(buildSecurityAlert({
            type: 'spam', color: 0xFFA500, icon: '⚠️',
            title: 'Spam Detected',
            description: `<@${userId}> — ${violation}\n*This message will be deleted shortly.*`,
            footer: '🛡️ Anti-Spam'
        }));
        setTimeout(() => alert.delete().catch(() => {}), 5000);
    } catch (_) {}

    console.log(`🛡️ [Anti-Spam] ${author.tag} in ${guild.name}: ${violation}`);
    return true;
}

async function handleAntiLink(message, client) {
    if (!FEATURES.ANTI_LINK && !FEATURES.ANTI_INVITE) return false;
    if (isWhitelisted(message.member)) return false;
    if (isChannelWhitelisted(message.channel.id)) return false;

    const { guild, author, content, channel } = message;
    const hasInvite = INVITE_REGEX.test(content);
    const urls      = content.match(URL_REGEX) ?? [];
    INVITE_REGEX.lastIndex = 0;

    let violation = null;

    if (hasInvite && FEATURES.ANTI_INVITE) {
        violation = 'Discord invite link';
    }

    if (!violation && FEATURES.ANTI_LINK && urls.length > 0) {
        for (const url of urls) {
            if (!isLinkWhitelisted(url)) {
                const isScam = SCAM_KEYWORDS.some(k => content.toLowerCase().includes(k));
                violation = isScam ? `Potential scam link: \`${url.substring(0, 60)}\`` : `Unapproved link: \`${url.substring(0, 60)}\``;
                break;
            }
        }
    }

    if (!violation) return false;

    try { await message.delete(); } catch (_) {}

    const warns = incrementWarn(guild.id, author.id);

    try {
        await author.send(buildSecurityAlert({
            type: 'link', color: 0xFF4500, icon: '🔗',
            title: `Link Blocked — ${guild.name}`,
            description: `Your message was removed for: **${violation}**\n\nOnly approved links are allowed in this server.`,
            footer: '☕ Umbra X Development Security'
        }));
    } catch (_) {}

    await sendSecurityLog(client, buildSecurityAlert({
        type: 'link', color: 0xFF4500, icon: '🔗',
        title: 'Link Blocked',
        description: `**User:** <@${author.id}> (\`${author.tag}\`)\n**Violation:** ${violation}\n**Warns:** \`${warns}/3\``,
        targetUser: author,
        footer: '🛡️ Anti-Link'
    }));

    if (warns >= 3) {
        await muteUser(message.member, whitelistConfig.antiSpam.muteDurationMs, `Anti-Link: ${violation}`);
        warnCounter.get(guild.id)?.set(author.id, 0);
    }

    console.log(`🛡️ [Anti-Link] ${author.tag} in ${guild.name}: ${violation}`);
    return true;
}

function trackNukeAction(guildId, userId, action) {
    const cfg = whitelistConfig.antiNuke;
    if (!nukeTracker.has(guildId)) nukeTracker.set(guildId, new Map());
    const gMap = nukeTracker.get(guildId);
    if (!gMap.has(userId)) gMap.set(userId, {});
    const uMap = gMap.get(userId);
    const now  = Date.now();

    if (!uMap[action]) uMap[action] = [];
    uMap[action] = uMap[action].filter(t => now - t < 60000); 

    uMap[action].push(now);

    const thresholds = {
        channelDelete:  cfg.maxChannelDeletesPerMinute,
        channelCreate:  cfg.maxChannelCreatesPerMinute,
        roleDelete:     cfg.maxRoleDeletesPerMinute,
        roleCreate:     cfg.maxRoleCreatesPerMinute,
        ban:            cfg.maxBansPerMinute,
        kick:           cfg.maxKicksPerMinute,
        webhookCreate:  cfg.maxWebhookCreatesPerMinute
    };

    const count     = uMap[action].length;
    const threshold = thresholds[action] ?? 5;

    return { triggered: count >= threshold, count, threshold };
}

async function handleNukePunishment(guild, perpetratorId, action, count, client) {
    const cfg = whitelistConfig.antiNuke;

    let perpetrator = null;
    try { perpetrator = await guild.members.fetch(perpetratorId); } catch (_) {}

    

    if (perpetrator && isWhitelisted(perpetrator)) {
        console.log(`⚠️ [Anti-Nuke] Whitelisted user ${perpetrator.user.tag} triggered threshold — skipping punishment`);
        return;
    }

    console.log(`🚨 [Anti-Nuke] ${perpetrator?.user?.tag ?? perpetratorId} triggered ${action} (${count}x) in ${guild.name} — punishing immediately`);

    const alertPayload = buildNukeAlertWithActions(
        perpetrator ?? { id: perpetratorId, user: { username: perpetratorId, displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png' } },
        action, count
    );
    await sendSecurityLog(client, alertPayload);

    

    if (cfg.punishmentAction === 'ban') {
        await banUser(guild, perpetratorId, `Anti-Nuke: ${count}x ${action} in 60s`);
    } else if (cfg.punishmentAction === 'kick') {
        if (perpetrator) await kickUser(perpetrator, `Anti-Nuke: ${count}x ${action} in 60s`);
    } else if (cfg.punishmentAction === 'mute') {
        if (perpetrator) await muteUser(perpetrator, 3600000, `Anti-Nuke: ${count}x ${action} in 60s`);
    }
}

async function handleAntiRaid(member, client) {
    if (!FEATURES.ANTI_RAID) return false;
    const cfg     = whitelistConfig.antiRaid;
    const guildId = member.guild.id;
    const now     = Date.now();

    if (!raidTracker.has(guildId)) raidTracker.set(guildId, []);
    const joins = raidTracker.get(guildId);
    const recent = joins.filter(t => now - t < cfg.joinWindowMs);
    recent.push(now);
    raidTracker.set(guildId, recent);

    if (recent.length < cfg.joinThreshold) return false;
    if (raidLockdowns.has(guildId)) return true; 

    console.log(`🚨 [Anti-Raid] Raid detected in ${member.guild.name} — ${recent.length} joins in ${cfg.joinWindowMs / 1000}s`);
    raidLockdowns.add(guildId);

    

    let lockdownApplied = false;
    if (cfg.enableLockdown) {
        try {
            await member.guild.setVerificationLevel(4, 'Anti-Raid lockdown');
            lockdownApplied = true;
            setTimeout(async () => {
                try { await member.guild.setVerificationLevel(1, 'Anti-Raid lockdown lifted'); } catch (_) {}
                raidLockdowns.delete(guildId);
                raidTracker.set(guildId, []);
                console.log(`🔓 [Anti-Raid] Lockdown lifted in ${member.guild.name}`);
            }, cfg.lockdownDurationMs);
        } catch (err) {
            console.error('❌ [Anti-Raid] Could not set verification level:', err.message);
        }
    }

    await sendSecurityLog(client, buildRaidAlert(member.guild, recent.length, lockdownApplied));

    if (cfg.punishmentAction === 'kick') {
        try { await kickUser(member, 'Anti-Raid: Mass join detected'); } catch (_) {}
    }

    return true;
}

function storeMessageForGhostPing(message) {
    if (!FEATURES.ANTI_GHOST_PING) return;
    if (message.mentions.users.size === 0 && message.mentions.roles.size === 0) return;

    const guildId = message.guild?.id;
    if (!guildId) return;
    if (!ghostPingStore.has(guildId)) ghostPingStore.set(guildId, new Map());

    ghostPingStore.get(guildId).set(message.id, {
        authorId:  message.author.id,
        authorTag: message.author.tag,
        content:   message.content,
        mentions:  [...message.mentions.users.keys()],
        rolesMentioned: [...message.mentions.roles.keys()],
        channelId: message.channel.id,
        timestamp: Date.now()
    });

    

    const store = ghostPingStore.get(guildId);
    for (const [id, data] of store) {
        if (Date.now() - data.timestamp > 120000) store.delete(id);
    }
}

async function handleGhostPing(message, client) {
    if (!FEATURES.ANTI_GHOST_PING) return false;
    const guildId = message.guild?.id;
    if (!guildId) return false;

    const store = ghostPingStore.get(guildId);
    if (!store?.has(message.id)) return false;

    const data = store.get(message.id);
    store.delete(message.id);

    const memberMentions = data.mentions.map(id => `<@${id}>`).join(', ');
    const roleMentions   = data.rolesMentioned.map(id => `<@&${id}>`).join(', ');

    const payload = buildSecurityAlert({
        type: 'ghost', color: 0x9B59B6, icon: '👻',
        title: 'Ghost Ping Detected',
        description:
            `<@${data.authorId}> ghost-pinged ${memberMentions}${roleMentions ? ` ${roleMentions}` : ''} and deleted the message!\n\n` +
            `**Deleted Message:**\n\`\`\`${data.content.substring(0, 300)}\`\`\``,
        footer: '🛡️ Anti-Ghost-Ping'
    });

    try {
        const originalChannel = client.channels.cache.get(data.channelId);
        if (originalChannel?.isTextBased()) {
            await originalChannel.send(payload);
        }
    } catch (err) {
        console.error('❌ [Anti-Ghost-Ping] Could not send channel alert:', err.message);
    }

    await sendSecurityLog(client, buildSecurityAlert({
        type: 'ghost', color: 0x9B59B6, icon: '👻',
        title: 'Ghost Ping — Full Log',
        description:
            `**Author:** <@${data.authorId}> (\`${data.authorTag}\`)\n` +
            `**Channel:** <#${data.channelId}>\n` +
            `**Pinged Users:** ${memberMentions || 'None'}\n` +
            `**Pinged Roles:** ${roleMentions || 'None'}\n` +
            `**Deleted Message:**\n\`\`\`${data.content.substring(0, 300)}\`\`\``,
        footer: '🛡️ Anti-Ghost-Ping'
    }));

    console.log(`👻 [Anti-Ghost-Ping] ${data.authorTag} ghost-pinged in guild ${guildId}`);
    return true;
}

function buildSecurityStatusComponent() {
    const container = new ContainerBuilder().setAccentColor(0x00FF88);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## 🛡️ Security Module Status`)
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));

    const moduleRows = [
        ['Anti-Spam',       FEATURES.ANTI_SPAM],
        ['Anti-Link',       FEATURES.ANTI_LINK],
        ['Anti-Invite',     FEATURES.ANTI_INVITE],
        ['Anti-Nuke',       FEATURES.ANTI_NUKE],
        ['Anti-Raid',       FEATURES.ANTI_RAID],
        ['Anti-Ghost-Ping', FEATURES.ANTI_GHOST_PING],
    ];

    const statusText = moduleRows
        .map(([name, enabled]) => `${enabled ? '✅' : '❌'} **${name}** — \`${enabled ? 'ENABLED' : 'DISABLED'}\``)
        .join('\n');

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(statusText));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(1));

    const cfg = whitelistConfig;
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `**📋 Whitelist**\n` +
            `👤 Users: \`${cfg.whitelistedUsers?.length ?? 0}\`  |  ` +
            `🏷️ Roles: \`${cfg.whitelistedRoles?.length ?? 0}\`  |  ` +
            `📢 Channels: \`${cfg.whitelistedChannels?.length ?? 0}\`  |  ` +
            `🔗 Links: \`${cfg.whitelistedLinks?.length ?? 0}\`\n` +
            `-# ⚠️ Administrator permission grants NO bypass — only explicit whitelist entries are exempt`
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(1));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `**⚙️ Log Channel** — ${FEATURES.LOG_CHANNEL ? `<#${FEATURES.LOG_CHANNEL}>` : '`Not set`'}\n` +
            `**🔇 Mute Duration** — \`${cfg.antiSpam?.muteDurationMs / 1000 ?? 300}s\`\n` +
            `**🚫 Nuke Punishment** — \`${cfg.antiNuke?.punishmentAction ?? 'ban'}\` (immediate, no approval)\n` +
            `**🛑 Raid Punishment** — \`${cfg.antiRaid?.punishmentAction ?? 'kick'}\``
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# 🛡️ Umbra X Development Security • <t:${Math.floor(Date.now() / 1000)}:F>`)
    );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function initializeSecurity(client) {
    console.log('\n🛡️  [Security] Initializing security module — STRICT MODE...');
    console.log(`   Anti-Spam:       ${FEATURES.ANTI_SPAM       ? '✅ ON' : '❌ OFF'}`);
    console.log(`   Anti-Link:       ${FEATURES.ANTI_LINK       ? '✅ ON' : '❌ OFF'}`);
    console.log(`   Anti-Invite:     ${FEATURES.ANTI_INVITE     ? '✅ ON' : '❌ OFF'}`);
    console.log(`   Anti-Nuke:       ${FEATURES.ANTI_NUKE       ? '✅ ON' : '❌ OFF'} (immediate punishment)`);
    console.log(`   Anti-Raid:       ${FEATURES.ANTI_RAID       ? '✅ ON' : '❌ OFF'}`);
    console.log(`   Anti-Ghost-Ping: ${FEATURES.ANTI_GHOST_PING ? '✅ ON' : '❌ OFF'}`);
    console.log(`   Log Channel:     ${FEATURES.LOG_CHANNEL ?? 'Not set'}`);
    console.log(`   ⚠️  Admin bypass: DISABLED — only anti.json whitelist is respected\n`);

    

    client.on('channelDelete', async (channel) => {
        if (!FEATURES.ANTI_NUKE || !channel.guild) return;
        try {
            const audit = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 1 });
            const entry = audit.entries.first();
            if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
            const { triggered, count } = trackNukeAction(channel.guild.id, entry.executor.id, 'channelDelete');
            if (triggered) await handleNukePunishment(channel.guild, entry.executor.id, 'Channel Delete', count, client);
        } catch (err) { console.error('❌ [Anti-Nuke] channelDelete error:', err.message); }
    });

    

    client.on('channelCreate', async (channel) => {
        if (!FEATURES.ANTI_NUKE || !channel.guild) return;
        try {
            const audit = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelCreate, limit: 1 });
            const entry = audit.entries.first();
            if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
            const { triggered, count } = trackNukeAction(channel.guild.id, entry.executor.id, 'channelCreate');
            if (triggered) await handleNukePunishment(channel.guild, entry.executor.id, 'Channel Create', count, client);
        } catch (err) { console.error('❌ [Anti-Nuke] channelCreate error:', err.message); }
    });

    

    client.on('roleDelete', async (role) => {
        if (!FEATURES.ANTI_NUKE) return;
        try {
            const audit = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 1 });
            const entry = audit.entries.first();
            if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
            const { triggered, count } = trackNukeAction(role.guild.id, entry.executor.id, 'roleDelete');
            if (triggered) await handleNukePunishment(role.guild, entry.executor.id, 'Role Delete', count, client);
        } catch (err) { console.error('❌ [Anti-Nuke] roleDelete error:', err.message); }
    });

    

    client.on('roleCreate', async (role) => {
        if (!FEATURES.ANTI_NUKE) return;
        try {
            const audit = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleCreate, limit: 1 });
            const entry = audit.entries.first();
            if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
            const { triggered, count } = trackNukeAction(role.guild.id, entry.executor.id, 'roleCreate');
            if (triggered) await handleNukePunishment(role.guild, entry.executor.id, 'Role Create', count, client);
        } catch (err) { console.error('❌ [Anti-Nuke] roleCreate error:', err.message); }
    });

    

    client.on('guildBanAdd', async (ban) => {
        if (!FEATURES.ANTI_NUKE) return;
        try {
            const audit = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
            const entry = audit.entries.first();
            if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
            if (entry.executor.id === client.user.id) return; 

            const { triggered, count } = trackNukeAction(ban.guild.id, entry.executor.id, 'ban');
            if (triggered) await handleNukePunishment(ban.guild, entry.executor.id, 'Mass Ban', count, client);
        } catch (err) { console.error('❌ [Anti-Nuke] ban error:', err.message); }
    });

    

    client.on('guildMemberRemove', async (member) => {
        if (!FEATURES.ANTI_NUKE) return;
        try {
            const audit = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 1 });
            const entry = audit.entries.first();
            if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
            if (entry.target.id !== member.id) return;
            if (entry.executor.id === client.user.id) return;
            const { triggered, count } = trackNukeAction(member.guild.id, entry.executor.id, 'kick');
            if (triggered) await handleNukePunishment(member.guild, entry.executor.id, 'Mass Kick', count, client);
        } catch (err) {  }
    });

    

    client.on('webhooksUpdate', async (channel) => {
        if (!FEATURES.ANTI_NUKE || !channel.guild) return;
        try {
            const audit = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.WebhookCreate, limit: 1 });
            const entry = audit.entries.first();
            if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
            const { triggered, count } = trackNukeAction(channel.guild.id, entry.executor.id, 'webhookCreate');
            if (triggered) await handleNukePunishment(channel.guild, entry.executor.id, 'Webhook Create', count, client);
        } catch (err) { console.error('❌ [Anti-Nuke] webhook error:', err.message); }
    });

    

    client.on('messageDelete', async (message) => {
        if (!message.guild || message.author?.bot) return;
        await handleGhostPing(message, client);
    });

    

    client.on('guildMemberAdd', async (member) => {
        await handleAntiRaid(member, client);
    });

    console.log('✅ [Security] All event listeners registered\n');
}

module.exports = {
    initializeSecurity,
    handleAntiSpam,
    handleAntiLink,
    storeMessageForGhostPing,
    buildSecurityStatusComponent,
    isWhitelisted,
    FEATURES,
};