import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';

const TOPIC_PREFIX = 'ticket:';

const PALETTE = {
  blush: 0xf9d6c1,
  icing: 0xfff3ea,
  berry: 0xf39ac7,
  cocoa: 0x5a3d2b,
};

const parseTopic = (topic = '') => {
  if (!topic.startsWith(TOPIC_PREFIX)) {
    return null;
  }

  const [, raw] = topic.split(TOPIC_PREFIX);
  return raw.split(';').reduce(
    (acc, pair) => {
      const [key, value] = pair.split('=');
      return { ...acc, [key]: value ?? null };
    },
    { owner: null, status: 'open', claimed: null }
  );
};

const buildTopic = ({ owner, status = 'open', claimed = null }) =>
  `${TOPIC_PREFIX}owner=${owner};status=${status};claimed=${claimed ?? ''}`;

const isTicketChannel = (channel) => Boolean(parseTopic(channel?.topic ?? ''));

const hasStaffPermission = (member, staffRoleId) => {
  if (!member) return false;
  if (staffRoleId && member.roles.cache.has(staffRoleId)) return true;
  return member.permissions.has(PermissionFlagsBits.ManageChannels);
};

const createTicketEmbed = (user, reason) =>
  new EmbedBuilder()
    .setTitle('Fresh Ticket Order')
    .setDescription(reason || 'Take a seat in the bakery booth—one of our helpers will be right over!')
    .setColor(PALETTE.blush)
    .addFields({ name: 'Guest', value: `${user}`, inline: true })
    .setFooter({ text: 'cinnxmn ticket helper' })
    .setTimestamp();

const ticketControls = (status, claimedBy) => {
  const controls = [
    new ButtonBuilder()
      .setCustomId('ticket-claim')
      .setLabel(claimedBy ? 'Swap Baker' : 'Claim Order')
      .setEmoji('🥐')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(status === 'closed'),
    new ButtonBuilder()
      .setCustomId('ticket-close')
      .setLabel(status === 'closed' ? 'Closed' : 'Mark as Served')
      .setEmoji('🍞')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(status === 'closed'),
  ];

  return new ActionRowBuilder().addComponents(controls);
};

const ticketOpenButton = () =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket-open')
      .setLabel('Open a Cozy Ticket')
      .setEmoji('🧁')
      .setStyle(ButtonStyle.Success)
  );

const panelEmbed = (overrides = {}) =>
  new EmbedBuilder()
    .setTitle(overrides.title || 'Welcome to the Bakery Counter!')
    .setDescription(
      overrides.description ||
        'Need a sprinkle of help? Press **Open a Cozy Ticket** to start a private chat with our helpers. We will whip up an answer just for you.'
    )
    .setColor(PALETTE.icing)
    .setFooter({ text: 'cinnxmn ticket helper' });

const findExistingTicket = (guild, userId) =>
  guild.channels.cache.find((channel) => {
    if (channel.type !== ChannelType.GuildText) return false;
    const topic = parseTopic(channel.topic);
    return topic?.owner === userId && topic.status !== 'closed';
  });

const createTicketChannel = async (guild, member, options) => {
  const { reason, staffRoleId, categoryId } = options;
  const existing = findExistingTicket(guild, member.id);
  if (existing) {
    return { channel: existing, created: false };
  }

  const name = `ticket-${member.user.username.toLowerCase().replace(/[^a-z0-9]/gi, '') || member.id}`.slice(0, 96);
  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: categoryId || null,
    topic: buildTopic({ owner: member.id, status: 'open' }),
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      staffRoleId
        ? { id: staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        : null,
    ].filter(Boolean),
  });

  const message = await channel.send({
    content: `${member}`,
    embeds: [createTicketEmbed(member, reason)],
    components: [ticketControls('open')],
  });

  return { channel, message, created: true };
};

const updateTicketStatus = async (channel, status, claimedBy) => {
  const topic = parseTopic(channel.topic) ?? {};
  const payload = buildTopic({ ...topic, status, claimed: claimedBy ?? topic.claimed });
  await channel.setTopic(payload);
  const controlRow = ticketControls(status, claimedBy ?? topic.claimed);
  const latest = (await channel.messages.fetch({ limit: 1 })).first();
  if (latest && latest.components.length) {
    await latest.edit({ components: [controlRow] });
  }
};

const closeTicket = async (channel, closedBy, reason) => {
  const topic = parseTopic(channel.topic);
  if (!topic || topic.status === 'closed') return false;

  await channel.permissionOverwrites.edit(topic.owner, {
    SendMessages: false,
    ViewChannel: false,
  });

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle('Order served')
        .setDescription(reason || 'This cozy ticket has been marked as complete. Thank you for stopping by!')
        .addFields(
          { name: 'Baker on duty', value: `${closedBy}` },
          { name: 'Guest', value: `<@${topic.owner}>` }
        )
        .setColor(PALETTE.cocoa)
        .setTimestamp(),
    ],
  });

  await updateTicketStatus(channel, 'closed', topic.claimed);
  await channel.setName(`closed-${channel.name.slice(0, 80)}`);
  return true;
};

const reopenTicket = async (channel, reopenedBy) => {
  const topic = parseTopic(channel.topic);
  if (!topic || topic.status !== 'closed') return false;

  await channel.permissionOverwrites.edit(topic.owner, {
    SendMessages: true,
    ViewChannel: true,
  });

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle('Order reheated')
        .setDescription('The guest can chat again while we add a fresh glaze.')
        .addFields({ name: 'Reopened by', value: `${reopenedBy}` })
        .setColor(PALETTE.blush)
        .setTimestamp(),
    ],
  });

  const baseName = channel.name.replace(/^closed-/, '');
  await channel.setName(baseName);
  await updateTicketStatus(channel, 'open', topic.claimed);
  return true;
};

const claimTicket = async (channel, claimer) => {
  const topic = parseTopic(channel.topic);
  if (!topic || topic.status === 'closed') return false;
  if (topic.claimed === claimer.id) return true;

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle('Order claimed')
        .setDescription(`${claimer} is on oven duty for this ticket.`)
        .setColor(PALETTE.berry)
        .setTimestamp(),
    ],
  });

  await updateTicketStatus(channel, topic.status, claimer.id);
  return true;
};

const addToTicket = async (channel, user) => {
  const topic = parseTopic(channel.topic);
  if (!topic) return false;
  await channel.permissionOverwrites.edit(user.id, {
    ViewChannel: true,
    SendMessages: true,
  });
  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle('Guest invited')
        .setDescription(`${user} can now join this cozy booth.`)
        .setColor(PALETTE.icing)
        .setTimestamp(),
    ],
  });
  return true;
};

const removeFromTicket = async (channel, user) => {
  const topic = parseTopic(channel.topic);
  if (!topic) return false;
  await channel.permissionOverwrites.edit(user.id, {
    ViewChannel: false,
    SendMessages: false,
  });
  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle('Guest waved goodbye')
        .setDescription(`${user} no longer has access to this ticket.`)
        .setColor(PALETTE.cocoa)
        .setTimestamp(),
    ],
  });
  return true;
};

export {
  addToTicket,
  claimTicket,
  closeTicket,
  createTicketChannel,
  hasStaffPermission,
  isTicketChannel,
  panelEmbed,
  parseTopic,
  reopenTicket,
  removeFromTicket,
  ticketControls,
  ticketOpenButton,
};
