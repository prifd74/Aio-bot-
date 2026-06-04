const {
    ChannelType, AuditLogEvent, AttachmentBuilder,
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    SectionBuilder, ThumbnailBuilder, MediaGalleryBuilder,
    MediaGalleryItemBuilder, SeparatorSpacingSize, MessageFlags,
} = require('discord.js');
const { createWelcomeCard } = require('../modules/card');

const Colors = {
    SUCCESS: 0x2ecc71, WARNING: 0xe67e22, DANGER: 0xe74c3c,
    INFO: 0x3498db, MODERATION: 0x9b59b6, MUTED: 0x95a5a6,
};
const ts  = (ms) => `<t:${Math.floor((ms ?? Date.now()) / 1000)}:F>`;
const tsR = (ms) => `<t:${Math.floor((ms ?? Date.now()) / 1000)}:R>`;
const now = ()   => `<t:${Math.floor(Date.now() / 1000)}:F>`;

const userTag   = (user)   => user       ? `**${user.username}** (\`${user.id}\`)` : 'Unknown';
const memberTag = (member) => member?.user ? `**${member.user.username}** (\`${member.id}\`)` : 'Unknown';

async function sendLog(client, container) {
    try {
        const ch = client.channels.cache.get(process.env.SERVER_LOG_CHANNEL_ID);
        if (!ch?.isTextBased()) return;
        await ch.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (e) { console.error('❌ sendLog:', e.message); }
}

function buildLogContainer({ emoji, title, description, fields = [], color, thumbnail, footer }) {
    const c = new ContainerBuilder().setAccentColor(color);
    const hdr = new TextDisplayBuilder().setContent(`## ${emoji} ${title}\n${description}`);
    if (thumbnail) {
        c.addSectionComponents(new SectionBuilder().addTextDisplayComponents(hdr).setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail)));
    } else {
        c.addTextDisplayComponents(hdr);
    }
    if (fields.length) {
        c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
        for (let i = 0; i < fields.length; i += 2) {
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                fields.slice(i, i + 2).map(f => `**${f.label}**\n${f.value}`).join('    ')
            ));
        }
    }
    if (footer) {
        c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer}`));
    }
    return c;
}

async function sendWelcomeMessage(client, member) {
    try {
        const ch = client.channels.cache.get(process.env.WELCOME_CHANNEL_ID);
        if (!ch?.isTextBased()) return;
        try {
            const buf = await createWelcomeCard(member, member.guild);
            const att = new AttachmentBuilder(buf, { name: 'welcome.png' });
            const container = new ContainerBuilder().setAccentColor(0xe74c3c)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `## 🎉 Welcome to **${member.guild.name}**!\nHey **${member.user.username}**, thrilled to have you here! ☕✨`
                ))
                .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
                .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL('attachment://welcome.png')))
                .addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `👤 **${member.user.username}** · 🌟 Member **#${member.guild.memberCount}** · 📅 Joined ${tsR(member.joinedTimestamp)}`
                ));
            await ch.send({ components: [container], files: [att], flags: MessageFlags.IsComponentsV2 });
        } catch {
            await ch.send(`🎉 Welcome **${member.user.username}** to **${member.guild.name}**! ☕✨`);
        }
    } catch (e) { console.error('❌ welcome:', e.message); }
}

function logMemberJoin(client, member) {
    const age = Math.floor((Date.now() - member.user.createdTimestamp) / 86_400_000);
    sendLog(client, buildLogContainer({
        emoji: '📥', title: 'Member Joined',
        description: `**${member.user.username}** joined the server${age < 7 ? '  ⚠️ *New account*' : ''}`,
        color: Colors.SUCCESS, thumbnail: member.user.displayAvatarURL({ size: 64 }),
        fields: [
            { label: '🪪 Username', value: member.user.username },           { label: '🤖 Bot',     value: member.user.bot ? 'Yes' : 'No' },
            { label: '📅 Created',  value: ts(member.user.createdTimestamp) },{ label: '🕐 Age',     value: `${age} days` },
            { label: '👥 Members',  value: `${member.guild.memberCount}` },   { label: '🆔 ID',      value: `\`${member.id}\`` },
        ], footer: `Joined ${now()}`,
    }));
    if (!member.user.bot) sendWelcomeMessage(client, member);
}

