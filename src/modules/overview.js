

const { createCanvas, loadImage } = require('canvas');
const { AttachmentBuilder } = require('discord.js');
const axios = require('axios');

const C = {
    bg:         '#0D0B14',
    card:       '#13101E',
    cardBorder: '#1E1830',
    panel:      '#110F1B',
    panelBorder:'#241C3A',
    accent1:    '#C84B9E',
    accent2:    '#8B3FC8',
    accent3:    '#E055B5',
    text:       '#F2EAF8',
    textSub:    '#A08EC0',
    textMuted:  '#5A4E72',
    chartFill1: 'rgba(200,75,158,0.18)',
    chartFill2: 'rgba(139,63,200,0.18)',
};

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function drawCard(ctx, x, y, w, h, r = 14, fill = C.card, border = C.cardBorder) {
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;   ctx.fill();
    ctx.strokeStyle = border; ctx.lineWidth = 1.5; ctx.stroke();
}

function gradientText(ctx, text, x, y, size, c1, c2, weight = 'bold') {
    ctx.font = `${weight} ${size}px Arial`;
    const w = ctx.measureText(text).width;
    const g = ctx.createLinearGradient(x, y - size, x + w, y);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillText(text, x, y);
}

async function fetchAvatar(url) {
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
        return await loadImage(Buffer.from(res.data));
    } catch { return null; }
}

function dateKey(d) {
    return (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);
}

function daysAgoKey(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return dateKey(d);
}

function buildDailyBuckets(history, days = 14) {
    const buckets = {};
    for (let i = 0; i < days; i++) buckets[daysAgoKey(i)] = 0;

    (history || []).forEach(e => {
        const k = dateKey(e.timestamp);
        if (k in buckets) buckets[k]++;
    });

    return Object.keys(buckets)
        .sort()
        .map(k => buckets[k]);
}

function countInWindow(history, windowMs) {
    const cutoff = Date.now() - windowMs;
    return (history || []).filter(e => new Date(e.timestamp).getTime() >= cutoff).length;
}

function computeRank(targetId, conversations) {
    if (!conversations || typeof conversations !== 'object') return null;
    const sorted = Object.entries(conversations)
        .map(([id, d]) => ({ id, msgs: d?.userStats?.totalMessages || 0 }))
        .sort((a, b) => b.msgs - a.msgs);
    const pos = sorted.findIndex(e => e.id === targetId);
    return { rank: pos === -1 ? sorted.length + 1 : pos + 1, total: sorted.length };
}

