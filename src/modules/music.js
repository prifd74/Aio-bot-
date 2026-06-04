const { Kazagumo } = require('kazagumo');
const { Connectors } = require('shoukaku');
const {
    AttachmentBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags
} = require('discord.js');
const { createCanvas } = require('@napi-rs/canvas');
const fs   = require('fs').promises;
const fsS  = require('fs');
const path = require('path');
require('dotenv').config();

let _client   = null;
let _kazagumo = null;
let _cardPath = null;

const guildEmbedMessages = new Map(); 

const currentTrackMap    = new Map(); 

const autoplayMap        = new Map(); 

const lastAutoplayTitles = new Map(); 

const trackStartTimes    = new Map(); 

async function generateBaseCard() {
    const W = 1200, H = 300;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext('2d');

    

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0,   '#06060f');
    bg.addColorStop(0.5, '#0d0b20');
    bg.addColorStop(1,   '#06060f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    

    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 50) {
        ctx.strokeStyle = 'rgba(120,80,255,0.05)';
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 50) {
        ctx.strokeStyle = 'rgba(120,80,255,0.05)';
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    

    const floorY = H - 55;
    ctx.strokeStyle = 'rgba(160,100,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(40, floorY); ctx.lineTo(W - 40, floorY); ctx.stroke();

    

    const BARS  = 52, BAR_W = 13;
    const gap   = (W - 80 - BARS * BAR_W) / (BARS - 1);
    const MAX_H = 155;

    for (let i = 0; i < BARS; i++) {
        const t = i / (BARS - 1);
        const h = Math.max(6,
            (Math.sin(t * Math.PI * 2.8) * 0.42 +
             Math.sin(t * Math.PI * 6.1 + 0.9) * 0.28 +
             Math.sin(t * Math.PI * 1.4 + 0.3) * 0.18 + 0.5) * MAX_H
        );
        const x  = 40 + i * (BAR_W + gap);
        const y  = floorY - h;
        const r  = 70, g2 = Math.round(50 + t * 200), b = Math.round(230 - t * 30);

        const barGrad = ctx.createLinearGradient(x, y, x, floorY);
        barGrad.addColorStop(0,   `rgba(${r},${g2},${b},1)`);
        barGrad.addColorStop(0.7, `rgba(${r},${g2},${b},0.8)`);
        barGrad.addColorStop(1,   `rgba(${r},${g2},${b},0.3)`);
        ctx.fillStyle = barGrad;
        ctx.beginPath(); ctx.roundRect(x, y, BAR_W, h, [4, 4, 0, 0]); ctx.fill();

        

        ctx.shadowColor = `rgb(${r},${g2},${b})`; ctx.shadowBlur = 16;
        ctx.fillStyle   = `rgba(${r},${g2},${b},1)`;
        ctx.fillRect(x, y, BAR_W, 4);
        ctx.shadowBlur  = 0;

        

        const rh    = h * 0.28;
        const rGrad = ctx.createLinearGradient(x, floorY, x, floorY + rh);
        rGrad.addColorStop(0, `rgba(${r},${g2},${b},0.22)`);
        rGrad.addColorStop(1, `rgba(${r},${g2},${b},0)`);
        ctx.fillStyle = rGrad;
        ctx.fillRect(x, floorY + 1, BAR_W, rh);
    }

    

    const o1 = ctx.createRadialGradient(0, H/2, 0, 0, H/2, 220);
    o1.addColorStop(0, 'rgba(120,60,255,0.18)'); o1.addColorStop(1, 'rgba(120,60,255,0)');
    ctx.fillStyle = o1; ctx.fillRect(0, 0, W, H);
    const o2 = ctx.createRadialGradient(W, H/2, 0, W, H/2, 220);
    o2.addColorStop(0, 'rgba(0,200,255,0.15)'); o2.addColorStop(1, 'rgba(0,200,255,0)');
    ctx.fillStyle = o2; ctx.fillRect(0, 0, W, H);

    

    const vT = ctx.createLinearGradient(0, 0, 0, 60);
    vT.addColorStop(0, 'rgba(0,0,0,0.65)'); vT.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = vT; ctx.fillRect(0, 0, W, 60);
    const vB = ctx.createLinearGradient(0, H-45, 0, H);
    vB.addColorStop(0, 'rgba(0,0,0,0)'); vB.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = vB; ctx.fillRect(0, H-45, W, 45);

    const dest = path.join(__dirname, 'music_card_base.png');
    await fs.writeFile(dest, canvas.toBuffer('image/png'));
    return dest;
}

