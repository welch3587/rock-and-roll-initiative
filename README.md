# Rock & Roll Initiative 🎲🎸

A fun rock & roll themed D&D / DCC initiative tracker with critical hit events, haptics, tabbed navigation (Home, Help, Band Setup, Initiative Tracker), and dual web + native support. 

**This project is an experiment exploring Grok Build workflows integrated with GitHub MCP.**

## Features
- **Landing page** with dungeon-door theme and welcome message
- **Band Setup tab**: Add/edit/remove players, "New Gig" (clear for new group), persistent session notes
- **Initiative Tracker tab**: Inline rolls next to each member, auto-sort, current turn highlight (gold), Next Turn, Roll All, Jam Break, crit/fumble pop-ups (natural 20/1 trigger fun events like "Take a shot!")
- **Help tab**: Quick instructions
- Auto-save (AsyncStorage), haptics on actions, dark tavern/rock theme
- Works as **PWA (web)** or **standalone mobile app**

Live web version and APK builds coming soon via the instructions below.

## Quick Start (Local)
```bash
npm install
npx expo start --clear
```
- Press `w` for web browser version (PWA-ready)
- Press `a` for Android (or scan QR with Expo Go)

## Deployment Options

### 1. Hosted Web / PWA (Recommended for instant sharing)
The app runs great in the browser and can be installed to the home screen like a native app.

**One-click hosting with Vercel (free, works with private or public repos):**
1. Push this code to your GitHub repo.
2. Go to [vercel.com/new](https://vercel.com/new), import the repo.
3. Select **"Other"** as the framework preset.
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Deploy.

The site will be a full PWA with offline support.

**Firebase Setup (for the Campaign / Multiplayer tab):**

**For Vercel (recommended for the deployed web version):**
1. In your Vercel dashboard for this project, go to **Settings → Environment Variables**.
2. Add the following 6 variables (use the values from your Firebase console):
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`
3. Redeploy. The app will use these at runtime.

**For local development:**
1. Copy `firebaseConfig.template.js` to `firebaseConfig.js` (gitignored) and paste your real config from the Firebase console.
2. The Campaign tab will then enable real-time sync across devices.

See Issue #2 for the full feature.

### 2. Standalone Mobile App (Native APK/IPA – no Expo Go needed)
```bash
# Install EAS CLI (once)
npm install -g eas-cli
eas login

# Build for Android (primary target)
eas build --platform android --profile preview   # Preview build (faster)
# or for production
eas build --platform android
```

- The resulting `.apk` can be shared directly or uploaded to Google Play.
- For iOS, use `--platform ios` (requires Apple Developer account).

See full docs: [Expo EAS Build](https://docs.expo.dev/build/introduction/)

## Tech Stack
- Expo SDK 54 (React Native 0.81 + react-native-web for dual targeting)
- `expo-haptics`, `@react-native-async-storage/async-storage`
- Tabbed UI with persistent state and local storage
- Ready for sounds (`expo-av`), images, or further expansion

## Development
- `npx expo start --web` for browser testing
- All changes in `App.js` affect both web and native
- GitHub repo: [welch3587/rock-and-roll-initiative](https://github.com/welch3587/rock-and-roll-initiative)

Pull the latest, run it in your next session, and let me know what to add next (sounds, player editing, campaign mode, better PWA manifest, etc.).

**Enjoy the sessions!** 🎲🎸🍺 Roll high and may your crits be legendary!
