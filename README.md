# LocalTube

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/FFmpeg-007808?style=for-the-badge&logo=ffmpeg&logoColor=white" alt="FFmpeg" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License" />
</p>

Self-hosted video library for watching, organizing, and studying from videos stored on your own computer. YouTube-style browsing and player experience while keeping your files, watch history, favorites, course progress, and Pomodoro tasks local.

## Features

- Local video scanning with metadata extraction
- YouTube-style browsing and player experience
- Folder-based categories and nested course organization
- Favorites, watch history, continue watching
- Search, sorting, and progress tracking
- Course mode with study planning and statistics
- Pomodoro timer with saved settings and tasks
- Optional online video download via `yt-dlp`
- Optional YouTube metadata/comments via `YOUTUBE_API_KEY`
- English and Arabic UI translations

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite |
| Backend | Express, TypeScript |
| Database | SQLite (better-sqlite3) |
| Video | FFmpeg for thumbnails, HTTP range streaming |

## Getting Started

### Prerequisites

- Node.js v18+
- FFmpeg installed and in PATH
- (Optional) yt-dlp for video downloads
- (Optional) YouTube API key for metadata

### Installation

```bash
git clone https://github.com/nagdista-dev/tubely.git
cd tubely
npm install
```

### Run

```bash
npm run dev
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
