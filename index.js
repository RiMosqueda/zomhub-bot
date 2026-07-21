require('dotenv').config();
const {
    Client,
    GatewayIntentBits,
    Partials,
    REST,
    Routes,
    SlashCommandBuilder,
} = require('discord.js');
const reactionRoles = require('./reactionRoles');

// 1. Creamos el cliente del bot.
//    "Intents" le dicen a Discord qué tipo de eventos queremos recibir.
//    Agregamos GuildMessageReactions para poder escuchar reacciones,
//    y GuildMembers para poder asignar/quitar roles.
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
    ],
    // "Partials" le dice a discord.js que nos avise de reacciones aunque
    // el mensaje no esté en su caché (por ejemplo, mensajes viejos).
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// 2. Definimos nuestros comandos slash (los que se escriben con "/").
const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Responde pong y muestra la latencia del bot'),
].map((command) => command.toJSON());

// 3. Registramos los comandos en Discord cuando el bot se prende.
client.once('ready', async () => {
    console.log(`Bot conectado como ${client.user.tag}`);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        // Registramos los comandos SOLO en tu servidor (guild).
        // Esto hace que aparezcan al instante (los comandos globales tardan hasta 1h).
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('Comandos slash registrados correctamente.');
    } catch (error) {
        console.error('Error registrando comandos:', error);
    }
});

// 4. Escuchamos cuando alguien usa un comando slash.
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ping') {
        const latencia = Math.round(client.ws.ping);
        await interaction.reply(`🏓 Pong! Latencia: ${latencia}ms`);
    }
});

// 5. Sistema de auto-roles por reacción.
//    Cuando alguien reacciona al mensaje configurado, le damos el rol.
//    Cuando quita la reacción, se lo quitamos.

client.on('messageReactionAdd', async (reaction, user) => {
    await handleReactionRole(reaction, user, 'add');
});

client.on('messageReactionRemove', async (reaction, user) => {
    await handleReactionRole(reaction, user, 'remove');
});

async function handleReactionRole(reaction, user, action) {
    // Ignoramos reacciones de bots (incluido el nuestro).
    if (user.bot) return;

    // Si la reacción llegó "parcial" (mensaje no cacheado), la completamos.
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('No se pudo completar la reacción:', error);
            return;
        }
    }

    // Solo nos importa el mensaje y canal configurados en reactionRoles.js
    if (reaction.message.id !== reactionRoles.messageId) return;
    if (reaction.message.channelId !== reactionRoles.channelId) return;

    // Buscamos si el emoji usado coincide con alguno configurado.
    const emojiUsado = reaction.emoji.name;
    const configRol = reactionRoles.roles.find((r) => r.emoji === emojiUsado);
    if (!configRol) return;

    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);

    try {
        if (action === 'add') {
            await member.roles.add(configRol.roleId);
            console.log(`Rol ${configRol.roleId} asignado a ${user.tag}`);
        } else {
            await member.roles.remove(configRol.roleId);
            console.log(`Rol ${configRol.roleId} quitado a ${user.tag}`);
        }
    } catch (error) {
        console.error('Error al modificar el rol (revisa permisos y jerarquía):', error);
    }
}

// 6. Conectamos el bot con el token de Discord.
client.login(process.env.DISCORD_TOKEN);