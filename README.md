# 🎬 LocalTube — Your Personal Offline Video Library

LocalTube is a self-hosted, highly premium media server that turns any offline folder of videos on your computer into a stunning, responsive, Netflix-style streaming experience inside your browser. 

---

# 📖 Part 1: Quick Start Guide (For Non-Technical Users)

If you just want to get the program running to watch your videos, follow these simple steps!

## 1. The Ingredients (What You Need)

* **Your Video Folder**: A folder on your computer filled with movie, course, or clip files.
* **FFmpeg (The Video Helper)**: A free helper program that LocalTube uses to capture video cover images (thumbnails).
* **Node.js (The Engine)**: A free engine that runs the website server on your machine.

---

## 2. Step-by-Step Installation

### Step A: Install FFmpeg (The Video Helper)
Choose the instructions for your operating system:

* 🍎 **macOS (Mac)**: 
  1. Open your search bar (`Cmd + Space`), type **Terminal**, and press Enter.
  2. Copy and paste this line, then press Enter:
     ```bash
     brew install ffmpeg
     ```
* 🐧 **Linux (Ubuntu/Debian)**:
  1. Open your terminal window.
  2. Type the following and press Enter:
     ```bash
     sudo apt update && sudo apt install -y ffmpeg
     ```
* 💻 **Windows**:
  1. Go to the [FFmpeg Downloads Page](https://ffmpeg.org/download.html).
  2. Download a Windows build (e.g. from gyan.dev).
  3. Extract the downloaded folder, rename it to `ffmpeg`, and place it in your `C:/` drive.
  4. Search "Environment Variables" in your Windows Start Menu, edit the system path variables, and add `C:/ffmpeg/bin` to your **Path**.

---

### Step B: Install Node.js (The Engine)
1. Go to the [Node.js Official Website](https://nodejs.org/).
2. Download and run the installer for **Node.js 22 (LTS)**.
3. Keep the default settings and click **Next** until the installation completes.

---

### Step C: Configure LocalTube
1. Open your downloaded `localtube` folder.
2. Find the file named `.env.example` and rename it to exactly `.env` (delete the `.example` extension).
3. Open this `.env` file in Notepad (Windows) or TextEdit (Mac).
4. Find the line `VIDEOS_DIR` and replace the path with the exact folder path where your videos are located.

*Examples:*
* **Windows**: `VIDEOS_DIR=C:/Users/YourName/Videos` *(Note: Always use forward slashes `/` instead of backslashes `\`)*
* **macOS**: `VIDEOS_DIR=/Users/YourName/Movies`
* **Linux**: `VIDEOS_DIR=/home/YourName/Videos`

Save and close the file.

---

### Step D: Install & Run
1. Open your **Terminal** (Mac/Linux) or **Command Prompt** (Windows, by typing `cmd` in the Start Menu).
2. Point your terminal to the `localtube` folder:
   ```bash
   cd "/path/to/where/you/downloaded/localtube"
   ```
3. Type this command and press Enter to install dependencies:
   ```bash
   npm install
   ```
4. Start the application:
   ```bash
   npm run dev
   ```
5. Open your web browser and go to:
   **[http://localhost:5173](http://localhost:5173)**

🎉 **Success! Click on any video to stream it instantly.**

---

## 🎮 Keyboard Shortcuts & Sleep Timer

While watching a video, enjoy these premium controls:

### Keyboard Shortcuts
* ⌨️ **Spacebar** or **K**: Play / Pause the video.
* ⌨️ **Right Arrow (→)**: Jump forward 10 seconds.
* ⌨️ **Left Arrow (←)**: Jump backward 10 seconds.
* ⌨️ **Up Arrow (↑)**: Turn volume up.
* ⌨️ **Down Arrow (↓)**: Turn volume down.
* ⌨️ **F**: Enter or Exit Fullscreen.
* ⌨️ **M**: Mute / Unmute the sound.

### Setting the Sleep Timer
Want the video to pause automatically when you go to bed?
1. Hover your cursor over the video to reveal the player's bottom control bar.
2. Click the **Timer** button.
3. Select an interval (5m, 15m, 30m, etc.) or type a custom number of minutes in the text box and click **Set**.
4. A countdown will show on your screen (e.g. `12m 45s left`). The video will automatically pause when it reaches zero!

---
---

# 🛠️ Part 2: Technical Architecture & Reference Manual

For developers and technical users, this section provides an exhaustive catalog of the program's backend architecture, SQLite storage schema, API routing structures, and media processing services.

```
                  ┌──────────────────────────────────────────────┐
                  │              Vite Web Interface              │
                  │        (React / Zustand State Store)         │
                  └──────────────────────┬───────────────────────┘
                                         │  (HTTP / SSE / Streams)
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │             Express REST Server              │
                  │           (Node.js / TypeScript)             │
                  └──────┬───────────────┬────────────────┬──────┘
                         │               │                │
                         ▼               ▼                ▼
     ┌───────────────────────┐ ┌──────────────────┐ ┌────────────────────┐
     │  SQLite / WAL Cache   │ │  FFmpeg / Probe  │ │ HTTP Range Stream  │
     │  (better-sqlite3)     │ │  (Scan Queue)    │ │ (Partial Delivery) │
     └───────────────────────┘ └──────────────────┘ └────────────────────┘
```

---

## 🗄️ SQLite Database Schema

The database uses **SQLite** located in the `cache/library.db` directory. It uses **Write-Ahead Logging (WAL)** for concurrent reading and writing.

### 1. `videos` Table
Stores extracted media metadata, filesystem paths, and classification parameters.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `TEXT` | `PRIMARY KEY` | SHA-256 hash generated from the absolute filepath. |
| `title` | `TEXT` | `NOT NULL` | The user-friendly video name (extracted from filename). |
| `filename` | `TEXT` | `NOT NULL` | The full name of the file on disk (e.g., `clip.mp4`). |
| `path` | `TEXT` | `NOT NULL UNIQUE` | Absolute filepath on the local filesystem. |
| `relativePath`| `TEXT` | `NOT NULL` | Path relative to the root `VIDEOS_DIR` folder. |
| `category` | `TEXT` | `NOT NULL` | Primary category (auto-assigned from top folder name). |
| `subcategory` | `TEXT` | `NULL` | Secondary sub-category (auto-assigned from nested folder). |
| `duration` | `REAL` | `DEFAULT 0` | Duration of the video in seconds. |
| `fileSize` | `INTEGER`| `DEFAULT 0` | Size of the video file in bytes. |
| `resolution` | `TEXT` | `NULL` | Video width and height layout (e.g., `1920x1080`). |
| `thumbnail` | `TEXT` | `NULL` | Relative web URL route to the generated cover asset. |
| `addedAt` | `TEXT` | `NOT NULL` | ISO 8601 timestamp of when the video was discovered. |
| `isFavorite` | `INTEGER`| `DEFAULT 0` | Boolean flag (0 = regular, 1 = user favorite). |
| `tags` | `TEXT` | `DEFAULT '[]'` | JSON array of tags or sub-folders. |
| `lastScanned` | `TEXT` | `NOT NULL` | ISO 8601 timestamp of the last library rescan cycle. |

### 2. `watch_history` Table
Stores playheads and watch history entries.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `videoId` | `TEXT` | `PRIMARY KEY` | References `videos(id)` with `ON DELETE CASCADE`. |
| `timestamp` | `REAL` | `NOT NULL DEFAULT 0` | The last played spot in seconds (video playhead). |
| `updatedAt` | `TEXT` | `NOT NULL` | ISO 8601 timestamp of the last play session. |

---

## 📡 REST API Specifications

The server mounts all API routes under the `/api` prefix.

### 🎥 Videos Endpoints (`/api/videos`)

#### `GET /api/videos`
Fetches a list of indexed videos with support for pagination, sorting, and category filtering.
* **Query Parameters**:
  * `page` (number, default: `1`): The page index.
  * `pageSize` (number, default: `60`, max: `120`): Items per page.
  * `category` (string, optional): Filters results to a specific folder category.
  * `sort` (string, default: `date`): Sorting order (`date` | `name` | `size` | `duration`).
* **Response Example (HTTP 200)**:
  ```json
  {
    "videos": [
      {
        "id": "a9f3b...",
        "title": "Introduction to React",
        "filename": "01-intro.mp4",
        "category": "Courses",
        "subcategory": "React",
        "duration": 482.5,
        "fileSize": 85938202,
        "resolution": "1920x1080",
        "thumbnail": "/thumbnails/a9f3b.jpg",
        "isFavorite": false,
        "watchProgress": 0.45
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 60,
    "hasMore": false
  }
  ```

#### `GET /api/videos/search`
Filters the library titles and folder structures.
* **Query Parameters**:
  * `q` (string, required): The search string.
* **Response Example (HTTP 200)**:
  ```json
  {
    "videos": [...],
    "total": 1
  }
  ```

#### `GET /api/videos/categories`
Returns an array of categories and subcategories derived from folder structures.
* **Response Example (HTTP 200)**:
  ```json
  [
    {
      "name": "Courses",
      "count": 12,
      "subcategories": ["React", "TypeScript"]
    }
  ]
  ```

#### `GET /api/videos/history`
Retrieves recently watched videos.
* **Query Parameters**:
  * `limit` (number, default: `12`): Number of items to return.

#### `GET /api/videos/:id`
Retrieves complete details for a single video.

#### `POST /api/videos/:id/favorite`
Toggles a video's favorite status. Returns the updated state.
* **Response Example (HTTP 200)**:
  ```json
  { "isFavorite": true }
  ```

#### `POST /api/videos/:id/progress`
Saves the playback progress of a video.
* **Request Body**:
  ```json
  { "timestamp": 124.5 }
  ```
* **Response Example (HTTP 200)**:
  ```json
  { "ok": true }
  ```

---

### 🌐 Streaming Endpoint (`/api/stream`)

#### `GET /api/stream/:id`
Streams a video file with **HTTP 206 Partial Content** range support. This enables seeking to any timestamp in the browser and provides smooth progressive loads.
* **Request Headers**:
  * `Range`: `bytes=start-end` (e.g. `bytes=1048576-`)
* **Response Headers**:
  * `Status`: `HTTP 206 Partial Content` (or `HTTP 200` if no range is requested)
  * `Content-Range`: `bytes start-end/totalSize`
  * `Accept-Ranges`: `bytes`
  * `Content-Length`: Size of the partial chunk
  * `Content-Type`: Matching media mime-type (e.g. `video/mp4`, `video/webm`)

---

### 🔄 Library Scan Endpoints (`/api/scan`)

#### `POST /api/scan`
Triggers an asynchronous scan of the video directory. Returns immediately.
* **Response Example (HTTP 200)**:
  ```json
  {
    "message": "Scan started",
    "status": {
      "status": "scanning",
      "processed": 0,
      "total": 150
    }
  }
  ```

#### `GET /api/scan/status`
Retrieves progress coordinates of the active scan.

---

## 🛠️ Scanner & Thumbnail Generation Internals

The backend contains a high-performance library scanner (`server/src/services/scanner.ts`):
1. **Recursive Directory Walker**: Recursively crawls `VIDEOS_DIR` filtering files matching supported video extensions.
2. **Category Assignment**: The parent directory directly under `VIDEOS_DIR` is assigned as `category`. Sub-directories inside that folder are assigned as `subcategory`.
3. **FFprobe Metadata Extraction**: Uses `ffprobe` to gather exact duration, resolution, audio channels, and codecs.
4. **Concurrent Thumbnail Queue**:
   * Uses an asynchronous queue limiting execution to a maximum of **3 concurrent FFmpeg processes**. This keeps CPU load low even when adding hundreds of new videos.
   * Thumbnails are extracted at **10% of the total video duration** to bypass black opening credits.
   * Generates compressed `.jpg` files saved in `/thumbnails` named by the video's ID.

---

## 💻 Developer & Advanced Setup (nvm & npm rebuild)

### Managing Node Versions
If you run this application under a system node version different from the version used when compiling, `better-sqlite3` will throw an architecture mismatch error:
```
Error: The module 'better_sqlite3.node' was compiled against a different Node.js version.
```

To resolve this cleanly:
1. **Configure with NVM (Node Version Manager)**:
   ```bash
   # Load nvm
   . ~/.nvm/nvm.sh
   
   # Setup Node 22
   nvm install 22
   nvm use 22
   ```
2. **Recompile Native Modules**:
   If you want to compile `better-sqlite3` for your current active terminal Node version instead, run:
   ```bash
   npm rebuild
   ```
   This will run `node-gyp` and rebuild the binary addon specifically for your system's current Node.js engine.

---

## 🛟 Exhaustive Troubleshooting Matrix

| Symptom | Root Cause | Diagnosis & Resolution Action |
|---|---|---|
| `better_sqlite3.node was compiled against a different Node version` | Terminal is running a different Node.js version than the one used during `npm install`. | Run `npm rebuild` to recompile the native database binary addon for your active Node shell, or switch version using `nvm use 22`. |
| `VIDEOS_DIR environment variable not set` | Your `.env` file is missing, misnamed, or has a syntax error. | Confirm that `.env` is in the root directory (not `.env.txt` or `.env.example`) and containing `VIDEOS_DIR=/absolute/path`. |
| Scan crashes on specific files | A video file has corrupted headers and FFmpeg/FFprobe exits with an error status. | Check the server console log output. It will print the exact path of the failing file. Move or convert the file. |
| Port conflict on `localhost:3001` or `5173` | Port is already in use by another program. | In `.env`, change `PORT=3002`. In `client/vite.config.ts`, edit the backend proxy targets to match the new port. |
| Cannot stream on mobile device (LAN) | Client cannot resolve localhost, or request is blocked by server CORS policy. | Find your host's local IP address (e.g. `192.168.1.100`) using `ipconfig` (Windows) or `ip addr` (Linux). Set `CORS_ORIGIN=http://192.168.1.100:5173` in `.env` and start servers. Browse using the IP address on your phone. |
| Slow initial rescan | FFmpeg needs to examine every new file. | This is normal during the first scan. Subsequent rescans check SQLite logs and finish instantly. |