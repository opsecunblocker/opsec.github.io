#!/usr/bin/env node
/* ==========================================================================
   tools/build.js — DEVELOPMENT ONLY.
   Renders the Jekyll site locally so we can preview it without Ruby.
   GitHub Pages ignores this folder (it's listed under `exclude` in _config.yml)
   and builds the real site with Jekyll.

   Usage:  node tools/build.js [--out _site] [--baseurl ""]
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Liquid } = require('liquidjs');
const MarkdownIt = require('markdown-it');

const ROOT = path.resolve(__dirname, '..');

/* --- args ---------------------------------------------------------------- */
const argv = process.argv.slice(2);
function arg(name, fallback) {
  const i = argv.indexOf('--' + name);
  return i !== -1 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
}
const OUT = path.resolve(ROOT, arg('out', '_site'));
const BASEURL_OVERRIDE = arg('baseurl', null);

/* --- config -------------------------------------------------------------- */
const config = yaml.load(fs.readFileSync(path.join(ROOT, '_config.yml'), 'utf8')) || {};
const baseurl = BASEURL_OVERRIDE !== null ? BASEURL_OVERRIDE : (config.baseurl || '');
const siteUrl = config.url || '';

/* --- engines ------------------------------------------------------------- */
const md = new MarkdownIt({ html: true, linkify: true, breaks: false });

const engine = new Liquid({
  root: [path.join(ROOT, '_includes'), ROOT],
  partials: path.join(ROOT, '_includes'),
  extname: '.html',
  strictFilters: false
});