async function loadNodesConfig() {
    try {
        const data  = await fs.readFile(path.join(__dirname, 'nodes.json'), 'utf8');
        const nodes = JSON.parse(data);
        if (!Array.isArray(nodes) || !nodes.length) { console.warn('⚠️  No nodes.'); return []; }
        return nodes.map(n => ({
            name  : n.name || n.host || `node-${Math.random().toString(36).slice(2,8)}`,
            url   : n.url  || `${n.host||''}:${n.port||''}`,
            auth  : n.auth || n.password || 'youshallnotpass',
            secure: !!n.secure
        }));
    } catch (e) { console.error('loadNodesConfig:', e.message); return []; }
}

async function initializeMusic(client) {
    _client = client;
    try {
        _cardPath = await generateBaseCard();
        console.log('✅ Visualiser card generated');
    } catch (e) { console.error('⚠️  Card generation failed:', e.message); }

    const nodes = await loadNodesConfig();
    if (!nodes.length) { console.log('⚠️  Music disabled: no nodes.'); return null; }

    try {
        _kazagumo = new Kazagumo({
            defaultSearchEngine: 'youtube',
            send: (guildId, payload) => {
                try {
                    const guild = _client.guilds.cache.get(guildId);
                    if (guild?.shard) guild.shard.send(payload);
                } catch (e) { console.error('send error:', e?.message); }
            }
        }, new Connectors.DiscordJS(client), nodes, { voiceConnectionTimeout: 30 });
        console.log(`✅ Kazagumo initialized with ${nodes.length} node(s)`);
        setupMusicEvents();
        return _kazagumo;
    } catch (e) { console.error('❌ initializeMusic:', e.message); return null; }
}

function setupMusicEvents() {
    _kazagumo.on('playerCreate',  p => console.log(`🎵 playerCreate: ${p.guildId}`));
    _kazagumo.on('playerDestroy', p => { console.log(`🎵 playerDestroy: ${p.guildId}`); cleanupGuild(p.guildId); });

    _kazagumo.on('trackStart', (player, track) => {
        const guildId = player.guildId;
        const current = player.queue.current || track;
        console.log(`▶️  trackStart: "${current.title}" [${guildId}]`);
        currentTrackMap.set(guildId, current);
        trackStartTimes.set(guildId, { start: Date.now(), pausedAt: null, elapsed: 0 });
        updateMusicEmbed(player, current).catch(e => console.error('trackStart embed:', e.message));
    });

    _kazagumo.on('trackEnd', async (player, track) => {
        console.log(`⏹️  trackEnd: "${track?.title}"`);
        currentTrackMap.delete(player.guildId);
        trackStartTimes.delete(player.guildId);
        await new Promise(r => setTimeout(r, 500));
        if (!player.playing && !player.queue.length) {
            if (autoplayMap.get(player.guildId)) await handleAutoplaySearch(player, track);
            else updateMusicEmbed(player, null);
        }
    });

    _kazagumo.on('playerEmpty', player => {
        currentTrackMap.delete(player.guildId);
        trackStartTimes.delete(player.guildId);
        if (autoplayMap.get(player.guildId)) handleAutoplaySearch(player, null);
        else updateMusicEmbed(player, null);
    });

    _kazagumo.on('trackError', (player, track, error) => {
        console.error(`❌ trackError: "${track?.title}" — ${error.message}`);
        currentTrackMap.delete(player.guildId);
        trackStartTimes.delete(player.guildId);
        if (player.queue.length) player.skip();
        else if (autoplayMap.get(player.guildId)) handleAutoplaySearch(player, track);
        else updateMusicEmbed(player, null);
    });

    _kazagumo.on('playerError',  (p, e) => console.error(`❌ playerError [${p.guildId}]:`, e.message));
    _kazagumo.on('disconnect',   p      => console.log(`🔌 disconnect: ${p.guildId}`));
    _kazagumo.on('error',        e      => console.error('Kazagumo error:', e));

    if (_kazagumo.shoukaku) {
        _kazagumo.shoukaku.on('error',          (e, c) => console.error('Shoukaku error:', e, c));
        _kazagumo.shoukaku.on('nodeError',      (n, e) => console.error(`Node error (${n.name}):`, e?.message));
        _kazagumo.shoukaku.on('nodeDisconnect', n      => console.warn(`Node disconnected: ${n.name}`));
        _kazagumo.shoukaku.on('nodeConnect',    n      => console.log(`Node connected: ${n.name}`));
    }
    console.log('✅ Music events registered');

    

    _client.on('voiceStateUpdate', async (oldState, newState) => {
        try {
            const guildId = oldState.guildId;
            const player  = _kazagumo?.players.get(guildId);
            if (!player || !player.voiceId) return;

            

            if (oldState.channelId !== player.voiceId) return;

            

            if (oldState.member?.user?.bot) return;

            const guild = _client.guilds.cache.get(guildId);
            if (!guild) return;
            const vc = guild.channels.cache.get(player.voiceId);
            if (!vc) return;

            

            

            const leavingId = oldState.member?.id;
            const humans = vc.members.filter(m => !m.user.bot && m.id !== leavingId).size;
            if (humans > 0) return;

            console.log(`🔇 VC empty in ${guildId}, leaving`);
            autoplayMap.delete(guildId);
            lastAutoplayTitles.delete(guildId);
            cleanupGuild(guildId);
            await player.destroy();
            await updateMusicEmbed({ guildId }, null);
        } catch (e) { console.error('voiceStateUpdate cleanup:', e.message); }
    });

    

    setInterval(() => {
        if (!_kazagumo) return;
        for (const [guildId, player] of _kazagumo.players) {
            if (!player || (!player.playing && !player.paused)) continue;
            const track = player.queue.current;
            if (!track) continue;
            currentTrackMap.set(guildId, track);
            updateMusicEmbed(player, track).catch(e =>
                console.error(`interval [${guildId}]:`, e.message)
            );
        }
    }, 7000);
}

