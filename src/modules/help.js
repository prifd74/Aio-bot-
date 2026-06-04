const {
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    MessageFlags
} = require('discord.js');

const OWNER_ID = '796001480406466601';

const COMMANDS = {
    general: [
        {
            name: 'l.waifu',
            description: 'Random waifu image with Smash/Pass voting system',
            usage: 'l.waifu',
            icon: '👧'
        },
        {
            name: 'l.pfp',
            description: 'Select random profile pictures (boy, girl, or couple)',
            usage: 'l.pfp [boy|girl|couple]',
            icon: '🖼️'
        },
        {
            name: 'l.edit',
            description: 'Edit images with 50+ effects (grayscale, blur, pixelate, cartoonize, etc.)',
            usage: 'l.edit [effect] [image_url/attachment]',
            icon: '🎨'
        },
        {
            name: 'l.action',
            description: 'Anime action commands (hug, kiss, pat, cuddle, etc.)',
            usage: 'l.action [hug|kiss|pat|cuddle|...] [@user]',
            icon: '👋'
        },
        {
            name: 'l.ping',
            description: 'Display bot ping and latency statistics',
            usage: 'l.ping',
            icon: '📡'
        },
        {
            name: 'l.cpu',
            description: 'System monitor showing CPU, RAM, and heap usage',
            usage: 'l.cpu',
            icon: '⚙️'
        },
        {
            name: 'l.serverinfo',
            description: 'Display server statistics and information',
            usage: 'l.serverinfo',
            icon: '🏛️'
        },
        {
            name: 'l.userinfo',
            description: 'Display user profile and statistics',
            usage: 'l.userinfo [@user]',
            icon: '👤'
        },
        {
            name: 'l.overview',
            description: 'View personalized activity overview and statistics card',
            usage: 'l.overview [@user]',
            icon: '📊'
        },
        {
            name: 'luna ship @user1 @user2',
            description: 'Generate a compatibility ship card for two users',
            usage: 'luna ship @user1 @user2',
            icon: '💕'
        }
    ],
    reminders: [
        {
            name: 'l.remind <time> <message>',
            description: 'Set a reminder for later (supports m, h, d units)',
            usage: 'l.remind 10m Remember to hydrate!',
            icon: '⏰'
        },
        {
            name: 'l.reminders',
            description: 'List all your active reminders',
            usage: 'l.reminders',
            icon: '📝'
        },
        {
            name: 'l.unremind <id>',
            description: 'Delete a reminder by ID',
            usage: 'l.unremind 1',
            icon: '❌'
        }
    ],
    leaderboard: [
        {
            name: 'l.top',
            description: 'View the weekly leaderboard (messages & images)',
            usage: 'l.top',
            icon: '🏆'
        }
    ],
    music: [
        {
            name: 'Music Commands',
            description: 'Search and play music in the music channel (buttons to play, pause, skip, queue)',
            usage: 'Type in the music channel or use slash commands',
            icon: '🎵'
        }
    ],
    chat: [
        {
            name: 'Chat Channel',
            description: 'Chat with Luna AI in the designated chat channel',
            usage: 'Just type naturally in the chat channel!',
            icon: '💬'
        },
        {
            name: 'Image Generation',
            description: 'Generate images using AI in the image channel',
            usage: 'Describe the image you want (add "gif" for animated)',
            icon: '🖌️'
        }
    ],
    owner: [
        {
            name: '!apistatus',
            description: '[OWNER] Show API keys status dashboard',
            usage: '!apistatus',
            icon: '🔑',
            ownerOnly: true
        },
        {
            name: '!secstatus',
            description: '[OWNER] Show security system status',
            usage: '!secstatus',
            icon: '🛡️',
            ownerOnly: true
        },
        {
            name: '!stats [@user]',
            description: '[OWNER] View detailed statistics for any user',
            usage: '!stats @user',
            icon: '📈',
            ownerOnly: true
        },
        {
            name: '!cleanup',
            description: '[OWNER] Remove old messages from database',
            usage: '!cleanup',
            icon: '🧹',
            ownerOnly: true
        },
        {
            name: '!leaderboard',
            description: '[OWNER] Force post the weekly leaderboard',
            usage: '!leaderboard',
            icon: '📋',
            ownerOnly: true
        },
        {
            name: '!setavatar',
            description: '[OWNER] Change bot avatar from folder',
            usage: '!setavatar',
            icon: '🎭',
            ownerOnly: true
        },
        {
            name: '!ticketpanel',
            description: '[OWNER] Post the ticket support panel',
            usage: '!ticketpanel',
            icon: '🎫',
            ownerOnly: true
        },
        {
            name: '!secwhitelist <add|remove> <user|role|channel|link> <value>',
            description: '[OWNER] Manage security whitelist',
            usage: '!secwhitelist add user 123456789',
            icon: '✅',
            ownerOnly: true
        },
        {
            name: '!restart',
            description: '[OWNER] Restart the bot',
            usage: '!restart',
            icon: '🔄',
            ownerOnly: true
        },
        {
            name: 'l.nuke',
            description: '[OWNER] Animated server nuke prank (visual only)',
            usage: 'l.nuke',
            icon: '💣',
            ownerOnly: true
        }
    ]
};

