const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MessageFlags
} = require('discord.js');

const OWNER_ID = '796001480406466601';

const NUKE_STAGES = [
    { label: '🔴 INITIALIZING NUKE SEQUENCE...', bar: '░░░░░░░░░░', delay: 800 },
    { label: '🟡 TARGETING SERVER...',            bar: '██░░░░░░░░', delay: 900 },
    { label: '🟡 BYPASSING DISCORD SECURITY...',  bar: '████░░░░░░', delay: 900 },
    { label: '🟠 ACQUIRING CHANNEL LIST...',       bar: '██████░░░░', delay: 800 },
    { label: '🟠 LOADING DELETION PAYLOAD...',     bar: '████████░░', delay: 900 },
    { label: '🔴 DEPLOYING NUKE IN 3...',          bar: '█████████░', delay: 700 },
    { label: '🔴 DEPLOYING NUKE IN 2...',          bar: '█████████░', delay: 700 },
    { label: '🔴 DEPLOYING NUKE IN 1...',          bar: '██████████', delay: 700 },
];

function buildNukeFrame(stage, authorId) {
    const container = new ContainerBuilder().setAccentColor(0xFF0000);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ☢️ NUKE INITIATED ☢️\n` +
            `\`\`\`\n${stage.label}\n[${stage.bar}]\n\`\`\`` +
            `\n-# Initiated by <@${authorId}>`
        )
    );
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildNukeFinalFrame(authorId) {
    const container = new ContainerBuilder().setAccentColor(0xFF4500);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## 💥 SERVER NUKED 💥\n` +
            `\`\`\`diff\n` +
            `- All channels deleted\n` +
            `- All roles wiped\n` +
            `- All members banned\n` +
            `- Server obliterated\n` +
            `\`\`\``
        )
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(1)
    );
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `*just kidding lol 😄 nothing actually happened*\n` +
            `-# Prank by <@${authorId}> • Umbra X Development`
        )
    );
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildDeniedFrame() {
    const container = new ContainerBuilder().setAccentColor(0xFF0000);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## 🚫 Access Denied\nOnly the bot owner can use this command.`
        )
    );
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

async function handleNukeCommand(message) {
    

    if (message.author.id !== OWNER_ID) {
        await message.reply(buildDeniedFrame());
        return;
    }

    const sent = await message.reply(buildNukeFrame(NUKE_STAGES[0], message.author.id));

    for (let i = 1; i < NUKE_STAGES.length; i++) {
        await new Promise(r => setTimeout(r, NUKE_STAGES[i - 1].delay));
        try {
            await sent.edit(buildNukeFrame(NUKE_STAGES[i], message.author.id));
        } catch (err) {
            console.error(`[nuke] Failed to edit stage ${i}:`, err.message);
            return;
        }
    }

    await new Promise(r => setTimeout(r, NUKE_STAGES[NUKE_STAGES.length - 1].delay));
    try {
        await sent.edit(buildNukeFinalFrame(message.author.id));
    } catch (err) {
        console.error('[nuke] Failed to edit final frame:', err.message);
    }
}

module.exports = { handleNukeCommand };