function drawSparkline(ctx, x, y, w, h, data, color, fillColor) {
    if (!data || data.length < 2) return;
    const max  = Math.max(...data, 1);
    const step = w / (data.length - 1);

    ctx.beginPath();
    ctx.moveTo(x, y + h);
    data.forEach((v, i) => ctx.lineTo(x + i * step, y + h - (v / max) * h));
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    ctx.beginPath();
    data.forEach((v, i) => {
        const px = x + i * step, py = y + h - (v / max) * h;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2.5;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur  = 10;
    ctx.stroke();
    ctx.shadowBlur  = 0;
}

async function drawOverviewCard(member, userData, conversations) {
    const W = 1100, H = 720; 

    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext('2d');

    

    const bgG = ctx.createRadialGradient(W * 0.2, H * 0.2, 0, W * 0.5, H * 0.5, W * 0.8);
    bgG.addColorStop(0, '#160D28'); bgG.addColorStop(0.5, '#0D0B14'); bgG.addColorStop(1, '#080610');
    ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);

    

    ctx.strokeStyle = 'rgba(139,63,200,0.06)'; ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 60) { ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,H); ctx.stroke(); }
    for (let gy = 0; gy < H; gy += 60) { ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(W,gy); ctx.stroke(); }

    

    [
        { x:120,   y:80,    r:200, c:'rgba(200,75,158,0.12)' },
        { x:W-150, y:150,   r:220, c:'rgba(139,63,200,0.10)' },
        { x:200,   y:H-100, r:180, c:'rgba(139,63,200,0.08)' },
        { x:W-200, y:H-80,  r:160, c:'rgba(200,75,158,0.09)' },
    ].forEach(o => {
        const g = ctx.createRadialGradient(o.x,o.y,0,o.x,o.y,o.r);
        g.addColorStop(0, o.c); g.addColorStop(1,'transparent');
        ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    });

    

    ctx.save();
    const bG = ctx.createLinearGradient(0,0,W,H);
    bG.addColorStop(0,'rgba(200,75,158,0.5)'); bG.addColorStop(0.5,'rgba(139,63,200,0.5)'); bG.addColorStop(1,'rgba(200,75,158,0.5)');
    roundRect(ctx, 2, 2, W-4, H-4, 20);
    ctx.strokeStyle = bG; ctx.lineWidth = 2; ctx.shadowColor = C.accent1; ctx.shadowBlur = 20; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.restore();

    

    drawCard(ctx, 20, 20, W-40, 120, 16, '#110E1C', '#1E1830');

    

    const avatarImg = await fetchAvatar(member.user.displayAvatarURL({ extension:'png', size:256 }));
    const aX = 68, aY = 80, aR = 42;

    ctx.save();
    ctx.beginPath(); ctx.arc(aX, aY, aR+6, 0, Math.PI*2);
    const rG = ctx.createLinearGradient(aX-aR, aY-aR, aX+aR, aY+aR);
    rG.addColorStop(0, C.accent1); rG.addColorStop(1, C.accent2);
    ctx.strokeStyle = rG; ctx.lineWidth = 3; ctx.shadowColor = C.accent1; ctx.shadowBlur = 20; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.restore();

    if (avatarImg) {
        ctx.save(); ctx.beginPath(); ctx.arc(aX, aY, aR, 0, Math.PI*2); ctx.clip();
        ctx.drawImage(avatarImg, aX-aR, aY-aR, aR*2, aR*2); ctx.restore();
    } else {
        const ag = ctx.createLinearGradient(aX-aR, aY-aR, aX+aR, aY+aR);
        ag.addColorStop(0, C.accent1); ag.addColorStop(1, C.accent2);
        ctx.beginPath(); ctx.arc(aX, aY, aR, 0, Math.PI*2); ctx.fillStyle = ag; ctx.fill();
    }

    

    const displayName = member.displayName || member.user.username;
    gradientText(ctx, displayName, 128, 68, 32, C.accent3, C.accent2, 'bold');
    ctx.font = '16px Arial'; ctx.fillStyle = C.textSub; ctx.textAlign = 'left';
    ctx.fillText(`@${member.user.username}`, 130, 90);

    

    const topRole = member.roles.cache.filter(r => r.name !== '@everyone').sort((a,b) => b.position-a.position).first();
    if (topRole) {
        ctx.font = 'bold 13px Arial';
        const rw = ctx.measureText(topRole.name).width + 20;
        roundRect(ctx, 128, 98, rw, 22, 8);
        const rGrd = ctx.createLinearGradient(128, 98, 128+rw, 120);
        rGrd.addColorStop(0,'rgba(200,75,158,0.25)'); rGrd.addColorStop(1,'rgba(139,63,200,0.25)');
        ctx.fillStyle = rGrd; ctx.fill();
        ctx.strokeStyle = 'rgba(200,75,158,0.5)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = C.accent3; ctx.fillText(topRole.name, 138, 113);
    }

    

    function fmtDate(d) { return d ? d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : 'Unknown'; }

    drawCard(ctx, W-420, 34, 170, 72, 12, '#1A0F2E', '#2A1848');
    ctx.font = 'bold 11px Arial'; ctx.fillStyle = C.textSub; ctx.textAlign = 'center';
    ctx.fillText('ACCOUNT CREATED', W-420+85, 56);
    ctx.font = 'bold 16px Arial'; ctx.fillStyle = C.text;
    ctx.fillText(fmtDate(member.user.createdAt), W-420+85, 76);

    drawCard(ctx, W-235, 34, 195, 72, 12, '#1A0F2E', '#2A1848');
    ctx.font = 'bold 11px Arial'; ctx.fillStyle = C.textSub;
    ctx.fillText('JOINED SERVER', W-235+97, 56);
    ctx.font = 'bold 16px Arial'; ctx.fillStyle = C.text;
    ctx.fillText(fmtDate(member.joinedAt), W-235+97, 76);
    ctx.textAlign = 'left';

    

    const userId    = member.user.id;
    const history   = userData?.conversationHistory || [];
    const totalMsgs = userData?.userStats?.totalMessages  || 0;
    const relLevel  = userData?.userStats?.relationshipLevel || 1;
    const imgsGen   = userData?.userStats?.imagesGenerated  || 0;
    const specials  = userData?.userStats?.specialMoments   || [];
    const intentsMap= userData?.userStats?.favoriteIntents  || {};

    const msgs1d  = countInWindow(history, 86_400_000);
    const msgs7d  = countInWindow(history, 604_800_000);
    const msgs14d = countInWindow(history, 1_209_600_000);

    const msgBuckets = buildDailyBuckets(history, 14);

    const rankInfo   = computeRank(userId, conversations);
    const rankDisplay= rankInfo ? `#${rankInfo.rank} / ${rankInfo.total}` : 'Unranked';

    const daysSince = userData?.firstMessage
        ? Math.floor((Date.now() - new Date(userData.firstMessage)) / 86_400_000) : 0;

    const favIntent = Object.keys(intentsMap).length
        ? Object.keys(intentsMap).sort((a,b) => intentsMap[b]-intentsMap[a])[0]
        : 'chat';

    

    const row1Y = 158, row1H = 170;
    const colW  = (W - 60) / 3;
    const cols  = [20, 20 + colW + 10, 20 + (colW + 10) * 2];

    function sectionHeader(x, y, label, icon) {
        ctx.font = 'bold 14px Arial'; ctx.textAlign = 'left';
        const g = ctx.createLinearGradient(x+20, y, x+200, y);
        g.addColorStop(0, C.accent3); g.addColorStop(1, C.accent2);
        ctx.fillStyle = g;
        ctx.fillText(`${icon}  ${label}`, x+20, y+22);
        ctx.beginPath(); ctx.moveTo(x+20, y+28); ctx.lineTo(x+colW-20, y+28);
        ctx.strokeStyle = 'rgba(200,75,158,0.3)'; ctx.lineWidth = 1; ctx.stroke();
    }

    function statRow(x, y, w, label, value, color = C.accent1) {
        drawCard(ctx, x, y, w, 34, 8, '#180F2A', '#2A1848');
        ctx.font = 'bold 14px Arial'; ctx.fillStyle = C.textSub; ctx.textAlign = 'left';
        ctx.fillText(label, x+14, y+22);
        ctx.font = 'bold 16px Arial'; ctx.fillStyle = color; ctx.textAlign = 'right';
        ctx.fillText(value, x+w-14, y+22);
        ctx.textAlign = 'left';
    }

    

    drawCard(ctx, cols[0], row1Y, colW, row1H, 14);
    sectionHeader(cols[0], row1Y, 'Activity Rank', '🏆');
    statRow(cols[0]+14, row1Y+40,  colW-28, 'Server Rank', rankDisplay,       C.accent3);
    statRow(cols[0]+14, row1Y+82,  colW-28, 'Level',       `Lvl ${relLevel}`, C.accent2);
    statRow(cols[0]+14, row1Y+124, colW-28, 'Images Gen.', `${imgsGen}`,      C.accent1);

    

    drawCard(ctx, cols[1], row1Y, colW, row1H, 14);
    sectionHeader(cols[1], row1Y, 'Messages', '💬');
    statRow(cols[1]+14, row1Y+40,  colW-28, 'Last 24h', `${msgs1d}`,  C.accent3);
    statRow(cols[1]+14, row1Y+82,  colW-28, 'Last 7d',  `${msgs7d}`,  C.accent2);
    statRow(cols[1]+14, row1Y+124, colW-28, 'Last 14d', `${msgs14d}`, C.accent1);

    

    drawCard(ctx, cols[2], row1Y, colW, row1H, 14);
    sectionHeader(cols[2], row1Y, 'Milestones', '✨');
    statRow(cols[2]+14, row1Y+40,  colW-28, 'Days active',  `${daysSince}d`,          C.accent3);
    statRow(cols[2]+14, row1Y+82,  colW-28, 'Fav topic',    favIntent.slice(0,10),    C.accent2);
    statRow(cols[2]+14, row1Y+124, colW-28, 'Achievements', `${specials.length}`,     C.accent1);

    

    const row2Y = row1Y + row1H + 14;
    const row2H = 240; 

    const infoW = colW * 2 + 10;

    

    drawCard(ctx, 20, row2Y, infoW, row2H, 14);
    sectionHeader(20, row2Y, 'Activity Breakdown', '📊');

    const intentEntries  = Object.entries(intentsMap).sort((a,b) => b[1]-a[1]).slice(0,4);
    const intentMax      = intentEntries[0]?.[1] || 1;
    const intentColors   = [C.accent1, C.accent2, '#E0558B', '#7B3FBB'];

    if (intentEntries.length === 0) {
        ctx.font = '14px Arial'; ctx.fillStyle = C.textMuted; ctx.textAlign = 'left';
        ctx.fillText('No activity data yet — start chatting!', 40, row2Y + 90);
    } else {
        intentEntries.forEach(([name, count], i) => {
            const barY      = row2Y + 44 + i * 38; 

            const barX      = 40;
            const barTotalW = infoW - 180;
            const barH      = 18;
            const fillW     = Math.max((count / intentMax) * barTotalW, 6);

            ctx.font = '13px Arial'; ctx.fillStyle = C.textSub; ctx.textAlign = 'left';
            ctx.fillText(name.slice(0,12), barX, barY + 13);

            

            roundRect(ctx, barX+110, barY, barTotalW, barH, 9);
            ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill();

            

            roundRect(ctx, barX+110, barY, fillW, barH, 9);
            const bg = ctx.createLinearGradient(barX+110, barY, barX+110+fillW, barY);
            bg.addColorStop(0, intentColors[i]); bg.addColorStop(1, intentColors[(i+1)%intentColors.length]);
            ctx.fillStyle = bg; ctx.shadowColor = intentColors[i]; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;

            ctx.font = 'bold 12px Arial'; ctx.fillStyle = C.text; ctx.textAlign = 'right';
            ctx.fillText(`${count}`, barX+110+barTotalW+24, barY+13);
            ctx.textAlign = 'left';
        });
    }

    

    drawCard(ctx, 30, row2Y+row2H-44, infoW-20, 32, 10, 'rgba(200,75,158,0.12)', 'rgba(200,75,158,0.3)');
    ctx.font = 'bold 13px Arial'; ctx.fillStyle = C.textSub; ctx.textAlign = 'left';
    ctx.fillText('Total messages with Luna:', 46, row2Y+row2H-22);
    ctx.font = 'bold 15px Arial'; ctx.fillStyle = C.accent3; ctx.textAlign = 'right';
    ctx.fillText(`${totalMsgs}`, 30+infoW-20-14, row2Y+row2H-22);
    ctx.textAlign = 'left';

    

    drawCard(ctx, cols[2], row2Y, colW, row2H, 14);
    sectionHeader(cols[2], row2Y, '14-Day Trend', '📈');

    ctx.font = '12px Arial'; ctx.textAlign = 'left';
    ctx.fillStyle = C.accent1; ctx.fillText('● Msgs',   cols[2]+16,  row2Y+44);
    ctx.fillStyle = C.accent2; ctx.fillText('● Images', cols[2]+90,  row2Y+44);

    const cX = cols[2]+18, cY = row2Y+56, cW = colW-36, cH = 140; 

    drawSparkline(ctx, cX, cY, cW, cH, msgBuckets, C.accent1, C.chartFill1);

    const msgTotal   = msgBuckets.reduce((a,b) => a+b, 0) || 1;
    const imgBuckets = msgBuckets.map(v => Math.round((v / msgTotal) * imgsGen));
    drawSparkline(ctx, cX, cY, cW, cH, imgBuckets, C.accent2, C.chartFill2);

    

    ctx.beginPath(); ctx.moveTo(cX, cY+cH); ctx.lineTo(cX+cW, cY+cH);
    ctx.strokeStyle = 'rgba(200,75,158,0.25)'; ctx.lineWidth = 1; ctx.stroke();

    

    ctx.font = '10px Arial'; ctx.fillStyle = C.textMuted; ctx.textAlign = 'center';
    ['14d','7d','now'].forEach((lbl,i) => ctx.fillText(lbl, cX+(i/2)*cW, cY+cH+14));
    ctx.textAlign = 'left';

    

    const footerY = row2Y + row2H + 12;
    drawCard(ctx, 20, footerY, W-40, 42, 10, 'rgba(17,14,28,0.9)', '#1E1830');

    ctx.font = '13px Arial'; ctx.fillStyle = C.textMuted; ctx.textAlign = 'left';
    ctx.fillText('📅  Stats lookback: Last 14 days  •  Luna • Umbra X Development', 36, footerY+26);

    ctx.textAlign = 'right';
    gradientText(ctx, '✦ Powered by Luna', W-36, footerY+26, 13, C.accent1, C.accent2, '');
    ctx.textAlign = 'left';

    return canvas.toBuffer('image/png');
}

async function handleOverviewCommand(message, conversations) {
    try {
        await message.channel.sendTyping();

        const mentionedUser = message.mentions.members?.first();
        const member        = mentionedUser || message.member;
        const targetId      = member.user.id;
        const userData      = conversations?.[targetId] || null;

        const buffer     = await drawOverviewCard(member, userData, conversations);
        const attachment = new AttachmentBuilder(buffer, { name: 'overview.png' });
        await message.reply({ files: [attachment] });
    } catch (err) {
        console.error('❌ Overview error:', err);
        await message.reply({ content: `Couldn't generate overview card right now — try again! 💜` });
    }
}

module.exports = { handleOverviewCommand };