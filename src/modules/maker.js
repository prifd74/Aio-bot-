

const { createCanvas, loadImage } = require('canvas');
const sharp = require('sharp');
const axios = require('axios');
const {
    AttachmentBuilder,
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');

const COOLDOWN_MS = 10 * 1000;
const CANVAS_W    = 900;
const CANVAS_H    = 500;
const cooldowns   = new Map();

const THEMES = [
    { name: 'Midnight',    bg0: '#0a0a0a',  bg1: '#111111',  bg2: '#0d0d0d',  text: '#ffffff', accent: 0x1a1a1a },
    { name: 'Deep Navy',   bg0: '#0a0f1e',  bg1: '#0d1b2a',  bg2: '#0a0f1e',  text: '#e0e8ff', accent: 0x0d1b2a },
    { name: 'Dark Rose',   bg0: '#1a0a0e',  bg1: '#2a0d15',  bg2: '#1a0a0e',  text: '#ffe0e8', accent: 0x801336 },
    { name: 'Forest',      bg0: '#0a140a',  bg1: '#0d1f0d',  bg2: '#0a140a',  text: '#e0ffe0', accent: 0x06d6a0 },
    { name: 'Deep Purple', bg0: '#0f0a1e',  bg1: '#1a0d2e',  bg2: '#0f0a1e',  text: '#e8e0ff', accent: 0x8338ec },
    { name: 'Slate',       bg0: '#0d1117',  bg1: '#161b22',  bg2: '#0d1117',  text: '#c9d1d9', accent: 0x30363d },
    { name: 'Ember',       bg0: '#1a0a00',  bg1: '#2a1200',  bg2: '#1a0a00',  text: '#ffe8d0', accent: 0xe76f51 },
    { name: 'Arctic',      bg0: '#0a1520',  bg1: '#0d2030',  bg2: '#0a1520',  text: '#d0eeff', accent: 0x457b9d },
];

async function downloadAvatar(url) {
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
        return Buffer.from(res.data);
    } catch {
        return null;
    }
}

function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let current = '';

    for (const word of words) {
        

        let safeWord = word;
        while (ctx.measureText(safeWord).width > maxWidth && safeWord.length > 1) {
            safeWord = safeWord.slice(0, -1);
        }
        if (safeWord !== word) safeWord += '…';

        const test = current ? `${current} ${safeWord}` : safeWord;
        if (ctx.measureText(test).width > maxWidth && current) {
            lines.push(current);
            current = safeWord;
        } else {
            current = test;
        }
    }
    if (current) lines.push(current);
    return lines;
}

function fitText(ctx, text, maxWidth, availableH, startSize = 40, minSize = 16) {
    for (let fs = startSize; fs >= minSize; fs -= 2) {
        ctx.font = `${fs}px Georgia, serif`;
        const lines = wrapText(ctx, text, maxWidth);
        const lineH = fs * 1.45;
        const totalH = lines.length * lineH;
        if (totalH <= availableH) {
            return { fontSize: fs, lines, lineH };
        }
    }
    

    ctx.font = `${minSize}px Georgia, serif`;
    const lineH = minSize * 1.45;
    const maxLines = Math.floor(availableH / lineH);
    let lines = wrapText(ctx, text, maxWidth);
    if (lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        

        lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S+$/, '') + '…';
    }
    return { fontSize: minSize, lines, lineH };
}