function logMemberLeave(client, member) {
    const hours = Math.floor((Date.now() - member.joinedTimestamp) / 3_600_000);
    const roles = member.roles.cache.filter(r => r.id !== member.guild.id).map(r => `\`${r.name}\``).join(', ') || 'None';
    sendLog(client, buildLogContainer({
        emoji: '📤', title: 'Member Left',
        description: `**${member.user.username}** has left the server`,
        color: Colors.WARNING, thumbnail: member.user.displayAvatarURL({ size: 64 }),
        fields: [
            { label: '🪪 Username', value: member.user.username }, { label: '🆔 ID',    value: `\`${member.id}\`` },
            { label: '⏱️ Time',    value: `${hours} hours` },      { label: '🎭 Roles', value: roles.substring(0, 200) },
        ], footer: `Left ${now()}`,
    }));
}

function logMemberKick(client, member, executor, reason) {
    sendLog(client, buildLogContainer({
        emoji: '🦶', title: 'Member Kicked',
        description: `**${member.user.username}** was kicked`,
        color: Colors.DANGER, thumbnail: member.user.displayAvatarURL({ size: 64 }),
        fields: [
            { label: '👤 Target',    value: userTag(member.user) },  { label: '🔨 By',     value: executor || 'Unknown' },
            { label: '⏱️ Had Been', value: `${Math.floor((Date.now() - member.joinedTimestamp) / 3_600_000)} hours` },
            { label: '📝 Reason',   value: reason || 'No reason' },
        ], footer: `Kicked ${now()}`,
    }));
}

function logMemberBan(client, ban, executor) {
    sendLog(client, buildLogContainer({
        emoji: '🔨', title: 'Member Banned',
        description: `**${ban.user.username}** was permanently banned`,
        color: Colors.DANGER, thumbnail: ban.user.displayAvatarURL({ size: 64 }),
        fields: [
            { label: '👤 Target', value: userTag(ban.user) },           { label: '🔨 By',     value: executor || 'Unknown' },
            { label: '🤖 Bot',    value: ban.user.bot ? 'Yes' : 'No' }, { label: '📝 Reason', value: ban.reason || 'No reason' },
        ], footer: `Banned ${now()}`,
    }));
}

function logMemberUnban(client, ban, executor) {
    sendLog(client, buildLogContainer({
        emoji: '🔓', title: 'Member Unbanned', description: `**${ban.user.username}** was unbanned`,
        color: Colors.SUCCESS, thumbnail: ban.user.displayAvatarURL({ size: 64 }),
        fields: [
            { label: '👤 User', value: userTag(ban.user) }, { label: '🔓 By', value: executor || 'Unknown' },
        ], footer: `Unbanned ${now()}`,
    }));
}

function logMemberTimeout(client, member, executor, until, reason) {
    sendLog(client, buildLogContainer({
        emoji: '🔇', title: 'Member Timed Out', description: `**${member.user.username}** was timed out`,
        color: Colors.MODERATION, thumbnail: member.user.displayAvatarURL({ size: 64 }),
        fields: [
            { label: '👤 Target', value: userTag(member.user) },                    { label: '🔇 By',     value: executor || 'Unknown' },
            { label: '⏰ Until',  value: until ? ts(until) : 'Unknown' }, { label: '📝 Reason', value: reason || 'No reason' },
        ], footer: `Timed out ${now()}`,
    }));
}

function logMemberTimeoutRemove(client, member, executor) {
    sendLog(client, buildLogContainer({
        emoji: '🔊', title: 'Timeout Removed', description: `**${member.user.username}**'s timeout was lifted`,
        color: Colors.SUCCESS, thumbnail: member.user.displayAvatarURL({ size: 64 }),
        fields: [
            { label: '👤 User', value: userTag(member.user) }, { label: '🔊 By', value: executor || 'Unknown' },
        ], footer: `Removed ${now()}`,
    }));
}

function logMemberNicknameChange(client, member, oldNick, newNick) {
    sendLog(client, buildLogContainer({
        emoji: '🏷️', title: 'Nickname Changed', description: `**${member.user.username}** changed nickname`,
        color: Colors.INFO, thumbnail: member.user.displayAvatarURL({ size: 64 }),
        fields: [
            { label: '👤 Member', value: member.user.username },
            { label: '❌ Before', value: oldNick || '*None*' }, { label: '✅ After', value: newNick || '*Removed*' },
        ], footer: `Changed ${now()}`,
    }));
}

