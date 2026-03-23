# Aarokya — Launch Locally

## What's Built & Running

| Component | Status | URL |
|-----------|--------|-----|
| **Backend** (Rust) | ✅ Built | Needs PostgreSQL + Redis to run |
| **Control Center** (Next.js) | ✅ Built & Running | http://localhost:3000 |
| **Customer App** (React Native) | ✅ Dependencies installed | Metro + emulator |
| **Partner App** (React Native) | ✅ Dependencies installed | Metro + emulator |
| **Shared Package** | ✅ Ready | Used by apps |

---

## Prerequisites

- **Docker** (recommended) — for PostgreSQL 16 + Redis 7
- **Rust** — `rustup` (backend)
- **Node.js 20+** — for all frontend apps
- **React Native** — Android Studio / Xcode for mobile apps

---

## Quick Start (Full Stack)

### 1. Start Infrastructure (PostgreSQL + Redis)

```bash
cd backend
docker compose up -d
```

If Docker isn't installed:
- Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) for Mac
- Or use Homebrew: `brew install postgresql@16 redis` and start services

### 2. Start Backend

```bash
cd backend
cp .env.example .env   # if not already done
cargo run
```

Backend runs at **http://localhost:8080**. Verify: `curl http://localhost:8080/health`

### 3. Start Control Center

```bash
cd apps/control-center
npm run dev
```

Open **http://localhost:3000** — login page, dashboard, users, finances, insurance, analytics, settings.

### 4. Start React Native Apps (Optional)

**Customer app (gig workers):**
```bash
cd apps/customer
npx react-native start --port 8082    # Metro bundler (keep running)
# In another terminal:
REACT_NATIVE_PACKAGER_PORT=8082 npx react-native run-android
```

**Partner app (employers):**
```bash
cd apps/partner
npx react-native start --port 8083
REACT_NATIVE_PACKAGER_PORT=8083 npx react-native run-android
```

For local backend from Android emulator, use `http://10.0.2.2:8080/api/v1` instead of localhost.

#### Run via Android Studio

1. **Open project** — File → Open → select `apps/customer/android` (the `android` folder)
2. **Wait for Gradle sync** — Let Android Studio finish indexing
3. **Start emulator** — Tools → Device Manager → Create/start a virtual device (e.g. Pixel 6, API 34)
4. **Run** — Click the green Run (▶) button or Run → Run 'app'

Ensure Metro is running (`npx react-native start --port 8082`) in a terminal before launching the app.

**If Android Studio reports "Cannot run program 'node'"** — Gradle can't find Node because the IDE doesn't inherit your shell's PATH. Fix with either:
- **Option A:** Launch Android Studio from terminal so it inherits PATH: `open -a /Applications/Android\ Studio.app`
- **Option B:** Symlink Node to a system path: `sudo ln -sf "$(which node)" /usr/local/bin/node`

---

## One-Command Launch

```bash
./scripts/launch-local.sh
```

Starts Docker (if available), backend, and Control Center. React Native apps need separate terminals.

---

## Dev OTP (All Apps)

For local testing **without SMS**, use the whitelisted number in Control Center, Customer app, and Partner app:

- **Phone:** `9876543210` (or `+919876543210`)
- **OTP:** `123456`

The backend returns `otp_hint` in the send-otp response, so the Control Center toast shows the OTP. For the whitelisted number, OTP is always `123456` and rate limiting is disabled.

**Requirements:** Backend must be running (`cargo run` in `backend/`). The Customer app uses `http://10.0.2.2:8080/api/v1` in dev when running on Android emulator.

To use a different whitelist number, set `DEV_OTP_PHONE=+91XXXXXXXXXX` in `backend/.env`. Set `DEV_OTP_PHONE=` (empty) to disable.

---

## Environment Variables

| App | Variable | Default |
|-----|----------|---------|
| Backend | `DATABASE_URL` | `postgres://aarokya:aarokya_dev@localhost:5432/aarokya` |
| Backend | `JWT_SECRET` | `change-this-in-production` |
| Backend | `DEV_OTP_PHONE` | `+919876543210` (fixed OTP 123456 for dev) |
| Control Center | `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8080/api/v1` |
| Customer | `API_BASE_URL` | Set for local: `http://10.0.2.2:8080/api/v1` (Android) |

---

## Troubleshooting

- **Backend fails to start** — Ensure PostgreSQL is running on port 5432. Run `docker compose up -d` in `backend/`.
- **Control Center 404** — Wait for Next.js to finish compiling. Refresh the page.
- **EMFILE / too many open files** — Increase limit: `ulimit -n 10240` (macOS).
- **React Native Metro** — Run `npx react-native start` before `run-android`/`run-ios`.
- **`adb: command not found` / `No emulators found`** — Add Android SDK to PATH. Add to `~/.zshrc`:
  ```bash
  export ANDROID_HOME=$HOME/Library/Android/sdk
  export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
  ```
  Then `source ~/.zshrc` or open a new terminal. Start an emulator: `emulator -avd Pixel_7a` (or create one in Android Studio → Device Manager).