function cleanupGuild(guildId) {
    currentTrackMap.delete(guildId);
    trackStartTimes.delete(guildId);
}

function formatTime(ms) {
    if (!ms || ms <= 0) return '0:00';
    const s   = Math.floor(ms / 1000);
    const h   = Math.floor(s / 3600);
    const m   = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${m}:${String(sec).padStart(2,'0')}`;
}

function getPosition(player) {
    const pos = player?.shoukaku?.position ?? 0;
    if (pos > 0) return pos;
    const t = trackStartTimes.get(player?.guildId);
    if (!t) return 0;
    if (t.pausedAt !== null) return t.elapsed;
    return t.elapsed + (Date.now() - t.start);
}

function getDuration(track) {
    if (!track) return 0;
    if (typeof track.duration === 'number' && track.duration > 0) return track.duration;
    if (typeof track.info?.length === 'number' && track.info.length > 0) return track.info.length;
    if (typeof track.length === 'number' && track.length > 0) return track.length;
    return 0;
}

function safeText(str) {
    if (!str) return 'Unknown';
    return str
        .replace(/@(everyone|here)/gi, '@\u200B$1')
        .replace(/<[@#!&]?\d+>/g, '[mention]')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim().slice(0, 100) || 'Unknown';
}

function buildProgressBar(pos, dur) {
    const p      = Math.max(0, Math.min(pos || 0, dur || 0));
    const pct    = dur > 0 ? Math.round((p / dur) * 20) : 0;
    const filled = Math.max(0, Math.min(pct, 20));
    return `${'▰'.repeat(filled)}🔘${'▱'.repeat(20 - filled)}`;
}

function buildQueueText(player, max = 5) {
    const q = player?.queue;
    if (!q || !q.length) return null;
    const lines = [...q].slice(0, max).map((t, i) => {
        const dur   = t.isStream ? '🔴 LIVE' : formatTime(getDuration(t));
        const title = safeText(t.title);
        const short = title.length > 45 ? title.slice(0, 43) + '…' : title;
        const req   = t.requester?.username ? ` — *${t.requester.username}*` : '';
        return `\`${String(i+1).padStart(2,'0')}\` **${short}** \`${dur}\`${req}`;
    });
    if (q.length > max) { const r = q.length - max; lines.push(`-# … and **${r}** more track${r>1?'s':''}`); }
    return lines.join('\n');
}