function logMemberRoleAdd(client, member, role) {
    sendLog(client, buildLogContainer({
        emoji: '➕', title: 'Role Assigned', description: `**${member.user.username}** received a role`,
        color: Colors.SUCCESS, thumbnail: member.user.displayAvatarURL({ size: 64 }),
        fields: [
            { label: '👤 Member', value: member.user.username },
            { label: '🎭 Role',   value: `\`${role.name}\` (\`${role.id}\`)` },
            { label: '🎨 Color',  value: role.color ? `\`#${role.color.toString(16).toUpperCase().padStart(6,'0')}\`` : 'Default' },
        ], footer: `Added ${now()}`,
    }));
}

function logMemberRoleRemove(client, member, role) {
    sendLog(client, buildLogContainer({
        emoji: '➖', title: 'Role Removed', description: `**${member.user.username}** lost a role`,
        color: Colors.WARNING, thumbnail: member.user.displayAvatarURL({ size: 64 }),
        fields: [
            { label: '👤 Member', value: member.user.username },
            { label: '🎭 Role',   value: `\`${role.name}\` (\`${role.id}\`)` },
        ], footer: `Removed ${now()}`,
    }));
}

function logMessageDelete(client, message) {
    if (message.author?.bot) return;
    const fields = [
        { label: '👤 Author',  value: userTag(message.author) },
        { label: '📍 Channel', value: `<#${message.channelId}>` },
        { label: '📅 Sent',    value: ts(message.createdTimestamp) },
        { label: '💬 Content', value: message.content?.substring(0, 400) || '*[No content]*' },
    ];
    if (message.attachments?.size) fields.push({ label: '📎 Files',    value: message.attachments.map(a => `[${a.name}](${a.url})`).join('\n').substring(0, 300) });
    if (message.stickers?.size)    fields.push({ label: '🎨 Stickers', value: message.stickers.map(s => s.name).join(', ') });
    sendLog(client, buildLogContainer({
        emoji: '🗑️', title: 'Message Deleted', description: `A message was deleted in <#${message.channelId}>`,
        color: Colors.DANGER, thumbnail: message.author.displayAvatarURL({ size: 64 }), fields, footer: `Deleted ${now()}`,
    }));
}

function logMessageEdit(client, oldMsg, newMsg) {
    if (oldMsg.author?.bot || oldMsg.content === newMsg.content) return;
    sendLog(client, buildLogContainer({
        emoji: '✏️', title: 'Message Edited',
        description: `**${oldMsg.author.username}** edited a message in <#${oldMsg.channelId}> · [Jump](${newMsg.url})`,
        color: Colors.INFO, thumbnail: oldMsg.author.displayAvatarURL({ size: 64 }),
        fields: [
            { label: '📝 Before',  value: oldMsg.content.substring(0, 400) || '*[empty]*' },
            { label: '✨ After',   value: newMsg.content.substring(0, 400) || '*[empty]*' },
            { label: '📍 Channel', value: `<#${oldMsg.channelId}>` }, { label: '⏰ Edited', value: ts(newMsg.editedTimestamp) },
        ], footer: `ID: ${oldMsg.id}`,
    }));
}

function logBulkMessageDelete(client, messages) {
    const channelId = messages.first()?.channelId;
    sendLog(client, buildLogContainer({
        emoji: '🧹', title: 'Bulk Delete', description: `**${messages.size}** messages purged from <#${channelId}>`,
        color: Colors.DANGER,
        fields: [
            { label: '📊 Count',   value: `${messages.size}` },
            { label: '👥 Authors', value: `${new Set(messages.map(m => m.author?.id).filter(Boolean)).size}` },
            { label: '📍 Channel', value: `<#${channelId}>` },
        ], footer: `Purged ${now()}`,
    }));
}

function logMessagePin(client, message, executor) {
    sendLog(client, buildLogContainer({
        emoji: '📌', title: 'Message Pinned', description: `A message in <#${message.channelId}> was pinned`,
        color: Colors.INFO,
        fields: [
            { label: '👤 Author', value: message.author?.username || 'Unknown' },
            { label: '📌 By',     value: executor || 'Unknown' },
            { label: '🔗 Jump',   value: `[View Message](${message.url})` },
        ], footer: `Pinned ${now()}`,
    }));
}

