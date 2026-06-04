

const {
    ChannelType,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ThumbnailBuilder,
    SectionBuilder,
    MessageFlags,
    AttachmentBuilder,
} = require('discord.js');

const fs   = require('fs');
const path = require('path');

const DATA_DIR     = path.join(__dirname, '..', 'data');
const TICKETS_FILE = path.join(DATA_DIR, 'tickets.json');
const COUNTER_FILE = path.join(DATA_DIR, 'ticket_counter.json');

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadTickets() {
    ensureDataDir();
    if (!fs.existsSync(TICKETS_FILE)) return {};
    try { return JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8')); } catch { return {}; }
}

function saveTickets(data) {
    ensureDataDir();
    fs.writeFileSync(TICKETS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function loadCounter() {
    ensureDataDir();
    if (!fs.existsSync(COUNTER_FILE)) return 1000;
    try { return JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8')).counter ?? 1000; } catch { return 1000; }
}

function saveCounter(n) {
    ensureDataDir();
    fs.writeFileSync(COUNTER_FILE, JSON.stringify({ counter: n }, null, 2), 'utf8');
}

const ticketStore = new Map(Object.entries(loadTickets()));
let ticketCounter = loadCounter();

function persistTicket(ticket) {
    ticketStore.set(ticket.channelId, ticket);
    const obj = {};
    for (const [k, v] of ticketStore) obj[k] = v;
    saveTickets(obj);
}

function persistCounter() {
    saveCounter(ticketCounter);
}

const TICKET_TYPES = [
    {
        id: 'general',
        label: '📋 General Support',
        description: 'General questions & help',
        emoji: '📋',
        envKey: 'CATEGORY_GENERAL',
        color: 0x5865F2,
        welcome: 'Please describe your issue and a staff member will be with you shortly.',
    },
    {
        id: 'billing',
        label: '💳 Billing Support',
        description: 'Payments, subscriptions & billing',
        emoji: '💳',
        envKey: 'CATEGORY_BILLING',
        color: 0xFEE75C,
        welcome: 'Please describe your billing issue and include any relevant order or transaction IDs.',
    },
    {
        id: 'coding',
        label: '💻 Coding Support',
        description: 'Technical help & coding questions',
        emoji: '💻',
        envKey: 'CATEGORY_CODING',
        color: 0x57F287,
        welcome: 'Please share your code snippet or describe your technical issue in detail.',
    },
    {
        id: 'report',
        label: '🚨 Report User/Staff',
        description: 'Report a user or staff member',
        emoji: '🚨',
        envKey: 'CATEGORY_REPORT',
        color: 0xED4245,
        welcome: 'Please provide the username, user ID, and any evidence for your report.',
    },
    {
        id: 'reward',
        label: '🎁 Claim Reward',
        description: 'Claim your earned rewards',
        emoji: '🎁',
        envKey: 'CATEGORY_REWARD',
        color: 0xEB459E,
        welcome: 'Please provide your reward details and any proof of eligibility.',
    },
];

function getTypeConfig(typeId) {
    return TICKET_TYPES.find(t => t.id === typeId);
}

function getCategoryId(typeId) {
    const t = getTypeConfig(typeId);
    return t ? process.env[t.envKey] : null;
}

function escapeHtml(str = '') {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ─── Components V2 builders ───────────────────────────────────────────────────

/**
 * Panel component.
 * imageUrl — pass 'attachment://panel.png' when sending with a file attachment,
 *            or null to skip the thumbnail.
 *
 * ⚠️ IMPORTANT: When MessageFlags.IsComponentsV2 is set, the message payload
 * must NOT include a top-level `content` field. Everything — including pings —
 * must live inside TextDisplayBuilder components.
 */
function buildPanelComponent(imageUrl = null) {
    const container = new ContainerBuilder().setAccentColor(0x5865F2);

    const headerText =
        `# 🎫 Support Center\n` +
        `Welcome to our support system! Our staff team is here to help you.\n` +
        `Open a ticket and we'll get back to you as soon as possible.\n\n` +
        `> 🕐 Average response time: **10 – 30 minutes**`;

    if (imageUrl) {
        const header = new SectionBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerText))
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(imageUrl));
        container.addSectionComponents(header);
    } else {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(headerText));
    }

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(2));

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### 📂 Support Categories`)
    );

    const colorDots = { general: '🔵', billing: '🟡', coding: '🟢', report: '🔴', reward: '🟣' };
    const categoryLines = TICKET_TYPES.map(t =>
        `${colorDots[t.id] ?? '⚪'} **${t.label}**\n> ${t.description}`
    ).join('\n\n');

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(categoryLines));

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `> 📌 Check our FAQ or help channels before opening a ticket.\n` +
            `> ⚠️ Ticket system abuse may result in restrictions.\n` +
            `-# Staff are volunteers · Response times may vary`
        )
    );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildTicketComponent(opener, typeConfig, ticketNumber) {
    const container = new ContainerBuilder().setAccentColor(typeConfig.color);

    const header = new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## ${typeConfig.emoji} Ticket #${ticketNumber}\n` +
                `**Category:** ${typeConfig.label}\n` +
                `**Opened by:** <@${opener.id}>`
            )
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(opener.displayAvatarURL({ size: 128 })));

    container.addSectionComponents(header);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `### 👋 Welcome, <@${opener.id}>!\n${typeConfig.welcome}`
        )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(1));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `> **Opened** — <t:${Math.floor(Date.now() / 1000)}:F> (<t:${Math.floor(Date.now() / 1000)}:R>)\n` +
            `-# Staff have been notified · Use the buttons below to manage this ticket`
        )
    );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