function buildNowPlayingContainer(track, player) {
    const pos      = getPosition(player);
    const dur      = getDuration(track);
    const isStream = track?.isStream ?? false;
    const paused   = player?.paused  ?? false;
    const volume   = player?.volume  ?? 100;
    const queueLen = player?.queue?.length ?? 0;
    const isAuto   = autoplayMap.get(player?.guildId) ?? false;
    const title    = safeText(track?.title);
    const artist   = safeText(track?.author);
    const bar      = isStream ? '🔴 **LIVE STREAM**' : buildProgressBar(pos, dur);
    const timeText = isStream ? '🔴 Live' : `${formatTime(pos)}  ──────  ${formatTime(dur)}`;

    const c = new ContainerBuilder().setAccentColor(paused ? 0xFFA500 : 0x6441A5);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `${paused ? '⏸️' : '▶️'}  **${paused ? 'PAUSED' : 'NOW PLAYING'}**\n### ${title}\n-# 🎤 ${artist}`
    ));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL('attachment://music_card.png'))
    );
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${bar}\n-# ${timeText}`));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `🔊 **${volume}%**\u2003📋 Queue: **${queueLen}**\u2003🔁 Autoplay: **${isAuto ? 'ON ✅' : 'OFF ❌'}**\u2003-# by ${track?.requester?.username ?? 'Unknown'}`
    ));
    const qt = buildQueueText(player);
    if (qt) {
        c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`📜  **Up Next**\n${qt}`));
    }
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('music_play'    ).setLabel('Play'    ).setEmoji('▶️').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('music_pause'   ).setLabel('Pause'   ).setEmoji('⏸️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('music_skip'    ).setLabel('Skip'    ).setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_stop'    ).setLabel('Stop'    ).setEmoji('⏹️').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('music_autoplay').setLabel('Autoplay').setEmoji('🔁').setStyle(isAuto ? ButtonStyle.Success : ButtonStyle.Secondary)
    ));
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('music_vol_down').setLabel('Vol −').setEmoji('🔉').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_vol_up'  ).setLabel('Vol +').setEmoji('🔊').setStyle(ButtonStyle.Secondary)
    ));
    return c;
}

function buildIdleContainer() {
    const c = new ContainerBuilder().setAccentColor(0x5865F2);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent('🎧  **Luna Music**  —  Ready to Play'));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL('attachment://music_card.png'))
    );
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        '**No song is currently playing.**\n\n' +
        '-# 💡 Type a song name or paste a playlist URL to start\n' +
        '-# ✨ Your personal music experience awaits!'
    ));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('music_play'    ).setLabel('Play'    ).setEmoji('▶️').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('music_pause'   ).setLabel('Pause'   ).setEmoji('⏸️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('music_skip'    ).setLabel('Skip'    ).setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_stop'    ).setLabel('Stop'    ).setEmoji('⏹️').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('music_autoplay').setLabel('Autoplay').setEmoji('🔁').setStyle(ButtonStyle.Secondary)
    ));
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('music_vol_down').setLabel('Vol −').setEmoji('🔉').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_vol_up'  ).setLabel('Vol +').setEmoji('🔊').setStyle(ButtonStyle.Secondary)
    ));
    return c;
}

async function purgeChannel(channel) {
    try {
        let fetched;
        do {
            const msgs = await channel.messages.fetch({ limit: 100 });
            if (!msgs.size) break;
            fetched = msgs.size;
            const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
            const recent = msgs.filter(m => m.createdTimestamp > cutoff);
            const old    = msgs.filter(m => m.createdTimestamp <= cutoff);
            if (recent.size >= 2) await channel.bulkDelete(recent, true);
            else if (recent.size === 1) await recent.first().delete();
            for (const msg of old.values()) {
                try { await msg.delete(); } catch {}
                await new Promise(r => setTimeout(r, 300));
            }
            if (fetched > 0) await new Promise(r => setTimeout(r, 500));
        } while (fetched >= 100);
    } catch (e) { console.error('purgeChannel:', e.message); }
}

function getCardFile() {
    const p = _cardPath || path.join(__dirname, 'music_card_base.png');
    return fsS.existsSync(p) ? new AttachmentBuilder(p, { name: 'music_card.png' }) : null;
}