const chTypeName = (t) => ({
    [ChannelType.GuildText]:          '💬 Text',
    [ChannelType.GuildVoice]:         '🔊 Voice',
    [ChannelType.GuildCategory]:      '📁 Category',
    [ChannelType.GuildAnnouncement]:  '📢 Announcement',
    [ChannelType.GuildForum]:         '🗂️ Forum',
    [ChannelType.GuildStageVoice]:    '🎙️ Stage',
    [ChannelType.GuildMedia]:         '🖼️ Media',
    [ChannelType.PrivateThread]:      '🧵 Private Thread',
    [ChannelType.PublicThread]:       '🧵 Public Thread',
    [ChannelType.AnnouncementThread]: '🧵 Announce Thread',
}[t] ?? '❓ Unknown');

function logChannelCreate(client, ch) {
    sendLog(client, buildLogContainer({
        emoji: '➕', title: 'Channel Created', description: `**#${ch.name}** was created`,
        color: Colors.SUCCESS,
        fields: [
            { label: '📛 Name',      value: ch.name },           { label: '📝 Type',      value: chTypeName(ch.type) },
            { label: '🆔 ID',        value: `\`${ch.id}\`` },   { label: '📍 Topic',     value: ch.topic || 'None' },
            { label: '🔒 NSFW',      value: ch.nsfw ? 'Yes' : 'No' },
            { label: '⏱️ Slowmode', value: ch.rateLimitPerUser ? `${ch.rateLimitPerUser}s` : 'Off' },
        ], footer: `Created ${now()}`,
    }));
}

function logChannelDelete(client, ch) {
    sendLog(client, buildLogContainer({
        emoji: '➖', title: 'Channel Deleted', description: `**#${ch.name}** was deleted`,
        color: Colors.DANGER,
        fields: [
            { label: '📛 Name', value: ch.name },
            { label: '📝 Type', value: chTypeName(ch.type) },
            { label: '🆔 ID',   value: `\`${ch.id}\`` },
        ], footer: `Deleted ${now()}`,
    }));
}

function logChannelUpdate(client, o, n) {
    const d = [];
    if (o.name             !== n.name)             d.push(`**Name:** \`${o.name}\` → \`${n.name}\``);
    if (o.topic            !== n.topic)            d.push(`**Topic:** ${o.topic||'*None*'} → ${n.topic||'*None*'}`);
    if (o.nsfw             !== n.nsfw)             d.push(`**NSFW:** ${o.nsfw} → ${n.nsfw}`);
    if (o.rateLimitPerUser !== n.rateLimitPerUser) d.push(`**Slowmode:** ${o.rateLimitPerUser}s → ${n.rateLimitPerUser}s`);
    if (o.bitrate          !== n.bitrate)          d.push(`**Bitrate:** ${o.bitrate} → ${n.bitrate}`);
    if (o.userLimit        !== n.userLimit)        d.push(`**User Limit:** ${o.userLimit||'∞'} → ${n.userLimit||'∞'}`);
    if (!d.length) return;
    sendLog(client, buildLogContainer({
        emoji: '✏️', title: 'Channel Updated', description: `<#${n.id}> was modified`,
        color: Colors.INFO,
        fields: [{ label: '📝 Changes', value: d.join('\n') }, { label: '🆔 ID', value: `\`${n.id}\`` }],
        footer: `Updated ${now()}`,
    }));
}

function logThreadCreate(client, thread, isNew) {
    if (!isNew) return;
    sendLog(client, buildLogContainer({
        emoji: '🧵', title: 'Thread Created', description: `**${thread.name}** created in <#${thread.parentId}>`,
        color: Colors.SUCCESS,
        fields: [
            { label: '🧵 Thread',       value: `<#${thread.id}>` },
            { label: '📍 Parent',        value: `<#${thread.parentId}>` },
            { label: '👤 By',            value: thread.ownerId ? `\`${thread.ownerId}\`` : 'Unknown' },
            { label: '⏰ Auto-archive', value: `${thread.autoArchiveDuration}m` },
        ], footer: `Created ${now()}`,
    }));
}

function logThreadDelete(client, thread) {
    sendLog(client, buildLogContainer({
        emoji: '🧵', title: 'Thread Deleted', description: `Thread **${thread.name}** was deleted`,
        color: Colors.DANGER,
        fields: [
            { label: '🧵 Name',  value: thread.name },
            { label: '📍 Parent', value: `<#${thread.parentId}>` },
            { label: '🆔 ID',    value: `\`${thread.id}\`` },
        ], footer: `Deleted ${now()}`,
    }));
}