/**
 * Staff ping — CV2 requires pings to be inside a TextDisplay, NOT in `content`.
 */
function buildStaffPingComponent(staffRoleId) {
    const container = new ContainerBuilder().setAccentColor(0x5865F2);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`<@&${staffRoleId}> — New ticket opened, please assist!`)
    );
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildClaimedComponent(ticket, claimerMember) {
    const container = new ContainerBuilder().setAccentColor(0x57F287);
    const header = new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## ✅ Ticket Claimed\n` +
                `<@${claimerMember.id}> is now handling this ticket.\n\n` +
                `**Opener** — <@${ticket.openerId}>\n` +
                `**Claimed by** — <@${claimerMember.id}>\n` +
                `**Claimed at** — <t:${Math.floor(Date.now() / 1000)}:F>`
            )
        )
        .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(claimerMember.user.displayAvatarURL({ size: 128 }))
        );
    container.addSectionComponents(header);
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildClosedNoticeComponent(ticket) {
    const container = new ContainerBuilder().setAccentColor(0xED4245);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## 🔒 Ticket Closed\n` +
            `This ticket has been closed. The opener can no longer see this channel.\n\n` +
            `**Opened by** — <@${ticket.openerId}>\n` +
            `${ticket.claimerId ? `**Handled by** — <@${ticket.claimerId}>\n` : ''}` +
            `**Closed at** — <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
            `-# Transcript is being generated · Use the button below to delete this channel`
        )
    );
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildRatingComponent(ticketId, channelName) {
    const container = new ContainerBuilder().setAccentColor(0xFEE75C);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ⭐ Rate Your Support Experience\n` +
            `Your ticket **${channelName}** has been closed.\n\n` +
            `How would you rate the support you received?`
        )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('-# This rating helps us improve our support quality')
    );
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildRatingLogComponent(rating, ticket, raterUser, claimerTag) {
    const stars = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
    const color = rating >= 4 ? 0x57F287 : rating >= 3 ? 0xFEE75C : 0xED4245;

    const container = new ContainerBuilder().setAccentColor(color);
    const header = new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ⭐ New Ticket Rating\n${stars} **${rating}/5**`)
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(raterUser.displayAvatarURL({ size: 128 })));

    container.addSectionComponents(header);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `**Ticket** — \`${ticket.channelName}\`\n` +
            `**Category** — ${ticket.typeId}\n` +
            `**Rated by** — <@${raterUser.id}>\n` +
            `${claimerTag ? `**Staff** — ${claimerTag}\n` : ''}` +
            `**Rated at** — <t:${Math.floor(Date.now() / 1000)}:F>`
        )
    );
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

