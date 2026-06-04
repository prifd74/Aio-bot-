const os = require('os');
const {
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ThumbnailBuilder,
    MessageFlags
} = require('discord.js');

function formatBytes(bytes) {
    const gb = bytes / (1024 ** 3);
    return gb >= 1 ? `${gb.toFixed(2)} GB` : `${(bytes / (1024 ** 2)).toFixed(0)} MB`;
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d) parts.push(`${d}d`);
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    if (s || !parts.length) parts.push(`${s}s`);
    return parts.join(' ');
}

function getProgressBar(percent, length = 12) {
    const filled = Math.round((percent / 100) * length);
    const empty  = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

function getCpuUsage() {
    return new Promise((resolve) => {
        const cpus1 = os.cpus();
        setTimeout(() => {
            const cpus2 = os.cpus();
            let totalIdle = 0, totalTick = 0;
            cpus2.forEach((cpu, i) => {
                const prev = cpus1[i];
                for (const type in cpu.times) {
                    totalTick += cpu.times[type] - (prev.times[type] || 0);
                }
                totalIdle += cpu.times.idle - (prev.times.idle || 0);
            });
            const usage = 100 - (100 * totalIdle / totalTick);
            resolve(Math.max(0, Math.min(100, usage)));
        }, 500);
    });
}

function getStatusEmoji(percent) {
    if (percent < 30)  return '🟢';
    if (percent < 65)  return '🟡';
    if (percent < 85)  return '🟠';
    return '🔴';
}

function buildCpuComponent(data, botAvatarUrl) {
    const {
        cpuModel, cpuCores, cpuThreads, cpuSpeed,
        cpuUsage, ramUsed, ramTotal, ramFree, ramUsage,
        heapUsed, heapTotal, heapUsage,
        platform, arch, nodeVersion, botUptime, sysUptime
    } = data;

    const container = new ContainerBuilder().setAccentColor(0x5865F2);

    const header = new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## 🖥️ Luna System Monitor\n` +
                `-# Live diagnostics for Umbra X Development`
            )
        )
        .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(botAvatarUrl)
        );
    container.addSectionComponents(header);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));

    const cpuBar    = getProgressBar(cpuUsage);
    const cpuEmoji  = getStatusEmoji(cpuUsage);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `**⚙️ CPU**\n` +
            `> **Model** — \`${cpuModel}\`\n` +
            `> **Cores** — \`${cpuCores} physical\` · \`${cpuThreads} logical\`\n` +
            `> **Speed** — \`${cpuSpeed} GHz\`\n` +
            `> **Usage** — ${cpuEmoji} \`${cpuUsage.toFixed(1)}%\` \`[${cpuBar}]\``
        )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(1));

    const ramBar   = getProgressBar(ramUsage);
    const ramEmoji = getStatusEmoji(ramUsage);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `**🧠 RAM**\n` +
            `> **Total** — \`${ramTotal}\`\n` +
            `> **Used** — \`${ramUsed}\` · **Free** — \`${ramFree}\`\n` +
            `> **Usage** — ${ramEmoji} \`${ramUsage.toFixed(1)}%\` \`[${ramBar}]\``
        )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(1));

    const heapBar   = getProgressBar(heapUsage);
    const heapEmoji = getStatusEmoji(heapUsage);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `**🤖 Bot Process**\n` +
            `> **Heap** — ${heapEmoji} \`${heapUsed}\` / \`${heapTotal}\` \`[${heapBar}]\`\n` +
            `> **Bot Uptime** — \`${botUptime}\`\n` +
            `> **Node.js** — \`${nodeVersion}\``
        )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(1));

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `**🌐 System**\n` +
            `> **OS** — \`${platform}\`\n` +
            `> **Arch** — \`${arch}\`\n` +
            `> **System Uptime** — \`${sysUptime}\``
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `-# 📊 Snapshot taken at <t:${Math.floor(Date.now() / 1000)}:T> · Umbra X Development`
        )
    );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

async function handleCpuCommand(message, client) {
    try {
        await message.channel.sendTyping();

        const cpuUsage = await getCpuUsage();

        const cpuInfo   = os.cpus();
        const cpuModel  = cpuInfo[0]?.model?.trim() || 'Unknown CPU';
        const cpuThreads = cpuInfo.length;

        const cpuCores  = Math.ceil(cpuThreads / 2);
        const cpuSpeed  = ((cpuInfo[0]?.speed || 0) / 1000).toFixed(2);

        const ramTotal  = os.totalmem();
        const ramFree   = os.freemem();
        const ramUsed   = ramTotal - ramFree;
        const ramUsage  = (ramUsed / ramTotal) * 100;

        const memUsage  = process.memoryUsage();
        const heapUsed  = memUsage.heapUsed;
        const heapTotal = memUsage.heapTotal;
        const heapUsage = (heapUsed / heapTotal) * 100;

        const platform    = `${os.type()} ${os.release()}`;
        const arch        = os.arch();
        const nodeVersion = process.version;
        const botUptime   = formatUptime(Math.floor(process.uptime()));
        const sysUptime   = formatUptime(os.uptime());

        const data = {
            cpuModel,
            cpuCores,
            cpuThreads,
            cpuSpeed,
            cpuUsage,
            ramUsed:   formatBytes(ramUsed),
            ramTotal:  formatBytes(ramTotal),
            ramFree:   formatBytes(ramFree),
            ramUsage,
            heapUsed:  formatBytes(heapUsed),
            heapTotal: formatBytes(heapTotal),
            heapUsage,
            platform,
            arch,
            nodeVersion,
            botUptime,
            sysUptime
        };

        const botAvatarUrl = client.user.displayAvatarURL({ size: 256 });
        await message.reply(buildCpuComponent(data, botAvatarUrl));

    } catch (error) {
        console.error('❌ l.cpu error:', error);
        try {
            await message.reply({ content: '❌ Failed to fetch system stats — try again in a moment.' });
        } catch (_) {}
    }
}

module.exports = { handleCpuCommand };