function logRoleCreate(client, role) {
    sendLog(client, buildLogContainer({
        emoji: '🎭', title: 'Role Created', description: `Role **${role.name}** was created`,
        color: Colors.SUCCESS,
        fields: [
            { label: '🎭 Name',        value: role.name },
            { label: '🎨 Color',       value: role.color ? `\`#${role.color.toString(16).toUpperCase().padStart(6,'0')}\`` : 'Default' },
            { label: '📌 Hoisted',     value: role.hoist ? 'Yes' : 'No' },
            { label: '📢 Mentionable', value: role.mentionable ? 'Yes' : 'No' },
            { label: '🆔 ID',          value: `\`${role.id}\`` },
        ], footer: `Created ${now()}`,
    }));
}

function logRoleDelete(client, role) {
    sendLog(client, buildLogContainer({
        emoji: '🎭', title: 'Role Deleted', description: `Role **${role.name}** was deleted`,
        color: Colors.DANGER,
        fields: [
            { label: '🎭 Name',  value: role.name },
            { label: '🎨 Color', value: role.color ? `\`#${role.color.toString(16).toUpperCase().padStart(6,'0')}\`` : 'Default' },
            { label: '🆔 ID',    value: `\`${role.id}\`` },
        ], footer: `Deleted ${now()}`,
    }));
}

function logRoleUpdate(client, o, n) {
    const d = [];
    if (o.name        !== n.name)        d.push(`**Name:** \`${o.name}\` → \`${n.name}\``);
    if (o.color       !== n.color)       d.push(`**Color:** \`#${o.color.toString(16).toUpperCase().padStart(6,'0')}\` → \`#${n.color.toString(16).toUpperCase().padStart(6,'0')}\``);
    if (o.mentionable !== n.mentionable) d.push(`**Mentionable:** ${o.mentionable} → ${n.mentionable}`);
    if (o.hoist       !== n.hoist)       d.push(`**Hoisted:** ${o.hoist} → ${n.hoist}`);
    if (o.permissions.bitfield !== n.permissions.bitfield) d.push('**Permissions:** Updated');
    if (!d.length) return;
    sendLog(client, buildLogContainer({
        emoji: '✏️', title: 'Role Updated', description: `Role \`${n.name}\` was modified`,
        color: Colors.INFO,
        fields: [{ label: '📝 Changes', value: d.join('\n') }, { label: '🆔 ID', value: `\`${n.id}\`` }],
        footer: `Updated ${now()}`,
    }));
}

function logGuildUpdate(client, o, n) {
    const d = [];
    if (o.name                  !== n.name)                  d.push(`**Name:** ${o.name} → ${n.name}`);
    if (o.description           !== n.description)           d.push(`**Description:** ${o.description||'*None*'} → ${n.description||'*None*'}`);
    if (o.verificationLevel     !== n.verificationLevel)     d.push(`**Verification:** ${o.verificationLevel} → ${n.verificationLevel}`);
    if (o.explicitContentFilter !== n.explicitContentFilter) d.push(`**Content Filter:** ${o.explicitContentFilter} → ${n.explicitContentFilter}`);
    if (o.afkTimeout            !== n.afkTimeout)            d.push(`**AFK Timeout:** ${o.afkTimeout}s → ${n.afkTimeout}s`);
    if (!d.length) return;
    sendLog(client, buildLogContainer({
        emoji: '⚙️', title: 'Server Updated', description: `**${n.name}** settings changed`,
        color: Colors.INFO, thumbnail: n.iconURL({ size: 64 }),
        fields: [{ label: '📝 Changes', value: d.join('\n') }],
        footer: `Updated ${now()}`,
    }));
}

