#!/usr/bin/env node
/**
 * retheme.mjs — move hardcoded legacy (Fiverr-green / cool-grey) hex colours
 * onto the Sanus "paper & ink + ultramarine" palette defined in
 * src/app/globals.css.
 *
 * Usage
 *   node scripts/retheme.mjs              # dry run over src/, prints a report
 *   node scripts/retheme.mjs --write      # apply in place
 *   node scripts/retheme.mjs --write src/app/(dashboard) src/components/foo.tsx
 *
 * It rewrites hex -> hex (case-insensitive), so it is safe inside Tailwind
 * arbitrary values like bg-[#1dbf73], hover:bg-[#19a463]/10, inline styles,
 * and CSS. 8-digit hex keeps its alpha suffix (#1dbf7333 -> #2f3cf533).
 * Files skipped: src/app/globals.css (token source) and anything in
 * node_modules/.next. Re-running is idempotent: no target colour is also a
 * source colour.
 *
 * ── Mapping ────────────────────────────────────────────────────────────────
 *  Role                 Old hex                                   New hex  Token
 *  Accent (brand)       #1dbf73                                -> #2f3cf5  bg-brand
 *  Accent hover / ink   #19a463 #108a50 #0f8f56 #1e5aa8 #1d4ed8
 *                       #3f4bb5                                -> #2330c8  brand-hover / brand-ink
 *  Accent deep          #0f5f3c #2d3794                        -> #1a2496
 *  Accent on dark       #8ee7bf                                -> #b4bbff  brand-on-ink
 *  Accent line          #bcebd5 #b8e6d0 #bfdbfe                -> #c9cdfb  brand-line
 *  Accent tint (strong) #d9f6e8 #d3f4e3                        -> #dfe2fd
 *  Accent tint          #e8faf1 #eef6ff #eff6ff #eef2ff        -> #eceefe  brand-tint
 *  Accent wash          #f4fcf8 #f0faf5 #fafefb #f3fcf7 #f4fdf8 -> #f4f5fe
 *  Dark panels          #0f4c3a                                -> #1a1a17  ink
 *                       #0d3f30 #0c3d2f                        -> #121210
 *  Ink                  #404145 #111827 #2b2c2f                -> #1a1a17  ink
 *  Ink soft             #374151                                -> #3a3934  ink-soft
 *  Muted text           #62646a #6b7280 #74767e                -> #5f5d57  ink-muted (6.0:1 on paper)
 *  Faint text           #95979d #9ca3af                        -> #706d65  ink-faint (4.7:1 on paper — now AA)
 *  Muted on dark        #cfd4d0                                -> #c9c6bd
 *  Strong line          #c5c6c9 #d1d5db #d5d6d9                -> #cbc6ba  line-strong
 *  Line                 #e4e5e7 #e5e7eb                        -> #e3dfd6  line
 *  Sunken surface       #f1f3f5 #f3f4f6 #f1f1f2 #f3f4f5 #efeff0
 *                       #eef2f6                                -> #eeebe4  paper-sunken
 *  Page background      #f9fafb #fafafa #f7f7f7 #f5f5f5        -> #f6f4ef  paper
 *  Warning text         #8a6508 #6b5208 #5c4300 #8a6d0b #b8860b
 *                       #9a5b00 #92400e #b7791f #b08a0e        -> #8a5a00  warning
 *  Warning line         #f5deb3 #f3d9a4 #f5d68a #fde68a        -> #ecd3a3
 *  Warning tint         #fdf6e3 #fffaf0 #fffbeb #fffaeb #fff4e0 -> #fbf0dc  warning-tint
 *  Danger               #c0392b #b91c1c #991b1b                -> #b42318  danger
 *  Danger line          #f5c6cb #fecaca                        -> #f4c7c2
 *  Danger tint          #fdecec #fef2f2                        -> #fdecea  danger-tint
 *
 *  Deliberately untouched: #ffffff, #b42318/#7a2318/#fdecea (already on
 *  palette), star amber #fbbf24/#f59e0b, Google brand colours (#4285f4
 *  #ea4335 #fbbc05 #34a853), and Tailwind named classes (green-*, emerald-*
 *  used as status colours).
 *
 * ── Contrast notes ─────────────────────────────────────────────────────────
 *  White text on #2f3cf5 = 6.8:1 and on #2330c8 = 9.0:1, so every
 *  "bg-[#1dbf73] text-white" button stays AA (it was 2.4:1 before!).
 *  #2330c8 on #eceefe = 8.3:1 (tinted pills). #2f3cf5 on #f6f4ef = 6.2:1.
 *  Watch out for #9ca3af that sat on the old dark-green hero: #706d65 on ink
 *  is only 3.3:1 — use text-paper/60 or #c9c6bd there instead.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

const GROUPS = [
  ['#2f3cf5', ['#1dbf73']],
  ['#2330c8', ['#19a463', '#108a50', '#0f8f56', '#1e5aa8', '#1d4ed8', '#3f4bb5']],
  ['#1a2496', ['#0f5f3c', '#2d3794']],
  ['#b4bbff', ['#8ee7bf']],
  ['#c9cdfb', ['#bcebd5', '#b8e6d0', '#bfdbfe']],
  ['#dfe2fd', ['#d9f6e8', '#d3f4e3']],
  ['#eceefe', ['#e8faf1', '#eef6ff', '#eff6ff', '#eef2ff']],
  ['#f4f5fe', ['#f4fcf8', '#f0faf5', '#fafefb', '#f3fcf7', '#f4fdf8']],
  ['#1a1a17', ['#0f4c3a', '#404145', '#111827', '#2b2c2f']],
  ['#121210', ['#0d3f30', '#0c3d2f']],
  ['#3a3934', ['#374151']],
  ['#5f5d57', ['#62646a', '#6b7280', '#74767e']],
  ['#706d65', ['#95979d', '#9ca3af']],
  ['#c9c6bd', ['#cfd4d0']],
  ['#cbc6ba', ['#c5c6c9', '#d1d5db', '#d5d6d9']],
  ['#e3dfd6', ['#e4e5e7', '#e5e7eb']],
  ['#eeebe4', ['#f1f3f5', '#f3f4f6', '#f1f1f2', '#f3f4f5', '#efeff0', '#eef2f6']],
  ['#f6f4ef', ['#f9fafb', '#fafafa', '#f7f7f7', '#f5f5f5']],
  ['#8a5a00', ['#8a6508', '#6b5208', '#5c4300', '#8a6d0b', '#b8860b', '#9a5b00', '#92400e', '#b7791f', '#b08a0e']],
  ['#ecd3a3', ['#f5deb3', '#f3d9a4', '#f5d68a', '#fde68a']],
  ['#fbf0dc', ['#fdf6e3', '#fffaf0', '#fffbeb', '#fffaeb', '#fff4e0']],
  ['#b42318', ['#c0392b', '#b91c1c', '#991b1b']],
  ['#f4c7c2', ['#f5c6cb', '#fecaca']],
  ['#fdecea', ['#fdecec', '#fef2f2']],
]

export const MAP = Object.fromEntries(
  GROUPS.flatMap(([to, froms]) => froms.map((f) => [f, to]))
)

// Sanity: idempotency (no target is also a source).
for (const to of Object.values(MAP)) {
  if (MAP[to]) throw new Error(`mapping is not idempotent: ${to} is both source and target`)
}

const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css', '.mdx', '.html'])
const SKIP_DIRS = new Set(['node_modules', '.next', '.git'])
const SKIP_FILES = new Set([join('src', 'app', 'globals.css')])

// Match #rrggbb, optionally followed by a 2-digit alpha (kept as-is), but
// never a longer run of hex digits (so hashes/ids aren't touched).
const HEX = /#([0-9a-fA-F]{6})(?=(?:[0-9a-fA-F]{2})?(?![0-9a-fA-F]))/g

function walk(p, out) {
  const st = statSync(p)
  if (st.isDirectory()) {
    for (const name of readdirSync(p)) {
      if (SKIP_DIRS.has(name)) continue
      walk(join(p, name), out)
    }
  } else if (EXTS.has(extname(p))) {
    out.push(p)
  }
  return out
}

const args = process.argv.slice(2)
const write = args.includes('--write')
const targets = args.filter((a) => !a.startsWith('--'))
const roots = targets.length ? targets : ['src']
const cwd = process.cwd()

let filesChanged = 0
let total = 0
const perColor = {}

for (const root of roots) {
  for (const file of walk(root, [])) {
    const rel = relative(cwd, file)
    if (SKIP_FILES.has(rel)) continue
    const src = readFileSync(file, 'utf8')
    let n = 0
    const next = src.replace(HEX, (m, hex) => {
      const to = MAP[`#${hex.toLowerCase()}`]
      if (!to) return m
      n++
      perColor[hex.toLowerCase()] = (perColor[hex.toLowerCase()] ?? 0) + 1
      return to
    })
    if (n) {
      filesChanged++
      total += n
      console.log(`${write ? 'updated' : 'would update'} ${rel} (${n})`)
      if (write) writeFileSync(file, next)
    }
  }
}

console.log(
  `\n${write ? 'Replaced' : 'Would replace'} ${total} colour(s) in ${filesChanged} file(s).`
)
for (const [from, count] of Object.entries(perColor).sort((a, b) => b[1] - a[1])) {
  console.log(`  #${from} -> ${MAP['#' + from]}  ×${count}`)
}
if (!write) console.log('\nDry run. Re-run with --write to apply.')