async function initializeMusicEmbed(client) {
    if (client) _client = client;
    try {
        const chId = process.env.MUSIC_CHANNEL_ID;
        if (!chId) { console.log('⚠️  MUSIC_CHANNEL_ID not set'); return; }
        const channel = _client.channels.cache.get(chId);
        if (!channel?.isTextBased()) { console.log('⚠️  Music channel not found'); return; }
        await purgeChannel(channel);

        const card    = getCardFile();
        const payload = {
            components: [buildIdleContainer()],
            flags     : MessageFlags.IsComponentsV2,
            files     : card ? [card] : []
        };
        const msg = await channel.send(payload);
        guildEmbedMessages.set(`initial_${chId}`, msg.id);
        console.log(`✅ Music embed ready (${msg.id})`);
    } catch (e) { console.error('initializeMusicEmbed:', e.message); }
}

async function updateMusicEmbed(player, track) {
    try {
        if (!_client) { console.error('updateMusicEmbed: _client not set'); return; }
        const chId = process.env.MUSIC_CHANNEL_ID;
        if (!chId) return;
        const channel = _client.channels.cache.get(chId);
        if (!channel?.isTextBased()) return;

        const guildId   = player?.guildId;
        const container = track ? buildNowPlayingContainer(track, player) : buildIdleContainer();
        const card      = getCardFile();
        const payload   = {
            components: [container],
            flags     : MessageFlags.IsComponentsV2,
            files     : card ? [card] : []
        };

        

        let msgId = guildId ? guildEmbedMessages.get(guildId) : null;
        if (!msgId) {
            msgId = guildEmbedMessages.get(`initial_${chId}`);
            if (msgId && guildId) guildEmbedMessages.set(guildId, msgId);
        }

        if (msgId) {
            try {
                const msg = await channel.messages.fetch(msgId);
                await msg.edit(payload);
                return;
            } catch (e) {
                console.error('updateMusicEmbed edit failed:', e.message);
                if (guildId) guildEmbedMessages.delete(guildId);
                guildEmbedMessages.delete(`initial_${chId}`);
            }
        }

        const newMsg = await channel.send(payload);
        if (guildId) guildEmbedMessages.set(guildId, newMsg.id);
        guildEmbedMessages.set(`initial_${chId}`, newMsg.id);
    } catch (e) { console.error('updateMusicEmbed:', e.message); }
}

