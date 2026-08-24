require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const axios = require('axios');
const util = require('minecraft-server-util'); // để ping server Java
const fs = require('fs');
const path = require('path');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

if (!DISCORD_TOKEN) {
    throw new Error('Chưa cấu hình DISCORD_TOKEN trong file .env');
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Đọc IP server Minecraft từ file bên ngoài để dễ thay đổi.
const serverIpFile = path.join(__dirname, 'server-ip.txt');
const SERVER_IP = fs.readFileSync(serverIpFile, 'utf8')
    .split(/\r?\n/)
    .map(line => line.split('#')[0].trim())
    .find(Boolean);

if (!SERVER_IP) {
    throw new Error(`Chưa nhập IP máy chủ trong ${serverIpFile}`);
}

// Hàm cập nhật trạng thái bot
async function updatePresence() {
    try {
        const response = await axios.get(`https://api.mcsrvstat.us/3/${SERVER_IP}`);
        const data = response.data;

        let activityName = "//help";
        if (data.online && data.players && typeof data.players.online === "number") {
            activityName = `//help | Player online: ${data.players.online}`;
        } else {
            activityName = "//help | Server offline";
        }

        client.user.setPresence({
            activities: [{ name: activityName, type: 2 }], // Listening
            status: data.online ? 'online' : 'dnd'
        });
    } catch (error) {
        client.user.setPresence({
            activities: [{ name: "//help | API error", type: 2 }],
            status: 'dnd'
        });
    }
}

client.once('ready', () => {
    console.log(`Bot đã sẵn sàng với tên: ${client.user.tag}`);
    updatePresence();

    // Cập nhật lại mỗi 60 giây
    setInterval(updatePresence, 30000);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Menu help
    if (message.content === '//help') {
        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle("📖 Danh sách lệnh")
            .setDescription("Các lệnh bạn có thể dùng:")
            .addFields(
                { name: "//ip", value: "Xem IP của máy chủ Minecraft", inline: false },
                { name: "//ping", value: "Xem độ trễ (ping) của server", inline: false },
                { name: "//ver", value: "Xem phiên bản máy chủ", inline: false },
                { name: "//playeron", value: "Xem số lượng và danh sách người chơi online", inline: false },
            )
            .setFooter({ text: "Bot Minecraft by NguyenRadeon" })
            .setTimestamp();

        message.channel.send({ embeds: [embed] });
    }

    // Lệnh IP
    if (message.content === '//ip') {
        const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("🌐 IP Máy Chủ")
            .setDescription("Thông tin kết nối cho cả PC và PE:")
            .addFields(
                { name: "PC (Java Edition)", value: `\`\`\`${SERVER_IP}:25565\`\`\``, inline: false },
                { name: "PE (Bedrock Edition)", value: `\`\`\`${SERVER_IP}:19132\`\`\``, inline: false }
            )
            .setTimestamp();

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('copy_java_ip')
                .setLabel('Copy Java IP')
                .setEmoji('📋')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('copy_bedrock_ip')
                .setLabel('Copy Bedrock IP')
                .setEmoji('📋')
                .setStyle(ButtonStyle.Secondary)
        );

        message.channel.send({ embeds: [embed], components: [buttons] });
    }

    // Lệnh ver

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const ip = interaction.customId === 'copy_java_ip'
        ? `${SERVER_IP}:25565`
        : interaction.customId === 'copy_bedrock_ip'
            ? `${SERVER_IP}:19132`
            : null;

    if (!ip) return;

    await interaction.reply({
        content: `\`\`\`${ip}\`\`\``,
        ephemeral: true
    });
});
    if (message.content === '//ver') {
        try {
            const response = await axios.get(`https://api.mcsrvstat.us/3/${SERVER_IP}`);
            const data = response.data;

            if (!data.online) {
                const embed = new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle("⚠️ Server Offline")
                    .setDescription("Máy chủ hiện đang offline hoặc không thể kết nối.")
                    .setTimestamp();

                message.channel.send({ embeds: [embed] });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0xf1c40f)
                .setTitle("🛠 Phiên bản máy chủ")
                .setDescription(`Máy chủ đang chạy phiên bản: **${data.version}**`)
                .setTimestamp();

            message.channel.send({ embeds: [embed] });
        } catch (error) {
            const embed = new EmbedBuilder()
                .setColor(0xe67e22)
                .setTitle("❗ Lỗi API")
                .setDescription("Không thể lấy thông tin từ API mcsrvstat.us.")
                .setTimestamp();

            message.channel.send({ embeds: [embed] });
        }
    }

    // Lệnh playeron
    if (message.content === '//playeron') {
    try {
        const response = await axios.get(`https://api.mcsrvstat.us/3/${SERVER_IP}`);
        const data = response.data;

        if (!data.online) {
            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle("⚠️ Server Offline")
                .setDescription("Máy chủ hiện đang offline hoặc không thể kết nối.")
                .setTimestamp();

            message.channel.send({ embeds: [embed] });
            return;
        }

        let description = `Có **${data.players.online}** người chơi online.`;
        if (data.players.list && data.players.list.length > 0) {
            // Nếu phần tử là object thì lấy thuộc tính name, nếu là string thì giữ nguyên
            description += `\n\n${data.players.list.map(player => 
                typeof player === 'string' ? `👤 ${player}` : `👤 ${player.name}`
            ).join('\n')}`;
        }

        const embed = new EmbedBuilder()
            .setColor(0x1abc9c)
            .setTitle("🎮 Người chơi Online")
            .setDescription(description)
            .setTimestamp();

        message.channel.send({ embeds: [embed] });
    } catch (error) {
        const embed = new EmbedBuilder()
            .setColor(0xe67e22)
            .setTitle("❗ Lỗi API")
            .setDescription("Không thể lấy thông tin từ API mcsrvstat.us.")
            .setTimestamp();

        message.channel.send({ embeds: [embed] });
    }
    }

    // Lệnh ping
    if (message.content === '//ping') {
        try {
            const result = await util.status(SERVER_IP, 25565); // ping trực tiếp Java server
            const ping = result.roundTripLatency;

            const embed = new EmbedBuilder()
                .setColor(0x9b59b6)
                .setTitle("📡 Ping Server")
                .setDescription(`Độ trễ hiện tại: **${ping} ms**`)
                .setTimestamp();

            message.channel.send({ embeds: [embed] });
        } catch (error) {
            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle("⚠️ Server Offline")
                .setDescription("Không thể kết nối tới server Minecraft.")
                .setTimestamp();

            message.channel.send({ embeds: [embed] });
        }
    }
});

client.login(DISCORD_TOKEN);