
const sharp    = require('sharp');
const axios    = require('axios');
const FormData = require('form-data');
const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    AttachmentBuilder,
    MessageFlags
} = require('discord.js');

const REMOVE_BG_KEY = process.env.REMOVE_BG_API_KEY;
const DEEPAI_KEY    = process.env.DEEPAI_API_KEY;

const COOLDOWN_MS    = 20 * 1000;
const SESSION_TTL    = 5  * 60 * 1000;
const cooldowns      = new Map(); 
const activeSessions = new Map(); 

const EFFECTS = [
    { value: 'grayscale',      label: '⬛ Grayscale',         description: 'Classic black & white',             category: '🎨 Colour Filters',    type: 'local' },
    { value: 'sepia',          label: '🟫 Sepia',              description: 'Warm retro brown tone',             category: '🎨 Colour Filters',    type: 'local' },
    { value: 'invert',         label: '🔄 Invert',             description: 'Negative/inverted colours',         category: '🎨 Colour Filters',    type: 'local' },
    { value: 'vintage',        label: '📷 Vintage',            description: 'Faded retro film look',             category: '🎨 Colour Filters',    type: 'local' },
    { value: 'warm',           label: '🌅 Warm Tone',          description: 'Golden warm colour boost',          category: '🎨 Colour Filters',    type: 'local' },
    { value: 'cool',           label: '🧊 Cool Tone',          description: 'Blue-tinted cool look',             category: '🎨 Colour Filters',    type: 'local' },
    { value: 'dramatic',       label: '🎭 Dramatic',           description: 'High contrast moody look',          category: '🎨 Colour Filters',    type: 'local' },
    { value: 'faded',          label: '🌫️ Faded',              description: 'Washed out matte finish',           category: '🎨 Colour Filters',    type: 'local' },
    { value: 'cyberpunk',      label: '🟣 Cyberpunk',          description: 'Neon magenta/cyan split tones',     category: '🎨 Colour Filters',    type: 'local' },
    { value: 'golden',         label: '✨ Golden Hour',        description: 'Rich golden/orange tones',          category: '🎨 Colour Filters',    type: 'local' },
    { value: 'rose',           label: '🌸 Rose Tint',          description: 'Soft pink dreamy tint',             category: '🎨 Colour Filters',    type: 'local' },
    { value: 'matrix',         label: '💚 Matrix',             description: 'Green monochrome hacker look',      category: '🎨 Colour Filters',    type: 'local' },
    { value: 'midnight',       label: '🌙 Midnight',           description: 'Deep blue dark night tone',         category: '🎨 Colour Filters',    type: 'local' },
    { value: 'duotone_purple', label: '💜 Duotone Purple',     description: 'Dark purple + light lavender tones',category: '🎨 Colour Filters',    type: 'local' },
    { value: 'duotone_teal',   label: '🩵 Duotone Teal',       description: 'Dark teal + light cyan tones',      category: '🎨 Colour Filters',    type: 'local' },

    { value: 'brightness_up',  label: '☀️ Brighter',           description: 'Increase brightness',               category: '🔧 Adjustments',       type: 'local' },
    { value: 'brightness_dn',  label: '🌑 Darker',             description: 'Decrease brightness',               category: '🔧 Adjustments',       type: 'local' },
    { value: 'contrast_up',    label: '🔆 More Contrast',      description: 'Boost contrast',                    category: '🔧 Adjustments',       type: 'local' },
    { value: 'contrast_dn',    label: '🔅 Less Contrast',      description: 'Soften/flatten contrast',           category: '🔧 Adjustments',       type: 'local' },
    { value: 'saturate_up',    label: '🌈 More Saturation',    description: 'Boost colour saturation',           category: '🔧 Adjustments',       type: 'local' },
    { value: 'saturate_dn',    label: '🩶 Desaturate',         description: 'Reduce colour saturation',          category: '🔧 Adjustments',       type: 'local' },
    { value: 'sharpen',        label: '🔪 Sharpen',            description: 'Crisp up details',                  category: '🔧 Adjustments',       type: 'local' },
    { value: 'sharpen_extra',  label: '⚡ Super Sharpen',      description: 'Aggressive detail enhancement',     category: '🔧 Adjustments',       type: 'local' },
    { value: 'blur',           label: '💨 Blur',               description: 'Soft gaussian blur',                category: '🔧 Adjustments',       type: 'local' },
    { value: 'blur_heavy',     label: '🌀 Heavy Blur',         description: 'Strong motion-style blur',          category: '🔧 Adjustments',       type: 'local' },
    { value: 'denoise',        label: '🧹 Denoise/Smooth',     description: 'Reduce noise, smooth skin',         category: '🔧 Adjustments',       type: 'local' },

    { value: 'vignette',       label: '🌑 Vignette',           description: 'Dark faded corners',                category: '✨ Aesthetic Overlays', type: 'local' },
    { value: 'vignette_heavy', label: '⚫ Heavy Vignette',     description: 'Strong dark vignette frame',        category: '✨ Aesthetic Overlays', type: 'local' },
    { value: 'border',         label: '🖼️ White Border',       description: 'Clean aesthetic white border',      category: '✨ Aesthetic Overlays', type: 'local' },
    { value: 'border_black',   label: '⬛ Black Border',       description: 'Dark moody black border',           category: '✨ Aesthetic Overlays', type: 'local' },
    { value: 'aesthetic_text', label: '💬 Aesthetic Text',     description: 'Random dreamy text overlay',        category: '✨ Aesthetic Overlays', type: 'local' },
    { value: 'grain',          label: '📽️ Film Grain',         description: 'Subtle film grain texture',         category: '✨ Aesthetic Overlays', type: 'local' },
    { value: 'scanlines',      label: '📺 Scanlines',          description: 'Old CRT/TV scanline effect',        category: '✨ Aesthetic Overlays', type: 'local' },
    { value: 'glitch',         label: '📡 Glitch',             description: 'RGB channel offset glitch effect',  category: '✨ Aesthetic Overlays', type: 'local' },
    { value: 'dots',           label: '🔵 Halftone Dots',      description: 'Comic book dot pattern overlay',    category: '✨ Aesthetic Overlays', type: 'local' },

    { value: 'flip',           label: '↕️ Flip Vertical',      description: 'Flip image upside down',            category: '🔄 Transforms',        type: 'local' },
    { value: 'mirror',         label: '↔️ Mirror',             description: 'Flip image horizontally',           category: '🔄 Transforms',        type: 'local' },
    { value: 'rotate90',       label: '↩️ Rotate 90°',         description: 'Rotate 90° clockwise',              category: '🔄 Transforms',        type: 'local' },
    { value: 'rotate180',      label: '🔃 Rotate 180°',        description: 'Rotate 180°',                       category: '🔄 Transforms',        type: 'local' },
    { value: 'rotate270',      label: '↪️ Rotate 270°',        description: 'Rotate 270° clockwise',             category: '🔄 Transforms',        type: 'local' },
    { value: 'pixelate',       label: '🟦 Pixelate',           description: '8-bit pixelated look',              category: '🔄 Transforms',        type: 'local' },
    { value: 'pixelate_heavy', label: '🟫 Heavy Pixelate',     description: 'Very blocky pixel effect',          category: '🔄 Transforms',        type: 'local' },
    { value: 'square_crop',    label: '✂️ Square Crop',        description: 'Crop to square (center)',           category: '🔄 Transforms',        type: 'local' },

    { value: 'remove_bg',      label: '🪄 Remove Background',  description: 'AI removes background (remove.bg)', category: '🪄 AI Effects',        type: 'api'   },
    { value: 'enhance',        label: '🚀 AI Enhance',         description: 'AI image enhancement (DeepAI)',     category: '🪄 AI Effects',        type: 'api'   },
    { value: 'cartoon',        label: '🎨 Cartoonize',         description: 'Turn photo into cartoon (DeepAI)', category: '🪄 AI Effects',        type: 'api'   },
];

