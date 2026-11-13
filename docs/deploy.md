# Running My Expenses on a server

This moves the app from the home PC to a Linux server with its own domain and HTTPS. The app runs
in Docker; its database and receipt photos live in a Docker volume called `my-expenses_data`.

You need:

- A Linux server (x86-64 or ARM64) with Docker Engine and the Docker Compose plugin.
- A domain or subdomain pointing at the server's IP address, for example `expenses.example.com`.

The commands below run on the server unless a step says otherwise.

## 1. Copy the app and its settings

```sh
git clone https://github.com/Sathes1229/my_expenses_tracking.git my-expenses
cd my-expenses
```

Copy `.env` from the PC into this folder. From the project folder on the PC, for example:

```sh
scp .env you@your-server:~/my-expenses/.env
```

Then, on the server, make it readable only by you and edit it:

```sh
chmod 600 .env
nano .env
```

- Set `APP_URL` to the domain, with `https` and no port: `APP_URL=https://expenses.example.com`.
- Leave `TRUST_PROXY` empty for now. Section 5 says when to set it.
- The keys and `BETTER_AUTH_SECRET` can stay as they are.
- `DATABASE_PATH` and `UPLOADS_DIR` do not matter here: `compose.yaml` points them at the volume.

## 2. Start it

```sh
docker compose up -d --build
```

The first build takes a few minutes. The app answers on port 3100 and updates its database by
itself each time it starts. To watch its log, run `docker compose logs -f app` (press `Ctrl+C` to
leave the log; the app keeps running).

Open the address. If you did not move the PC's data (section 3), it shows the page that creates
the owner account.

Day to day:

- After changing `.env`, run `docker compose up -d`. A plain `docker compose restart` keeps the
  old settings.
- To update the app: `git pull`, then `docker compose up -d --build`.
- To stop it: `docker compose down`. The data stays in the volume. Never add `-v` to that
  command: it deletes the volume, and every expense with it.

## 3. Move the data from the PC

Do this before anyone starts using the server. It replaces everything in the volume.

1. On the PC, stop the app (`Ctrl+C`), then copy the whole `data` folder to the server, next to
   `compose.yaml`:

   ```sh
   scp -r data you@your-server:~/my-expenses/
   ```

2. On the server, empty the volume, copy the data in, and give it to the app's user:

   ```sh
   docker compose stop
   docker compose run --rm --user root --entrypoint sh -v "$PWD/data:/from:ro" app \
     -c 'rm -rf /data/* && cp -a /from/. /data/ && chown -R node:node /data'
   docker compose start
   ```

   The volume is emptied first so that no file from the new, empty database is left beside the
   copied one.

3. Sign in with your usual account. Invite links made on the PC point at the PC's address, so
   make new ones.
4. Delete the copied folder from the server (`rm -rf data`). It holds the whole database and is
   not needed any more.

## 4. Back up the volume

Stop the app, pack the volume into a dated file in `backups/`, and start the app again:

```sh
docker compose stop
docker compose run --rm --user root --entrypoint sh -v "$PWD/backups:/backups" app \
  -c 'tar czf /backups/my-expenses-$(date +%F).tar.gz -C /data .'
docker compose start
```

Copy the files in `backups/` off the server, for example to the home PC.

To restore one, replace the date with the backup's:

```sh
docker compose stop
docker compose run --rm --user root --entrypoint sh -v "$PWD/backups:/backups:ro" app \
  -c 'rm -rf /data/* && tar xzf /backups/my-expenses-2026-11-13.tar.gz -C /data && chown -R node:node /data'
docker compose start
```

## 5. HTTPS with Caddy

Use this when nothing else on the server handles HTTPS. Caddy gets and renews the certificate on
its own; ports 80 and 443 must be open to the internet.

1. Install Caddy from its official packages: https://caddyserver.com/docs/install
2. Put this in `/etc/caddy/Caddyfile`, with your domain:

   ```
   expenses.example.com {
   	reverse_proxy 127.0.0.1:3100
   }
   ```

   Then run `sudo systemctl reload caddy`.
3. Make Caddy the only way in. Create `compose.override.yaml` next to `compose.yaml` (Docker
   Compose reads it on its own):

   ```yaml
   services:
     app:
       ports: !override
         - "127.0.0.1:3100:3100"
   ```

   A firewall such as `ufw` does not block ports that Docker publishes, so this line is what
   closes port 3100 to the outside.
4. Set `TRUST_PROXY=1` in `.env`, then run `docker compose up -d`.

### Why TRUST_PROXY, and only behind Caddy

The app limits failed sign-ins per visitor address. Behind Caddy, every request reaches the app
from Caddy, so the app reads the visitor's address from the `X-Forwarded-For` header instead.
Caddy writes that header itself and ignores any value the visitor sent.

Set `TRUST_PROXY=1` only when both are true: Caddy is in front, and port 3100 is closed as in
step 3. Without Caddy, any visitor could write their own `X-Forwarded-For` and get around the
limit. The other way round, behind Caddy with `TRUST_PROXY` empty, every visitor counts as one
address, and 20 failed sign-ins from anyone would block sign-in for everyone for up to 15
minutes.

### Receipt uploads

The app refuses a receipt upload that has no `Content-Length` header (it answers
`411 Length Required`), because it checks the size before reading the photo. Browsers always send
it, and Caddy passes it on unchanged by default. If you use a different proxy, check that it does
not resend uploads in chunks without a length.

### Access logs

Caddy writes no access log unless you add a `log` line. Invite addresses carry their secret in
the path (`/invite/...`), so if you turn the log on, leave those addresses out:

```
expenses.example.com {
	log
	@invite path /invite/*
	log_skip @invite
	reverse_proxy 127.0.0.1:3100
}
```

Older Caddy versions call `log_skip` `skip_log`.

## When someone keeps the owner locked out

Five wrong passwords for one username within 15 minutes lock that username, from every address,
until the earliest of the last five failures is 15 minutes old. That stops password guessing. It also
means anyone who knows the owner's username can keep it locked by failing on purpose every few
minutes. At home only devices on the Wi-Fi can try; on the internet anyone can.

While the username is locked:

- New sign-ins are refused, even with the right password. Devices already signed in stay signed
  in, so keep one phone or computer signed in as the owner.
- The owner reset page does not help: it changes the password, but signing in is still locked.
  It also has its own limit of 5 wrong tokens in 15 minutes.

What you can do:

- Wait. The lock lifts at most 15 minutes after the failures stop.
- Clear it straight away from the server, replacing `yourusername` with the locked username (use
  `owner-reset` to clear the reset page's limit):

  ```sh
  docker compose exec app node -e "require('better-sqlite3')('/data/app.db').prepare(\"delete from login_attempts where key = 'user:' || lower(?)\").run(process.argv[1])" yourusername
  ```

  Whoever caused it can lock it again, so this is short relief.
- If it keeps happening, keep strangers away from the sign-in page altogether with a shared
  password in Caddy. The browser asks for it before the app opens:

  ```
  expenses.example.com {
  	basic_auth {
  		family <hash>
  	}
  	reverse_proxy 127.0.0.1:3100
  }
  ```

  Replace `<hash>` with the output of `caddy hash-password`, and give the family the password you
  typed there.
