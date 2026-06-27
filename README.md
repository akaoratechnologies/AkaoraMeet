# Akaora Meet – GitHub Pages Browser Version

This version is built for direct browser hosting on GitHub Pages.

## Main flow

1. Home screen shows two simple options:
   - Create a new meeting
   - Join the meeting
2. Create flow asks for the user's name first.
3. `Create Meeting Now` stays disabled until the name is entered.
4. Mic and camera are optional and OFF by default.
5. After meeting creation, the user is redirected to the call screen.
6. Room code and share link are available directly on the call screen.
7. Join flow validates the room code and shows a clear invalid-room error.
8. Live chat works with Firebase Realtime Database and includes an emoji picker.

## Files

```text
index.html
styles.css
app.js
firebase-config.js
database.rules.json
manifest.webmanifest
.nojekyll
assets/logo.png
```

## Firebase setup

Your Firebase config is already added in `firebase-config.js`.

Open Firebase Console > Realtime Database > Rules and paste the content from `database.rules.json`.

For quick testing, the included rules allow no-login rooms to work with room codes from 6 to 12 characters. For production, add expiry cleanup, rate limiting, and stronger validation.

## GitHub Pages deployment

1. Extract the ZIP.
2. Upload the inside files directly into your GitHub repo root.
3. Make sure `index.html` is directly in root.
4. Go to GitHub repo Settings > Pages.
5. Select `Deploy from branch`.
6. Select branch `main` and folder `/root`.
7. Open the HTTPS GitHub Pages URL.

The repo root should look like this:

```text
index.html
app.js
styles.css
firebase-config.js
database.rules.json
manifest.webmanifest
.nojekyll
assets/
README.md
```

## Local testing

Run this inside the extracted folder:

```bash
python -m http.server 8080
```

Open:

```text
http://localhost:8080
```

Camera and mic work on `localhost`. Public camera/mic/screen share requires HTTPS, so use the GitHub Pages HTTPS link for real testing.

## Important WebRTC note

The app uses Firebase only for signaling and chat. Video/audio uses WebRTC. Some strict networks need a TURN server. If two users can join and chat but video/audio fails, add a TURN server inside `rtcConfig` in `app.js`.