async function handleMusicButton(interaction) {
    if (!interaction.isButton() || !interaction.customId.startsWith('music_')) return;
    const { customId, guildId } = interaction;
    try {
        await interaction.deferUpdate();

        const player = _kazagumo?.players.get(guildId);
        const chId   = process.env.MUSIC_CHANNEL_ID;

        if (player && chId && !guildEmbedMessages.get(guildId)) {
            const initId = guildEmbedMessages.get(`initial_${chId}`);
            if (initId) guildEmbedMessages.set(guildId, initId);
        }

        if (!player && customId !== 'music_stop')
            return interaction.followUp({ content: '❌ No active music player!', ephemeral: true });
        if (!interaction.member?.voice?.channel && customId !== 'music_stop')
            return interaction.followUp({ content: '❌ Join a voice channel first!', ephemeral: true });

        switch (customId) {

            case 'music_play': {
                if (!player.paused) return interaction.followUp({ content: '▶️ Already playing!', ephemeral: true });
                await player.pause(false);
                const t = trackStartTimes.get(guildId);
                if (t && t.pausedAt !== null) { t.start = Date.now(); t.pausedAt = null; }
                await updateMusicEmbed(player, currentTrackMap.get(guildId) ?? null);
                interaction.followUp({ content: '▶️ Resumed!', ephemeral: true });
                break;
            }

            case 'music_pause': {
                if (player.paused) return interaction.followUp({ content: '⏸️ Already paused!', ephemeral: true });
                await player.pause(true);
                const t = trackStartTimes.get(guildId);
                if (t && t.pausedAt === null) { t.elapsed += Date.now() - t.start; t.pausedAt = Date.now(); }
                await updateMusicEmbed(player, currentTrackMap.get(guildId) ?? null);
                interaction.followUp({ content: '⏸️ Paused!', ephemeral: true });
                break;
            }

            case 'music_skip': {
                const ct = currentTrackMap.get(guildId);
                if (!ct) return interaction.followUp({ content: '❌ Nothing is playing!', ephemeral: true });
                if (!player.queue.length && !autoplayMap.get(guildId))
                    return interaction.followUp({ content: '❌ Queue is empty & autoplay is off.', ephemeral: true });
                const skippedTitle = safeText(ct.title);
                

                currentTrackMap.delete(guildId);
                player.skip();
                interaction.followUp({ content: `⏭️ Skipped **${skippedTitle}**!`, ephemeral: true });
                break;
            }

            case 'music_vol_down': {
                const vol = Math.max(0, (player.volume || 100) - 10);
                await player.setVolume(vol);
                await updateMusicEmbed(player, currentTrackMap.get(guildId) ?? null);
                interaction.followUp({ content: `🔉 Volume: **${vol}%**`, ephemeral: true });
                break;
            }

            case 'music_vol_up': {
                const vol = Math.min(100, (player.volume || 100) + 10);
                await player.setVolume(vol);
                await updateMusicEmbed(player, currentTrackMap.get(guildId) ?? null);
                interaction.followUp({ content: `🔊 Volume: **${vol}%**`, ephemeral: true });
                break;
            }

            case 'music_autoplay': {
                const next = !autoplayMap.get(guildId);
                autoplayMap.set(guildId, next);
                await updateMusicEmbed(player ?? { guildId }, currentTrackMap.get(guildId) ?? null);
                interaction.followUp({ content: `🔁 Autoplay ${next ? '✅ ON' : '❌ OFF'}`, ephemeral: true });
                if (next && player && !player.playing && !player.queue.length)
                    await handleAutoplaySearch(player, null);
                break;
            }

            case 'music_stop': {
                if (!player) return interaction.followUp({ content: '❌ No active player!', ephemeral: true });
                const sid = guildId;
                autoplayMap.delete(sid); lastAutoplayTitles.delete(sid); cleanupGuild(sid);
                await player.destroy();
                await updateMusicEmbed({ guildId: sid }, null);
                interaction.followUp({ content: '⏹️ Stopped!', ephemeral: true });
                break;
            }
        }
    } catch (e) {
        console.error('handleMusicButton:', e);
        try { interaction.followUp({ content: '❌ Something went wrong!', ephemeral: true }); } catch {}
    }
}

async function handleMusicSearch(message, kazagumo) {
    const kz = kazagumo || _kazagumo;
    if (!kz) return;
    try {
        const voiceChannel = message.member?.voice?.channel;
        if (!voiceChannel) return message.reply('❌ Join a voice channel first!');
        const query = message.content?.trim();
        if (!query) return message.reply('❌ Provide a song name or URL!');
        try { await message.delete(); } catch {}
        await message.channel.sendTyping();

        const chId = process.env.MUSIC_CHANNEL_ID;
        let player = kz.players.get(message.guildId);
        if (!player) {
            player = await kz.createPlayer({
                guildId: message.guildId, voiceId: voiceChannel.id,
                textId : message.channel.id, deaf: true
            });
        }
        if (!guildEmbedMessages.get(message.guildId)) {
            const initId = guildEmbedMessages.get(`initial_${chId}`);
            if (initId) guildEmbedMessages.set(message.guildId, initId);
        }

        const result = await kz.search(query, { requester: message.author });
        if (!result?.tracks?.length)
            return message.channel.send('❌ No results found!')
                .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

        

        if (result.type === 'PLAYLIST') {
            const tracks = result.tracks;
            if (player.playing || player.paused) {
                for (const t of tracks) player.queue.add(t);
                await updateMusicEmbed(player, currentTrackMap.get(player.guildId) ?? null);
            } else {
                const [first, ...rest] = tracks;
                for (const t of rest) player.queue.add(t);
                currentTrackMap.set(player.guildId, first);
                await player.play(first);
            }
            message.channel.send(`📋 **Playlist:** ${safeText(result.playlistName || 'Unnamed')} — **${tracks.length}** tracks`)
                .then(m => setTimeout(() => m.delete().catch(() => {}), 8000));
            return;
        }

        

        const track = result.tracks[0];
        if (player.playing || player.paused) {
            player.queue.add(track);
            await updateMusicEmbed(player, currentTrackMap.get(player.guildId) ?? null);
            message.channel.send(`➕ **Queued:** ${safeText(track.title)} \`${formatTime(getDuration(track))}\``)
                .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
        } else {
            currentTrackMap.set(player.guildId, track);
            await player.play(track);
        }
    } catch (e) { console.error('handleMusicSearch:', e.message); }
}