function logEmojiCreate(client, emoji) {
    sendLog(client, buildLogContainer({
        emoji: '😄', title: 'Emoji Added', description: `**:${emoji.name}:** was added`,
        color: Colors.SUCCESS, thumbnail: emoji.imageURL(),
        fields: [
            { label: '📛 Name',      value: `:${emoji.name}:` },
            { label: '✨ Animated', value: emoji.animated ? 'Yes' : 'No' },
            { label: '🤖 Managed',  value: emoji.managed ? 'Yes' : 'No' },
            { label: '🆔 ID',       value: `\`${emoji.id}\`` },
        ], footer: `Added ${now()}`,
    }));
}
function logEmojiDelete(client, emoji) {
    sendLog(client, buildLogContainer({
        emoji: '😔', title: 'Emoji Removed', description: `**:${emoji.name}:** was removed`,
        color: Colors.DANGER, thumbnail: emoji.imageURL(),
        fields: [{ label: '📛 Name', value: `:${emoji.name}:` }, { label: '🆔 ID', value: `\`${emoji.id}\`` }],
        footer: `Removed ${now()}`,
    }));
}
function logEmojiUpdate(client, o, n) {
    if (o.name === n.name) return;
    sendLog(client, buildLogContainer({
        emoji: '✏️', title: 'Emoji Renamed', description: 'An emoji was renamed',
        color: Colors.INFO, thumbnail: n.imageURL(),
        fields: [{ label: '❌ Old', value: `:${o.name}:` }, { label: '✅ New', value: `:${n.name}:` }],
        footer: `Renamed ${now()}`,
    }));
}
function logStickerCreate(client, s) {
    sendLog(client, buildLogContainer({
        emoji: '🎨', title: 'Sticker Added', description: `**${s.name}** was added`,
        color: Colors.SUCCESS,
        fields: [{ label: '📛 Name', value: s.name }, { label: '🏷️ Desc', value: s.description || 'None' }, { label: '🆔 ID', value: `\`${s.id}\`` }],
        footer: `Added ${now()}`,
    }));
}
function logStickerDelete(client, s) {
    sendLog(client, buildLogContainer({
        emoji: '🎨', title: 'Sticker Removed', description: `**${s.name}** was removed`,
        color: Colors.DANGER,
        fields: [{ label: '📛 Name', value: s.name }, { label: '🆔 ID', value: `\`${s.id}\`` }],
        footer: `Removed ${now()}`,
    }));
}
function logInviteCreate(client, inv) {
    sendLog(client, buildLogContainer({
        emoji: '🔗', title: 'Invite Created', description: 'A new invite was created',
        color: Colors.SUCCESS,
        fields: [
            { label: '🔗 Link',       value: inv.url },
            { label: '📍 Channel',    value: `<#${inv.channelId}>` },
            { label: '👤 By',         value: inv.inviter?.username || 'Unknown' },
            { label: '📈 Max Uses',   value: `${inv.maxUses || 'Unlimited'}` },
            { label: '⏰ Expires',    value: inv.maxAge ? `in ${Math.floor(inv.maxAge/3600)}h` : 'Never' },
            { label: '🔁 Temporary', value: inv.temporary ? 'Yes' : 'No' },
        ], footer: `Created ${now()}`,
    }));
}
function logInviteDelete(client, inv) {
    sendLog(client, buildLogContainer({
        emoji: '🔗', title: 'Invite Deleted', description: 'An invite was revoked',
        color: Colors.DANGER,
        fields: [
            { label: '🔗 Link',    value: inv.url },
            { label: '📍 Channel', value: `<#${inv.channelId}>` },
            { label: '👤 By',      value: inv.inviter?.username || 'Unknown' },
            { label: '📊 Uses',    value: `${inv.uses ?? '?'}` },
        ], footer: `Deleted ${now()}`,
    }));
}

