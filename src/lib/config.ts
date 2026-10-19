/**
 * Central configuration — portable paths and settings.
 *
 * This file is the SINGLE SOURCE OF TRUTH for all filesystem paths and
 * machine-specific settings. Every other file in the project imports from
 * here instead of hardcoding paths.
 *
 * PORTABILITY: All paths are derived from `process.cwd()` (the directory
 * from which the app is started). This means the system works identically
 * no matter where it's installed — on a developer's laptop, a VPS, or
 * Vercel. The only assumption is that you start the app from the project
 * root directory.
 *
 * Override defaults with environment variables:
 *   WORKSPACE_SLUG    — the slug of the workspace to resolve (default: 'maison-ete')
 *   UPLOADS_DIR       — absolute path to the uploads directory (default: <cwd>/uploads)
 *   DATABASE_URL      — set in .env (default: file:<cwd>/db/custom.db)
 */
import 'server-only'
import path from 'path'
import { promises as fs } from 'fs'

// ── Uploads directory ─────────────────────────────────────
//
// Defaults to `<project-root>/uploads`. Override with UPLOADS_DIR env var
// if you want to store uploads elsewhere (e.g. a mounted volume).

export const UPLOADS_DIR: string =
  process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads')

// ── Database path ──────────────────────────────────────────
//
// Defaults to `<project-root>/db/custom.db`. The DATABASE_URL env var
// takes precedence (set in .env).

export const DB_DIR: string = path.join(process.cwd(), 'db')
export const DB_PATH: string = path.join(DB_DIR, 'custom.db')

// ── Workspace slug ──────────────────────────────────────────
//
// The system is single-tenant — it resolves one workspace by slug.
// Override with WORKSPACE_SLUG if you renamed the workspace.

export const WORKSPACE_SLUG: string =
  process.env.WORKSPACE_SLUG || 'maison-ete'

// ── Path conversion helpers ────────────────────────────────
//
// These functions bridge between filesystem paths and public URLs.
// They are PORTABLE — they work with any base directory, not just
// /home/z/my-project.

/**
 * Convert a filesystem path to a public URL path.
 *
 * Examples (all return the same thing):
 *   /home/z/my-project/uploads/maison-ete/photo.jpg  →  /uploads/maison-ete/photo.jpg
 *   /opt/myapp/uploads/maison-ete/photo.jpg           →  /uploads/maison-ete/photo.jpg
 *   C:\Users\me\app\uploads\maison-ete\photo.jpg       →  /uploads/maison-ete/photo.jpg
 *
 * Also passes through paths that are already public URLs.
 */
export function assetPublicPath(filePath: string): string {
  if (!filePath) return filePath

  // Already a public path (starts with /uploads/)
  if (filePath.startsWith('/uploads/')) return filePath

  // Already a full URL (http://... or https://...)
  if (/^https?:\/\//.test(filePath)) return filePath

  // Find /uploads/ in the path — this works regardless of the OS or
  // where the project is installed.
  const uploadsIdx = filePath.lastIndexOf(path.sep + 'uploads' + path.sep)
  if (uploadsIdx !== -1) {
    // Convert the OS-specific separator to URL-style /
    return filePath.slice(uploadsIdx).split(path.sep).join('/')
  }

  // Windows-style paths use backslashes; also check forward slashes
  const fwdIdx = filePath.lastIndexOf('/uploads/')
  if (fwdIdx !== -1) {
    return filePath.slice(fwdIdx)
  }

  // Fallback: if the path is inside UPLOADS_DIR, strip that prefix.
  if (filePath.startsWith(UPLOADS_DIR)) {
    return '/uploads/' + filePath.slice(UPLOADS_DIR.length).split(path.sep).join('/').replace(/^\/+/, '')
  }

  // Last resort: return as-is (might be a relative path or already public)
  return filePath
}

/**
 * Convert a public URL path (/uploads/...) back to a filesystem path.
 *
 * This is the reverse of `assetPublicPath`. Used by the file-serving
 * route to find files on disk.
 */
export function resolveUploadFsPath(publicPath: string): string {
  if (!publicPath) return ''

  // If it's already a filesystem path, return as-is
  if (publicPath.startsWith(UPLOADS_DIR)) return publicPath

  // Strip /uploads/ prefix and join with UPLOADS_DIR
  let relative = publicPath
  if (relative.startsWith('/uploads/')) {
    relative = relative.slice('/uploads/'.length)
  } else if (relative.startsWith('uploads/')) {
    relative = relative.slice('uploads/'.length)
  }

  // Handle URLs (e.g. https://example.com/uploads/...)
  if (/^https?:\/\//.test(relative)) {
    const idx = relative.indexOf('/uploads/')
    if (idx !== -1) {
      relative = relative.slice(idx + '/uploads/'.length)
    }
  }

  return path.join(UPLOADS_DIR, relative)
}

// ── Directory bootstrap ────────────────────────────────────
//
// Ensure the uploads and db directories exist. Called once at module
// load time. Safe to call multiple times.

let _bootstrapped = false
export async function ensureDirectories(): Promise<void> {
  if (_bootstrapped) return
  _bootstrapped = true
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true })
    await fs.mkdir(DB_DIR, { recursive: true })
  } catch {
    // Ignore — the routes will create subdirectories as needed.
  }
}

// Bootstrap synchronously (fire and forget)
ensureDirectories()
