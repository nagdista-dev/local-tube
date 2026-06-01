# LocalTube – Premium YouTube‑Inspired Video Library

> **A modern, beautiful web app for managing and watching your personal video collection**

## What is LocalTube?
LocalTube is a self‑hosted video library that mimics the look and feel of YouTube — but it runs entirely on **your own computer**.  It lets you:
- Browse videos by folders or categories
- Play videos directly in the browser
- Mark favourites, keep watch‑history and download videos
- Organise study‑plans, courses and a **Pomodoro timer** for focused work sessions
- Enjoy a sleek dark‑mode UI with premium glass‑morphism design, smooth animations and responsive layout.

The project is built with **Node.js**, **React**, **TypeScript** and **SQLite** – all open‑source technologies that run on any modern laptop (Windows, macOS or Linux).  No external cloud services are required; everything stays on your machine, keeping your data private.

---

## 🎯 Who is this for?
- **Non‑technical users** who want a beautiful interface to watch their own video files.
- **Students & creators** looking for a study‑planner and a Pomodoro timer integrated with their video library.
- **Privacy‑conscious people** who prefer a local solution rather than streaming from a third‑party service.

You don’t need to write code or use a terminal if you follow the step‑by‑step guide below – just a few clicks and you’ll be up and running.

---

## 📦 Quick Start (No‑code version)
### 1️⃣ Prerequisites
1. **Node.js (v20 or later)** – download from [nodejs.org](https://nodejs.org).
2. **Git** – to clone the repository (optional, you can also download a zip).
3. **A folder with video files** – any format supported by the HTML5 video player (mp4, webm, mkv, …).

### 2️⃣ Clone or download the project
```bash
# Using Git (recommended)
git clone https://github.com/nagdista-dev/local-tube.git
cd local-tube
```
Or click the **"Code → Download ZIP"** button on GitHub, unzip the archive and open the folder.

### 3️⃣ Install dependencies (one‑time only)
Open a terminal in the project folder and run:
```bash
npm install
```
This will download all required libraries for the client (React) and the server (Express, SQLite, etc.).

### 4️⃣ Tell LocalTube where your videos live
1. Start the server once so it creates a default configuration file:
   ```bash
   npm run dev   # this starts both client and server
   ```
2. Open your web browser and go to **http://localhost:5173** – you’ll see a tiny "setup" screen.
3. Click **“Choose Library Location”** and select the folder that contains your videos.
4. Click **“Save & Scan”** – LocalTube will scan the folder, build a tiny database and display the videos in the sidebar.

> **Tip:** The scan runs in the background; you can continue using the app while it processes large collections.

### 5️⃣ Browse & watch videos
- The **sidebar** lists all folders and categories. Click a folder to see its videos.
- Click a video thumbnail to start playback in the built‑in player.
- Use the **heart icon** to favourite a video, or the **history** tab to see what you watched recently.

### 6️⃣ Pomodoro Timer & Study Planner
- A new **Tools** section in the sidebar holds the **Pomodoro** page.
- Click **Pomodoro** → you’ll see a beautiful timer with work, short‑break and long‑break modes.
- Click the **gear icon** to customise session lengths; settings are saved automatically to the database.
- You can also **create tasks** (e.g., “Write blog post”) – each completed work session increments the task’s cycle count.

### 7️⃣ Advanced – Managing your library
- **Rename / move folders** on your file system and click **“Refresh”** in the app to update the view.
- Use the **“Clear Cache”** button (under Settings) if you ever need to rebuild the entire database.

---

## 🛠️ Development (If you want to tweak the code)
### Project structure
```
local-tube/
├─ client/               # React front‑end (Vite)
│   ├─ src/            # Components, pages, hooks
│   └─ vite.config.ts
├─ server/               # Express back‑end
│   ├─ src/            # API routes, database service, utils
│   └─ tsconfig.json
├─ thumbnails/          # Auto‑generated video preview images
├─ cache/               # SQLite database lives here
└─ README.md            # <‑ your new readme!
```

### Running locally (with hot‑reload)
```bash
# From the project root
npm run dev
```
- The client runs on **http://localhost:5173**.
- The API server runs on **http://localhost:3001**.
- Both are started together via `concurrently`.

### Adding new features
All UI components are written in **TypeScript + JSX** and styled with **Tailwind‑CSS** (the project already includes a premium design system).  To add a new page, create a file under `client/src/pages/`, export a React component and register the route in `client/src/App.tsx`.

### Database schema
The SQLite database (`cache/library.db`) holds several tables:
- `videos` – metadata of every scanned video.
- `watch_history` – timestamps for where you left off.
- `pomodoro_settings` – customised timer lengths.
- `pomodoro_tasks` – user‑defined tasks with completed cycles.
- `course_study_plans` – optional study‑plan data.

All queries are prepared once for performance and are accessed via the `videoDb` service (`server/src/services/database.ts`).

---

## 📚 FAQ (Non‑technical)
**Q: Do I need an internet connection?**
- No.  After you clone the repo and install the dependencies once, everything runs locally.

**Q: Will my videos be uploaded anywhere?**
- Absolutely not.  LocalTube only reads files from the folder you point it to; no data is sent to external servers.

**Q: Can I use it on a different computer?**
- Yes.  Just copy the project folder (or clone it again) and repeat the installation steps.

**Q: How do I back up my data?**
- The SQLite file lives in `cache/library.db`.  Copy that file to a backup location – it contains all your settings, watch‑history and Pomodoro tasks.

**Q: I see an error about "better‑sqlite3" not loading.**
- This happens if the native binary is compiled for a different Node version.  Run:
  ```bash
  npm rebuild better-sqlite3
  ```
  or reinstall the dependencies with the same Node version you use to run the app.

---

## 🚀 Deploying to the web (Optional)
If you ever want to expose LocalTube on your home network, you can run it behind a reverse‑proxy (e.g., Nginx) and enable HTTPS with a self‑signed certificate.  The steps are similar to any Node.js app; refer to the **"Deploy"** section in the wiki for a detailed guide.

---

## 🙏 Contributing
- Fork the repository, make your changes, and open a **Pull Request**.
- Follow the existing code style (Prettier + ESLint) – the project ships with a `lint` script.
- Please keep the premium UI guidelines in mind (smooth gradients, glass‑morphism, subtle animations).

---

## 📜 License
LocalTube is released under the **MIT License** – feel free to use, modify and share it however you like.

---

## 📧 Contact & Support
If you encounter any issues or have ideas for new features, feel free to:
- Open an **Issue** on GitHub.
- Email the developer at **nagdista@gmail.com**.
- Star the repo on GitHub – it helps the project grow!

Enjoy a premium‑grade video library that feels like YouTube, but stays completely in your hands.
