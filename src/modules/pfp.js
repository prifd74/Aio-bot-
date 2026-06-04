

const fs   = require('fs').promises;
const path = require('path');
const {
    AttachmentBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags
} = require('discord.js');

const PFP_BASE_DIR = path.join(__dirname, '..', '..', 'pfp-images');
const IMAGE_EXTS   = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const COOLDOWN_MS = 15 * 1000;
const cooldowns   = new Map();

const lastUsedMap = new Map(); 

const TAG_META = {
    boy:    { label: 'Boy',    color: 0x4169E1, emoji: '<:854614blondboydab:1485294030609842227>', folder: 'boy'    },
    girl:   { label: 'Girl',   color: 0xFF69B4, emoji: '<:386341excitedgirly:1485294002671587449>', folder: 'girl'   },
    couple: { label: 'Couple', color: 0xFF1493, emoji: '<:207421blushingcouple:1485294048389627904>', folder: 'couple' },
};

const TAG_ALIASES = {
    boy:    ['boy', 'boys', 'male', 'guy', 'guys', 'man', 'men'],
    girl:   ['girl', 'girls', 'female', 'woman', 'women', 'lady'],
    couple: ['couple', 'couples', 'pair', 'love', 'matching', 'duo'],
};

async function getImages(folder) {
    const folderPath = path.join(PFP_BASE_DIR, folder);
    try {
        await fs.access(folderPath);
    } catch {
        console.warn(`⚠️ [PFP] Folder missing: ${folderPath}`);
        return [];
    }
    const files = await fs.readdir(folderPath);
    return files.filter(f => IMAGE_EXTS.includes(path.extname(f).toLowerCase()));
}

function parsePairs(files) {
    const groups = new Map();

    for (const file of files) {
        const name  = path.parse(file).name;           

        const match = name.match(/^([a-zA-Z]+)(\d+)$/); 

        if (!match) continue;

        const prefix = match[1].toLowerCase();
        if (!groups.has(prefix)) groups.set(prefix, []);
        groups.get(prefix).push(file);
    }

    

    const pairs = new Map();
    for (const [prefix, files] of groups) {
        if (files.length === 2) {
            

            pairs.set(prefix, files.sort());
        }
    }

    return pairs;
}

function pickRandom(pool, userId, tag) {
    if (pool.length === 0) return null;
    if (pool.length === 1) return pool[0];

    const lastKey  = `${userId}_${tag}`;
    const lastPick = lastUsedMap.get(lastKey);
    const filtered = lastPick ? pool.filter(p => p !== lastPick) : pool;
    const picked   = filtered[Math.floor(Math.random() * filtered.length)];

    lastUsedMap.set(lastKey, picked);
    return picked;
}

function resolveTag(input) {
    const clean = input?.toLowerCase().trim();
    for (const [tag, aliases] of Object.entries(TAG_ALIASES)) {
        if (aliases.includes(clean)) return tag;
    }
    return null;
}

function buildPfpComponent(tag, fileNames) {
    const meta      = TAG_META[tag];
    const container = new ContainerBuilder().setAccentColor(meta.color);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${meta.emoji} ${meta.label} PFP`)
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));

    

    const gallery = new MediaGalleryBuilder();
    for (const fileName of fileNames) {
        gallery.addItems(
            new MediaGalleryItemBuilder()
                .setURL(`attachment://${fileName}`)
                .setDescription(`${meta.label} profile picture`)
        );
    }
    container.addMediaGalleryComponents(gallery);

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `-# 🖼️ Right-click → Save Image to use as PFP  ·  \`l.pfp boy\` \`l.pfp girl\` \`l.pfp couple\``
        )
    );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildHelpComponent(invalidTag = null) {
    const container = new ContainerBuilder().setAccentColor(0x8B4513);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `${invalidTag ? `## ❌ Unknown tag: \`${invalidTag}\`\n` : `## 🖼️ PFP Command\n`}` +
            `Get a random stylish profile picture!\n\n` +
            `**Usage:** \`l.pfp <tag>\`\n\n` +
            `**Tags:**\n` +
            `\`boy\` <:854614blondboydab:1485294030609842227> — Stylish boy photo\n` +
            `\`girl\` <:386341excitedgirly:1485294002671587449> — Stylish girl photo\n` +
            `\`couple\` <:207421blushingcouple:1485294048389627904> — Matching couple photos (2 images)`
        )
    );
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildEmptyComponent(tag) {
    const meta      = TAG_META[tag];
    const container = new ContainerBuilder().setAccentColor(0xFF9900);
    const hint = tag === 'couple'
        ? `Name your files like \`a1.jpg\`, \`a2.jpg\`, \`b1.jpg\`, \`b2.jpg\` — same letter = a pair.`
        : `Add some images to the folder and try again.`;
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## 📂 No Images Found\n` +
            `Try later`
        )
    );
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildNoPairsComponent() {
    const container = new ContainerBuilder().setAccentColor(0xFF9900);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## 📂 No Valid Pairs Found\n` +
            `Try later`
        )
    );
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

async function handlePfpCommand(message) {
    const userId = message.author.id;
    const now    = Date.now();

    const args  = message.content.trim().split(/\s+/);
    const input = args[1];

    if (!input) {
        await message.reply({ ...buildHelpComponent(), allowedMentions: { repliedUser: false } });
        return;
    }

    const tag = resolveTag(input);
    if (!tag) {
        await message.reply({ ...buildHelpComponent(input), allowedMentions: { repliedUser: false } });
        return;
    }

    

    const lastCd = cooldowns.get(userId);
    if (lastCd && now - lastCd < COOLDOWN_MS) {
        const remaining = Math.ceil((COOLDOWN_MS - (now - lastCd)) / 1000);
        await message.reply({
            content: `⏳ You can use \`l.pfp\` again in **${remaining}s**~`,
            allowedMentions: { repliedUser: false }
        });
        return;
    }

    cooldowns.set(userId, now);
    await message.channel.sendTyping();

    const meta   = TAG_META[tag];
    const images = await getImages(meta.folder);

    if (images.length === 0) {
        cooldowns.delete(userId);
        await message.reply({ ...buildEmptyComponent(tag), allowedMentions: { repliedUser: false } });
        return;
    }

    

    if (tag === 'couple') {
        const pairs = parsePairs(images);

        if (pairs.size === 0) {
            cooldowns.delete(userId);
            await message.reply({ ...buildNoPairsComponent(), allowedMentions: { repliedUser: false } });
            return;
        }

        const prefixes    = [...pairs.keys()];
        const pickedPfx   = pickRandom(prefixes, userId, tag);
        const pairFiles   = pairs.get(pickedPfx);
        const folderPath  = path.join(PFP_BASE_DIR, meta.folder);

        const attachments = pairFiles.map(f =>
            new AttachmentBuilder(path.join(folderPath, f), { name: f })
        );

        await message.reply({
            ...buildPfpComponent(tag, pairFiles),
            files: attachments,
            allowedMentions: { repliedUser: false }
        });

        console.log(`✅ [PFP] Couple pair "${pickedPfx}" → ${pairFiles.join(', ')} → ${message.author.username}`);
        return;
    }

    

    const fileName   = pickRandom(images, userId, tag);
    const filePath   = path.join(PFP_BASE_DIR, meta.folder, fileName);
    const attachment = new AttachmentBuilder(filePath, { name: fileName });

    await message.reply({
        ...buildPfpComponent(tag, [fileName]),
        files: [attachment],
        allowedMentions: { repliedUser: false }
    });

    console.log(`✅ [PFP] ${tag} → ${fileName} → ${message.author.username}`);
}

module.exports = { handlePfpCommand };