function logVoiceStateUpdate(client, o, n) {
    const member = n.member; if (!member) return;
    if (!o.channelId && n.channelId)
        return sendLog(client, buildLogContainer({
            emoji: '🎙️', title: 'Joined Voice', description: `**${member.user.username}** joined a voice channel`,
            color: Colors.SUCCESS, thumbnail: member.user.displayAvatarURL({ size: 64 }),
            fields: [{ label: '👤 Member', value: member.user.username }, { label: '🔊 Channel', value: `<#${n.channelId}>` }],
            footer: `Joined ${now()}`,
        }));
    if (o.channelId && !n.channelId)
        return sendLog(client, buildLogContainer({
            emoji: '🔇', title: 'Left Voice', description: `**${member.user.username}** left a voice channel`,
            color: Colors.WARNING, thumbnail: member.user.displayAvatarURL({ size: 64 }),
            fields: [{ label: '👤 Member', value: member.user.username }, { label: '🔊 Channel', value: `<#${o.channelId}>` }],
            footer: `Left ${now()}`,
        }));
    if (o.channelId && n.channelId && o.channelId !== n.channelId)
        return sendLog(client, buildLogContainer({
            emoji: '↩️', title: 'Moved Voice', description: `**${member.user.username}** moved channels`,
            color: Colors.INFO, thumbnail: member.user.displayAvatarURL({ size: 64 }),
            fields: [{ label: '📤 From', value: `<#${o.channelId}>` }, { label: '📥 To', value: `<#${n.channelId}>` }],
            footer: `Moved ${now()}`,
        }));
    if (o.serverMute !== n.serverMute)
        sendLog(client, buildLogContainer({
            emoji: n.serverMute ? '🔇' : '🔊',
            title: n.serverMute ? 'Server Muted' : 'Server Unmuted',
            description: `**${member.user.username}** was ${n.serverMute ? 'server muted' : 'server unmuted'}`,
            color: n.serverMute ? Colors.WARNING : Colors.SUCCESS, thumbnail: member.user.displayAvatarURL({ size: 64 }),
            fields: [{ label: '👤 Member', value: member.user.username }, { label: '🔊 Channel', value: `<#${n.channelId}>` }],
            footer: now(),
        }));
}

function logStageInstanceCreate(client, si) {
    sendLog(client, buildLogContainer({
        emoji: '🎙️', title: 'Stage Started', description: `Stage started in <#${si.channelId}>`,
        color: Colors.INFO,
        fields: [{ label: '📢 Topic', value: si.topic }, { label: '📍 Channel', value: `<#${si.channelId}>` }],
        footer: `Started ${now()}`,
    }));
}
function logStageInstanceDelete(client, si) {
    sendLog(client, buildLogContainer({
        emoji: '🎙️', title: 'Stage Ended', description: `Stage in <#${si.channelId}> ended`,
        color: Colors.MUTED,
        fields: [{ label: '📢 Topic', value: si.topic }, { label: '📍 Channel', value: `<#${si.channelId}>` }],
        footer: `Ended ${now()}`,
    }));
}
function logGuildScheduledEventCreate(client, e) {
    sendLog(client, buildLogContainer({
        emoji: '📅', title: 'Event Scheduled', description: `**${e.name}** was scheduled`,
        color: Colors.SUCCESS,
        fields: [
            { label: '📛 Name',   value: e.name },
            { label: '📝 Desc',   value: e.description?.substring(0,200) || 'None' },
            { label: '⏰ Starts', value: ts(e.scheduledStartTimestamp) },
            { label: '👤 By',     value: e.creator?.username || 'Unknown' },
        ], footer: `Created ${now()}`,
    }));
}
function logGuildScheduledEventDelete(client, e) {
    sendLog(client, buildLogContainer({
        emoji: '📅', title: 'Event Cancelled', description: `**${e.name}** was cancelled`,
        color: Colors.DANGER,
        fields: [{ label: '📛 Name', value: e.name }, { label: '⏰ Was At', value: ts(e.scheduledStartTimestamp) }],
        footer: `Cancelled ${now()}`,
    }));
}
function logModerationAction(client, action, user, reason, moderator) {
    sendLog(client, buildLogContainer({
        emoji: '⚖️', title: `Mod: ${action}`, description: `Action taken against **${user.username}**`,
        color: Colors.MODERATION, thumbnail: user.displayAvatarURL({ size: 64 }),
        fields: [
            { label: '👤 Target', value: userTag(user) },
            { label: '⚖️ Action', value: action },
            { label: '🔨 By',     value: moderator || 'Unknown' },
            { label: '📝 Reason', value: reason || 'None' },
        ], footer: `${now()}`,
    }));
}

