# Enabling Google Drive sync

Macro Log can keep each person's data in a private folder of **their own** Google Drive. No server is involved and nothing is stored centrally. To turn this on for your deployment you create one free OAuth client in Google Cloud and paste its ID into the app. About ten minutes.

## 1. Create a project and enable the Drive API

1. Go to https://console.cloud.google.com/ and sign in.
2. Create a new project (for example "Macro Log").
3. Open **APIs & Services → Library**, search for **Google Drive API**, and click **Enable**.

## 2. Configure the consent screen

1. Open **APIs & Services → OAuth consent screen** (Google now calls this "Google Auth Platform → Branding").
2. User type: **External**. App name: Macro Log. Add your email as the support and developer contact.
3. Under **Data access** (or Scopes), add the scope `https://www.googleapis.com/auth/drive.appdata`. This is the only one the app uses. It is a non-sensitive scope, so Google does not require a security review.
4. Optional but recommended: set the app home page to your deployment URL and the privacy policy to `<your URL>/privacy.html`, which is included in this repo.
5. Under **Audience**, click **Publish app** so anyone with a Google account can sign in. While it is in "Testing", only the test users you list can connect, and their sign-ins expire after seven days.

## 3. Create the OAuth client

1. Open **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**.
3. **Authorized JavaScript origins**: your site origin, for example `https://ijlorenzo.github.io`. Add `http://localhost:8080` too if you run it locally.
4. **Authorized redirect URIs**: the app's directory URL **with the trailing slash**, for example `https://ijlorenzo.github.io/openAI.test/` and `http://localhost:8080/`.
5. Create it and copy the **Client ID** (it ends in `.apps.googleusercontent.com`). There is no secret to copy; the app does not use one.

## 4. Put the client ID in the app

Either:

- Paste it into `src/config.js` as `GOOGLE_CLIENT_ID` and push. Everyone using your deployment can then connect their own Drive from Settings. The ID is public by design.
- Or paste it in the app itself under **Settings → Sync → Google client ID**. That only applies on that device, which is handy for testing before you commit it.

## How it behaves

- Local storage stays the default. Sync is opt-in from Settings, or from "Restore from Google Drive" on the welcome screen on a new device.
- Google's access tokens last one hour. The app refreshes silently when it can and otherwise shows a "Reconnect" pill. Reconnecting is a quick bounce through Google if you are still signed in.
- Changes from two devices are merged record by record using timestamps, so logging on a phone and a laptop does not overwrite either side. Deletions are kept as tombstones so they win over stale copies.
- Disconnecting keeps local data and leaves the Drive file in place. To remove it, open Google Drive → Settings → Manage apps → Macro Log → Delete hidden app data.
