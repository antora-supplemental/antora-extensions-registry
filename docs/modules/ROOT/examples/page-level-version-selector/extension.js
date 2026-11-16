'use strict'

/**
 * Page-level version selector (RFC 0001 spike).
 *
 * Written against the Antora 3.2.0-era tree on dev-centr/antora branch
 * feature/page-level-version-selector (commit 4319072e). The encoding-guard
 * commit on that branch is not copied; the encoding guard already lives in
 * agent-rules. Design record only. Do not keep developing a full Antora fork.
 *
 * Design note: docs/modules/ROOT/pages/design/page-level-version-selector.adoc
 *
 * Scans classified pages for AsciiDoc attrs:
 *   :page-version-track: <track-id>
 *   :page-version-track-version: <version>   (required for versioned members)
 *   :page-version-track-display: <label>    (optional UI label)
 *
 * When a track has 2+ distinct track versions, registers a versionless
 * selector page at the earliest member's module path under
 * `versions/<track-id>/index.adoc` (spike URL; core may own routing later).
 *
 * Playbook:
 *
 *   antora:
 *     extensions:
 *       - ./page-level-version-selector-extension.js
 *         mode: selector          # selector | alias
 *         short_circuit_single: true
 *
 * Upstream: deferred.
 */

function readPageAttr (page, name) {
  const doc = page.asciidoc && page.asciidoc.document
  if (!doc) return undefined
  const value = doc.getAttribute(name)
  return value === undefined ? undefined : String(value).trim()
}

function trackKey (page) {
  const component = page.src && page.src.component
  const track = readPageAttr(page, 'page-version-track')
  if (!component || !track) return null
  return `${component}::${track}`
}

function versionLabel (page, version) {
  return readPageAttr(page, 'page-version-track-display') || version
}

function pageXref (page) {
  const { component, version, module: moduleName, relative } = page.src
  const coord = version ? `${version}@${component}` : component
  if (!moduleName || moduleName === 'ROOT') return `${coord}::${relative}`
  return `${coord}:${moduleName}:${relative}`
}

function buildSelectorAsciiDoc (trackId, members) {
  const sorted = members.slice().sort((a, b) => {
    const av = readPageAttr(a, 'page-version-track-version') || ''
    const bv = readPageAttr(b, 'page-version-track-version') || ''
    return av.localeCompare(bv, undefined, { numeric: true })
  })
  const title = sorted[0].title || trackId
  const lines = [
    `= ${title} versions`,
    `:page-version-track: ${trackId}`,
    '',
    'Select a version of this document to continue.',
    '',
  ]
  for (const page of sorted) {
    const version = readPageAttr(page, 'page-version-track-version')
    if (!version) continue
    const label = versionLabel(page, version)
    lines.push(`* xref:${pageXref(page)}[${label}]`)
  }
  lines.push('')
  return lines.join('\n')
}

function registerSelectorPage (contentCatalog, trackId, members, componentName) {
  const relative = `versions/${trackId}/index.adoc`
  const path = `modules/ROOT/pages/${relative}`
  contentCatalog.addFile({
    contents: Buffer.from(buildSelectorAsciiDoc(trackId, members)),
    path,
    src: {
      component: componentName,
      version: '',
      module: 'ROOT',
      family: 'page',
      relative,
      basename: relative,
      stem: 'index',
      extname: '.adoc',
      path,
    },
  })
}

function registerLatestAlias (contentCatalog, latestPage, trackId, componentName) {
  const relative = `versions/${trackId}/index.adoc`
  contentCatalog.addFile({
    src: {
      component: componentName,
      version: '',
      module: 'ROOT',
      family: 'alias',
      relative,
    },
    rel: latestPage,
  })
}

function applyPageVersionTracks (contentCatalog, { mode, shortCircuitSingle }) {
  const tracks = new Map()
  contentCatalog.findPages({}).forEach((page) => {
    const key = trackKey(page)
    if (!key) return
    if (!readPageAttr(page, 'page-version-track-version')) return
    if (!tracks.has(key)) tracks.set(key, [])
    tracks.get(key).push(page)
  })

  tracks.forEach((members, key) => {
    const [componentName, trackId] = key.split('::')
    const unique = new Map()
    members.forEach((page) => {
      const version = readPageAttr(page, 'page-version-track-version')
      if (version && !unique.has(version)) unique.set(version, page)
    })
    const list = [...unique.values()]
    if (list.length < 2) return

    if (mode === 'alias') {
      registerLatestAlias(contentCatalog, list[list.length - 1], trackId, componentName)
      return
    }
    if (shortCircuitSingle && list.length === 1) {
      registerLatestAlias(contentCatalog, list[0], trackId, componentName)
      return
    }
    registerSelectorPage(contentCatalog, trackId, list, componentName)
  })
}

module.exports.register = function ({ config = {} }) {
  const modeRaw = config.mode == null ? 'selector' : String(config.mode).toLowerCase()
  const mode = modeRaw === 'alias' ? 'alias' : 'selector'
  const shortCircuitRaw =
    config.shortCircuitSingle !== undefined
      ? config.shortCircuitSingle
      : config.short_circuit_single
  const shortCircuitSingle = shortCircuitRaw !== false

  this.once('contentClassified', ({ contentCatalog }) => {
    applyPageVersionTracks(contentCatalog, { mode, shortCircuitSingle })
  })
}

module.exports._internal = {
  trackKey,
  buildSelectorAsciiDoc,
  applyPageVersionTracks,
}
