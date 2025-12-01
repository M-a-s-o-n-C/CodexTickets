import 'dotenv/config';
import { Client, Collection, Events, GatewayIntentBits, Partials } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import {
  addToTicket,
  claimTicket,
  closeTicket,
  createTicketChannel,
  hasStaffPermission,
  isTicketChannel,
  panelEmbed,
  reopenTicket,
  removeFromTicket,
  ticketOpenButton,
} from './lib/ticketManager.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel],
});

client.commands = new Collection();
const commandsPath = path.join(process.cwd(), 'src/commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
for (const file of commandFiles) {
  const { default: command } = await import(path.join(commandsPath, file));
  if ('data' in command) {
    client.commands.set(command.data.name, command);
  }
}

client.once(Events.ClientReady, (c) => {
  console.log(`cinnxmn ticket helper ready as ${c.user.tag}`);
});

const getStaffRoleId = () => process.env.STAFF_ROLE_ID || null;
const getCategoryId = () => process.env.TICKET_CATEGORY_ID || null;

const ensureTicketContext = (interaction) => {
  const { channel } = interaction;
  if (!channel || !isTicketChannel(channel)) {
    return interaction.reply({
      content: 'This command only works in a cozy ticket channel. 🧁',
      ephemeral: true,
    });
  }
  return null;
};

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (!client.commands.has(interaction.commandName)) return;
    const sub = interaction.options.getSubcommand();
    const staffRoleId = getStaffRoleId();

    if (sub === 'panel') {
      if (!hasStaffPermission(interaction.member, staffRoleId)) {
        return interaction.reply({
          content: 'Only bakers with Manage Channels (or the staff role) can post the ticket counter. 🍰',
          ephemeral: true,
        });
      }

      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      await interaction.reply({
        embeds: [panelEmbed({ title, description })],
        components: [ticketOpenButton()],
      });
      return;
    }

    if (sub === 'new') {
      const reason = interaction.options.getString('reason');
      await interaction.deferReply({ ephemeral: true });
      const { channel, created } = await createTicketChannel(interaction.guild, interaction.member, {
        reason,
        staffRoleId,
        categoryId: getCategoryId(),
      });
      const action = created ? 'Baked' : 'Found';
      await interaction.editReply({ content: `${action} your cozy ticket: ${channel}` });
      return;
    }

    if (sub === 'claim') {
      const pending = ensureTicketContext(interaction);
      if (pending) return pending;
      if (!hasStaffPermission(interaction.member, staffRoleId)) {
        return interaction.reply({
          content: 'Only bakers with Manage Channels (or the staff role) can claim tickets.',
          ephemeral: true,
        });
      }
      await claimTicket(interaction.channel, interaction.member);
      return interaction.reply({ content: 'Order claimed—time to preheat the oven! 🧡', ephemeral: true });
    }

    if (sub === 'close') {
      const pending = ensureTicketContext(interaction);
      if (pending) return pending;
      if (!hasStaffPermission(interaction.member, staffRoleId)) {
        return interaction.reply({
          content: 'Only bakers with Manage Channels (or the staff role) can close tickets.',
          ephemeral: true,
        });
      }
      const reason = interaction.options.getString('reason');
      await closeTicket(interaction.channel, interaction.member, reason);
      return interaction.reply({ content: 'Ticket marked as served. 🧁', ephemeral: true });
    }

    if (sub === 'reopen') {
      const pending = ensureTicketContext(interaction);
      if (pending) return pending;
      if (!hasStaffPermission(interaction.member, staffRoleId)) {
        return interaction.reply({
          content: 'Only bakers with Manage Channels (or the staff role) can reopen tickets.',
          ephemeral: true,
        });
      }
      const reopened = await reopenTicket(interaction.channel, interaction.member);
      if (!reopened) {
        return interaction.reply({ content: 'This ticket is already piping hot—no need to reheat!', ephemeral: true });
      }
      return interaction.reply({ content: 'Ticket reheated and ready to chat. ☕', ephemeral: true });
    }

    if (sub === 'add') {
      const pending = ensureTicketContext(interaction);
      if (pending) return pending;
      if (!hasStaffPermission(interaction.member, staffRoleId)) {
        return interaction.reply({
          content: 'Only bakers with Manage Channels (or the staff role) can add guests.',
          ephemeral: true,
        });
      }
      const user = interaction.options.getUser('user');
      await addToTicket(interaction.channel, user);
      return interaction.reply({ content: `Invited ${user} to this cozy booth.`, ephemeral: true });
    }

    if (sub === 'remove') {
      const pending = ensureTicketContext(interaction);
      if (pending) return pending;
      if (!hasStaffPermission(interaction.member, staffRoleId)) {
        return interaction.reply({
          content: 'Only bakers with Manage Channels (or the staff role) can remove guests.',
          ephemeral: true,
        });
      }
      const user = interaction.options.getUser('user');
      await removeFromTicket(interaction.channel, user);
      return interaction.reply({ content: `Waved goodbye to ${user} from this ticket.`, ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    const staffRoleId = getStaffRoleId();

    if (interaction.customId === 'ticket-open') {
      await interaction.deferReply({ ephemeral: true });
      const { channel, created } = await createTicketChannel(interaction.guild, interaction.member, {
        staffRoleId,
        categoryId: getCategoryId(),
      });
      const action = created ? 'Baked' : 'Found';
      return interaction.editReply({ content: `${action} your cozy ticket: ${channel}` });
    }

    if (interaction.customId === 'ticket-claim') {
      if (!hasStaffPermission(interaction.member, staffRoleId)) {
        return interaction.reply({
          content: 'Only bakers with Manage Channels (or the staff role) can claim tickets.',
          ephemeral: true,
        });
      }
      if (!isTicketChannel(interaction.channel)) {
        return interaction.reply({ content: 'Claim can only be used inside a cozy ticket channel.', ephemeral: true });
      }
      await claimTicket(interaction.channel, interaction.member);
      return interaction.reply({ content: 'Order claimed—time to preheat the oven! 🧡', ephemeral: true });
    }

    if (interaction.customId === 'ticket-close') {
      if (!hasStaffPermission(interaction.member, staffRoleId)) {
        return interaction.reply({
          content: 'Only bakers with Manage Channels (or the staff role) can close tickets.',
          ephemeral: true,
        });
      }
      if (!isTicketChannel(interaction.channel)) {
        return interaction.reply({ content: 'Close can only be used inside a cozy ticket channel.', ephemeral: true });
      }
      await closeTicket(interaction.channel, interaction.member);
      return interaction.reply({ content: 'Ticket marked as served. 🧁', ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