function buildHelpEmbed(isOwner = false) {
    const container = new ContainerBuilder().setAccentColor(0x9B5CFF);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## 📚 Luna Commands Directory\n` +
            `-# Complete guide to all available commands`
        )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));

    let generalText = `**🎮 General Commands**\n`;
    COMMANDS.general.forEach((cmd, idx) => {
        generalText += `${cmd.icon} \`${cmd.name}\` — ${cmd.description}\n`;
    });
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(generalText));

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(1));

    let remindersText = `**⏰ Reminder System**\n`;
    COMMANDS.reminders.forEach((cmd) => {
        remindersText += `${cmd.icon} \`${cmd.name}\` — ${cmd.description}\n`;
    });
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(remindersText));

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(1));

    let leaderboardText = `**🏆 Leaderboard**\n`;
    COMMANDS.leaderboard.forEach((cmd) => {
        leaderboardText += `${cmd.icon} \`${cmd.name}\` — ${cmd.description}\n`;
    });
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(leaderboardText));

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(1));

    let musicText = `**🎵 Music System**\n`;
    COMMANDS.music.forEach((cmd) => {
        musicText += `${cmd.icon} **${cmd.name}** — ${cmd.description}\n`;
    });
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(musicText));

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(1));

    let chatText = `**💬 Chat & Images**\n`;
    COMMANDS.chat.forEach((cmd) => {
        chatText += `${cmd.icon} **${cmd.name}** — ${cmd.description}\n`;
    });
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(chatText));

    if (isOwner) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
        let ownerText = `**👑 Owner-Only Commands**\n`;
        COMMANDS.owner.forEach((cmd) => {
            ownerText += `${cmd.icon} \`${cmd.name}\` — ${cmd.description}\n`;
        });
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(ownerText));
    }

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `-# 💡 Use \`l.help [command]\` for detailed usage info\n` +
            `-# 🌟 React with ❓ on any message for quick command help`
        )
    );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildDetailedCommandHelp(commandName) {
    const findCommand = (name) => {
        for (const category in COMMANDS) {
            const cmd = COMMANDS[category].find(c => c.name.toLowerCase().startsWith(name.toLowerCase()));
            if (cmd) return cmd;
        }
        return null;
    };

    const command = findCommand(commandName);
    if (!command) {
        const container = new ContainerBuilder().setAccentColor(0xFF4FA3);
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`❌ Command not found: \`${commandName}\`\n\nUse \`l.help\` to see all available commands!`)
        );
        return { components: [container], flags: MessageFlags.IsComponentsV2 };
    }

    const container = new ContainerBuilder().setAccentColor(0x9B5CFF);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ${command.icon} ${command.name}\n` +
            `-# Detailed Information`
        )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `**Description**\n${command.description}\n\n` +
            `**Usage**\n\`\`\`\n${command.usage}\n\`\`\`\n\n` +
            `**Example**\n\`\`\`\n${command.usage.split('[')[0]}example\n\`\`\`${command.ownerOnly ? '\n\n⚠️ **Owner-Only Command**' : ''}`
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# Use \`l.help\` to see all commands`)
    );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

async function handleHelpCommand(message) {
    const args = message.content.toLowerCase().split(' ');
    const isOwner = message.author.id === OWNER_ID;

    if (args.length === 1 || !args[1]) {
        await message.reply(buildHelpEmbed(isOwner));
    } else {
        const commandName = args.slice(1).join(' ');
        await message.reply(buildDetailedCommandHelp(commandName));
    }
}

module.exports = { handleHelpCommand };