async function handleAutoplaySearch(player, lastTrack = null) {
    try {
        const guildId = player.guildId;
        if (!autoplayMap.get(guildId)) return;
        const guild = _client.guilds.cache.get(guildId);
        if (!guild) return;
        const vc = guild.channels.cache.get(player.voiceId);
        if (!vc) return;

        

        if (vc.members.filter(m => !m.user.bot).size === 0) {
            autoplayMap.delete(guildId);
            lastAutoplayTitles.delete(guildId);
            cleanupGuild(guildId);
            try { await player.destroy(); } catch {}
            await updateMusicEmbed({ guildId }, null);
            return;
        }

        if (!lastAutoplayTitles.has(guildId)) lastAutoplayTitles.set(guildId, new Set());
        const seen = lastAutoplayTitles.get(guildId);
        if (seen.size > 50) lastAutoplayTitles.set(guildId, new Set([...seen].slice(-25)));

        const generic = [
            'trending music 2024', 'popular songs 2024', 'top hits playlist', 'chill music mix',
            'party music', 'workout songs', 'lofi hip hop', 'electronic music mix',
            'indie music', 'pop hits', 'rock songs', 'edm music', 'acoustic songs', 'billboard hot 100'
        ];
        let pool = [...generic];
        if (lastTrack?.title || lastTrack?.author) {
            const st  = (lastTrack.title  || '').replace(/[^\w\s]/gi, '').slice(0, 40);
            const sa  = (lastTrack.author || '').replace(/[^\w\s]/gi, '').slice(0, 30);
            const rel = [];
            if (sa) rel.push(`${sa} songs`, `${sa} best songs`, `${sa} mix`);
            if (st) rel.push(`songs like ${st}`, `${st} playlist`);
            pool = [...rel, ...generic];
        }

        let chosen = null, attempts = 0;
        while (!chosen && attempts < 5) {
            attempts++;
            const q = pool[Math.floor(Math.random() * pool.length)];
            let res; try { res = await _kazagumo.search(q); } catch { continue; }
            if (!res?.tracks?.length) continue;
            const cands = res.tracks.slice(0, 10);
            chosen = cands.find(t => t.title && !seen.has(t.title))
                  || cands[Math.floor(Math.random() * Math.min(5, cands.length))];
        }

        if (!chosen) {
            setTimeout(() => {
                if (autoplayMap.get(guildId) && !player.playing && !player.queue.length)
                    handleAutoplaySearch(player, lastTrack);
            }, 3000);
            return;
        }

        if (chosen.title) seen.add(chosen.title);
        if (!player.playing && !player.queue.length) {
            currentTrackMap.set(guildId, chosen);
            await player.play(chosen);
        } else {
            player.queue.add(chosen);
        }
    } catch (e) {
        console.error('handleAutoplaySearch:', e.message);
        setTimeout(() => {
            if (autoplayMap.get(player?.guildId) && !player.playing && !player.queue.length)
                handleAutoplaySearch(player, lastTrack);
        }, 3000);
    }
}

async function checkVoiceChannelAndCleanup(guildId) {
    try {
        if (!_kazagumo) return;
        const player = _kazagumo.players.get(guildId);
        if (!player) return;
        const vc = _client.guilds.cache.get(guildId)?.channels.cache.get(player.voiceId);
        if (!vc) return;
        if (vc.members.filter(m => !m.user.bot).size === 0) {
            autoplayMap.delete(guildId);
            lastAutoplayTitles.delete(guildId);
            cleanupGuild(guildId);
            await player.destroy();
            await updateMusicEmbed({ guildId }, null);
        }
    } catch (e) { console.error('checkVoiceChannelAndCleanup:', e.message); }
}

module.exports = {
    initializeMusic,
    initializeMusicEmbed,
    handleMusicButton,
    handleMusicSearch,
    setupMusicEvents,
    checkVoiceChannelAndCleanup
};