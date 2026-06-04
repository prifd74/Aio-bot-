const { AttachmentBuilder, MessageFlags } = require('discord.js');
const { createCanvas } = require('canvas');
const axios = require('axios');

const ComponentType = {
    ACTION_ROW:       1,
    BUTTON:           2,
    STRING_SELECT:    3,
    TEXT_INPUT:       4,
    USER_SELECT:      5,
    ROLE_SELECT:      6,
    MENTIONABLE_SELECT: 7,
    CHANNEL_SELECT:   8,
    SECTION:          9,
    TEXT_DISPLAY:     10,
    THUMBNAIL:        11,
    MEDIA_GALLERY:    12,
    FILE:             13,
    SEPARATOR:        14,
    CONTENT_INVENTORY_ENTRY: 16,
    CONTAINER:        17,
};

const SeparatorSpacing = { Small: 1, Large: 2 };

const ACCENT_COLORS = [
    0xF4A261, 0xE76F51, 0x2A9D8F, 0x457B9D,
    0x8338EC, 0x06D6A0, 0xFFB703, 0xE63946,
];

const BACKGROUND_COLORS = [
    { bg: '#1a1a2e', accent: '#16213e', text: '#ffffff' },
    { bg: '#2d132c', accent: '#801336', text: '#ffffff' },
    { bg: '#0f3460', accent: '#16213e', text: '#ffffff' },
    { bg: '#1b262c', accent: '#0f4c75', text: '#ffffff' },
    { bg: '#2c3e50', accent: '#34495e', text: '#ffffff' },
    { bg: '#2b2e4a', accent: '#e84545', text: '#ffffff' },
    { bg: '#1e3a8a', accent: '#3b82f6', text: '#ffffff' },
    { bg: '#1f2937', accent: '#374151', text: '#ffffff' }
];

const QUOTE_APIS = [
    {
        name: 'ZenQuotes',
        url: 'https://zenquotes.io/api/random',
        transform: (data) => ({ text: data[0].q, author: data[0].a })
    },
    {
        name: 'Quotable',
        url: 'https://api.quotable.io/random',
        transform: (data) => ({ text: data.content, author: data.author })
    },
    {
        name: 'API Ninjas',
        url: 'https://api.api-ninjas.com/v1/quotes?category=inspirational',
        headers: { 'X-Api-Key': process.env.API_NINJAS_KEY || '' },
        transform: (data) => ({ text: data[0].quote, author: data[0].author }),
        requiresKey: true
    }
];

