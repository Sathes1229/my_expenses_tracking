# My Expenses

The household expense tracker. It runs on this PC, and everyone in the family opens it in a
browser on their phone or laptop over the home Wi-Fi.

Everything below happens in PowerShell, opened in the project folder (the folder that holds this
file). To open it there: in File Explorer, open the folder, click the address bar, type
`powershell` and press Enter.

## First-time setup on a new PC

Do this once, on a PC that has never run the app.

1. Install Node.js: download the LTS version from https://nodejs.org and run the installer with
   its default choices. Then close PowerShell and open it again in the project folder.
2. Install what the app needs:

   ```powershell
   npm install
   ```

3. Make your own settings file from the example:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Open `.env` in Notepad and fill in two lines:
   - `APP_URL=`: the address everyone will open, for example `http://192.168.1.10:3100`.
     [Open it on phones and other devices](#open-it-on-phones-and-other-devices) shows how to
     find this PC's address.
   - `BETTER_AUTH_SECRET=`: a long random value that keeps sign-ins safe. This command makes one.
     Paste what it prints right after the `=`:

     ```powershell
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```

   Save the file.
5. Build the app, then start it:

   ```powershell
   npm run build
   npm start
   ```

6. Open the `APP_URL` address in a browser on this PC. The first visit asks you to create the
   owner account, which is yours.

So that phones can reach the app too, also do [Let other devices in](#let-other-devices-in-once)
once.

## Start and stop it

To start the app:

```powershell
npm start
```

Wait for the line that says `Ready`. The app runs as long as this window stays open, so leave it
open (minimized is fine).

To stop it, click the window and press `Ctrl+C`. If it asks `Terminate batch job (Y/N)?`, type `Y`
and press Enter. Closing the window also stops it.

After the app's code has been updated, build it once before you start it again:

```powershell
npm install
npm run build
npm start
```

## Open it on phones and other devices

On this PC, the app is at http://localhost:3100. Everyone else opens:

```
http://<this PC's IP address>:3100
```

for example `http://192.168.1.10:3100`.

To find this PC's IP address, run `ipconfig` in PowerShell. Under **Wireless LAN adapter Wi-Fi**
(or **Ethernet adapter Ethernet** if the PC is plugged in with a cable), the number after
**IPv4 Address** is the one you need.

The `APP_URL` line in the `.env` file must be that same address, for example:

```
APP_URL=http://192.168.1.10:3100
```

Invite links and sign-in use this address. Your router can give the PC a new IP address now and
then (after a restart, for example). When that happens, put the new address in `APP_URL`, save
`.env`, and restart the app. To stop it changing, reserve a fixed address for this PC in your
router's DHCP settings.

### Let other devices in (once)

Windows Firewall can stop other devices from reaching port 3100. Allow it once:

1. Open the Start menu, type `PowerShell`, right-click **Windows PowerShell** and choose
   **Run as administrator**.
2. Paste this command and press Enter:

   ```powershell
   New-NetFirewallRule -DisplayName "My Expenses (port 3100)" -Direction Inbound -Protocol TCP -LocalPort 3100 -Action Allow -Profile Private
   ```

The rule only works on a network Windows treats as private. Check that your home Wi-Fi is set to
Private: **Settings > Network & internet > Wi-Fi**, choose your network, and under
**Network profile type** pick **Private network**.

## Turn on the AI features

Receipt reading and the assistant need a key from an AI provider. Keys go in the `.env` file:

1. Open `.env` in Notepad.
2. Put your key after one of these, with no spaces:
   - `ANTHROPIC_API_KEY=` or `OPENAI_API_KEY=`: reads receipt photos and runs the assistant.
   - `DEEPSEEK_API_KEY=`: runs the assistant only. It cannot read receipt photos.

   One key is enough.
3. Save the file and restart the app.
4. Sign in as the owner, open **Settings > AI** and choose the models.

Keep `.env` private. Never send it to anyone or upload it anywhere: it holds your keys.

## Forgot the owner password

Family members who forget their password ask the owner, who resets it in **Settings**. If the
owner forgets theirs:

1. Open `.env` in Notepad and put a token of your choice after `OWNER_RESET_TOKEN=`. Make it long
   and hard to guess, like a password you will only use once.
2. Save the file and restart the app.
3. Open the sign-in page and choose **Reset the owner password**.
4. Enter the token and your new password twice.
5. Sign in with the new password. Any device where the owner was signed in is signed out.
6. Clear the token again (leave `OWNER_RESET_TOKEN=` empty), save, and restart the app.

Each token works once. To reset again later, choose a new one. After 5 wrong tokens in 15
minutes, the page asks you to wait before trying again.

## Back up your data

All the expenses, accounts and receipt photos are in the `data` folder in the project folder.

1. Stop the app (`Ctrl+C`). A copy made while it runs can miss recent changes or be damaged.
2. Copy the whole `data` folder to a USB drive or a cloud folder. Add the date to the copy's name,
   for example `data 2026-11-13`.
3. Start the app again.

To restore a backup: stop the app, replace the `data` folder with your copy (rename it back to
`data`), and start the app.

## Moving to a server

The app also runs in Docker on a Linux server with its own domain. The steps, including how to
move this PC's data there, are in [docs/deploy.md](docs/deploy.md).