function buildSelectPages(sessionMsgId) {
    const categories = [...new Set(EFFECTS.map(e => e.category))];
    const rows       = [];

    for (const cat of categories) {
        const catEffects = EFFECTS.filter(e => e.category === cat);
        const options    = catEffects.map(e => ({
            label:       e.label.slice(0, 25),
            value:       e.value,
            description: e.description.slice(0, 50),
        }));

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`edit_${cat.replace(/[^a-z]/gi, '')}_${sessionMsgId}`)
            .setPlaceholder(`${cat}`)
            .addOptions(options);

        rows.push(new ActionRowBuilder().addComponents(menu));
    }

    return rows; 
}

async function applyLocalEffect(inputBuffer, effect) {
    const img      = sharp(inputBuffer);
    const meta     = await img.metadata();
    const { width, height } = meta;

    switch (effect) {

        case 'grayscale':
            return img.grayscale().jpeg({ quality: 92 }).toBuffer();

        case 'sepia':
            return img.grayscale().tint({ r: 112, g: 66, b: 20 }).jpeg({ quality: 92 }).toBuffer();

        case 'invert':
            return img.negate().jpeg({ quality: 92 }).toBuffer();

        case 'vintage':
            return img
                .modulate({ saturation: 0.55, brightness: 1.05 })
                .tint({ r: 200, g: 170, b: 120 })
                .linear(0.82, 25)
                .jpeg({ quality: 88 }).toBuffer();

        case 'warm':
            return img
                .tint({ r: 255, g: 210, b: 160 })
                .modulate({ saturation: 1.25, brightness: 1.05 })
                .jpeg({ quality: 92 }).toBuffer();

        case 'cool':
            return img
                .tint({ r: 160, g: 210, b: 255 })
                .modulate({ saturation: 1.1 })
                .jpeg({ quality: 92 }).toBuffer();

        case 'dramatic':
            return img
                .linear(1.6, -(1.6 - 1) * 128)
                .modulate({ saturation: 0.8 })
                .jpeg({ quality: 92 }).toBuffer();

        case 'faded':
            return img
                .modulate({ saturation: 0.4, brightness: 1.1 })
                .linear(0.75, 30)
                .jpeg({ quality: 88 }).toBuffer();

        case 'cyberpunk':
            return img
                .tint({ r: 220, g: 50, b: 220 })
                .modulate({ saturation: 2.0, brightness: 1.1 })
                .linear(1.3, -20)
                .jpeg({ quality: 92 }).toBuffer();

        case 'golden':
            return img
                .tint({ r: 255, g: 190, b: 80 })
                .modulate({ saturation: 1.4, brightness: 1.08 })
                .jpeg({ quality: 92 }).toBuffer();

        case 'rose':
            return img
                .tint({ r: 255, g: 180, b: 200 })
                .modulate({ saturation: 0.9, brightness: 1.08 })
                .jpeg({ quality: 92 }).toBuffer();

        case 'matrix':
            return img.grayscale().tint({ r: 0, g: 255, b: 70 }).jpeg({ quality: 92 }).toBuffer();

        case 'midnight':
            return img
                .tint({ r: 30, g: 60, b: 180 })
                .modulate({ saturation: 0.7, brightness: 0.75 })
                .jpeg({ quality: 92 }).toBuffer();

        case 'duotone_purple': {
            return img
                .grayscale()
                .tint({ r: 100, g: 50, b: 200 })
                .modulate({ brightness: 1.05 })
                .jpeg({ quality: 92 }).toBuffer();
        }

        case 'duotone_teal':
            return img
                .grayscale()
                .tint({ r: 0, g: 180, b: 200 })
                .jpeg({ quality: 92 }).toBuffer();

        case 'brightness_up':
            return img.modulate({ brightness: 1.4 }).jpeg({ quality: 92 }).toBuffer();

        case 'brightness_dn':
            return img.modulate({ brightness: 0.6 }).jpeg({ quality: 92 }).toBuffer();

        case 'contrast_up':
            return img.linear(1.5, -(1.5 - 1) * 128).jpeg({ quality: 92 }).toBuffer();

        case 'contrast_dn':
            return img.linear(0.65, -(0.65 - 1) * 128).jpeg({ quality: 92 }).toBuffer();

        case 'saturate_up':
            return img.modulate({ saturation: 2.0 }).jpeg({ quality: 92 }).toBuffer();

        case 'saturate_dn':
            return img.modulate({ saturation: 0.2 }).jpeg({ quality: 92 }).toBuffer();

        case 'sharpen':
            return img.sharpen({ sigma: 1.5, m1: 1.0, m2: 0.5 }).jpeg({ quality: 92 }).toBuffer();

        case 'sharpen_extra':
            return img.sharpen({ sigma: 3.0, m1: 2.0, m2: 0.8 }).jpeg({ quality: 92 }).toBuffer();

        case 'blur':
            return img.blur(3).jpeg({ quality: 92 }).toBuffer();

        case 'blur_heavy':
            return img.blur(12).jpeg({ quality: 92 }).toBuffer();

        case 'denoise':
            return img
                .blur(1.2)
                .sharpen({ sigma: 0.5, m1: 0.3, m2: 0.1 })
                .jpeg({ quality: 94 }).toBuffer();

        case 'vignette': {
            const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <defs><radialGradient id="v" cx="50%" cy="50%" r="70%">
                    <stop offset="45%" stop-color="black" stop-opacity="0"/>
                    <stop offset="100%" stop-color="black" stop-opacity="0.72"/>
                </radialGradient></defs>
                <rect width="100%" height="100%" fill="url(#v)"/>
            </svg>`;
            return img.composite([{ input: Buffer.from(svg), blend: 'over' }]).jpeg({ quality: 92 }).toBuffer();
        }

        case 'vignette_heavy': {
            const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <defs><radialGradient id="v" cx="50%" cy="50%" r="60%">
                    <stop offset="30%" stop-color="black" stop-opacity="0"/>
                    <stop offset="100%" stop-color="black" stop-opacity="0.92"/>
                </radialGradient></defs>
                <rect width="100%" height="100%" fill="url(#v)"/>
            </svg>`;
            return img.composite([{ input: Buffer.from(svg), blend: 'over' }]).jpeg({ quality: 92 }).toBuffer();
        }

        case 'border': {
            const b    = Math.max(18, Math.round(Math.min(width, height) * 0.045));
            const base = await sharp({ create: { width: width + b * 2, height: height + b * 2, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer();
            return sharp(base).composite([{ input: inputBuffer, left: b, top: b }]).jpeg({ quality: 93 }).toBuffer();
        }

        case 'border_black': {
            const b    = Math.max(18, Math.round(Math.min(width, height) * 0.045));
            const base = await sharp({ create: { width: width + b * 2, height: height + b * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } }).png().toBuffer();
            return sharp(base).composite([{ input: inputBuffer, left: b, top: b }]).jpeg({ quality: 93 }).toBuffer();
        }

        case 'aesthetic_text': {
            const words   = ['dreamland', '美しい', 'ethereal', 'lost souls', 'soft chaos', '꒰ aesthetic ꒱', 'golden hour', 'in bloom', '존재', 'serenity', 'ephemeral', 'tender'];
            const text    = words[Math.floor(Math.random() * words.length)];
            const size    = Math.max(22, Math.round(width / 13));
            const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <filter id="g"><feGaussianBlur stdDeviation="4" result="b"/>
                    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                </defs>
                <text x="50%" y="90%" font-family="Georgia,serif" font-size="${size}px" font-style="italic"
                    fill="white" fill-opacity="0.9" text-anchor="middle" filter="url(#g)" letter-spacing="8">${text}</text>
                <text x="50%" y="90%" font-family="Georgia,serif" font-size="${size}px" font-style="italic"
                    fill="none" stroke="white" stroke-width="0.4" stroke-opacity="0.35"
                    text-anchor="middle" letter-spacing="8">${text}</text>
            </svg>`;
            return img.composite([{ input: Buffer.from(svg), blend: 'over' }]).jpeg({ quality: 92 }).toBuffer();
        }

        case 'grain': {
            const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch"/>
                <feColorMatrix type="saturate" values="0"/>
                <feBlend in="SourceGraphic" mode="overlay" result="blend"/>
                <feComposite in="blend" in2="SourceGraphic" operator="in"/></filter>
                <rect width="100%" height="100%" filter="url(#n)" opacity="0.18"/>
            </svg>`;
            return img.composite([{ input: Buffer.from(svg), blend: 'overlay' }]).jpeg({ quality: 90 }).toBuffer();
        }

        case 'scanlines': {
            const lineH    = 4;
            const lines    = [];
            for (let y = 0; y < height; y += lineH * 2) {
                lines.push(`<rect x="0" y="${y}" width="${width}" height="${lineH}" fill="black" opacity="0.22"/>`);
            }
            const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${lines.join('')}</svg>`;
            return img.composite([{ input: Buffer.from(svg), blend: 'over' }]).jpeg({ quality: 90 }).toBuffer();
        }

        case 'glitch': {
            const offset   = Math.max(4, Math.round(width * 0.012));
            const rChan    = await sharp(inputBuffer).extractChannel('red').toBuffer();
            const gChan    = await sharp(inputBuffer).extractChannel('green').toBuffer();
            const bChan    = await sharp(inputBuffer).extractChannel('blue').toBuffer();

            const rBuf = await sharp(rChan, { raw: { width, height, channels: 1 } })
                .extend({ left: offset, right: 0, top: 0, bottom: 0, background: 0 })
                .extract({ left: offset, top: 0, width, height }).toBuffer();

            const bBuf = await sharp(bChan, { raw: { width, height, channels: 1 } })
                .extend({ left: 0, right: offset, top: 0, bottom: 0, background: 0 })
                .extract({ left: 0, top: 0, width, height }).toBuffer();

            return sharp(inputBuffer)
                .composite([
                    { input: await sharp(rBuf, { raw: { width, height, channels: 1 } }).toColourspace('srgb').png().toBuffer(), blend: 'add', left: 0, top: 0 },
                ])
                .jpeg({ quality: 90 }).toBuffer();
        }

        case 'dots': {
            const spacing = Math.max(6, Math.round(width / 80));
            const dotR    = Math.round(spacing * 0.35);
            const dotsSvg = [];
            for (let x = spacing; x < width; x += spacing * 2) {
                for (let y = spacing; y < height; y += spacing * 2) {
                    dotsSvg.push(`<circle cx="${x}" cy="${y}" r="${dotR}" fill="black" opacity="0.15"/>`);
                }
            }
            const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${dotsSvg.join('')}</svg>`;
            return img.composite([{ input: Buffer.from(svg), blend: 'over' }]).jpeg({ quality: 90 }).toBuffer();
        }

        case 'flip':
            return img.flip().jpeg({ quality: 92 }).toBuffer();

        case 'mirror':
            return img.flop().jpeg({ quality: 92 }).toBuffer();

        case 'rotate90':
            return img.rotate(90).jpeg({ quality: 92 }).toBuffer();

        case 'rotate180':
            return img.rotate(180).jpeg({ quality: 92 }).toBuffer();

        case 'rotate270':
            return img.rotate(270).jpeg({ quality: 92 }).toBuffer();

        case 'pixelate': {
            const f  = 10;
            const sw = Math.max(1, Math.round(width / f));
            const sh = Math.max(1, Math.round(height / f));
            return img
                .resize(sw, sh, { kernel: sharp.kernel.nearest })
                .resize(width, height, { kernel: sharp.kernel.nearest })
                .jpeg({ quality: 90 }).toBuffer();
        }

        case 'pixelate_heavy': {
            const f  = 25;
            const sw = Math.max(1, Math.round(width / f));
            const sh = Math.max(1, Math.round(height / f));
            return img
                .resize(sw, sh, { kernel: sharp.kernel.nearest })
                .resize(width, height, { kernel: sharp.kernel.nearest })
                .jpeg({ quality: 88 }).toBuffer();
        }

        case 'square_crop': {
            const size = Math.min(width, height);
            const left = Math.floor((width  - size) / 2);
            const top  = Math.floor((height - size) / 2);
            return img.extract({ left, top, width: size, height: size }).jpeg({ quality: 93 }).toBuffer();
        }

        default:
            throw new Error(`Unknown effect: ${effect}`);
    }
}

async function applyApiEffect(inputBuffer, effect) {
    switch (effect) {

        case 'remove_bg': {
            if (!REMOVE_BG_KEY) throw new Error('`REMOVE_BG_API_KEY` not set in .env — get a free key at https://www.remove.bg/api');
            const form = new FormData();
            form.append('image_file', inputBuffer, { filename: 'image.png', contentType: 'image/png' });
            form.append('size', 'auto');
            const res = await axios.post('https://api.remove.bg/v1.0/removebg', form, {
                headers: { 'X-Api-Key': REMOVE_BG_KEY, ...form.getHeaders() },
                responseType: 'arraybuffer',
                timeout: 30000,
            });
            return { buffer: Buffer.from(res.data), ext: 'png' };
        }

        case 'enhance': {
            if (!DEEPAI_KEY) throw new Error('`DEEPAI_API_KEY` not set in .env — get a free key at https://deepai.org/api');
            const form = new FormData();
            form.append('image', inputBuffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
            const res = await axios.post('https://api.deepai.org/api/torch-srgan', form, {
                headers: { 'api-key': DEEPAI_KEY, ...form.getHeaders() },
                timeout: 60000,
            });
            const outputUrl = res.data?.output_url;
            if (!outputUrl) throw new Error('DeepAI returned no output URL');
            const imgRes = await axios.get(outputUrl, { responseType: 'arraybuffer', timeout: 30000 });
            return { buffer: Buffer.from(imgRes.data), ext: 'jpg' };
        }

        case 'cartoon': {
            if (!DEEPAI_KEY) throw new Error('`DEEPAI_API_KEY` not set in .env — get a free key at https://deepai.org/api');
            const form = new FormData();
            form.append('image', inputBuffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
            const res = await axios.post('https://api.deepai.org/api/toonify', form, {
                headers: { 'api-key': DEEPAI_KEY, ...form.getHeaders() },
                timeout: 60000,
            });
            const outputUrl = res.data?.output_url;
            if (!outputUrl) throw new Error('DeepAI returned no output URL');
            const imgRes = await axios.get(outputUrl, { responseType: 'arraybuffer', timeout: 30000 });
            return { buffer: Buffer.from(imgRes.data), ext: 'jpg' };
        }

        default:
            throw new Error(`Unknown API effect: ${effect}`);
    }
}

async function downloadImage(url) {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
    return Buffer.from(res.data);
}
function buildPickerComponent(imageUrl) {
    const container = new ContainerBuilder().setAccentColor(0xFF69B4);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## 🎨 Image Editor\n` +
            `Image loaded! Choose an effect from the menus below.\n\n` +
            `**${EFFECTS.filter(e => e.type === 'local').length}** local effects  ·  ` +
            `**${EFFECTS.filter(e => e.type === 'api').length}** AI effects  ·  ` +
            `*Session expires in 5 min*`
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));

    container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(imageUrl).setDescription('Original image')
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `**🎨 Colour Filters** — 15 filters (grayscale, sepia, cyberpunk, duotone...)\n` +
            `**🔧 Adjustments** — 11 tweaks (brightness, contrast, sharpen, blur...)\n` +
            `**✨ Aesthetic Overlays** — 9 overlays (vignette, text, grain, glitch...)\n` +
            `**🔄 Transforms** — 8 transforms (flip, rotate, pixelate, crop...)\n` +
            `**🪄 AI Effects** — 3 AI edits (remove bg, enhance, cartoon)`
        )
    );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildProcessingComponent(effectLabel) {
    const container = new ContainerBuilder().setAccentColor(0xFFAA00);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ⏳ Processing...\nApplying **${effectLabel}** to your image...`
        )
    );
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildResultComponent(effectLabel, fileName) {
    const container = new ContainerBuilder().setAccentColor(0x00FF88);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ✅ ${effectLabel}\nHere's your edited image!`)
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));

    container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder()
                .setURL(`attachment://${fileName}`)
                .setDescription('Edited image')
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `-# 🎨 Right-click → Save Image  ·  Use \`l.edit\` again to start a new edit session`
        )
    );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