async function generateQuoteImage(quoteText, author, themeIndex) {
    const idx   = (themeIndex >= 0 && themeIndex < THEMES.length)
        ? themeIndex
        : Math.floor(Math.random() * THEMES.length);
    const theme = THEMES[idx];

    const canvas = createCanvas(CANVAS_W, CANVAS_H);
    const ctx    = canvas.getContext('2d');

    

    const bgGrad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
    bgGrad.addColorStop(0,   theme.bg0);
    bgGrad.addColorStop(0.5, theme.bg1);
    bgGrad.addColorStop(1,   theme.bg2);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    

    const avatarAreaW = Math.round(CANVAS_W * 0.42);
    const textAreaX   = avatarAreaW + 40;
    const textAreaW   = CANVAS_W - textAreaX - 50;

    const avatarUrl = author.displayAvatarURL({ extension: 'png', size: 256 });
    const avatarBuf = await downloadAvatar(avatarUrl);

    if (avatarBuf) {
        try {
            const avatarImg = await loadImage(avatarBuf);
            ctx.drawImage(avatarImg, 0, 0, avatarAreaW, CANVAS_H);

            

            const overlay = ctx.createLinearGradient(0, 0, avatarAreaW, 0);
            overlay.addColorStop(0,   'rgba(0,0,0,0.15)');
            overlay.addColorStop(0.6, 'rgba(0,0,0,0.50)');
            overlay.addColorStop(1,   'rgba(0,0,0,0.92)');
            ctx.fillStyle = overlay;
            ctx.fillRect(0, 0, avatarAreaW, CANVAS_H);
        } catch (_) {
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, avatarAreaW, CANVAS_H);
        }
    } else {
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, avatarAreaW, CANVAS_H);
    }

    

    const sepGrad = ctx.createLinearGradient(avatarAreaW, 0, avatarAreaW, CANVAS_H);
    sepGrad.addColorStop(0,   'rgba(255,255,255,0)');
    sepGrad.addColorStop(0.3, 'rgba(255,255,255,0.07)');
    sepGrad.addColorStop(0.7, 'rgba(255,255,255,0.07)');
    sepGrad.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.strokeStyle = sepGrad;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(avatarAreaW, 30);
    ctx.lineTo(avatarAreaW, CANVAS_H - 30);
    ctx.stroke();

    

    ctx.font      = 'bold 110px Georgia, serif';
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillText('\u201C', textAreaX - 10, 130);

    

    

    

    const reservedAuthorH = 90;
    const padding         = 40; 

    const availableTextH  = CANVAS_H - padding - reservedAuthorH;

    

    const { fontSize, lines, lineH } = fitText(
        ctx, quoteText, textAreaW,
        availableTextH,
        40,   

        16    

    );

    ctx.font      = `${fontSize}px Georgia, serif`;
    ctx.fillStyle = theme.text;

    const totalTextH = lines.length * lineH;

    

    const startY = padding + (availableTextH - totalTextH) / 2 + lineH;

    for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], textAreaX, startY + i * lineH);
    }

    

    const authorY = CANVAS_H - reservedAuthorH + 10;

    const nameFontSize     = Math.max(14, Math.round(fontSize * 0.62));
    const usernameFontSize = Math.max(12, Math.round(fontSize * 0.48));

    ctx.font      = `italic ${nameFontSize}px Georgia, serif`;
    ctx.fillStyle = `${theme.text}bf`; 

    ctx.fillText(`\u2013 ${author.displayName || author.username}`, textAreaX, authorY);

    ctx.font      = `${usernameFontSize}px "Courier New", monospace`;
    ctx.fillStyle = `${theme.text}61`; 

    ctx.fillText(`@${author.username}`, textAreaX, authorY + nameFontSize + 6);

    

    ctx.font      = '13px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.textAlign = 'right';
    ctx.fillText('Luna • Umbra X Development', CANVAS_W - 20, CANVAS_H - 16);
    ctx.textAlign = 'left';

    

    const rawBuffer = canvas.toBuffer('image/png');
    const finalBuffer = await sharp(rawBuffer).png({ compressionLevel: 8 }).toBuffer();

    return { buffer: finalBuffer, themeIndex: idx };
}

function buildButtons(themeIndex, quoteText, authorId) {
    

    

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`qmaker_prev:${themeIndex}:${authorId}`)
            .setLabel('⬅ Prev')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`qmaker_rand:${themeIndex}:${authorId}`)
            .setLabel('🎨 Random')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`qmaker_next:${themeIndex}:${authorId}`)
            .setLabel('Next ➡')
            .setStyle(ButtonStyle.Secondary),
    );
}

