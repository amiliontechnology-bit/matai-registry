# ⬡ Matai Registry

A secure web system to register Samoan Matai titles and generate printable certificates. Built with React + Firebase — completely free to host and operate.

---

## ✦ Features

- 🔐 **Secure login** — Email/password authentication via Firebase
- 📋 **Title registration** — Matai title, holder, type (Ali'i / Faipule / Tulafale), village, district, date
- 🔍 **Search & filter** — Find records by name, title, district, or type
- ✏️ **Edit records** — Update any registration
- 🖨️ **Print certificates** — Formal A4 landscape certificate with ornamental design
- 🗑️ **Delete records** — With confirmation prompt
- 🔒 **Data security** — Only authenticated users can access the registry

---

## 🚀 Setup Guide (Step by Step)

### 1. Set Up Firebase (free)

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Create a project"**, name it `matai-registry`, click through the setup
3. In your project dashboard, click the **Web icon `</>`** to add a web app
4. Name it `matai-registry-web`, click **"Register app"**
5. **Copy the `firebaseConfig` object** — you'll need it in a moment

#### Enable Authentication
1. In Firebase console → **Authentication** → **Get started**
2. Click **"Email/Password"** → Enable → Save
3. Go to **Users** tab → **Add user** → Enter your admin email + password

#### Enable Firestore Database
1. In Firebase console → **Firestore Database** → **Create database**
2. Choose **"Start in production mode"** → Select a region → Done

#### Set Firestore Security Rules
1. In Firestore → **Rules** tab → Replace the contents with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /registrations/{doc} {
      allow read, write: if request.auth != null;
    }
  }
}
```

2. Click **Publish**

---

### 2. Configure the App

Open `src/firebase.js` and replace the placeholder values with your Firebase config:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

---

### 3. Install & Run Locally

You need [Node.js](https://nodejs.org) installed (version 16 or newer).

```bash
# Install dependencies
npm install

# Start local development server
npm start
```

Open [http://localhost:3000](http://localhost:3000) — log in with the admin credentials you created in Firebase.

---

### 4. Deploy to GitHub Pages (free hosting)

1. Create a GitHub account at [https://github.com](https://github.com)
2. Create a new repository named `matai-registry`
3. In `package.json`, update the `homepage` field:
   ```json
   "homepage": "https://YOUR-GITHUB-USERNAME.github.io/matai-registry"
   ```
4. Push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/matai-registry.git
   git push -u origin main
   ```
5. Deploy:
   ```bash
   npm run deploy
   ```
6. Your app is live at `https://YOUR-USERNAME.github.io/matai-registry`

> **Alternative**: Deploy to [Netlify](https://netlify.com) — drag and drop your `build` folder after running `npm run build`. Also free.

---

## 🖨️ Printing Certificates

1. Open any registered title → click the 🏅 icon
2. Review the certificate on screen
3. Click **"Print Certificate"**
4. In print dialog, select **A4 Landscape** orientation
5. Disable headers/footers if your browser adds them

---

## 🔧 Managing Users

To add more administrators:
1. Go to Firebase console → Authentication → Users → Add user

To remove access:
- Disable or delete the user in Firebase Authentication

---

## 📁 Project Structure

```
src/
├── firebase.js          # Firebase configuration
├── App.jsx              # Routing
├── index.css            # Global styles
└── pages/
    ├── Login.jsx        # Login screen
    ├── Dashboard.jsx    # Registry list with search/filter
    ├── Register.jsx     # Add / edit title form
    └── Certificate.jsx  # Printable certificate
```

---

## 💰 Cost

| Service | Cost |
|---|---|
| Firebase Firestore (up to 1GB, 50k reads/day) | **Free** |
| Firebase Authentication | **Free** |
| GitHub Pages hosting | **Free** |
| **Total** | **$0/month** |

---

*Built for the registration and preservation of Samoan Matai titles.*