function setupServerLogs(client) {
    client.on('guildMemberAdd', m => logMemberJoin(client, m));
    client.on('guildMemberRemove', async (m) => {
        try {
            const logs = await m.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick });
            const e = logs.entries.first();
            (e && e.target.id === m.id && Date.now() - e.createdTimestamp < 5000)
                ? logMemberKick(client, m, e.executor?.username, e.reason)
                : logMemberLeave(client, m);
        } catch { logMemberLeave(client, m); }
    });
    client.on('guildBanAdd', async (ban) => {
        try { const l = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }); logMemberBan(client, ban, l.entries.first()?.executor?.username); }
        catch { logMemberBan(client, ban); }
    });
    client.on('guildBanRemove', async (ban) => {
        try { const l = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanRemove }); logMemberUnban(client, ban, l.entries.first()?.executor?.username); }
        catch { logMemberUnban(client, ban); }
    });
    client.on('guildMemberUpdate', async (o, n) => {
        n.roles.cache.filter(r => !o.roles.cache.has(r.id)).forEach(r => logMemberRoleAdd(client, n, r));
        o.roles.cache.filter(r => !n.roles.cache.has(r.id)).forEach(r => logMemberRoleRemove(client, n, r));
        if (o.nickname !== n.nickname) logMemberNicknameChange(client, n, o.nickname, n.nickname);
        if (!o.communicationDisabledUntilTimestamp && n.communicationDisabledUntilTimestamp) {
            try { const l = await n.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate }); const e = l.entries.first(); logMemberTimeout(client, n, e?.executor?.username, n.communicationDisabledUntilTimestamp, e?.reason); }
            catch { logMemberTimeout(client, n, null, n.communicationDisabledUntilTimestamp, null); }
        }
        if (o.communicationDisabledUntilTimestamp && !n.communicationDisabledUntilTimestamp) {
            try { const l = await n.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate }); logMemberTimeoutRemove(client, n, l.entries.first()?.executor?.username); }
            catch { logMemberTimeoutRemove(client, n, null); }
        }
    });
    client.on('messageDelete',     m       => logMessageDelete(client, m));
    client.on('messageUpdate',     (o, n)  => logMessageEdit(client, o, n));
    client.on('messageDeleteBulk', msgs    => logBulkMessageDelete(client, msgs));
    client.on('channelCreate',  ch         => logChannelCreate(client, ch));
    client.on('channelDelete',  ch         => logChannelDelete(client, ch));
    client.on('channelUpdate',  (o, n)     => logChannelUpdate(client, o, n));
    client.on('threadCreate',   (t, isNew) => logThreadCreate(client, t, isNew));
    client.on('threadDelete',   t          => logThreadDelete(client, t));
    client.on('roleCreate',  r      => logRoleCreate(client, r));
    client.on('roleDelete',  r      => logRoleDelete(client, r));
    client.on('roleUpdate',  (o, n) => logRoleUpdate(client, o, n));
    client.on('guildUpdate', (o, n) => logGuildUpdate(client, o, n));
    client.on('emojiCreate',   e      => logEmojiCreate(client, e));
    client.on('emojiDelete',   e      => logEmojiDelete(client, e));
    client.on('emojiUpdate',   (o, n) => logEmojiUpdate(client, o, n));
    client.on('stickerCreate', s      => logStickerCreate(client, s));
    client.on('stickerDelete', s      => logStickerDelete(client, s));
    client.on('inviteCreate',  i      => logInviteCreate(client, i));
    client.on('inviteDelete',  i      => logInviteDelete(client, i));
    client.on('voiceStateUpdate',          (o, n) => logVoiceStateUpdate(client, o, n));
    client.on('stageInstanceCreate',       si     => logStageInstanceCreate(client, si));
    client.on('stageInstanceDelete',       si     => logStageInstanceDelete(client, si));
    client.on('guildScheduledEventCreate', e      => logGuildScheduledEventCreate(client, e));
    client.on('guildScheduledEventDelete', e      => logGuildScheduledEventDelete(client, e));
    console.log('✅ Server logging (Components V2) initialized!');
}

module.exports = {
    setupServerLogs, sendLog, sendWelcomeMessage, buildLogContainer,
    logMemberJoin, logMemberLeave, logMemberKick, logMemberBan, logMemberUnban,
    logMemberTimeout, logMemberTimeoutRemove, logMemberNicknameChange,
    logMemberRoleAdd, logMemberRoleRemove,
    logMessageDelete, logMessageEdit, logBulkMessageDelete, logMessagePin,
    logChannelCreate, logChannelDelete, logChannelUpdate, logThreadCreate, logThreadDelete,
    logRoleCreate, logRoleDelete, logRoleUpdate, logGuildUpdate,
    logEmojiCreate, logEmojiDelete, logEmojiUpdate, logStickerCreate, logStickerDelete,
    logInviteCreate, logInviteDelete, logVoiceStateUpdate,
    logStageInstanceCreate, logStageInstanceDelete,
    logGuildScheduledEventCreate, logGuildScheduledEventDelete,
    logModerationAction,
};