async function handleMention(message, client) {
    const userId = message.author.id;
    const now    = Date.now();

    

    const lastCd = cooldowns.get(userId);
    if (lastCd && now - lastCd < COOLDOWN_MS) {
        const rem = Math.ceil((COOLDOWN_MS - (now - lastCd)) / 1000);
        await message.reply({
            content: `⏳ Quote cooldown — try again in **${rem}s**~`,
            allowedMentions: { repliedUser: false }
        });
        return;
    }

    

    let quotedMessage;
    try {
        quotedMessage = await message.channel.messages.fetch(message.reference.messageId);
    } catch (e) {
        await message.reply({
            content: '❌ Couldn\'t fetch the message you replied to!',
            allowedMentions: { repliedUser: false }
        });
        return;
    }

    

    let quoteText = quotedMessage.content?.trim();
    quoteText = quoteText?.replace(/<@!?\d+>/g, '').trim();

    if (!quoteText) {
        await message.reply({
            content: '❌ That message has no text to quote!',
            allowedMentions: { repliedUser: false }
        });
        return;
    }

    

    if (quoteText.length > 400) quoteText = quoteText.slice(0, 399) + '…';

    cooldowns.set(userId, now);
    await message.channel.sendTyping();

    let result;
    try {
        result = await generateQuoteImage(quoteText, quotedMessage.author);
    } catch (e) {
        console.error('❌ [Maker] Failed:', e.message);
        cooldowns.delete(userId);
        await message.reply({
            content: '❌ Failed to generate quote — try again!',
            allowedMentions: { repliedUser: false }
        });
        return;
    }

    const { buffer, themeIndex } = result;
    const fileName   = `quote_${Date.now()}.png`;
    const attachment = new AttachmentBuilder(buffer, { name: fileName });

    const container = new ContainerBuilder().setAccentColor(THEMES[themeIndex].accent);
    container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder()
                .setURL(`attachment://${fileName}`)
                .setDescription('Quote image')
        )
    );

    const buttons = buildButtons(themeIndex, quoteText, quotedMessage.author.id);

    await message.reply({
        components: [container, buttons],
        flags:      MessageFlags.IsComponentsV2,
        files:      [attachment],
        allowedMentions: { repliedUser: false }
    });

    console.log(`✅ [Maker] ${message.author.username} quoted ${quotedMessage.author.username}: "${quoteText.slice(0, 40)}"`);
}

async function handleQuoteButton(interaction) {
    if (!interaction.isButton()) return false;
    const { customId } = interaction;
    if (!customId.startsWith('qmaker_')) return false;

    await interaction.deferUpdate();

    const [action, currentIdxStr] = customId.split(':');
    const currentIdx = parseInt(currentIdxStr, 10);

    let nextIdx;
    if (action === 'qmaker_prev') {
        nextIdx = (currentIdx - 1 + THEMES.length) % THEMES.length;
    } else if (action === 'qmaker_next') {
        nextIdx = (currentIdx + 1) % THEMES.length;
    } else {
        

        do { nextIdx = Math.floor(Math.random() * THEMES.length); }
        while (nextIdx === currentIdx && THEMES.length > 1);
    }

    

    

    

    

    

    

    let quoteText   = null;
    let authorUser  = null;

    try {
        

        

        const triggerMsg = await interaction.channel.messages.fetch(
            interaction.message.reference?.messageId
        );
        const quotedMsg = await interaction.channel.messages.fetch(
            triggerMsg.reference?.messageId
        );
        quoteText  = quotedMsg.content?.replace(/<@!?\d+>/g, '').trim();
        if (quoteText?.length > 400) quoteText = quoteText.slice(0, 399) + '…';
        authorUser = quotedMsg.author;
    } catch (_) {
        await interaction.followUp({ content: '❌ Couldn\'t reload the original message.', ephemeral: true });
        return true;
    }

    if (!quoteText || !authorUser) {
        await interaction.followUp({ content: '❌ Couldn\'t reload quote text.', ephemeral: true });
        return true;
    }

    const { buffer, themeIndex } = await generateQuoteImage(quoteText, authorUser, nextIdx);
    const fileName   = `quote_${Date.now()}.png`;
    const attachment = new AttachmentBuilder(buffer, { name: fileName });

    const container = new ContainerBuilder().setAccentColor(THEMES[themeIndex].accent);
    container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder()
                .setURL(`attachment://${fileName}`)
                .setDescription('Quote image')
        )
    );

    const buttons = buildButtons(themeIndex, quoteText, authorUser.id);

    await interaction.editReply({
        components: [container, buttons],
        flags:      MessageFlags.IsComponentsV2,
        files:      [attachment],
    });

    return true;
}

module.exports = { handleMention, handleQuoteButton, THEMES };

