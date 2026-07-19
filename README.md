# Orjun — A Life, Kept

A private, personal digital-life website: photo & video albums, a daily journal,
a life-journey timeline, and an admin dashboard to manage all of it. Built with
plain HTML/CSS/JS + Firebase, deployable for free on GitHub Pages.

## 1. What's in this project

| File | Purpose |
|---|---|
| `index.html` / `style.css` / `script.js` | Public site |
| `admin.html` / `admin.css` / `admin.js` | Private admin dashboard |
| `firebase.js` | **The only file with Firebase config** |
| `manifest.json` / `sw.js` | PWA support (installable, offline app shell) |

## 2. Create your Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. Once created, click the **Web** icon (`</>`) to register a web app. Skip Firebase Hosting — you're using GitHub Pages instead.
3. Copy the `firebaseConfig` object it gives you.
4. Open `firebase.js` in this project and paste your values into the `firebaseConfig` object at the top. That's the only place you ever need to edit credentials.

### Enable the three services you need

In the Firebase Console sidebar:

- **Build → Authentication → Get started → Sign-in method → Email/Password → Enable.**
- **Build → Firestore Database → Create database** (start in production mode).
- **Build → Storage → Get started** (start in production mode).

## 3. Create your first administrator account

Passwords are never written into the code. Instead:

1. Firebase Console → **Authentication → Users → Add user**.
2. Enter your own email and choose a password.
3. That's it — this is the only account that will be able to sign in at `admin.html`.

To change your password later, use **Authentication → Users → ⋮ → Reset password**, or add a "forgot password" flow later if you want one.

## 4. Lock the database down (important)

By default, "production mode" blocks all reads and writes — you need rules that let *anyone* read the public content, but only *your signed-in account* write to it.

**Firestore rules** (Firestore Database → Rules):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

**Storage rules** (Storage → Rules):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

Because only your one Authentication user exists, `request.auth != null` effectively means "only me." If you ever add more Firebase Auth users for other reasons, tighten these rules to check a specific `request.auth.uid` or a `role` field.

## 5. Run it locally (optional)

Any static file server works, since this project has no build step:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## 6. Deploy to GitHub Pages

1. Push this project to a new GitHub repository.
2. In the repo: **Settings → Pages → Source → Deploy from a branch → `main` / root**.
3. Wait a minute, then your site is live at `https://<your-username>.github.io/<repo-name>/`.
4. Visit `/admin.html` on that same domain and sign in with the account you created in step 3.

Every change you make in the admin dashboard writes straight to Firestore/Storage and appears on the public site instantly — no redeploy needed. You only need to push to GitHub again if you change the code itself.

## 7. Day-to-day use

- **Public site** (`index.html`): what visitors see — About, Life Journey, Gallery, Journal, search, dark/light toggle, ambient music.
- **Admin dashboard** (`admin.html`): sign in, then use the sidebar to create albums, drag-and-drop upload photos/videos in bulk, write journal entries (autosaves as you type), add Life Journey milestones, edit your About Me section, manage categories, and adjust site-wide settings.

## 8. Notes on limits

- Firebase's free "Spark" plan comfortably covers a personal site: 1 GB Storage, 10 GB/month download, 50K Firestore reads/day. If your photo/video library grows large, consider compressing videos before upload and upgrading to the pay-as-you-go "Blaze" plan (still effectively free at personal-site scale).
- Everything here is genuinely private only to the extent the rules in step 4 restrict *writes*. Public **reads** are open by design (so your own site can display itself without you being logged in) — if you want the whole site password-protected instead, that's a bigger change (server-side auth) and worth a follow-up if you need it.
