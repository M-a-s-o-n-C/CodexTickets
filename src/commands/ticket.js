import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Ticket utilities')
  .addSubcommand((sub) =>
    sub
      .setName('panel')
      .setDescription('Post an interactive ticket panel')
      .addStringOption((opt) =>
        opt
          .setName('title')
          .setDescription('Panel title override')
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName('description')
          .setDescription('Panel description override')
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('new')
      .setDescription('Open a fresh ticket channel')
      .addStringOption((opt) =>
        opt
          .setName('reason')
          .setDescription('Tell staff why you need support')
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('claim')
      .setDescription('Claim the current ticket for yourself')
  )
  .addSubcommand((sub) =>
    sub
      .setName('close')
      .setDescription('Close the current ticket')
      .addStringOption((opt) =>
        opt
          .setName('reason')
          .setDescription('Closure note for the requester')
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('reopen')
      .setDescription('Reopen a closed ticket')
  )
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Add someone to the ticket')
      .addUserOption((opt) =>
        opt
          .setName('user')
          .setDescription('Member to add')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Remove someone from the ticket')
      .addUserOption((opt) =>
        opt
          .setName('user')
          .setDescription('Member to remove')
          .setRequired(true)
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

export default { data };
