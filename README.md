# cinnxmn ticket helper

A modern, bakery-themed Discord ticket bot with slash commands, embeds, and button-driven workflows. It supports ticket creation from a panel or command, claiming, closing, reopening, and managing channel access—with cozy cinnamon-roll vibes baked in.

## Features
- **Slash commands** for `/ticket new`, `/ticket close`, `/ticket claim`, `/ticket reopen`, `/ticket add`, and `/ticket remove`.
- **Ticket panel** button that drops a reusable "Open Ticket" card.
- **Embeds + buttons** inside each ticket for quick claim/close actions.
- **Per-channel permissions** so only the requester and staff can see the ticket.
- **Staff gating** via role ID or `ManageChannels` permission.

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the environment template and fill in your details:
   ```bash
   cp .env.example .env
   ```
   - `DISCORD_TOKEN`: Bot token from the Discord Developer Portal.
   - `CLIENT_ID`: Application (bot) ID.
   - `GUILD_ID`: Development guild ID (use this for rapid command deployment).
   - `STAFF_ROLE_ID`: Role allowed to manage tickets (falls back to `ManageChannels`).
   - `TICKET_CATEGORY_ID`: Optional category to nest ticket channels under.
3. Deploy slash commands (run after every command schema change):
   ```bash
   npm run deploy
   ```
4. Start the bot:
   ```bash
   npm start
   ```

## Usage
- Use `/ticket panel` in your intake channel to post the embed with the **Open Ticket** button.
- Users can press **Open Ticket** or run `/ticket new` to create their private channel.
- Staff can press the in-ticket **Claim**/**Close** buttons or run `/ticket claim` and `/ticket close` for more context.
- `/ticket reopen` reactivates a closed channel, and `/ticket add`/`/ticket remove` manage extra participants.

## Notes
- The bot keeps lightweight state in the channel topic (owner, status, claimed by). That means no external database is required, but do not edit the topic manually.
- Slash commands can be deployed globally by omitting `GUILD_ID`, but global rollout can take up to an hour.