async function handleEditCommand(message) {
    const userId = message.author.id;
    const now    = Date.now();

    const lastCd = cooldowns.get(userId);
    if (lastCd && now - lastCd < COOLDOWN_MS) {
        const rem = Math.ceil((COOLDOWN_MS - (now - lastCd)) / 1000);
        await message.reply({ content: `⏳ Use \`l.edit\` again in **${rem}s**~`, allowedMentions: { repliedUser: false } });
        return;
    }

    const attachment = message.attachments.find(a =>
        a.contentType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(a.name || '')
    );

    if (!attachment) {
        const c = new ContainerBuilder().setAccentColor(0xFF9900);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `## 📎 Attach an Image!\nSend \`l.edit\` with a photo attached to start editing.\n\n` +
            `**${EFFECTS.length} effects available:** filters, adjustments, overlays, transforms & AI`
        ));
        await message.reply({ components: [c], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
        return;
    }

    cooldowns.set(userId, now);
    await message.channel.sendTyping();

    let imageBuffer;
    try {
        imageBuffer = await downloadImage(attachment.url);
    } catch (e) {
        await message.reply({ content: '❌ Failed to download your image. Try again!', allowedMentions: { repliedUser: false } });
        cooldowns.delete(userId);
        return;
    }

    const pickerPayload = buildPickerComponent(attachment.url);
    const sentMsg = await message.reply({
        ...pickerPayload,
        components: [
            ...pickerPayload.components,
            ...buildSelectPages('placeholder')
        ],
        allowedMentions: { repliedUser: false }
    });

    const realId = sentMsg.id;
    activeSessions.set(realId, { userId, imageBuffer, imageUrl: attachment.url, createdAt: now });

    await sentMsg.edit({
        ...pickerPayload,
        components: [
            ...pickerPayload.components,
            ...buildSelectPages(realId)
        ],
    }).catch(() => {});

    setTimeout(async () => {
        if (!activeSessions.has(realId)) return;
        activeSessions.delete(realId);
        await sentMsg.edit({
            ...pickerPayload,
            components: [],
        }).catch(() => {});
    }, SESSION_TTL);
}

