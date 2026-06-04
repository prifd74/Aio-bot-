

const fs   = require('fs').promises;
const path = require('path');
const {
    ContainerBuilder, TextDisplayBuilder,
    SeparatorBuilder, MessageFlags
} = require('discord.js');

const REMINDERS_FILE = path.join(process.cwd(), 'data', 'reminders.json');

let reminders  = [];
let _client    = null;
let _checkLoop = null;

async function loadReminders() {
    try {
        const raw = await fs.readFile(REMINDERS_FILE, 'utf8');
        reminders = JSON.parse(raw);
        console.log(`⏰ Loaded ${reminders.length} reminder(s)`);
    } catch (err) {
        if (err.code === 'ENOENT') { reminders = []; await saveReminders(); }
        else { console.error('Error loading reminders:', err); reminders = []; }
    }
}

async function saveReminders() {
    try {
        await fs.mkdir(path.dirname(REMINDERS_FILE), { recursive: true });
        await fs.writeFile(REMINDERS_FILE, JSON.stringify(reminders, null, 2));
    } catch (err) { console.error('Error saving reminders:', err); }
}

function parseTimeString(input) {
    let totalMs = 0;
    const cleaned = input.toLowerCase().trim();

    

    const simpleShort = /(\d+)\s*([dhms])/g;
    let match;
    let foundShort = false;
    while ((match = simpleShort.exec(cleaned)) !== null) {
        foundShort = true;
        const val  = parseInt(match[1]);
        const unit = match[2];
        if      (unit === 's') totalMs += val * 1000;
        else if (unit === 'm') totalMs += val * 60 * 1000;
        else if (unit === 'h') totalMs += val * 60 * 60 * 1000;
        else if (unit === 'd') totalMs += val * 24 * 60 * 60 * 1000;
    }
    if (foundShort && totalMs > 0) return totalMs;

    

    const natPattern = /(\d+)\s*(second|minute|hour|day|sec|min|hr)/;
    const natMatch   = cleaned.match(natPattern);
    if (natMatch) {
        const val  = parseInt(natMatch[1]);
        const unit = natMatch[2];
        if      (unit.startsWith('sec')) totalMs = val * 1000;
        else if (unit.startsWith('min')) totalMs = val * 60 * 1000;
        else if (unit.startsWith('hour') || unit === 'hr') totalMs = val * 60 * 60 * 1000;
        else if (unit.startsWith('day'))                   totalMs = val * 24 * 60 * 60 * 1000;
        if (totalMs > 0) return totalMs;
    }

    return null;
}

function formatDuration(ms) {
    const totalSecs = Math.floor(ms / 1000);
    const d = Math.floor(totalSecs / 86400);
    const h = Math.floor((totalSecs % 86400) / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 && d === 0) parts.push(`${s}s`);
    return parts.join(' ') || '0s';
}