// ─── Action rows ──────────────────────────────────────────────────────────────
function buildTicketActionRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setEmoji('✋').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    );
}

function buildDeleteActionRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_delete').setLabel('Delete Channel').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
    );
}

function buildRatingActionRow(ticketId) {
    return new ActionRowBuilder().addComponents(
        ...[1, 2, 3, 4, 5].map(n =>
            new ButtonBuilder()
                .setCustomId(`ticket_rate_${ticketId}_${n}`)
                .setLabel(`${n}⭐`)
                .setStyle(n >= 4 ? ButtonStyle.Success : n === 3 ? ButtonStyle.Secondary : ButtonStyle.Danger)
        )
    );
}

// ─── Transcript generator ─────────────────────────────────────────────────────
async function fetchAllMessages(channel) {
    const messages = [];
    let lastId = null;
    while (true) {
        const opts = { limit: 100 };
        if (lastId) opts.before = lastId;
        const batch = await channel.messages.fetch(opts);
        if (!batch.size) break;
        messages.push(...batch.values());
        lastId = batch.last().id;
        if (batch.size < 100 || messages.length >= 500) break;
    }
    return messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

function buildHtmlTranscript(messages, ticket) {
    const typeConfig = getTypeConfig(ticket.typeId) || { label: 'Support', color: 0x5865F2, emoji: '🎫' };

    const rows = messages.map(msg => {
        const time = new Date(msg.createdTimestamp).toLocaleString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });
        const avatarUrl = msg.author.displayAvatarURL({ extension: 'png', size: 64 });
        const isBot = msg.author.bot;
        let content = escapeHtml(msg.content || '');

        if (msg.embeds.length > 0) {
            content += msg.embeds.map(e =>
                `<div class="embed">
                    ${e.title ? `<div class="embed-title">${escapeHtml(e.title)}</div>` : ''}
                    ${e.description ? `<div class="embed-desc">${escapeHtml(e.description)}</div>` : ''}
                </div>`
            ).join('');
        }

        if (msg.attachments.size > 0) {
            content += [...msg.attachments.values()].map(att =>
                att.contentType?.startsWith('image/')
                    ? `<br><img class="att-img" src="${att.url}" alt="attachment">`
                    : `<br><a class="att-link" href="${att.url}" target="_blank">📎 ${escapeHtml(att.name)}</a>`
            ).join('');
        }

        return `<div class="msg${isBot ? ' bot' : ''}">
            <img class="av" src="${avatarUrl}" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'" alt="">
            <div class="body">
                <div class="head">
                    <span class="name${isBot ? ' bname' : ''}">${escapeHtml(msg.author.username)}${isBot ? ' <span class="badge">BOT</span>' : ''}</span>
                    <span class="ts">${time}</span>
                </div>
                <div class="content">${content || '<em class="empty">—</em>'}</div>
            </div>
        </div>`;
    }).join('');

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Transcript — ${escapeHtml(ticket.channelName)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0d1117;color:#c9d1d9;font-family:'Segoe UI',system-ui,sans-serif;font-size:14px}
.hdr{background:linear-gradient(135deg,#1f2937,#111827);padding:20px 28px;border-bottom:1px solid #30363d;display:flex;align-items:center;gap:14px}
.hdr-icon{width:44px;height:44px;background:#5865F2;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.hdr-info h1{font-size:18px;font-weight:700;color:#f0f6fc}
.hdr-info p{color:#8b949e;font-size:12px;margin-top:2px}
.meta{background:#161b22;padding:10px 28px;border-bottom:1px solid #30363d;display:flex;gap:28px;flex-wrap:wrap}
.mi{display:flex;flex-direction:column}
.ml{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#8b949e}
.mv{font-size:12px;color:#c9d1d9;margin-top:2px}
.msgs{padding:12px 28px;max-width:860px}
.msg{display:flex;gap:12px;padding:7px 0;border-bottom:1px solid #161b22}
.msg:hover{background:#161b22;margin:0 -28px;padding:7px 28px;border-radius:4px}
.bot{opacity:.8}
.av{width:38px;height:38px;border-radius:50%;flex-shrink:0;object-fit:cover}
.body{flex:1;min-width:0}
.head{display:flex;align-items:baseline;gap:8px;margin-bottom:3px}
.name{font-weight:600;color:#f0f6fc}
.bname{color:#5865F2}
.badge{background:#5865F2;color:#fff;font-size:9px;padding:1px 4px;border-radius:3px;text-transform:uppercase;font-weight:700}
.ts{font-size:11px;color:#6e7681}
.content{line-height:1.5;word-break:break-word;white-space:pre-wrap}
.embed{border-left:3px solid #5865F2;background:#161b22;padding:8px 12px;border-radius:0 4px 4px 0;margin-top:4px}
.embed-title{font-weight:600;color:#f0f6fc;margin-bottom:4px}
.embed-desc{color:#c9d1d9;font-size:13px}
.att-img{max-width:300px;max-height:200px;border-radius:6px;margin-top:6px;display:block}
.att-link{color:#58a6ff;text-decoration:none}
.att-link:hover{text-decoration:underline}
.empty{color:#6e7681;font-style:italic}
.footer{padding:16px 28px;border-top:1px solid #30363d;text-align:center;color:#6e7681;font-size:12px}
</style></head><body>
<div class="hdr">
    <div class="hdr-icon">${typeConfig.emoji}</div>
    <div class="hdr-info">
        <h1>Ticket Transcript — ${escapeHtml(ticket.channelName)}</h1>
        <p>${typeConfig.label} · ${messages.length} messages · Generated ${new Date().toLocaleString()}</p>
    </div>
</div>
<div class="meta">
    <div class="mi"><span class="ml">Opened by</span><span class="mv">${escapeHtml(ticket.openerTag)}</span></div>
    ${ticket.claimerTag ? `<div class="mi"><span class="ml">Handled by</span><span class="mv">${escapeHtml(ticket.claimerTag)}</span></div>` : ''}
    <div class="mi"><span class="ml">Category</span><span class="mv">${typeConfig.label}</span></div>
    <div class="mi"><span class="ml">Ticket #</span><span class="mv">${ticket.ticketNumber}</span></div>
    <div class="mi"><span class="ml">Opened</span><span class="mv">${new Date(ticket.openedAt).toLocaleString()}</span></div>
    <div class="mi"><span class="ml">Closed</span><span class="mv">${new Date().toLocaleString()}</span></div>
</div>
<div class="msgs">${rows}</div>
<div class="footer">Transcript generated by Umbra X Development Ticket System</div>
</body></html>`;
}

// ─── Core functions ───────────────────────────────────────────────────────────

/**
 * Send the ticket panel. Attaches image.png from the same directory if present.
 */
async function sendTicketPanel(client) {
    const channelId = process.env.TICKET_PANEL_CHANNEL_ID;
    if (!channelId) return console.warn('⚠️  TICKET_PANEL_CHANNEL_ID not set');

    const channel = client.channels.cache.get(channelId);
    if (!channel?.isTextBased()) return console.warn('⚠️  Ticket panel channel not found');

    const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('ticket_open_select')
            .setPlaceholder('🎫 Choose a support category...')
            .addOptions(TICKET_TYPES.map(t => ({
                label: t.label,
                description: t.description,
                value: t.id,
                emoji: t.emoji,
            })))
    );

    const imagePath = path.join(__dirname, 'image.png');
    const hasImage  = fs.existsSync(imagePath);

    if (hasImage) {
        const imageAttachment = new AttachmentBuilder(imagePath, { name: 'panel.png' });
        const panelPayload    = buildPanelComponent('attachment://panel.png');
        await channel.send({
            ...panelPayload,
            files: [imageAttachment],
            components: [...panelPayload.components, selectRow],
        });
    } else {
        const panelPayload = buildPanelComponent(null);
        await channel.send({
            ...panelPayload,
            components: [...panelPayload.components, selectRow],
        });
    }

    console.log('🎫 Ticket panel sent!');
}

/**
 * Open a new ticket channel for a user
 */
async function openTicket(interaction, typeId) {
    const guild      = interaction.guild;
    const opener     = interaction.member;
    const typeConfig = getTypeConfig(typeId);
    const categoryId = getCategoryId(typeId);

    if (!typeConfig) return interaction.reply({ content: '❌ Invalid ticket type.', ephemeral: true });

    const existing = [...ticketStore.values()].find(
        t => t.openerId === opener.id && t.typeId === typeId && t.status === 'open'
    );
    if (existing) {
        return interaction.reply({
            content: `❌ You already have an open ticket of this type: <#${existing.channelId}>`,
            ephemeral: true,
        });
    }

    await interaction.deferReply({ ephemeral: true });

    ticketCounter++;
    persistCounter();

    const ticketNumber = ticketCounter;
    const channelName  = `ticket-${typeId}-${ticketNumber}`;

    const overwrites = [
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        {
            id: opener.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        },
    ];

    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId) {
        overwrites.push({
            id: staffRoleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
        });
    }

    const channelOptions = {
        name: channelName,
        type: ChannelType.GuildText,
        permissionOverwrites: overwrites,
        topic: `Ticket #${ticketNumber} | ${typeConfig.label} | Opened by ${opener.user.username}`,
    };
    if (categoryId) channelOptions.parent = categoryId;

    const ticketChannel = await guild.channels.create(channelOptions);

    const ticketData = {
        channelId:   ticketChannel.id,
        channelName,
        openerId:    opener.id,
        openerTag:   opener.user.tag || opener.user.username,
        typeId,
        ticketNumber,
        status:      'open',
        claimerId:   null,
        claimerTag:  null,
        openedAt:    new Date().toISOString(),
        closedAt:    null,
        rating:      null,
        ratedAt:     null,
        raterTag:    null,
        guildId:     guild.id,
        guildName:   guild.name,
    };
    persistTicket(ticketData);

    // Staff ping — CV2: NO `content` field, use TextDisplay instead
    if (staffRoleId) {
        await ticketChannel.send(buildStaffPingComponent(staffRoleId));
    }

    // Welcome message + action buttons
    await ticketChannel.send({
        ...buildTicketComponent(opener.user, typeConfig, ticketNumber),
        components: [buildTicketActionRow()],
    });

    await interaction.editReply({ content: `✅ Your ticket has been opened: <#${ticketChannel.id}>` });
}

/**
 * Claim a ticket (staff only)
 */
async function claimTicket(interaction) {
    const channel = interaction.channel;
    const ticket  = ticketStore.get(channel.id);

    if (!ticket) return interaction.reply({ content: '❌ This is not a tracked ticket.', ephemeral: true });
    if (ticket.status !== 'open') return interaction.reply({ content: '❌ This ticket is not open.', ephemeral: true });

    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
        return interaction.reply({ content: '❌ Only staff can claim tickets.', ephemeral: true });
    }
    if (ticket.claimerId) {
        return interaction.reply({ content: `❌ Already claimed by <@${ticket.claimerId}>.`, ephemeral: true });
    }

    ticket.claimerId  = interaction.user.id;
    ticket.claimerTag = interaction.user.tag || interaction.user.username;
    persistTicket(ticket);

    await interaction.reply(buildClaimedComponent(ticket, interaction.member));

    // Post a visible message so the opener knows staff is coming
    const waitContainer = new ContainerBuilder().setAccentColor(0x57F287);
    waitContainer.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ⏳ Staff is on the way!\n` +
            `<@${ticket.openerId}> — Please hold on! <@${interaction.user.id}> has picked up your ticket and will be with you shortly.\n\n` +
            `> 💬 Feel free to describe your issue in detail while you wait.`
        )
    );
    await interaction.channel.send({ components: [waitContainer], flags: MessageFlags.IsComponentsV2 });
}

/**
 * Close a ticket — move to closed category, generate transcript, DM rating
 */
async function closeTicket(interaction) {
    const channel = interaction.channel;
    const ticket  = ticketStore.get(channel.id);

    if (!ticket) return interaction.reply({ content: '❌ This is not a tracked ticket.', ephemeral: true });
    if (ticket.status === 'closed') return interaction.reply({ content: '❌ Already closed.', ephemeral: true });

    // Staff only — opener can no longer close their own ticket
    const staffRoleId = process.env.STAFF_ROLE_ID;
    const isStaff     = staffRoleId ? interaction.member.roles.cache.has(staffRoleId) : false;

    if (!isStaff) {
        return interaction.reply({ content: '❌ Only staff can close tickets.', ephemeral: true });
    }

    ticket.status   = 'closed';
    ticket.closedAt = new Date().toISOString();
    persistTicket(ticket);

    // Send the closed notice with the Delete button
    const closedPayload = buildClosedNoticeComponent(ticket);
    await interaction.reply({
        ...closedPayload,
        components: [...closedPayload.components, buildDeleteActionRow()],
    });

    const closedCategoryId = process.env.CATEGORY_CLOSED;
    if (closedCategoryId) {
        try { await channel.setParent(closedCategoryId, { lockPermissions: false }); } catch (_) {}
    }

    // Revoke opener's access entirely — they can no longer see the channel
    try {
        await channel.permissionOverwrites.edit(ticket.openerId, {
            ViewChannel:        false,
            SendMessages:       false,
            ReadMessageHistory: false,
        });
    } catch (_) {}

    const messages   = await fetchAllMessages(channel);
    const html       = buildHtmlTranscript(messages, ticket);
    const htmlBuffer = Buffer.from(html, 'utf8');
    const attachment = new AttachmentBuilder(htmlBuffer, { name: `transcript-${ticket.channelName}.html` });

    const transcriptChannelId = process.env.TRANSCRIPT_LOG_CHANNEL_ID;
    if (transcriptChannelId) {
        const transcriptChannel = interaction.guild.channels.cache.get(transcriptChannelId);
        if (transcriptChannel?.isTextBased()) {
            const logContainer = new ContainerBuilder().setAccentColor(0x5865F2);
            logContainer.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## 📄 Ticket Transcript\n` +
                    `**Ticket** — \`${ticket.channelName}\`\n` +
                    `**Opened by** — <@${ticket.openerId}>\n` +
                    `${ticket.claimerId ? `**Handled by** — <@${ticket.claimerId}>\n` : ''}` +
                    `**Closed at** — <t:${Math.floor(Date.now() / 1000)}:F>\n` +
                    `**Messages** — ${messages.length}`
                )
            );
            // Send transcript log as a plain message (no CV2 flag) so the file attachment works reliably
            await transcriptChannel.send({
                components: [logContainer],
                flags: MessageFlags.IsComponentsV2,
            });
            await transcriptChannel.send({ files: [attachment] });
        }
    }

    try {
        const openerUser  = await interaction.client.users.fetch(ticket.openerId);
        const dmContainer = new ContainerBuilder().setAccentColor(0x5865F2);
        dmContainer.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## 📄 Your Ticket Transcript\nYour ticket **${ticket.channelName}** in **${interaction.guild.name}** has been closed.\n\nFind the full transcript attached below.`
            )
        );
        const dmAttachment = new AttachmentBuilder(htmlBuffer, { name: `transcript-${ticket.channelName}.html` });
        // Send DM notice then file separately — CV2 and files cannot be mixed
        await openerUser.send({ components: [dmContainer], flags: MessageFlags.IsComponentsV2 });
        await openerUser.send({ files: [dmAttachment] });

        setTimeout(async () => {
            try {
                const ratingRow = buildRatingActionRow(ticket.channelId);
                await openerUser.send({ ...buildRatingComponent(ticket.channelId, ticket.channelName), components: [ratingRow] });
            } catch (_) {}
        }, 2000);
    } catch (err) {
        console.log(`⚠️  Could not DM opener for ticket ${ticket.channelName}:`, err.message);
    }
}

/**
 * Handle a star rating submission from a DM button
 */
async function handleRating(interaction, ticketId, rating) {
    await interaction.deferUpdate();

    const ticket = ticketStore.get(ticketId);

    const disabledRow = new ActionRowBuilder().addComponents(
        ...[1, 2, 3, 4, 5].map(n =>
            new ButtonBuilder()
                .setCustomId(`ticket_rate_${ticketId}_${n}_done`)
                .setLabel(`${n}⭐`)
                .setStyle(n === rating ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setDisabled(true)
        )
    );
    try { await interaction.editReply({ components: [disabledRow] }); } catch (_) {}

    const thankContainer = new ContainerBuilder().setAccentColor(0x57F287);
    thankContainer.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ✅ Thanks for your rating!\nYou rated your support experience **${'⭐'.repeat(rating)}** (${rating}/5).\n\nYour feedback helps us improve!`
        )
    );
    try { await interaction.user.send({ components: [thankContainer], flags: MessageFlags.IsComponentsV2 }); } catch (_) {}

    if (ticket) {
        ticket.rating   = rating;
        ticket.ratedAt  = new Date().toISOString();
        ticket.raterTag = interaction.user.tag || interaction.user.username;
        persistTicket(ticket);
    }

    const ratingChannelId = process.env.RATING_LOG_CHANNEL_ID;
    if (ratingChannelId) {
        const ratingChannel = interaction.client.channels.cache.get(ratingChannelId);
        if (ratingChannel?.isTextBased()) {
            await ratingChannel.send(
                buildRatingLogComponent(rating, ticket || { channelName: ticketId, typeId: 'unknown' }, interaction.user, ticket?.claimerTag ?? null)
            );
        }
    }
}

/**
 * Delete a ticket channel (staff only)
 */
async function deleteTicket(interaction) {
    const channel = interaction.channel;
    const ticket  = ticketStore.get(channel.id);

    const staffRoleId = process.env.STAFF_ROLE_ID;
    const isStaff     = staffRoleId ? interaction.member.roles.cache.has(staffRoleId) : false;

    if (!isStaff) {
        return interaction.reply({ content: '❌ Only staff can delete ticket channels.', ephemeral: true });
    }

    if (ticket && ticket.status !== 'closed') {
        return interaction.reply({ content: '❌ Close the ticket before deleting it.', ephemeral: true });
    }

    await interaction.reply({ content: '🗑️ Deleting channel in 3 seconds...', ephemeral: true });

    setTimeout(async () => {
        try { await channel.delete('Ticket deleted by staff'); } catch (_) {}
    }, 3000);
}

// ─── Interaction router ───────────────────────────────────────────────────────
async function handleTicketInteraction(interaction) {
    // Support both old (isStringSelectMenu) and new (isStringSelect) discord.js API
    const isSelectMenu =
        (typeof interaction.isStringSelectMenu === 'function' && interaction.isStringSelectMenu()) ||
        (typeof interaction.isStringSelect      === 'function' && interaction.isStringSelect());

    if (isSelectMenu && interaction.customId === 'ticket_open_select') {
        await openTicket(interaction, interaction.values[0]);
        return true;
    }

    if (!interaction.isButton()) return false;
    const id = interaction.customId;

    if (id === 'ticket_claim')  { await claimTicket(interaction);  return true; }
    if (id === 'ticket_close')  { await closeTicket(interaction);  return true; }
    if (id === 'ticket_delete') { await deleteTicket(interaction); return true; }

    if (id.startsWith('ticket_rate_') && !id.endsWith('_done')) {
        const parts    = id.split('_');
        const stars    = parseInt(parts[parts.length - 1], 10);
        const ticketId = parts.slice(2, parts.length - 1).join('_');
        await handleRating(interaction, ticketId, stars);
        return true;
    }

    return false;
}

module.exports = { sendTicketPanel, handleTicketInteraction, TICKET_TYPES };