function ensureLeadingSlash(s) { return String(s).charAt(0) === '/' ? s : '/' + s; }
function isAbsolute(u) { return /^https?:\/\//i.test(u || ''); }

engine.registerFilter('relative_url', function (input) {
  if (input === null || input === undefined) return '';
  input = String(input);
  if (isAbsolute(input)) return input;
  return (baseurl + ensureLeadingSlash(input)).replace(/\/{2,}/g, '/');
});
engine.registerFilter('absolute_url', function (input) {
  if (input === null || input === undefined) return '';
  input = String(input);
  if (isAbsolute(input)) return input;
  return (siteUrl + baseurl + ensureLeadingSlash(input)).replace(/(?<!:)\/{2,}/g, '/');
});

/* Jekyll allows `{% include file.html key=value %}`; liquidjs wants
   `{% include 'file.html', key: value %}`. Rewrite for the local build. */
function normaliseIncludes(src) {
  return src.replace(/\{%-?\s*include\s+([^\s%'"]+?)\s+([^%{}]*?)\s*-?%\}/g,
    function (match, name, rawArgs) {
      const args = rawArgs.split(',')
        .map(function (s) { return s.trim(); })
        .filter(Boolean)
        .map(function (a) {
          const m = /^(\w+)\s*=\s*(.+)$/.exec(a);
          return m ? m[1] + ': ' + m[2] : a;
        });
      return '{%- include \'' + name + '\'' +
        (args.length ? ', ' + args.join(', ') : '') + ' -%}';
    });
}

/* --- front matter -------------------------------------------------------- */
function parseFrontMatter(src) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(src);
  if (!m) return { data: {}, content: src };
  return { data: yaml.load(m[1]) || {}, content: m[2] };
}

function readDoc(file) {
  const src = fs.readFileSync(file, 'utf8');
  const parsed = parseFrontMatter(src);
  return { file: file, data: parsed.data, content: parsed.content };
}

/* --- discover content ---------------------------------------------------- */
const skipDirs = new Set(['_site', 'tools', 'node_modules', '.git']);
const skipFiles = new Set(['_config.yml', 'package.json', 'package-lock.json',
                           'README.md', 'CONTRIBUTING.md', 'Gemfile', 'Gemfile.lock']);

function walk(dir, out) {
  out = out || [];
  if (!fs.existsSync(dir)) return out;
  fs.readdirSync(dir).forEach(function (name) {
    if (name.charAt(0) === '.' || skipDirs.has(name)) return;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (!skipFiles.has(name)) out.push(full);
  });
  return out;
}

/* collections */
const collections = {};
Object.keys(config.collections || {}).forEach(function (name) {
  const dir = path.join(ROOT, '_' + name);
  if (!fs.existsSync(dir)) return;
  const permalink = (config.collections[name] || {}).permalink || '/:collection/:path:output_ext';
  const items = fs.readdirSync(dir)
    .filter(function (f) { return /\.(md|html|markdown)$/i.test(f); })
    .sort()
    .map(function (f) {
      const doc = readDoc(path.join(dir, f));
      const slug = f.replace(/\.(md|html|markdown)$/i, '');
      const relPath = '/' + path.relative(ROOT, path.join(dir, f)).split(path.sep).join('/');
      return {
        data: doc.data,
        content: doc.content,
        slug: slug,
        relativePath: relPath,
        url: '/' + name + '/' + slug + '/',
        outputPath: path.join(OUT, name, slug, 'index.html')
      };
    });
  collections[name] = items;
});

/* defaults (layout/values per scope) */
function applyDefaults(data, type) {
  (config.defaults || []).forEach(function (entry) {
    const scope = entry.scope || {};
    if (scope.type && scope.type !== type) return;
    Object.keys(entry.values || {}).forEach(function (k) {
      if (data[k] === undefined) data[k] = entry.values[k];
    });
  });
  return data;
}

/* standalone pages */
const pages = walk(ROOT)
  .filter(function (f) { return /\.(md|html|markdown)$/i.test(f); })
  .filter(function (f) { return !path.relative(ROOT, f).split(path.sep)[0].startsWith('_'); })
  .filter(function (f) { return !/^(Gemfile|package|README|CONTRIBUTING)/i.test(path.basename(f)); })
  .map(function (f) {
    const doc = readDoc(f);
    const rel = '/' + path.relative(ROOT, f).split(path.sep).join('/');
    const isHtml = /\.html$/i.test(rel);
    const noExt = rel.replace(/\.(md|html|markdown)$/i, '');
    const url = noExt === '/index' ? '/' : (isHtml ? rel : noExt + '/');
    // .html pages keep their filename (404.html); .md pages become /name/index.html
    const outputPath = isHtml
      ? path.join(OUT, rel)
      : (noExt === '/index'
          ? path.join(OUT, 'index.html')
          : path.join(OUT, noExt.slice(1), 'index.html'));
    return { data: doc.data, content: doc.content, url: url, outputPath: outputPath, relPath: rel };
  });

/* --- the site object handed to Liquid ------------------------------------ */
const site = Object.assign({}, config, {
  baseurl: baseurl,
  url: siteUrl,
  time: new Date(),
  games: (collections.games || []).map(function (d) {
    return Object.assign({}, d.data, { url: d.url, slug: d.slug || d.data.slug });
  })
});

/* --- render -------------------------------------------------------------- */
function layoutFile(name) {
  return path.join(ROOT, '_layouts', name + '.html');
}

async function renderContent(source, ctx, filename) {
  return engine.parseAndRender(normaliseIncludes(source), ctx, { filename: filename || 'page' });
}

async function applyLayout(html, layoutName, ctx) {
  let out = html;
  let name = layoutName;
  const seen = new Set();

  while (name) {
    if (seen.has(name) || !fs.existsSync(layoutFile(name))) break;
    seen.add(name);
    const raw = fs.readFileSync(layoutFile(name), 'utf8');
    const parsed = parseFrontMatter(raw);
    const filename = path.relative(ROOT, layoutFile(name));
    out = await renderContent(parsed.content, Object.assign({}, ctx, { content: out }), filename);
    name = parsed.data.layout;
  }
  return out;
}

async function renderDoc(doc, type) {
  const data = applyDefaults(Object.assign({}, doc.data), type);
  const filename = doc.relPath || doc.relativePath || 'page';

  // Jekyll only runs a Markdown converter on .md/.markdown — .html is Liquid only.
  const isMarkdown = /\.(md|markdown)$/i.test(filename);
  const body0 = isMarkdown ? md.render(doc.content || '') : (doc.content || '');

  const page = Object.assign({}, data, {
    url: doc.url,
    slug: data.slug || doc.slug,
    content: body0,
    path: doc.relPath || doc.relativePath
  });

  const ctx = { site: site, page: page };
  const body = await renderContent(page.content, ctx, filename);
  const html = await applyLayout(body, page.layout, Object.assign({}, ctx, { content: body }));

  fs.mkdirSync(path.dirname(doc.outputPath), { recursive: true });
  fs.writeFileSync(doc.outputPath, html);
  return doc.outputPath;
}

/* --- static assets ------------------------------------------------------- */
function copyStatic() {
  const files = walk(ROOT).filter(function (f) {
    return !/\.(md|html|markdown)$/i.test(f);
  });
  files.forEach(function (f) {
    const rel = path.relative(ROOT, f);
    const dest = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(f, dest);
  });
}

/* --- go ------------------------------------------------------------------ */
(async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  copyStatic();

  let count = 0;
  for (const doc of pages) { await renderDoc(doc, 'pages'); count++; }
  for (const name of Object.keys(collections)) {
    for (const doc of collections[name]) { await renderDoc(doc, name); count++; }
  }

  console.log('Built ' + count + ' pages → ' + path.relative(ROOT, OUT) +
              '  (baseurl="' + baseurl + '")');
})().catch(function (err) {
  console.error('Build failed:', err);
  process.exit(1);
});