function sanitizeMentions(text) {
    return text
        .replace(/@everyone/gi, '@\u200beveryone')   

        .replace(/@here/gi,     '@\u200bhere')
        .replace(/<@[!&]?\d+>/g, '[mention]')        

        .replace(/<#\d+>/g,      '[channel]');        

}

function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function buildReminderSetComponent(reminderText, duration, fireAt, id, EMOJI) {
    const container = new ContainerBuilder().setAccentColor(0x7B68EE);
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## ⏰ Reminder Set! ${EMOJI.sparkle}\n` +
        `I'll ping you <t:${Math.floor(fireAt / 1000)}:R> at <t:${Math.floor(fireAt / 1000)}:T>\n\n` +
        `**📝 Message:** ${reminderText}\n` +
        `**⏱️ Duration:** \`${formatDuration(duration)}\`\n` +
        `-# ID: \`${id}\` • Use \`l.reminders\` to see all your reminders`
    ));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildReminderFireComponent(userId, reminderText, setAt, EMOJI) {
    const container = new ContainerBuilder().setAccentColor(0xFF69B4);
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## ⏰ Reminder! ${EMOJI.waving}\n` +
        `<@${userId}> Hey, you asked me to remind you about this:\n\n` +
        `**📝 ${reminderText}**\n\n` +
        `-# Set <t:${Math.floor(new Date(setAt).getTime() / 1000)}:R>`
    ));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildReminderListComponent(userReminders, userName, EMOJI) {
    const container = new ContainerBuilder().setAccentColor(0x7B68EE);
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## ⏰ ${userName}'s Reminders ${EMOJI.chai}`
    ));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));

    if (userReminders.length === 0) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `No active reminders! Use \`l.remind <time> <message>\` to set one ${EMOJI.sparkle}`
        ));
    } else {
        let listText = '';
        userReminders.forEach((r, i) => {
            listText += `**${i + 1}.** ${r.message}\n` +
                        `⏰ Fires <t:${Math.floor(r.fireAt / 1000)}:R> • \`ID: ${r.id}\`\n\n`;
        });
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(listText.trim()));
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `-# Use \`l.unremind <id>\` to cancel a reminder`
        ));
    }

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildReminderCancelComponent(id, reminderText, EMOJI) {
    const container = new ContainerBuilder().setAccentColor(0x00FF88);
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## ✅ Reminder Cancelled ${EMOJI.sparkle}\n` +
        `Removed: **${reminderText}**\n` +
        `-# ID: \`${id}\``
    ));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildInfoComponent(title, body, accentColor = 0x8B4513) {
    const container = new ContainerBuilder().setAccentColor(accentColor);
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}\n${body}`));
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

async function checkAndFireReminders(EMOJI) {
    if (!_client) return;
    const now = Date.now();
    const due = reminders.filter(r => r.fireAt <= now);
    if (due.length === 0) return;

    for (const r of due) {
        try {
            const channel = _client.channels.cache.get(r.channelId);
            if (channel?.isTextBased()) {
                await channel.send(buildReminderFireComponent(r.userId, r.message, r.createdAt, EMOJI));
            } else {
                const user = await _client.users.fetch(r.userId).catch(() => null);
                if (user) await user.send(buildReminderFireComponent(r.userId, r.message, r.createdAt, EMOJI)).catch(() => {});
            }
        } catch (err) {
            console.error(`Failed to fire reminder ${r.id}:`, err.message);
        }
    }

    

    reminders = reminders.filter(r => r.fireAt > now);
    await saveReminders();
}

async function handleRemindCommand(message, EMOJI) {
    

    const args     = message.content.slice('l.remind'.length).trim();
    const spaceIdx = args.search(/\s/);

    if (!args || spaceIdx === -1) {
        return message.reply(buildInfoComponent(
            '⏰ Reminder Usage',
            '`l.remind <time> <message>`\n\n**Examples:**\n`l.remind 10m check the oven`\n`l.remind 2h meeting time`\n`l.remind 1d water plants`\n\n**Time formats:** `30s` `10m` `2h` `1d` `1h30m`',
            0x7B68EE
        ));
    }

    const timeStr = args.slice(0, spaceIdx).trim();
    const msgText = sanitizeMentions(args.slice(spaceIdx).trim());

    if (!msgText) {
        return message.reply(buildInfoComponent('⏰ Missing Message', 'Please include a reminder message!\n`l.remind 10m <your message here>`', 0xFF0000));
    }

    const duration = parseTimeString(timeStr);
    if (!duration) {
        return message.reply(buildInfoComponent('⏰ Invalid Time', `Couldn't parse \`${timeStr}\`\nTry formats like: \`10m\` \`2h\` \`1d\` \`1h30m\``, 0xFF0000));
    }

    

    if (duration > 7 * 24 * 60 * 60 * 1000) {
        return message.reply(buildInfoComponent('⏰ Too Far Ahead', 'Maximum reminder duration is **7 days**!', 0xFF0000));
    }

    

    const userCount = reminders.filter(r => r.userId === message.author.id).length;
    if (userCount >= 10) {
        return message.reply(buildInfoComponent('⏰ Too Many Reminders', 'You have **10 active reminders** already — cancel one first with `l.unremind <id>`', 0xFF0000));
    }

    const fireAt = Date.now() + duration;
    const id     = makeId();

    reminders.push({
        id,
        userId:    message.author.id,
        channelId: message.channel.id,
        guildId:   message.guild?.id || null,
        message:   msgText,
        fireAt,
        createdAt: new Date().toISOString()
    });

    await saveReminders();
    await message.reply(buildReminderSetComponent(msgText, duration, fireAt, id, EMOJI));
}

async function handleRemindersListCommand(message, EMOJI) {
    const userReminders = reminders
        .filter(r => r.userId === message.author.id)
        .sort((a, b) => a.fireAt - b.fireAt);

    const userName = message.author.displayName || message.author.username;
    await message.reply(buildReminderListComponent(userReminders, userName, EMOJI));
}

async function handleUnremindCommand(message, EMOJI) {
    

    const id = message.content.slice('l.unremind'.length).trim();
    if (!id) {
        return message.reply(buildInfoComponent('ℹ️ Usage', '`l.unremind <id>`\nGet reminder IDs with `l.reminders`', 0x7B68EE));
    }

    const idx = reminders.findIndex(r => r.id === id && r.userId === message.author.id);
    if (idx === -1) {
        return message.reply(buildInfoComponent('❌ Not Found', `No reminder with ID \`${id}\` found for you!`, 0xFF0000));
    }

    const removed = reminders.splice(idx, 1)[0];
    await saveReminders();
    await message.reply(buildReminderCancelComponent(id, removed.message, EMOJI));
}

async function initializeReminders(client, EMOJI) {
    _client = client;
    await loadReminders();
    

    _checkLoop = setInterval(() => checkAndFireReminders(EMOJI), 15 * 1000);
    console.log('⏰ Reminder system initialized!');
}

module.exports = {
    initializeReminders,
    handleRemindCommand,
    handleRemindersListCommand,
    handleUnremindCommand
};