const FALLBACK_QUOTES = [
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "Life is what happens when you're busy making other plans.", author: "John Lennon" },
    { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
    { text: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle" },
    { text: "Be yourself; everyone else is already taken.", author: "Oscar Wilde" },
    { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
    { text: "Your time is limited, don't waste it living someone else's life.", author: "Steve Jobs" },
    { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
    { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" }
];

async function fetchQuote() {
    console.log('📖 Fetching quote from APIs...');
    for (const api of QUOTE_APIS) {
        if (api.requiresKey && !api.headers?.['X-Api-Key']) {
            console.log(`⏭️ Skipping ${api.name} (no API key)`);
            continue;
        }
        try {
            console.log(`🌐 Trying ${api.name}...`);
            const response = await axios.get(api.url, {
                headers: api.headers || {},
                timeout: 10000
            });
            if (response.data) {
                const quote = api.transform(response.data);
                if (quote.text && quote.author) {
                    console.log(`✅ Quote fetched from ${api.name}`);
                    return quote;
                }
            }
        } catch (error) {
            console.log(`❌ ${api.name} failed: ${error.message}`);
        }
    }
    console.log('📚 Using fallback quote...');
    return FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
}

function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + ' ' + word).width;
        if (width < maxWidth) {
            currentLine += ' ' + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

async function generateQuoteCard(quote) {
    try {
        console.log('🎨 Generating quote card...');
        const width = 1200;
        const height = 675;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        const colors = BACKGROUND_COLORS[Math.floor(Math.random() * BACKGROUND_COLORS.length)];

        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, colors.bg);
        gradient.addColorStop(1, colors.accent);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = colors.text;
        ctx.globalAlpha = 0.1;
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.arc(Math.random() * width, Math.random() * height, 50 + Math.random() * 100, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;

        const padding = 80;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(padding, padding, width - padding * 2, height - padding * 2);

        ctx.fillStyle = colors.text;
        ctx.globalAlpha = 0.3;
        ctx.font = 'bold 120px serif';
        ctx.fillText('"', padding + 40, padding + 120);
        ctx.globalAlpha = 1.0;

        ctx.fillStyle = colors.text;
        ctx.font = 'bold 42px Arial, sans-serif';
        ctx.textAlign = 'center';

        const maxTextWidth = (width - padding * 2) - 200;
        const lines = wrapText(ctx, quote.text, maxTextWidth);
        const lineHeight = 60;
        let textY = (height - lines.length * lineHeight) / 2;

        lines.forEach((line) => {
            ctx.fillText(line, width / 2, textY);
            textY += lineHeight;
        });

        ctx.font = 'italic 32px Arial, sans-serif';
        ctx.globalAlpha = 0.8;
        ctx.fillText(`— ${quote.author}`, width / 2, textY + 40);
        ctx.globalAlpha = 1.0;

        ctx.strokeStyle = colors.text;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(width / 2 - 100, textY + 20);
        ctx.lineTo(width / 2 + 100, textY + 20);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        ctx.font = '18px Arial, sans-serif';
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = colors.text;
        ctx.fillText('☕ Umbra X Development', width / 2, height - 40);
        ctx.globalAlpha = 1.0;

        console.log('✅ Quote card generated successfully');
        return canvas.toBuffer('image/png');
    } catch (error) {
        console.error('❌ Error generating quote card:', error);
        throw error;
    }
}

function buildQuoteComponents(quote, timestamp) {
    const timeStr = `<t:${Math.floor(timestamp / 1000)}:F>`;
    const preview = quote.text.length > 80 ? quote.text.slice(0, 77) + '…' : quote.text;

    return [
        {
            type: ComponentType.CONTAINER,
            accent_color: ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)],
            components: [

                

                {
                    type: ComponentType.SECTION,
                    components: [
                        {
                            type: ComponentType.TEXT_DISPLAY,
                            content: '## ✨  Quote of the Moment'
                        },
                        {
                            type: ComponentType.TEXT_DISPLAY,
                            content: `-# *"${preview}"*`
                        }
                    ],
                    accessory: {
                        type: ComponentType.THUMBNAIL,
                        media: { url: 'attachment://quote.png' }
                    }
                },

                

                {
                    type: ComponentType.SEPARATOR,
                    divider: true,
                    spacing: SeparatorSpacing.Small
                },

                

                {
                    type: ComponentType.MEDIA_GALLERY,
                    items: [
                        {
                            media: { url: 'attachment://quote.png' }
                        }
                    ]
                },

                

                {
                    type: ComponentType.SEPARATOR,
                    divider: true,
                    spacing: SeparatorSpacing.Small
                },

                

                {
                    type: ComponentType.TEXT_DISPLAY,
                    content: `-# ☕ Umbra X Development  •  ${timeStr}`
                }

            ]
        }
    ];
}

async function postQuoteToChannel(client) {
    const quoteChannelId = process.env.QUOTE_CHANNEL_ID;
    if (!quoteChannelId) {
        console.log('⚠️ QUOTE_CHANNEL_ID not set in .env');
        return;
    }
    try {
        const channel = client.channels.cache.get(quoteChannelId);
        if (!channel?.isTextBased()) {
            console.log('❌ Quote channel not found or not text-based');
            return;
        }
        console.log('📖 Posting quote to channel...');
        const quote = await fetchQuote();
        const cardBuffer = await generateQuoteCard(quote);
        const attachment = new AttachmentBuilder(cardBuffer, { name: 'quote.png' });
        const components = buildQuoteComponents(quote, Date.now());

        await channel.send({
            components,
            files: [attachment],
            flags: MessageFlags.IsComponentsV2
        });

        console.log(`✅ Quote posted to channel ${quoteChannelId}`);
        console.log(`📝 "${quote.text}" — ${quote.author}`);
    } catch (error) {
        console.error('❌ Error posting quote:', error);
    }
}

function initializeQuoteSystem(client) {
    const quoteInterval = parseInt(process.env.QUOTE_INTERVAL_MINUTES) || 60;
    const quoteChannelId = process.env.QUOTE_CHANNEL_ID;

    if (!quoteChannelId) {
        console.log('⚠️ Quote system disabled: QUOTE_CHANNEL_ID not set in .env');
        return null;
    }

    console.log(`✨ Quote system initialized — posting every ${quoteInterval} minutes`);
    console.log(`📍 Target channel: ${quoteChannelId}`);

    setTimeout(() => postQuoteToChannel(client), 5000);

    const intervalMs = quoteInterval * 60 * 1000;
    return setInterval(() => postQuoteToChannel(client), intervalMs);
}

module.exports = {
    initializeQuoteSystem,
    postQuoteToChannel,
    generateQuoteCard,
    fetchQuote
};