async function handleEditSelect(interaction) {
    const { customId, values, user } = interaction;
    if (!customId.startsWith('edit_')) return false;

    const parts     = customId.split('_');
    const sessionId = parts[parts.length - 1];
    const session   = activeSessions.get(sessionId);

    if (!session) {
        await interaction.reply({ content: '⌛ This edit session expired! Send `l.edit` again.', ephemeral: true });
        return true;
    }

    if (session.userId !== user.id) {
        await interaction.reply({ content: '🚫 This edit session belongs to someone else!', ephemeral: true });
        return true;
    }

    const effectValue = values[0];
    const effectMeta  = EFFECTS.find(e => e.value === effectValue);
    if (!effectMeta) return true;

    await interaction.deferReply();

    let resultBuffer, outputExt = 'jpg';

    try {
        if (effectMeta.type === 'api') {
            const result = await applyApiEffect(session.imageBuffer, effectValue);
            resultBuffer = result.buffer;
            outputExt    = result.ext;
        } else {
            resultBuffer = await applyLocalEffect(session.imageBuffer, effectValue);
            outputExt    = (effectValue === 'border' || effectValue === 'border_black' || effectValue === 'remove_bg') ? 'png' : 'jpg';
        }
    } catch (e) {
        console.error(`❌ [Edit] "${effectValue}" failed:`, e.message);
        await interaction.editReply({ content: `❌ **${effectMeta.label}** failed: ${e.message}` });
        return true;
    }

    const fileName  = `luna_edit_${effectValue}.${outputExt}`;
    const attach    = new AttachmentBuilder(resultBuffer, { name: fileName });
    const resultPay = buildResultComponent(effectMeta.label, fileName);

    await interaction.editReply({ ...resultPay, files: [attach] });
    console.log(`✅ [Edit] ${user.username} → "${effectValue}"`);
    return true;
}

module.exports = { handleEditCommand, handleEditSelect };

