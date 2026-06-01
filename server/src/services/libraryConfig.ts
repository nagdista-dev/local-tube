import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), '..', 'cache');
const CONFIG_PATH = path.join(CACHE_DIR, 'library-config.json');

interface LibraryConfigFile {
  videosDir?: string;
}

export interface DirectoryListing {
  currentPath: string;
  parentPath: string | null;
  entries: {
    name: string;
    path: string;
  }[];
}

function defaultVideosDir(): string {
  return process.env.VIDEOS_DIR || path.join(process.env.HOME || '', 'Videos');
}

function readConfig(): LibraryConfigFile {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return {};
    }

    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as LibraryConfigFile;
  } catch {
    return {};
  }
}

function writeConfig(config: LibraryConfigFile): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function getLibraryLocation(): string {
  return readConfig().videosDir || defaultVideosDir();
}

export function setLibraryLocation(videosDir: string): string {
  const normalized = path.resolve(videosDir.trim());

  if (!fs.existsSync(normalized)) {
    throw new Error(`Directory not found: ${normalized}`);
  }

  const stat = fs.statSync(normalized);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${normalized}`);
  }

  writeConfig({ videosDir: normalized });
  return normalized;
}

export function listLibraryDirectories(targetPath?: string): DirectoryListing {
  const homeDir = process.env.HOME || path.parse(process.cwd()).root;
  const requestedPath = targetPath?.trim() || getLibraryLocation() || homeDir;
  let currentPath = path.resolve(requestedPath);

  if (!fs.existsSync(currentPath)) {
    currentPath = homeDir;
  }

  if (!fs.statSync(currentPath).isDirectory()) {
    currentPath = path.dirname(currentPath);
  }

  const entries = fs.readdirSync(currentPath, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => ({
      name: entry.name,
      path: path.join(currentPath, entry.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const root = path.parse(currentPath).root;
  const parentPath = currentPath === root ? null : path.dirname(currentPath);

  return { currentPath, parentPath, entries };
}
