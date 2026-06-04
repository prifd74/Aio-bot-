const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

const C = {
    cream:     '#FDF6EC',
    gold:      '#C9973A',
    goldLight: '#F0C97A',
    goldDeep:  '#A87828',
    rose:      '#D4736A',
    rosePale:  '#F2C5AD',
    teal:      '#3D8FA1',
    tealLight: '#89C4CE',
    warmWhite: '#FEFAF4',
    brown:     '#7A5C3A',
    dimBrown:  '#A07850',
    textDark:  '#3B2A1A',
    textMid:   '#6B4E30',
};

function seededRand(seed) {
    let s = seed;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function drawStar4(ctx, cx, cy, r, color, alpha) {
    alpha = alpha !== undefined ? alpha : 0.8;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = color;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.moveTo(cx,            cy - r);
    ctx.lineTo(cx + r * 0.28, cy - r * 0.28);
    ctx.lineTo(cx + r,        cy);
    ctx.lineTo(cx + r * 0.28, cy + r * 0.28);
    ctx.lineTo(cx,            cy + r);
    ctx.lineTo(cx - r * 0.28, cy + r * 0.28);
    ctx.lineTo(cx - r,        cy);
    ctx.lineTo(cx - r * 0.28, cy - r * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function drawDiamond(ctx, cx, cy, r, color, alpha) {
    alpha = alpha !== undefined ? alpha : 0.8;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = color;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    ctx.moveTo(cx,     cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx,     cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function drawShimmerLine(ctx, x, y, len, color) {
    color = color || C.gold;
    const g = ctx.createLinearGradient(x, y, x + len, y);
    g.addColorStop(0,    'rgba(0,0,0,0)');
    g.addColorStop(0.15, color + '44');
    g.addColorStop(0.4,  color + 'CC');
    g.addColorStop(0.6,  color + 'CC');
    g.addColorStop(0.85, color + '44');
    g.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.save();
    ctx.strokeStyle = g;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
    ctx.restore();
}

function drawDiamondDivider(ctx, cx, y, totalW, color) {
    color = color || C.gold;
    const halfW = totalW / 2;
    ctx.save();
    const gl = ctx.createLinearGradient(cx - halfW, y, cx - 14, y);
    gl.addColorStop(0, 'rgba(0,0,0,0)');
    gl.addColorStop(1, color + 'BB');
    ctx.strokeStyle = gl;
    ctx.lineWidth   = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - halfW, y);
    ctx.lineTo(cx - 14, y);
    ctx.stroke();
    const gr = ctx.createLinearGradient(cx + 14, y, cx + halfW, y);
    gr.addColorStop(0, color + 'BB');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.strokeStyle = gr;
    ctx.beginPath();
    ctx.moveTo(cx + 14, y);
    ctx.lineTo(cx + halfW, y);
    ctx.stroke();
    ctx.restore();
    drawDiamond(ctx, cx, y, 5, color, 0.85);
}

function drawSparkles(ctx, w, h, count, seed) {
    const rand = seededRand(seed);
    ctx.save();
    for (let i = 0; i < count; i++) {
        const sx    = rand() * w;
        const sy    = rand() * h;
        const size  = rand() * 3.5 + 1;
        const alpha = rand() * 0.45 + 0.08;
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = rand() > 0.5 ? C.goldLight : '#FFFFFF';
        ctx.shadowColor = C.goldLight;
        ctx.shadowBlur  = 10;
        ctx.beginPath();
        for (let p = 0; p < 8; p++) {
            const angle  = (p * Math.PI) / 4 - Math.PI / 2;
            const radius = p % 2 === 0 ? size : size * 0.3;
            const px = sx + radius * Math.cos(angle);
            const py = sy + radius * Math.sin(angle);
            p === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
}

function drawVignette(ctx, w, h, strength) {
    strength = strength !== undefined ? strength : 0.35;
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.9);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,' + strength + ')');
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
}

function drawCornerCurl(ctx, x, y, size, mirrorX, mirrorY, color) {
    color = color || C.gold;
    ctx.save();
    ctx.translate(x, y);
    if (mirrorX) ctx.scale(-1, 1);
    if (mirrorY) ctx.scale(1, -1);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.8;
    ctx.globalAlpha = 0.7;
    ctx.lineCap     = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    ctx.moveTo(0, size);
    ctx.bezierCurveTo(0, size * 0.35, size * 0.35, 0, size, 0);
    ctx.stroke();
    ctx.globalAlpha = 0.38;
    ctx.lineWidth   = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.55);
    ctx.bezierCurveTo(0, size * 0.2, size * 0.2, 0, size * 0.55, 0);
    ctx.stroke();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle   = color;
    ctx.shadowBlur  = 12;
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.45;
    ctx.shadowBlur  = 4;
    ctx.beginPath();
    ctx.arc(size * 0.3, size * 0.07, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(size * 0.07, size * 0.3, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

async function drawBackground(ctx, W, H) {
    try {
        const bg = await loadImage(path.join(__dirname, 'card.png'));
        ctx.drawImage(bg, 0, 0, W, H);
    } catch (e) {
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0,   '#2a5c6a');
        g.addColorStop(0.4, '#4a7a5a');
        g.addColorStop(1,   '#8a6a2a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    }
}

async function createWelcomeCard(member, guild) {
    const width  = 1200;
    const height = 500;
    const canvas = createCanvas(width, height);
    const ctx    = canvas.getContext('2d');

    await drawBackground(ctx, width, height);
    drawVignette(ctx, width, height, 0.30);
    drawSparkles(ctx, width, height, 48, 91);

    ctx.save();
    ctx.shadowColor = C.goldDeep;
    ctx.shadowBlur  = 36;
    ctx.strokeStyle = C.gold + '66';
    ctx.lineWidth   = 2;
    roundRect(ctx, 28, 28, width - 56, height - 56, 26);
    ctx.stroke();
    ctx.restore();

    const cX = 28, cY = 28, cW = width - 56, cH = height - 56;
    const cardGrad = ctx.createLinearGradient(cX, cY, cX + cW, cY + cH);
    cardGrad.addColorStop(0,   'rgba(253,248,238,0.86)');
    cardGrad.addColorStop(0.5, 'rgba(250,240,220,0.80)');
    cardGrad.addColorStop(1,   'rgba(244,229,205,0.78)');
    ctx.fillStyle = cardGrad;
    roundRect(ctx, cX, cY, cW, cH, 26);
    ctx.fill();

    ctx.save();
    ctx.strokeStyle = C.gold + 'BB';
    ctx.lineWidth   = 1.8;
    roundRect(ctx, cX, cY, cW, cH, 26);
    ctx.stroke();
    ctx.strokeStyle = C.gold + '2A';
    ctx.lineWidth   = 1;
    roundRect(ctx, cX + 10, cY + 10, cW - 20, cH - 20, 20);
    ctx.stroke();
    ctx.restore();

    drawCornerCurl(ctx, cX + 32,      cY + 32,      52, false, false, C.gold);
    drawCornerCurl(ctx, cX + cW - 32, cY + 32,      52, true,  false, C.gold);
    drawCornerCurl(ctx, cX + 32,      cY + cH - 32, 52, false, true,  C.rose);
    drawCornerCurl(ctx, cX + cW - 32, cY + cH - 32, 52, true,  true,  C.rose);

    const avSize = 168;
    const avCX   = cX + 85 + avSize / 2;
    const avCY   = cY + cH / 2;

    for (let ring = 3; ring >= 1; ring--) {
        const rSize = avSize / 2 + 18 + ring * 16;
        ctx.save();
        ctx.strokeStyle = C.gold;
        ctx.lineWidth   = 1;
        ctx.globalAlpha = 0.07 - ring * 0.01;
        ctx.setLineDash(ring === 1 ? [4, 6] : ring === 2 ? [2, 8] : []);
        ctx.beginPath();
        ctx.arc(avCX, avCY, rSize, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    const halo = ctx.createRadialGradient(avCX, avCY, avSize * 0.38, avCX, avCY, avSize / 2 + 65);
    halo.addColorStop(0,   'rgba(240,200,100,0.20)');
    halo.addColorStop(0.6, 'rgba(212,115,106,0.06)');
    halo.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(avCX, avCY, avSize / 2 + 65, 0, Math.PI * 2);
    ctx.fill();

    try {
        const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512 });
        const avatar    = await loadImage(avatarURL);
        ctx.save();
        ctx.beginPath();
        ctx.arc(avCX, avCY, avSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, avCX - avSize / 2, avCY - avSize / 2, avSize, avSize);
        ctx.restore();
    } catch (e) {
        const fb = ctx.createRadialGradient(avCX, avCY, 0, avCX, avCY, avSize / 2);
        fb.addColorStop(0, C.rosePale);
        fb.addColorStop(1, C.gold + '88');
        ctx.fillStyle = fb;
        ctx.beginPath();
        ctx.arc(avCX, avCY, avSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.font         = 'bold 72px Georgia';
        ctx.fillStyle    = C.warmWhite;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(member.user.username.charAt(0).toUpperCase(), avCX, avCY);
    }

    const avBorder = ctx.createLinearGradient(avCX - avSize / 2, avCY - avSize / 2, avCX + avSize / 2, avCY + avSize / 2);
    avBorder.addColorStop(0,    C.goldLight);
    avBorder.addColorStop(0.33, C.gold);
    avBorder.addColorStop(0.66, C.rose);
    avBorder.addColorStop(1,    C.tealLight);
    ctx.save();
    ctx.strokeStyle = avBorder;
    ctx.lineWidth   = 5;
    ctx.shadowColor = C.gold + 'AA';
    ctx.shadowBlur  = 20;
    ctx.beginPath();
    ctx.arc(avCX, avCY, avSize / 2 + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.font         = 'bold 11px Georgia';
    ctx.fillStyle    = C.textMid;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(guild.name.toUpperCase().slice(0, 22), avCX, avCY + avSize / 2 + 30);
    ctx.restore();

    const tX = cX + 85 + avSize + 72;
    const tY = cY + 62;

    const tagText = 'A new soul has arrived';
    const tagW = 248, tagH = 30;
    const tagG = ctx.createLinearGradient(tX, tY, tX + tagW, tY + tagH);
    tagG.addColorStop(0, 'rgba(201,151,58,0.18)');
    tagG.addColorStop(1, 'rgba(212,115,106,0.14)');
    ctx.save();
    ctx.fillStyle = tagG;
    roundRect(ctx, tX, tY, tagW, tagH, 8);
    ctx.fill();
    ctx.strokeStyle = C.gold + '77';
    ctx.lineWidth   = 1.2;
    roundRect(ctx, tX, tY, tagW, tagH, 8);
    ctx.stroke();
    ctx.font         = '13px Georgia';
    ctx.fillStyle    = C.brown;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, tX + tagW / 2, tY + tagH / 2);
    ctx.restore();
    drawDiamond(ctx, tX + 10,        tY + tagH / 2, 4, C.gold, 0.7);
    drawDiamond(ctx, tX + tagW - 10, tY + tagH / 2, 4, C.gold, 0.7);

    ctx.save();
    ctx.font          = 'bold 72px Georgia';
    ctx.textAlign     = 'left';
    ctx.textBaseline  = 'alphabetic';
    const wGrad = ctx.createLinearGradient(tX, tY + 50, tX + 450, tY + 100);
    wGrad.addColorStop(0,    C.brown);
    wGrad.addColorStop(0.45, C.gold);
    wGrad.addColorStop(0.75, C.goldDeep);
    wGrad.addColorStop(1,    C.rose);
    ctx.fillStyle     = wGrad;
    ctx.shadowColor   = 'rgba(160,120,50,0.25)';
    ctx.shadowBlur    = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
    ctx.fillText('Welcome', tX, tY + 95);
    ctx.restore();

    const rawName     = member.user.username;
    const displayName = rawName.length > 18 ? rawName.slice(0, 16) + '..' : rawName;
    ctx.save();
    ctx.font          = 'bold 46px Georgia';
    ctx.textAlign     = 'left';
    ctx.textBaseline  = 'alphabetic';
    ctx.fillStyle     = C.textDark;
    ctx.shadowColor   = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur    = 8;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 2;
    ctx.fillText(displayName, tX, tY + 155);
    ctx.restore();

    drawShimmerLine(ctx, tX, tY + 174, 530);

    const serverLineY = tY + 206;
    drawDiamond(ctx, tX + 8, serverLineY - 7, 5, C.gold, 0.7);
    ctx.save();
    ctx.font         = '20px Georgia';
    ctx.fillStyle    = C.textMid;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(guild.name, tX + 22, serverLineY);
    ctx.restore();

    const badgeX = tX, badgeY = tY + 228, badgeW = 210, badgeH = 48;
    const bGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY + badgeH);
    bGrad.addColorStop(0, 'rgba(201,151,58,0.18)');
    bGrad.addColorStop(1, 'rgba(61,143,161,0.14)');
    ctx.save();
    ctx.fillStyle = bGrad;
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 10);
    ctx.fill();
    const badgeHL = ctx.createLinearGradient(badgeX, badgeY, badgeX, badgeY + 12);
    badgeHL.addColorStop(0, 'rgba(255,255,255,0.18)');
    badgeHL.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = badgeHL;
    roundRect(ctx, badgeX + 1, badgeY + 1, badgeW - 2, 12, 9);
    ctx.fill();
    ctx.strokeStyle = C.gold + '88';
    ctx.lineWidth   = 1.5;
    ctx.shadowColor = C.gold + '44';
    ctx.shadowBlur  = 8;
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 10);
    ctx.stroke();
    ctx.font         = 'bold 21px Georgia';
    ctx.fillStyle    = C.brown;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor  = C.gold + '66';
    ctx.shadowBlur   = 10;
    ctx.fillText('Member  #' + guild.memberCount, badgeX + badgeW / 2, badgeY + badgeH / 2);
    ctx.restore();

    drawShimmerLine(ctx, cX + 60, cY + cH - 44, cW - 120);

    const footerY = cY + cH - 18;
    const footerCX = width / 2;
    drawDiamond(ctx, footerCX, footerY - 6, 4, C.dimBrown, 0.5);
    ctx.save();
    ctx.font         = '13px Georgia';
    ctx.fillStyle    = C.dimBrown + 'BB';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText("We're so glad you're here", footerCX - 12, footerY);
    ctx.textAlign = 'left';
    ctx.fillText('May your time here be wonderful', footerCX + 12, footerY);
    ctx.restore();

    return canvas.toBuffer('image/png');
}

async function createRankCard(username, totalMessages, level) {
    const width  = 900;
    const height = 350;
    const canvas = createCanvas(width, height);
    const ctx    = canvas.getContext('2d');

    await drawBackground(ctx, width, height);
    drawVignette(ctx, width, height, 0.3);
    drawSparkles(ctx, width, height, 28, 44);

    ctx.save();
    ctx.shadowColor = C.goldDeep;
    ctx.shadowBlur  = 28;
    ctx.strokeStyle = C.gold + '77';
    ctx.lineWidth   = 2;
    roundRect(ctx, 28, 28, width - 56, height - 56, 22);
    ctx.stroke();
    ctx.restore();

    const cX = 28, cY = 28, cW = width - 56, cH = height - 56;
    const cardGrad = ctx.createLinearGradient(cX, cY, cX + cW, cY + cH);
    cardGrad.addColorStop(0, 'rgba(253,248,238,0.86)');
    cardGrad.addColorStop(1, 'rgba(244,229,205,0.80)');
    ctx.fillStyle = cardGrad;
    roundRect(ctx, cX, cY, cW, cH, 22);
    ctx.fill();

    ctx.save();
    ctx.strokeStyle = C.gold + 'BB';
    ctx.lineWidth   = 1.8;
    roundRect(ctx, cX, cY, cW, cH, 22);
    ctx.stroke();
    ctx.strokeStyle = C.gold + '2A';
    ctx.lineWidth   = 1;
    roundRect(ctx, cX + 9, cY + 9, cW - 18, cH - 18, 16);
    ctx.stroke();
    ctx.restore();

    drawCornerCurl(ctx, cX + 26,      cY + 26,      40, false, false, C.gold);
    drawCornerCurl(ctx, cX + cW - 26, cY + 26,      40, true,  false, C.gold);
    drawCornerCurl(ctx, cX + 26,      cY + cH - 26, 40, false, true,  C.rose);
    drawCornerCurl(ctx, cX + cW - 26, cY + cH - 26, 40, true,  true,  C.rose);

    const lX = cX + 44;

    const titleY = cY + 46;
    drawDiamond(ctx, lX + 6,   titleY - 5, 4, C.dimBrown, 0.65);
    drawDiamond(ctx, lX + 120, titleY - 5, 4, C.dimBrown, 0.65);
    ctx.save();
    ctx.font         = '13px Georgia';
    ctx.fillStyle    = C.dimBrown;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Your Journey', lX + 20, titleY);
    ctx.restore();

    const displayName = username.length > 20 ? username.slice(0, 18) + '..' : username;
    ctx.save();
    ctx.font          = 'bold 40px Georgia';
    ctx.textAlign     = 'left';
    ctx.textBaseline  = 'alphabetic';
    const uGrad = ctx.createLinearGradient(lX, cY + 60, lX + 500, cY + 100);
    uGrad.addColorStop(0,   C.brown);
    uGrad.addColorStop(0.6, C.gold);
    uGrad.addColorStop(1,   C.goldDeep);
    ctx.fillStyle     = uGrad;
    ctx.shadowColor   = C.gold + '55';
    ctx.shadowBlur    = 12;
    ctx.shadowOffsetY = 2;
    ctx.fillText(displayName, lX, cY + 98);
    ctx.restore();

    drawShimmerLine(ctx, lX, cY + 116, cW - 88);

    const barX = lX, barY = cY + 134, barW = cW - 88, barH = 16;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    roundRect(ctx, barX, barY, barW, barH, 8);
    ctx.fill();
    ctx.strokeStyle = C.gold + '55';
    ctx.lineWidth   = 1;
    roundRect(ctx, barX, barY, barW, barH, 8);
    ctx.stroke();
    ctx.restore();

    const pct = Math.min(totalMessages / 1000, 1);
    if (pct > 0) {
        const fillGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
        fillGrad.addColorStop(0,   C.rose);
        fillGrad.addColorStop(0.4, C.gold);
        fillGrad.addColorStop(0.8, C.tealLight);
        fillGrad.addColorStop(1,   C.teal);
        ctx.save();
        ctx.fillStyle   = fillGrad;
        ctx.shadowColor = C.gold + '99';
        ctx.shadowBlur  = 12;
        roundRect(ctx, barX, barY, barW * pct, barH, 8);
        ctx.fill();
        const barHL = ctx.createLinearGradient(barX, barY, barX, barY + barH * 0.5);
        barHL.addColorStop(0, 'rgba(255,255,255,0.28)');
        barHL.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = barHL;
        roundRect(ctx, barX + 1, barY + 1, barW * pct - 2, barH * 0.5, 7);
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.fillStyle   = C.warmWhite;
        ctx.shadowColor = C.goldLight;
        ctx.shadowBlur  = 22;
        ctx.beginPath();
        ctx.arc(barX + barW * pct, barY + barH / 2, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    ctx.save();
    ctx.font         = '13px Georgia';
    ctx.fillStyle    = C.dimBrown;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(totalMessages + ' / 1000 xp', barX, barY + 38);
    ctx.restore();

    const boxes = [
        { label: 'LEVEL',    value: String(level),         color: C.teal  },
        { label: 'MESSAGES', value: String(totalMessages), color: C.rose  },
        { label: 'STATUS',   value: 'Online',              color: C.brown },
    ];
    const boxW = 198, boxH = 90, boxY = cY + 180;
    boxes.forEach(function(box, i) {
        const bx   = lX + i * (boxW + 14);
        const boxG = ctx.createLinearGradient(bx, boxY, bx, boxY + boxH);
        boxG.addColorStop(0, 'rgba(201,151,58,0.13)');
        boxG.addColorStop(1, 'rgba(0,0,0,0.02)');
        ctx.save();
        ctx.fillStyle = boxG;
        roundRect(ctx, bx, boxY, boxW, boxH, 14);
        ctx.fill();
        const boxHL = ctx.createLinearGradient(bx, boxY, bx, boxY + 16);
        boxHL.addColorStop(0, 'rgba(255,255,255,0.20)');
        boxHL.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = boxHL;
        roundRect(ctx, bx + 1, boxY + 1, boxW - 2, 16, 13);
        ctx.fill();
        ctx.strokeStyle = C.gold + '66';
        ctx.lineWidth   = 1.5;
        roundRect(ctx, bx, boxY, boxW, boxH, 14);
        ctx.stroke();
        ctx.font         = '11px Georgia';
        ctx.fillStyle    = C.dimBrown;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(box.label, bx + boxW / 2, boxY + 30);
        ctx.font         = 'bold 30px Georgia';
        ctx.fillStyle    = box.color;
        ctx.shadowColor  = box.color + '66';
        ctx.shadowBlur   = 12;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(box.value, bx + boxW / 2, boxY + 70);
        ctx.restore();
    });

    return canvas.toBuffer('image/png');
}

async function createCelebrationCard(username) {
    const width  = 900;
    const height = 450;
    const canvas = createCanvas(width, height);
    const ctx    = canvas.getContext('2d');

    await drawBackground(ctx, width, height);
    drawVignette(ctx, width, height, 0.26);
    drawSparkles(ctx, width, height, 60, 13);

    ctx.save();
    ctx.shadowColor = C.goldDeep;
    ctx.shadowBlur  = 44;
    ctx.strokeStyle = C.gold + '88';
    ctx.lineWidth   = 2;
    roundRect(ctx, 40, 35, width - 80, height - 70, 26);
    ctx.stroke();
    ctx.restore();

    const cX = 40, cY = 35, cW = width - 80, cH = height - 70;
    const cardGrad = ctx.createLinearGradient(cX, cY, cX + cW, cY + cH);
    cardGrad.addColorStop(0, 'rgba(253,248,238,0.87)');
    cardGrad.addColorStop(1, 'rgba(244,229,205,0.81)');
    ctx.fillStyle = cardGrad;
    roundRect(ctx, cX, cY, cW, cH, 26);
    ctx.fill();

    ctx.save();
    ctx.strokeStyle = C.gold + 'BB';
    ctx.lineWidth   = 2;
    roundRect(ctx, cX, cY, cW, cH, 26);
    ctx.stroke();
    ctx.strokeStyle = C.rose + '33';
    ctx.lineWidth   = 1;
    roundRect(ctx, cX + 11, cY + 11, cW - 22, cH - 22, 20);
    ctx.stroke();
    ctx.restore();

    drawCornerCurl(ctx, cX + 32,      cY + 32,      54, false, false, C.gold);
    drawCornerCurl(ctx, cX + cW - 32, cY + 32,      54, true,  false, C.gold);
    drawCornerCurl(ctx, cX + 32,      cY + cH - 32, 54, false, true,  C.gold);
    drawCornerCurl(ctx, cX + cW - 32, cY + cH - 32, 54, true,  true,  C.gold);

    const tagW = 260, tagH = 30, tagX = width / 2 - tagW / 2, tagY = cY + 28;
    const tagG = ctx.createLinearGradient(tagX, tagY, tagX + tagW, tagY + tagH);
    tagG.addColorStop(0, 'rgba(201,151,58,0.18)');
    tagG.addColorStop(1, 'rgba(212,115,106,0.14)');
    ctx.save();
    ctx.fillStyle = tagG;
    roundRect(ctx, tagX, tagY, tagW, tagH, 8);
    ctx.fill();
    ctx.strokeStyle = C.gold + '77';
    ctx.lineWidth   = 1.2;
    roundRect(ctx, tagX, tagY, tagW, tagH, 8);
    ctx.stroke();
    ctx.font         = '13px Georgia';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = C.brown;
    ctx.fillText('Achievement Unlocked', width / 2, tagY + tagH / 2);
    ctx.restore();
    drawDiamond(ctx, tagX + 10,        tagY + tagH / 2, 4, C.gold, 0.7);
    drawDiamond(ctx, tagX + tagW - 10, tagY + tagH / 2, 4, C.gold, 0.7);

    ctx.save();
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'alphabetic';
    ctx.font          = 'bold 70px Georgia';
    const h1G = ctx.createLinearGradient(0, height / 2 - 110, width, height / 2 - 60);
    h1G.addColorStop(0,   C.brown);
    h1G.addColorStop(0.5, C.gold);
    h1G.addColorStop(1,   C.rose);
    ctx.fillStyle     = h1G;
    ctx.shadowColor   = C.gold + '66';
    ctx.shadowBlur    = 20;
    ctx.shadowOffsetY = 3;
    ctx.fillText('Congratulations', width / 2, height / 2 - 55);
    ctx.restore();

    ctx.save();
    ctx.font         = 'bold 37px Georgia';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    const h2G = ctx.createLinearGradient(0, height / 2 - 16, width, height / 2 + 24);
    h2G.addColorStop(0, C.teal);
    h2G.addColorStop(1, C.rose);
    ctx.fillStyle   = h2G;
    ctx.shadowColor = C.teal + '55';
    ctx.shadowBlur  = 14;
    ctx.fillText("You're truly wonderful", width / 2, height / 2 - 10);
    ctx.restore();

    drawDiamondDivider(ctx, width / 2, height / 2 + 20, 560);

    ctx.save();
    ctx.font         = 'bold 39px Georgia';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    const nGrad = ctx.createLinearGradient(0, height / 2 + 50, width, height / 2 + 88);
    nGrad.addColorStop(0,   C.brown);
    nGrad.addColorStop(0.5, C.gold);
    nGrad.addColorStop(1,   C.rose);
    ctx.fillStyle   = nGrad;
    ctx.shadowColor = C.gold + '55';
    ctx.shadowBlur  = 12;
    const displayName = username.length > 22 ? username.slice(0, 20) + '..' : username;
    ctx.fillText(displayName, width / 2, height / 2 + 68);
    ctx.restore();

    ctx.save();
    ctx.font         = '20px Georgia';
    ctx.fillStyle    = C.textMid;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Thank you for being a cherished part of this community', width / 2, height / 2 + 110);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(201,151,58,0.05)';
    ctx.fillRect(cX, cY + cH - 50, cW, 50);
    drawShimmerLine(ctx, cX, cY + cH - 50, cW, C.gold + '88');
    const fY  = cY + cH - 25;
    const fCX = width / 2;
    drawStar4(ctx, fCX - 230, fY, 4, C.dimBrown, 0.5);
    drawStar4(ctx, fCX - 75,  fY, 4, C.dimBrown, 0.5);
    drawStar4(ctx, fCX + 75,  fY, 4, C.dimBrown, 0.5);
    drawStar4(ctx, fCX + 230, fY, 4, C.dimBrown, 0.5);
    ctx.font         = '13px Georgia';
    ctx.fillStyle    = C.dimBrown + 'AA';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Achievement Logged', fCX - 152, fY);
    ctx.fillText('+500 XP', fCX, fY);
    ctx.fillText('Rank: Legendary', fCX + 152, fY);
    ctx.restore();

    return canvas.toBuffer('image/png');
}

module.exports = {
    createWelcomeCard,
    createRankCard,
    createCelebrationCard,
};