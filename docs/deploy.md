# Running My Expenses on a server

This moves the app from the home PC to a Linux server with its own domain and HTTPS. The app runs
in Docker; its database and receipt photos live in a Docker volume called `my-expenses_data`.

You need:

- A Linux server (x86-64 or ARM64) with Docker Engine and the Docker Compose plugin.
- A domain or subdomain pointing at the server's IP address, for example `expenses.example.com`.
  Set this up first: Caddy needs it to get a certificate.
- Ports 80 and 443 open to the internet. Port 3100, where the app itself listens, stays closed:
  visitors reach the app only through Caddy.

The commands below run on the server unless a step says otherwise. Follow the steps in order.
Until an owner account exists, whoever opens the app first can create it, so the app must not be
reachable before Caddy is in front of it.

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
- Leave `TRUST_PROXY` for step 2.
- The keys and `BETTER_AUTH_SECRET` can stay as they are.
- `DATABASE_PATH` and `UPLOADS_DIR` do not matter here: `compose.yaml` points them at the volume.

## 2. Put Caddy in front, before the app first starts

Caddy handles HTTPS and gets and renews the certificate on its own. Use it when nothing else on
the server handles HTTPS. If something already does, point it at `127.0.0.1:3100`, create
`compose.override.yaml` as in item 1 below, and skip items 2 to 4: leave `TRUST_PROXY` empty,
because the notes on it are about Caddy.

1. Keep port 3100 off the internet. Create `compose.override.yaml` next to `compose.yaml` (Docker
   Compose reads it on its own):

   ```yaml
   services:
     app:
       ports: !override
         - "127.0.0.1:3100:3100"
   ```

   A firewall such as `ufw` does not block ports that Docker publishes, so this line is what
   closes port 3100 to the outside.
2. Set `TRUST_PROXY=1` in `.env`. The section "Why TRUST_PROXY" below says why it belongs with
   Caddy.
3. Install Caddy from its official packages: https://caddyserver.com/docs/install
4. Put this in `/etc/caddy/Caddyfile`, with your domain:

   ```
   expenses.example.com {
   	reverse_proxy 127.0.0.1:3100
   }
   ```

   Then run `sudo systemctl reload caddy`. Until the app starts in step 5, the address answers
   with an error page (502). That is expected.

## 3. Build the app

```sh
docker compose build
```

The first build takes a few minutes.

## 4. Move the data from the PC

Skip this step for a fresh start. To bring the PC's data, do it now, before the app first starts.

1. On the PC, stop the app (`Ctrl+C`), then copy the whole `data` folder to the server, next to
   `compose.yaml`:

   ```sh
   scp -r data you@your-server:~/my-expenses/
   ```

2. On the server, copy it into the volume and give it to the app's user:

   ```sh
   docker compose run --rm --user root --entrypoint sh -v "$PWD/data:/from:ro" app \
     -c 'rm -rf /data/* && cp -a /from/. /data/ && chown -R node:node /data'
   ```

   This creates the volume if it does not exist yet. The command empties the volume before
   copying, so if you ever repeat it on a server where the app has already run, no file from the
   old database is left beside the copied one. In that case run `docker compose stop` before it
   and `docker compose up -d` after it.

## 5. Start it

```sh
docker compose up -d
```

The app updates its database by itself each time it starts. To watch its log, run
`docker compose logs -f app` (press `Ctrl+C` to leave the log; the app keeps running).

Open the `https` address from `APP_URL`, for example `https://expenses.example.com`. Always use
that address: sign-in is set up for it.

- Fresh start: the page that creates the owner account appears. Create the owner account straight
  away, before you share the address with anyone.
- Moved data: sign in with your usual account. Invite links made on the PC point at the PC's
  address, so make new ones. Then delete the copied folder from the server (`rm -rf data`). It
  holds the whole database and is not needed any more.

Day to day:

- After changing `.env`, run `docker compose up -d`. A plain `docker compose restart` keeps the
  old settings.
- To update the app: `git pull`, then `docker compose up -d --build`.
- To stop it: `docker compose down`. The data stays in the volume. Never add `-v` to that
  command: it deletes the volume, and every expense with it.

## 6. Back up the volume

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

## Notes on Caddy

### Why TRUST_PROXY, and only behind Caddy

The app limits failed sign-ins per visitor address. Behind Caddy, every request reaches the app
from Caddy, so the app reads the visitor's address from the `X-Forwarded-For` header instead.
Caddy writes that header itself and ignores any value the visitor sent.

Keep `TRUST_PROXY=1` only while both are true: Caddy is in front, and port 3100 is closed as in
step 2. Without Caddy, any visitor could write their own `X-Forwarded-For` and get around the
limit. The other way round, behind Caddy with `TRUST_PROXY` empty, every visitor counts as one
address, and 20 failed sign-ins from anyone would block sign-in for everyone for up to 15
minutes.

### Receipt uploads

The app takes receipt photos of up to 15 MB. Browsers send the size of an upload in a
`Content-Length` header, and Caddy passes it on unchanged by default, so a photo that is too big is
refused (`413 Content Too Large`) before it is read. A proxy that resends uploads in chunks without
a length works too: the app counts the upload as it arrives and refuses it with the same `413` once
it passes the limit.

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
