# Between Sessions

PCIC's between-session practice app for families. It runs in the phone's web browser and can be saved to the Home Screen like an app. Works on iPhone and Android.

## How privacy works

- Everything a family enters is stored only on their own phone. The app sends nothing anywhere.
- There are no accounts, emails, or required names. A child's first name is optional and stays on the phone.
- PCIC never receives, sees, backs up, or can recover anything families enter.
- In session, the family opens the **Summary** tab on their own phone and shows it. Clinicians don't handle client phones.
- Entries older than 90 days delete themselves. Families can erase everything in Settings, and can set a 4-digit app passcode.
- The page blocks itself from loading or sending anything outside its own website (Content-Security-Policy in `index.html`). No analytics, trackers, web fonts, or outside scripts.

Have PCIC's HIPAA privacy lead review this before launch.

## What's in this folder

| File | What it is |
|---|---|
| `index.html` | The page families open |
| `app.js` | The app |
| `app.css` | The look |
| `sw.js` | Lets the app open without a connection |
| `manifest.webmanifest` | Name and icon for the Home Screen |
| `icons/` | Home Screen icons |

## Putting it online with GitHub Pages (free)

1. Sign in to the PCIC GitHub account at github.com.
2. Click **+** (top right) and choose **New repository**. Name it `between-sessions`, set it to **Public**, and click **Create repository**. Free GitHub Pages requires a public repository. The code holds no client information.
3. On the new repository page, click **uploading an existing file**.
4. Unzip `between-sessions.zip` on your computer. Drag everything inside the folder (including the `icons` folder) into the upload area, then click **Commit changes**.
5. Go to **Settings**, then **Pages** (left menu). Under **Branch**, choose `main` and `/ (root)`, then click **Save**.
6. Wait a minute or two and refresh. The page shows your link, for example `https://pcic-account.github.io/between-sessions/`.
7. Open the link on your iPhone in Safari, tap **Share**, then **Add to Home Screen**, and try it.

You can later point a PCIC web address (for example `app.yourpracticedomain.com`) at it under **Settings → Pages → Custom domain**.

## Updating the app later

1. Replace the changed files in the repository (same upload steps).
2. In `sw.js`, change the `VERSION` line (for example `between-sessions-1.0.1`) so phones pick up the new files.

Families keep their entries through updates.

## What families should know

- On iPhone, add it to the Home Screen **before** setting it up. The Home Screen app keeps its own data separate from Safari.
- Deleting the app or clearing the browser's data erases everything, and PCIC can't restore it.
- The app doesn't alert anyone. Crisis numbers (988, Colorado Crisis Services, 911) are on every screen under **Get help now**.

- ## Live address

https://parentchild.github.io
