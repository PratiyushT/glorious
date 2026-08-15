#!/usr/bin/env python3
"""
Veylin's convention checker — the rules `shopify theme check` does not know.

    python bin/veylin-lint.py            # all rules
    python bin/veylin-lint.py --list     # what it checks and why
    python bin/veylin-lint.py -o R05     # one rule

Exit 0 clean, 1 on any error. Warnings never fail the run.

This exists because Veylin's conventions were prose in CLAUDE.md, which holds
only as long as the next reader is diligent. Every rule below is here because
the thing it checks has actually gone wrong in this repo, or because Shopify
validates it server-side and only tells you at upload time.

`bin/` is not one of Shopify's theme directories, so nothing here ships.
"""

import json
import os
import re
import sys
from collections import OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Shopify's own directories. Anything else in the repo is tooling.
THEME_DIRS = ('assets', 'blocks', 'config', 'layout', 'locales', 'sections',
              'snippets', 'templates')

SCHEMA_RE = re.compile(r'{%-?\s*schema\s*-?%}(.*?){%-?\s*endschema\s*-?%}', re.S)

problems = []   # (level, rule, path, message)


def err(rule, path, msg):
    problems.append(('error', rule, path, msg))


def warn(rule, path, msg):
    problems.append(('warn', rule, path, msg))


# ---------------------------------------------------------------- helpers

def rel(p):
    return os.path.relpath(p, ROOT).replace('\\', '/')


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def read_json(p):
    """Shopify's JSON files may carry /* */ comments; json does not."""
    return json.loads(re.sub(r'/\*.*?\*/', '', read(p), flags=re.S))


def walk_files(subdir, ext):
    d = os.path.join(ROOT, subdir)
    if not os.path.isdir(d):
        return
    for name in sorted(os.listdir(d)):
        if name.endswith(ext):
            yield os.path.join(d, name)


def schemas():
    """(path, parsed schema) for every section and block that has one.

    Parses the schema block rather than pattern-matching inside it. The
    recorded one-liner used a regex that could not cross a brace, so a range
    carrying `visible_if: "{{ ... }}"` was skipped in silence — see R01.
    """
    for sub in ('sections', 'blocks'):
        for p in walk_files(sub, '.liquid'):
            for body in SCHEMA_RE.findall(read(p)):
                try:
                    yield p, json.loads(body)
                except json.JSONDecodeError as e:
                    err('R00', rel(p), 'schema is not valid JSON: %s' % e)


def each_setting(node):
    """Every settings object anywhere in a schema, blocks and presets included."""
    if isinstance(node, dict):
        if 'type' in node and 'id' in node:
            yield node
        for v in node.values():
            for s in each_setting(v):
                yield s
    elif isinstance(node, list):
        for v in node:
            for s in each_setting(v):
                yield s


def theme_settings():
    return read_json(os.path.join(ROOT, 'config', 'settings_schema.json'))


def locale(name):
    return read_json(os.path.join(ROOT, 'locales', name))


# Shopify resolves `'k' | t: count: n` against k.one / k.other rather than a
# string at k, so a pluralised key is a dict and is still resolved.
PLURALS = {'zero', 'one', 'two', 'few', 'many', 'other'}


def resolves(tree, dotted):
    node = tree
    for k in dotted.split('.'):
        if not isinstance(node, dict) or k not in node:
            return False
        node = node[k]
    if isinstance(node, str):
        return True
    return isinstance(node, dict) and bool(PLURALS & set(node))


def strip_comments(src):
    """Blank out {% comment %} blocks, keeping line numbers intact.

    A rule that scans for a pattern will otherwise flag the prose in CLAUDE.md's
    own voice explaining why that pattern is banned — which is exactly what
    happened to R08 on its first run.
    """
    def blank(m):
        return re.sub(r'[^\n]', ' ', m.group(0))

    # Tag form: {%- comment -%} ... {%- endcomment -%}
    src = re.sub(r'{%-?\s*comment\s*-?%}.*?{%-?\s*endcomment\s*-?%}',
                 blank, src, flags=re.S)

    # Inside a {%- liquid -%} tag the keywords are bare, one per line, with no
    # braces of their own — so the tag form above never sees them.
    def scrub(m):
        return re.sub(r'^[ \t]*comment\b.*?^[ \t]*endcomment\b',
                      blank, m.group(0), flags=re.S | re.M)
    return re.sub(r'{%-?\s*liquid\b.*?-?%}', scrub, src, flags=re.S)


def strip_inert(src):
    """Blank regions that are not HTML markup, keeping line numbers intact.

    <style> and <script> bodies, HTML comments and CSS/JS block comments. The
    structural rules below look for attributes, and prose *about* an attribute
    is not an occurrence of it — R08 flagged its own explanation of why
    `href="#"` is banned, twice, in two different comment syntaxes.
    """
    def blank(m):
        return re.sub(r'[^\n]', ' ', m.group(0))
    for pat in (r'<style\b.*?</style>', r'<script\b.*?</script>',
                r'<!--.*?-->', r'/\*.*?\*/'):
        src = re.sub(pat, blank, src, flags=re.S | re.I)
    return src


def strip_liquid(src):
    """Blank out {% ... %} and {{ ... }}, keeping line numbers intact.

    Liquid inside an HTML tag can contain `>` — `{%- if thumb_crop_h > 0 %}`
    ends an <img> early for any regex reading up to the next angle bracket,
    which is how R10 first reported an image that carries its LQIP two lines
    further down.
    """
    def blank(m):
        return re.sub(r'[^\n]', ' ', m.group(0))
    src = re.sub(r'{%.*?%}', blank, src, flags=re.S)
    return re.sub(r'{{.*?}}', blank, src, flags=re.S)


# ---------------------------------------------------------------- rules

def R01_range_steps():
    """Shopify validates range steps server-side; theme check does not.

    (default - min) must divide by step, and (max - min) / step must be <= 101,
    or the upload fails with `default must be a step in the range`.
    """
    def check(where, s):
        if s.get('type') != 'range':
            return
        mn, mx = s.get('min', 0), s.get('max', 0)
        st = s.get('step', 1) or 1
        d = s.get('default', mn)
        if (d - mn) % st:
            err('R01', where, '%s: default %s is not a step from min %s (step %s)'
                % (s.get('id'), d, mn, st))
        if (mx - mn) / st > 101:
            err('R01', where, '%s: %s steps, Shopify allows 101'
                % (s.get('id'), int((mx - mn) / st)))

    for s in each_setting(theme_settings()):
        check('config/settings_schema.json', s)
    for p, sc in schemas():
        for s in each_setting(sc):
            check(rel(p), s)


def R02_select_defaults():
    """A select's default must be one of its own option values.

    Shopify rejects this at upload. It is the easiest thing to break while
    renaming option ids, which the step conversion does constantly.
    """
    def check(where, s):
        if s.get('type') != 'select' or 'default' not in s:
            return
        vals = [o.get('value') for o in s.get('options', [])]
        if s['default'] not in vals:
            err('R02', where, '%s: default %r is not among its options %s'
                % (s.get('id'), s['default'], vals))

    for s in each_setting(theme_settings()):
        check('config/settings_schema.json', s)
    for p, sc in schemas():
        for s in each_setting(sc):
            check(rel(p), s)


def R03_schema_translations():
    """Every `t:` in a schema must resolve in en.default.schema.json.

    theme check's TranslationKeyExists reads section schemas but NOT
    config/settings_schema.json, so a theme setting can point at a key nobody
    wrote and the theme still returns []. The editor then shows the raw path
    where the help text should be, which is how
    settings_schema.cart.cart_image_fit.info shipped missing.
    """
    tree = locale('en.default.schema.json')

    def keys(node):
        if isinstance(node, str):
            return [node[2:]] if node.startswith('t:') else []
        if isinstance(node, dict):
            return [k for v in node.values() for k in keys(v)]
        if isinstance(node, list):
            return [k for v in node for k in keys(v)]
        return []

    for k in sorted(set(keys(theme_settings()))):
        if not resolves(tree, k):
            err('R03', 'config/settings_schema.json', 'unresolved t: %s' % k)
    for p, sc in schemas():
        for k in sorted(set(keys(sc))):
            if not resolves(tree, k):
                err('R03', rel(p), 'unresolved t: %s' % k)


def R04_storefront_translations():
    """Every `'x.y' | t` in Liquid must resolve in en.default.json."""
    tree = locale('en.default.json')
    pat = re.compile(r"'([a-z0-9_]+(?:\.[a-z0-9_]+)+)'\s*\|\s*t\b")
    for sub in ('sections', 'blocks', 'snippets', 'templates', 'layout'):
        for p in walk_files(sub, '.liquid'):
            for k in sorted(set(pat.findall(read(p)))):
                if not resolves(tree, k):
                    err('R04', rel(p), "unresolved | t: '%s'" % k)


def R05_step_callers():
    """Every setting feeding a step resolver must offer only ids it knows.

    THE rule that would have caught the footer. section-style.liquid stopped
    understanding numbers when padding became a step, but the footer kept its
    range — so its stored 70 and 30 matched no `when`, space-step.liquid
    printed nothing, and the caller's fallback quietly rendered `lg` for both.
    The footer went from ~42/27.6px to 89.6/89.6 and nothing in the source
    looked wrong.

    A resolver with a fallback absorbs a caller you forgot to convert and
    reports nothing. So: find each resolver's known ids, find every setting
    that feeds it, and assert the setting is a select whose every option and
    whose default are ids the resolver actually has.
    """
    resolvers = {}
    for p in walk_files('snippets', '.liquid'):
        name = os.path.basename(p)[:-7]
        if not name.endswith('-step'):
            continue
        src = read(p)
        ids = set(re.findall(r"when\s+'([^']+)'", src))
        # scale-step nests scale names over step names; the scale names are
        # its first case level and are not step ids.
        scales = set(re.findall(r"case\s+scale\s*-%\}(.*)", src, re.S))
        if scales:
            ids -= set(re.findall(r"when\s+'([a-z_]+)'\s*-%\}\s*\{%-\s*case", src))
        resolvers[name] = ids
    if not resolvers:
        return

    # which settings are handed to a resolver, and by whom
    fed = {}   # setting id -> resolver name
    call = re.compile(r"render\s+'([a-z-]+-step)'[^%]*?step:\s*([a-zA-Z0-9_.]+)")
    for sub in ('snippets', 'sections', 'blocks', 'layout'):
        for p in walk_files(sub, '.liquid'):
            for res, expr in call.findall(read(p)):
                if res not in resolvers:
                    err('R05', rel(p), "renders unknown resolver '%s'" % res)
                    continue
                sid = expr.rsplit('.', 1)[-1]
                if expr.startswith(('settings.', 'section.settings.',
                                    'block.settings.')) or expr in ('padding_top',
                                                                    'padding_bottom'):
                    fed[sid] = res

    # section-style takes padding_top/padding_bottom from its callers, so those
    # two ids are fed to space-step wherever a section declares them.
    for sid in ('padding_top', 'padding_bottom'):
        fed.setdefault(sid, 'space-step')

    # `inherit` is the documented sentinel for "leave it to the theme setting".
    # The caller tests for it and never asks the resolver, so it is legitimately
    # absent from every `when` — see snippets/button.liquid. Any OTHER unknown
    # id is still an error, which is the point of the rule.
    SENTINELS = {'inherit'}

    def check(where, s):
        sid = s.get('id')
        if sid not in fed:
            return
        known = resolvers[fed[sid]] | SENTINELS
        if s.get('type') != 'select':
            err('R05', where, "%s feeds %s but is a '%s', not a select — its "
                "value cannot resolve to a step"
                % (sid, fed[sid], s.get('type')))
            return
        for o in s.get('options', []):
            if o.get('value') not in known:
                err('R05', where, '%s offers %r, which %s does not resolve'
                    % (sid, o.get('value'), fed[sid]))
        if 'default' in s and s['default'] not in known:
            err('R05', where, '%s defaults to %r, which %s does not resolve'
                % (sid, s['default'], fed[sid]))

    for s in each_setting(theme_settings()):
        check('config/settings_schema.json', s)
    for p, sc in schemas():
        for s in each_setting(sc):
            check(rel(p), s)


def R06_setting_references():
    """`settings.foo` in Liquid must be a setting that exists.

    Catches the stale reference left behind when a setting is renamed or
    folded into another — the exact failure mode of collapsing thirteen
    fluid endpoints into five steps.
    """
    known = {s.get('id') for s in each_setting(theme_settings())}
    # Only the global `settings` drop. Anything reached through a dot —
    # block.settings.x, section.settings.x, and a captured block such as the
    # footer's `social.settings.facebook` — belongs to that object's own
    # schema, not to config/settings_schema.json.
    pat = re.compile(r'(?<![.\w])settings\.([a-z0-9_]+)')
    for sub in ('sections', 'blocks', 'snippets', 'layout', 'templates'):
        for p in walk_files(sub, '.liquid'):
            for name in sorted(set(pat.findall(strip_comments(read(p))))):
                if name not in known:
                    err('R06', rel(p), 'settings.%s is not defined in '
                        'config/settings_schema.json' % name)


def R07_block_types_exist():
    """A block type is a data contract.

    A stored block whose type no longer exists fails the WHOLE template with
    `Invalid value for type in block 'x'`, and the error names the template
    rather than the rename that caused it.
    """
    have = {os.path.basename(p)[:-7] for p in walk_files('blocks', '.liquid')}
    if not have:
        return
    for p in walk_files('templates', '.json'):
        data = read_json(p)
        for skey, sec in (data.get('sections') or {}).items():
            for bkey, blk in (sec.get('blocks') or {}).items():
                t = blk.get('type', '')
                if t.startswith(('@', 'shopify://')):
                    continue
                # local section blocks are declared in the section's schema
                if t in have:
                    continue
                sec_file = os.path.join(ROOT, 'sections', sec.get('type', '') + '.liquid')
                local = set()
                if os.path.exists(sec_file):
                    for body in SCHEMA_RE.findall(read(sec_file)):
                        try:
                            local = {b.get('type') for b in
                                     json.loads(body).get('blocks', [])}
                        except json.JSONDecodeError:
                            pass
                if t not in local:
                    err('R07', rel(p), "section %s block %s: type '%s' is "
                        "neither a theme block nor declared by %s"
                        % (skey, bkey, t, sec.get('type')))


def R08_no_dead_buttons():
    """No href="#". A control that looks live and goes nowhere is not shipped."""
    pat = re.compile(r'href\s*=\s*"#"')
    for sub in ('sections', 'blocks', 'snippets', 'layout', 'templates'):
        for p in walk_files(sub, '.liquid'):
            for i, line in enumerate(strip_inert(strip_comments(read(p))).splitlines(), 1):
                if pat.search(line):
                    err('R08', '%s:%d' % (rel(p), i), 'href="#"')


def R09_shop_data():
    """No literal shop address, telephone, email or map URL outside config/.

    The shop states these once, as theme settings, because the same facts
    appear in the menu overlay, the footer and the Visit section.
    """
    pats = [
        (r'\bmaps\.google\.|google\.[a-z.]+/maps', 'a map URL'),
        (r'\b[0-9]{3,5}\s+[NSEW]?\s*[A-Z][a-zA-Z]+\s+(?:Blvd|Street|St|Ave|Avenue|Road|Rd|Drive|Dr)\b', 'a street address'),
        (r'\b[a-z0-9._%+-]+@(?!example\.com)[a-z0-9.-]+\.[a-z]{2,}\b', 'an email address'),
    ]
    for sub in ('sections', 'blocks', 'snippets', 'layout', 'templates'):
        for p in walk_files(sub, '.liquid'):
            for i, line in enumerate(strip_inert(strip_comments(read(p))).splitlines(), 1):
                for pat, what in pats:
                    if re.search(pat, line, re.I):
                        err('R09', '%s:%d' % (rel(p), i),
                            '%s belongs in config/, not here' % what)


def R10_image_lqip():
    """Every theme-controlled <img> carries data-image-lqip, or an explicit off.

    A theme-wide contract: a same-image low-quality preview, with branded
    vector logos opting out by name rather than by omission.
    """
    tag = re.compile(r'<img\b[^>]*>', re.S)
    for sub in ('sections', 'blocks', 'snippets', 'layout', 'templates'):
        for p in walk_files(sub, '.liquid'):
            src = strip_liquid(strip_inert(strip_comments(read(p))))
            for m in tag.finditer(src):
                if 'data-image-lqip' in m.group(0):
                    continue
                line = src.count('\n', 0, m.start()) + 1
                warn('R10', '%s:%d' % (rel(p), line),
                     '<img> without data-image-lqip (use "off" for a logo)')


def R11_theme_js_stays_es5():
    """assets/*.js stays ES5, because that is what makes Shopify minify it.

    "Shopify automatically minifies CSS files, as well as JavaScript files that
    use ES5 syntax or lower, when they're requested by the storefront." A theme
    may not ship minified sources of its own, so this auto-minification is the
    only minification the theme gets — and one arrow function silently forfeits
    it for the whole file. Measured on theme.js: ~24 KB gzipped served minified
    against ~37.5 KB as authored.

    Strings and comments are removed first, or `script.async = true` reads as
    the `async` keyword — which is exactly what a first pass here did.
    """
    checks = (
        (r'=>', 'an arrow function'),
        (r'\bconst\b', 'const'),
        (r'\blet\b', 'let'),
        (r'\bclass\s+\w', 'a class'),
        (r'`', 'a template literal'),
        (r'\.\.\.', 'spread/rest'),
        (r'(?<![.\w])(?:async\s+function|await\s+)', 'async/await'),
        (r'\bfor\s*\(\s*(?:var|let|const)?\s*\w+\s+of\b', 'for...of'),
    )
    for p in walk_files('assets', '.js'):
        src = read(p)
        src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
        src = re.sub(r'(?m)^\s*//.*$', '', src)
        src = re.sub(r'(?<!\\)([\'"])(?:\\.|(?!\1).)*\1', 'STR', src)
        for pat, what in checks:
            for m in re.finditer(pat, src):
                line = src.count('\n', 0, m.start()) + 1
                err('R11', '%s:%d' % (rel(p), line),
                    '%s — ES6 here stops Shopify minifying the whole file' % what)


def R12_icon_uid():
    """An icon whose SVG declares an id is rendered with a uid.

    `snippets/icon-bag-plus.liquid` builds a `<mask>`, and a mask needs an id.
    The icon renders four times on the home page, so a fixed id put four
    identical ids in one document — invalid HTML, and every `url(#...)` binds
    to whichever came first, so removing that one silently breaks the rest.

    `{% increment %}` cannot solve it from inside the snippet: `{% render %}`
    isolates increment counters the same way it isolates `assign`, so the
    snippet counts 0 every time. The caller has to pass the token, which makes
    this a convention — and conventions in this repo get a rule.
    """
    # Public calls still go through icon.liquid, but implementations live in
    # flat icon-*.liquid snippets because Shopify does not support a nested
    # snippets/icons directory. Strip comments before looking for ids so prose
    # about the mask does not create a false positive.
    src = strip_comments(read(os.path.join(ROOT, 'snippets', 'icon.liquid')))
    icons = re.findall(r"{%-?\s*when\s+'([a-z0-9-]+)'", src)
    needs = set()
    for name in icons:
        # Only a declared id matters. Fall back to the dispatcher branch for
        # any icon not split into its own implementation file.
        pat = (r"{%-?\s*when\s+'" + re.escape(name)
               + r"'\s*-?%}(.*?)(?={%-?\s*when\s|{%-?\s*endcase)")
        icon_path = os.path.join(ROOT, 'snippets', 'icon-' + name + '.liquid')
        body = read(icon_path) if os.path.exists(icon_path) else ''
        if not body:
            m = re.search(pat, src, re.S)
            body = m.group(1) if m else ''
        if re.search(r'\sid="', strip_comments(body)):
            needs.add(name)
    if not needs:
        return
    call = re.compile(r"{%-?\s*render\s+'icon'\s*,([^%]*?)-?%}", re.S)
    for sub in ('sections', 'blocks', 'snippets', 'layout', 'templates'):
        for p in walk_files(sub, '.liquid'):
            src = strip_inert(strip_comments(read(p)))
            for m in call.finditer(src):
                args = m.group(1)
                got = re.search(r"icon:\s*'([a-z0-9-]+)'", args)
                if not got or got.group(1) not in needs:
                    continue
                if re.search(r'\buid:', args):
                    continue
                line = src.count('\n', 0, m.start()) + 1
                err('R12', '%s:%d' % (rel(p), line),
                    "render 'icon', icon: '%s' without uid: — its SVG declares "
                    'an id and would duplicate' % got.group(1))


def R13_central_icon_library():
    """Theme-owned icon drawings live only in snippets/icon-*.liquid.

    Shopify has no supported snippets/icons subdirectory, so the flat
    icon-*.liquid family is the single source of truth and icon.liquid is its
    public dispatcher. This rule covers the easy escape hatches too: SVG
    strings in JavaScript, character entities in Liquid/JavaScript, and icons
    drawn with CSS `content`.

    Shopify's `placeholder_svg_tag` remains valid. It generates a merchant
    content placeholder at runtime and does not place literal SVG markup in a
    theme file.
    """
    legacy_glyph = re.compile(
        r'&(?:larr|rarr|times|plus|minus);|'
        r'&#(?:9654|10005|10022|10074);|[▶❚]'
    )

    for sub in ('sections', 'blocks', 'snippets', 'layout', 'templates'):
        for p in walk_files(sub, '.liquid'):
            src = strip_inert(strip_comments(read(p)))
            name = os.path.basename(p)
            if not name.startswith('icon-'):
                for m in re.finditer(r'<svg\b', src, re.I):
                    line = src.count('\n', 0, m.start()) + 1
                    err('R13', '%s:%d' % (rel(p), line),
                        'inline SVG belongs in snippets/icon-*.liquid')
            for m in legacy_glyph.finditer(src):
                line = src.count('\n', 0, m.start()) + 1
                err('R13', '%s:%d' % (rel(p), line),
                    'character icon belongs in the shared icon library')

    for p in walk_files('assets', '.js'):
        src = read(p)
        for pat, message in (
                (re.compile(r'<svg\b', re.I),
                 'JavaScript SVG belongs in snippets/icon-*.liquid'),
                (legacy_glyph,
                 'JavaScript character icon belongs in the shared icon library')):
            for m in pat.finditer(src):
                line = src.count('\n', 0, m.start()) + 1
                err('R13', '%s:%d' % (rel(p), line), message)

    css_glyph = re.compile(
        r'content\s*:\s*([\'\"])(?:\+|−|×|▶|❚❚|\\2212)\1', re.I
    )
    for p in walk_files('assets', '.css'):
        src = read(p)
        for m in css_glyph.finditer(src):
            line = src.count('\n', 0, m.start()) + 1
            err('R13', '%s:%d' % (rel(p), line),
                'CSS-generated icon belongs in the shared icon library')


def R14_shared_setting_contracts():
    """Specialised blocks keep the complete settings of the base they extend.

    A resource title is Text whose content comes from a product, collection or
    article;
    Add to cart is Button whose action submits a product form. Their behaviour
    is allowed to differ, but their appearance controls are one editor
    contract. Article metadata is Text and Article excerpt is Rich text for the
    same reason. This catches the quiet drift where one copy gains an option,
    label or visibility rule and its siblings do not. Product and Collection
    title deliberately omit the three Wrap values that hide title text.
    Collection header's title/image arrangement is resource-specific and is
    therefore excluded from its otherwise shared Search-header contract.
    Group's private contextual copies are covered for the same reason.
    """
    def top_settings(path):
        full = os.path.join(ROOT, path)
        match = SCHEMA_RE.search(read(full))
        if not match:
            err('R14', path, 'shared-contract file has no schema')
            return {}
        try:
            schema = json.loads(match.group(1))
        except json.JSONDecodeError:
            # R00 owns the detailed JSON error.
            return {}
        return {s['id']: s for s in schema.get('settings', []) if 'id' in s}

    def normalise(setting, allow_role_default=False):
        # Sections and blocks use different owner drops in visible_if, but the
        # editor contract is otherwise identical.
        value = json.loads(json.dumps(setting).replace(
            'section.settings.', 'block.settings.'))
        if allow_role_default:
            value.pop('default', None)
        return value

    families = (
        ('blocks/text.liquid', {'text'}, set(), (
            'blocks/product_title.liquid',
            'blocks/collection_title.liquid',
            'blocks/article_title.liquid',
            'blocks/article_metadata.liquid',
            'blocks/product_vendor.liquid',
            'blocks/product_price.liquid',
            'blocks/_product-card-option-values.liquid',
            'blocks/_collection-count-text.liquid',
            'blocks/_hotspot-count-text.liquid',
        )),
        ('blocks/rich-text.liquid', {'text'}, set(), (
            'blocks/product_description.liquid',
            'blocks/product_text.liquid',
            'blocks/article_excerpt.liquid',
        )),
        ('blocks/media.liquid', {'video', 'image', 'autoplay', 'loop'}, set(), (
            'blocks/collection_image.liquid',
            'blocks/article_image.liquid',
        )),
        ('blocks/button.liquid', {'button_label', 'button_link'}, {'button_style'}, (
            'blocks/product_variant_picker.liquid',
            'blocks/product_buy_buttons.liquid',
            'blocks/_product-card-add.liquid',
            'blocks/_hotspot-add.liquid',
            'blocks/email-signup.liquid',
            'blocks/discount-offer.liquid',
        )),
        ('blocks/group.liquid', set(),
         {'direction', 'align_vertical', 'content_alignment', 'vertical_gap', 'padding'}, (
            'blocks/_product-card-group.liquid',
            'blocks/_collection-card-group.liquid',
            'blocks/_collection-card-header.liquid',
            'blocks/_hotspot-actions.liquid',
            'blocks/_hotspot-card.liquid',
            'blocks/_interactive-media-list-header.liquid',
            'blocks/accordion.liquid',
            'blocks/_splash-screen.liquid',
            'blocks/_splash-newsletter.liquid',
        )),
        ('sections/main-product.liquid', set(), set(), (
            'sections/featured-product.liquid',
        )),
        ('sections/collection-header.liquid', {
            'layout', 'media_position', 'image_width', 'show_overlay', 'overlay_color',
            'overlay_strength'
        }, {'height'}, (
            'sections/search-header.liquid',
        )),
        ('sections/featured-products.liquid',
         {'collection', 'limit_products', 'products_to_show'},
         {'padding_top', 'padding_bottom'}, (
            'sections/product-recommendations.liquid',
        )),
        ('sections/main-list-collections.liquid',
         {'columns', 'collections_per_page'}, {'padding_bottom'}, (
            'sections/main-blog.liquid',
        )),
    )

    for base_path, excluded, role_defaults, target_paths in families:
        base = top_settings(base_path)
        for target_path in target_paths:
            target = top_settings(target_path)
            for setting_id, base_setting in base.items():
                if setting_id in excluded:
                    continue
                if setting_id not in target:
                    err('R14', target_path, "%s contract is missing setting '%s'"
                        % (base_path, setting_id))
                    continue
                role_default = setting_id in role_defaults
                expected_setting = base_setting
                if (target_path in ('blocks/product_title.liquid',
                                    'blocks/collection_title.liquid',
                                    'blocks/article_title.liquid')
                        and setting_id == 'wrap'):
                    expected_setting = json.loads(json.dumps(base_setting))
                    allowed_wraps = ('default', 'pretty', 'balance')
                    if target_path == 'blocks/product_title.liquid':
                        allowed_wraps += ('minimum_two_lines',)
                        expected_setting['info'] = (
                            't:blocks.product_title.wrap_info')
                    expected_setting['options'] = [
                        option for option in expected_setting.get('options', [])
                        if option.get('value') in allowed_wraps
                    ]
                    if target_path == 'blocks/product_title.liquid':
                        expected_setting['options'].append({
                            'value': 'minimum_two_lines',
                            'label': 't:blocks.product_title.minimum_two_lines'
                        })
                if normalise(expected_setting, role_default) != normalise(
                        target[setting_id], role_default):
                    err('R14', target_path, "%s setting '%s' has drifted from %s"
                        % (base_path, setting_id, base_path))


def R15_shared_renderers():
    """Blocks sharing an editor contract also call its one runtime renderer."""
    contracts = {
        'text-block': (
            'blocks/text.liquid',
            'blocks/product_title.liquid',
            'blocks/collection_title.liquid',
            'blocks/article_title.liquid',
            'blocks/article_metadata.liquid',
            'blocks/product_vendor.liquid',
            'blocks/product_price.liquid',
            'blocks/_product-card-option-values.liquid',
            'blocks/_collection-count-text.liquid',
            'blocks/_hotspot-count-text.liquid',
        ),
        'rich-text-block': (
            'blocks/rich-text.liquid',
            'blocks/product_description.liquid',
            'blocks/product_text.liquid',
            'blocks/article_excerpt.liquid',
        ),
        'media-block': (
            'blocks/media.liquid',
            'blocks/collection_image.liquid',
            'blocks/article_image.liquid',
            'blocks/_collection-card-media.liquid',
        ),
        'button': (
            'blocks/button.liquid',
            'blocks/product_variant_picker.liquid',
            'blocks/product_buy_buttons.liquid',
            'blocks/_product-card-add.liquid',
            'blocks/_hotspot-add.liquid',
            'blocks/email-signup.liquid',
            'sections/cookie-banner.liquid',
        ),
        'layout-group': (
            'blocks/group.liquid',
            'blocks/_product-card-group.liquid',
            'blocks/_collection-card-group.liquid',
            'blocks/_collection-card-header.liquid',
            'blocks/_hotspot-actions.liquid',
            'blocks/_hotspot-card.liquid',
            'blocks/_interactive-media-list-header.liquid',
            'blocks/accordion.liquid',
            'blocks/_splash-screen.liquid',
            'blocks/_splash-newsletter.liquid',
            'sections/group.liquid',
        ),
        'card-price': (
            'blocks/_product-card-price.liquid',
            'blocks/_hotspot-price.liquid',
        ),
        'catalog-header': (
            'sections/collection-header.liquid',
            'sections/search-header.liquid',
        ),
        'huge-text': (
            'blocks/huge-text.liquid',
            'sections/header.liquid',
            'sections/hero.liquid',
            'sections/footer.liquid',
        ),
    }
    for snippet, paths in contracts.items():
        pattern = re.compile(r"render\s+['\"]" + re.escape(snippet) + r"['\"]")
        for path in paths:
            if not pattern.search(strip_comments(read(os.path.join(ROOT, path)))):
                err('R15', path, "shared contract must render '%s'" % snippet)


def R16_shared_button_markup():
    """CTA-style .btn markup is emitted only by snippets/button.liquid.

    Structural controls such as close buttons, carousel arrows and quantity
    steppers deliberately keep their own semantic markup and component class.
    Any element that opts into the theme's Button appearance contract must go
    through the shared renderer so global and local overrides stay aligned.
    """
    class_with_btn = re.compile(
        r'class\s*=\s*([\'\"])[^\'\"]*(?<![\w-])btn(?![\w-])[^\'\"]*\1',
        re.I,
    )
    for sub in ('sections', 'blocks', 'snippets'):
        for path in walk_files(sub, '.liquid'):
            if rel(path) == 'snippets/button.liquid':
                continue
            src = strip_inert(strip_comments(read(path)))
            for match in class_with_btn.finditer(src):
                line = src.count('\n', 0, match.start()) + 1
                err('R16', '%s:%d' % (rel(path), line),
                    "Button appearance markup must render 'button'")


def R17_snippet_graph():
    """Every literal snippet call resolves, and every snippet is reachable.

    A renderer left behind after a component migration still ships as theme
    payload and misleads the next maintainer into extending the wrong code.
    Missing targets fail only when that branch renders, so both directions of
    the graph are release errors.
    """
    have = {os.path.basename(p)[:-7] for p in walk_files('snippets', '.liquid')}
    used = set()
    call = re.compile(r"(?:render|include)\s+['\"]([^'\"]+)['\"]")
    for sub in ('layout', 'sections', 'blocks', 'snippets', 'templates'):
        for path in walk_files(sub, '.liquid'):
            used.update(call.findall(strip_comments(read(path))))

    for name in sorted(used - have):
        err('R17', 'snippets/%s.liquid' % name,
            'literal render/include target does not exist')
    for name in sorted(have - used):
        err('R17', 'snippets/%s.liquid' % name,
            'snippet is orphaned; remove it or connect it to one owner')


def R18_json_composition():
    """JSON templates/groups reference real sections and stay within limits."""
    section_types = {
        os.path.basename(p)[:-7] for p in walk_files('sections', '.liquid')
    }
    json_paths = list(walk_files('templates', '.json'))
    json_paths += [p for p in walk_files('sections', '.json')
                   if os.path.basename(p).endswith('-group.json')]

    for path in json_paths:
        data = read_json(path)
        sections = data.get('sections') or {}
        order = data.get('order') or []
        where = rel(path)

        if len(sections) > 25:
            err('R18', where, '%d sections; Shopify allows 25 per template/group'
                % len(sections))
        if len(order) != len(set(order)):
            err('R18', where, 'order contains duplicate section ids')
        for section_id in order:
            if section_id not in sections:
                err('R18', where, "order references missing section '%s'"
                    % section_id)

        for section_id, section in sections.items():
            section_type = section.get('type', '')
            if section_type not in section_types:
                err('R18', where, "section '%s' uses missing type '%s'"
                    % (section_id, section_type))

            blocks = section.get('blocks') or {}
            block_order = section.get('block_order') or []
            if len(blocks) > 50:
                err('R18', where, "section '%s' has %d blocks; Shopify allows 50"
                    % (section_id, len(blocks)))
            if len(block_order) != len(set(block_order)):
                err('R18', where, "section '%s' block_order has duplicates"
                    % section_id)
            for block_id in block_order:
                if block_id not in blocks:
                    err('R18', where, "section '%s' block_order references "
                        "missing block '%s'" % (section_id, block_id))


def R19_no_runtime_color_literals():
    """Rendered theme code takes colours from settings and semantic tokens.

    Literal values are valid only where Shopify requires the merchant-facing
    colour defaults (`config/settings_schema.json`) and where the merchant's
    saved choices live (`config/settings_data.json`). Executable CSS, Liquid,
    JavaScript and SVG must use scheme variables, `currentColor`, transparent,
    or a value emitted from a setting. Otherwise a component silently stops
    following its selected colour scheme.
    """
    literal = re.compile(
        r'#[0-9a-f]{3,8}\b|'
        r'\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\s*\(',
        re.I,
    )
    named_css = re.compile(
        r'(?<![-\w])(?:black|white|red|blue|green|gray|grey)(?![-\w])',
        re.I,
    )
    named_markup = re.compile(
        r'\b(?:fill|stroke|color)\s*=\s*([\'"])'
        r'(?:black|white|red|blue|green|gray|grey)\1',
        re.I,
    )

    def blank(m):
        return re.sub(r'[^\n]', ' ', m.group(0))

    for path in walk_files('assets', '.css'):
        raw = read(path)
        src = re.sub(r'/\*.*?\*/', blank, raw, flags=re.S)
        for match in literal.finditer(raw):
            line = raw.count('\n', 0, match.start()) + 1
            err('R19', '%s:%d' % (rel(path), line),
                'colour literal %r; use a scheme token' % match.group(0))
        for match in named_css.finditer(src):
            line = src.count('\n', 0, match.start()) + 1
            err('R19', '%s:%d' % (rel(path), line),
                'runtime colour literal %r; use a scheme token'
                % match.group(0))

    for path in walk_files('assets', '.js'):
        src = read(path)
        for match in literal.finditer(src):
            line = src.count('\n', 0, match.start()) + 1
            err('R19', '%s:%d' % (rel(path), line),
                'colour literal %r; use a scheme token'
                % match.group(0))

    for sub in ('layout', 'sections', 'blocks', 'snippets', 'templates'):
        for path in walk_files(sub, '.liquid'):
            raw = read(path)
            src = strip_comments(raw)
            src = re.sub(r'<!--.*?-->|/\*.*?\*/|//[^\n]*', blank, src,
                         flags=re.S)
            for match in literal.finditer(raw):
                line = raw.count('\n', 0, match.start()) + 1
                err('R19', '%s:%d' % (rel(path), line),
                    'colour literal %r; use a scheme token or setting value'
                    % match.group(0))
            for match in named_markup.finditer(src):
                line = src.count('\n', 0, match.start()) + 1
                err('R19', '%s:%d' % (rel(path), line),
                    'runtime colour literal %r; use a scheme token or '
                    'setting value' % match.group(0))

    for name in sorted(n for n in os.listdir(ROOT) if n.endswith('.md')):
        path = os.path.join(ROOT, name)
        src = read(path)
        for match in literal.finditer(src):
            line = src.count('\n', 0, match.start()) + 1
            err('R19', '%s:%d' % (rel(path), line),
                'colour literal %r; document the scheme role instead'
                % match.group(0))


def R20_custom_liquid_section():
    """The Theme Store requires one Custom Liquid section on all templates."""
    path = os.path.join(ROOT, 'sections', 'custom-liquid.liquid')
    where = 'sections/custom-liquid.liquid'
    if not os.path.isfile(path):
        err('R20', where, 'mandatory Theme Store section is missing')
        return

    bodies = SCHEMA_RE.findall(read(path))
    if not bodies:
        err('R20', where, 'section has no schema')
        return

    try:
        schema = json.loads(bodies[0])
    except json.JSONDecodeError:
        return  # R00 owns the detailed schema error.

    liquid_ids = [
        setting.get('id') for setting in schema.get('settings', [])
        if setting.get('type') == 'liquid' and setting.get('id')
    ]
    if not liquid_ids:
        err('R20', where, 'section needs a section-level liquid setting')
    else:
        source = strip_comments(read(path))
        if not any(('section.settings.%s' % setting_id) in source
                   for setting_id in liquid_ids):
            err('R20', where, 'liquid setting is never rendered')

    enabled = schema.get('enabled_on')
    disabled = schema.get('disabled_on')
    if enabled is None or '*' not in enabled.get('templates', []):
        err('R20', where, 'section is not enabled on every template')
    elif enabled.get('groups'):
        err('R20', where, 'section belongs to templates, not section groups')
    if disabled is not None and disabled.get('templates'):
        err('R20', where, 'section disables one or more templates')
    if not schema.get('presets'):
        err('R20', where, 'section needs a preset so merchants can add it')


def R21_product_titles_remain_complete():
    """Product title never offers or emits a text-hiding presentation."""
    path = os.path.join(ROOT, 'blocks', 'product_title.liquid')
    where = 'blocks/product_title.liquid'
    match = SCHEMA_RE.search(read(path))
    if not match:
        return  # R00 and R14 own missing or invalid block schema details.
    try:
        schema = json.loads(match.group(1))
    except json.JSONDecodeError:
        return

    settings = {
        setting.get('id'): setting for setting in schema.get('settings', [])
        if setting.get('id')
    }
    if 'always_two_lines' in settings:
        err('R21', where, 'obsolete split-and-ellipsis setting must be removed')

    wrap = settings.get('wrap', {})
    values = [option.get('value') for option in wrap.get('options', [])]
    if values != [
            'default', 'pretty', 'balance', 'minimum_two_lines']:
        err('R21', where, 'Wrap may arrange words but must never hide them')

    source = strip_comments(read(path))
    if 'preserve_content: true' not in source:
        err('R21', where, 'shared Text renderer must reject saved truncation values')
    if ("block.settings.wrap == 'minimum_two_lines'" not in source
            or 'title_words.size > 2' not in source
            or 'product-title__minimum-break' not in source):
        err('R21', where,
            'Minimum two lines must add a non-truncating break for 3+ words')

    card_presets = [
        preset for preset in schema.get('presets', [])
        if preset.get('settings', {}).get('element') == 'h3'
    ]
    if not card_presets or not all(
            preset.get('settings', {}).get('link_to_product') is True
            for preset in card_presets):
        err('R21', where, 'Product card title preset must link the visible title')

    css_where = 'assets/base.css'
    css = strip_comments(read(os.path.join(ROOT, css_where)))
    if 'product-title--always-two-lines' in css or 'product-title__line' in css:
        err('R21', css_where, 'obsolete title splitting CSS remains')
    if '.card--composed > .product-details__title' not in css:
        err('R21', css_where, 'cards do not reserve an expandable title row')
    link_rule = re.search(
        r'\.card--composed \.product-details__title a\s*\{([^}]+)\}', css)
    if not link_rule or 'text-decoration: none' not in link_rule.group(1):
        err('R21', css_where,
            'linked card titles must retain the plain-title presentation')


def R22_collection_data_contract():
    """Collection titles remain complete and collection images stay adapted."""
    title_where = 'blocks/collection_title.liquid'
    image_where = 'blocks/collection_image.liquid'

    def schema_for(where):
        match = SCHEMA_RE.search(read(os.path.join(ROOT, where)))
        if not match:
            return {}
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            return {}

    title_schema = schema_for(title_where)
    title_settings = {
        setting.get('id'): setting
        for setting in title_schema.get('settings', [])
        if setting.get('id')
    }
    title_wrap = title_settings.get('wrap', {})
    title_values = [
        option.get('value') for option in title_wrap.get('options', [])
    ]
    if title_values != ['default', 'pretty', 'balance']:
        err('R22', title_where, 'Collection title Wrap must never hide text')
    title_source = strip_comments(read(os.path.join(ROOT, title_where)))
    if ('closest.collection' not in title_source
            or 'preserve_content: true' not in title_source):
        err('R22', title_where,
            'Collection title must preserve the closest collection title')

    theme_js_where = 'assets/theme.js'
    theme_js = strip_comments(read(os.path.join(ROOT, theme_js_where)))
    if ("character === ' '" not in theme_js
            or "title.appendChild(document.createTextNode(' '));" not in theme_js):
        err('R22', theme_js_where,
            'Animated catalogue titles must retain ordinary wrap-point spaces')

    css_where = 'assets/base.css'
    css = strip_comments(read(os.path.join(ROOT, css_where)))
    catalog_title_rule = re.search(
        r'\.catalog-block-header\s+\[data-catalog-title\]\s*\{([^}]*)\}',
        css,
        re.S,
    )
    if (not catalog_title_rule
            or 'white-space: normal' not in catalog_title_rule.group(1)
            or 'overflow: visible' not in catalog_title_rule.group(1)):
        err('R22', css_where,
            'Catalogue resource titles must wrap completely instead of clipping')

    image_schema = schema_for(image_where)
    resource_settings = [
        setting for setting in image_schema.get('settings', [])
        if setting.get('type') in ('image_picker', 'video', 'collection')
    ]
    if resource_settings:
        err('R22', image_where,
            'Collection image is data-adapted and must not expose an uploader')
    image_source = strip_comments(read(os.path.join(ROOT, image_where)))
    if ('collection.image' not in image_source
            or 'collection.featured_image' not in image_source
            or "render 'media-block'" not in image_source):
        err('R22', image_where,
            'Collection image must use collection data and shared Media')

    media_source = strip_comments(read(os.path.join(
        ROOT, 'snippets', 'media-block.liquid')))
    if ('presentation.focal_point' not in media_source
            or "render 'responsive-image'" not in media_source):
        err('R22', 'snippets/media-block.liquid',
            'shared Media must retain focal points and responsive images')

    template = read(os.path.join(ROOT, 'templates', 'collection.json'))
    if '"type": "collection_title"' not in template:
        err('R22', 'templates/collection.json',
            'default collection header is missing Collection title')
    if '"type": "collection_image"' not in template:
        err('R22', 'templates/collection.json',
            'default collection header is missing Collection image')

    header = read(os.path.join(ROOT, 'sections', 'collection-header.liquid'))
    if 'closest.collection: collection' not in header:
        err('R22', 'sections/collection-header.liquid',
            'Collection header does not pass its collection to child blocks')
    header_schema = schema_for('sections/collection-header.liquid')
    header_settings = {
        setting.get('id'): setting
        for setting in header_schema.get('settings', []) if setting.get('id')
    }
    layout_values = [
        option.get('value')
        for option in header_settings.get('layout', {}).get('options', [])
    ]
    if layout_values != [
            'side_by_side', 'title_over_image', 'image_only', 'title_only']:
        err('R22', 'sections/collection-header.liquid',
            'Collection header title/image layouts have drifted')
    for setting_id in (
            'media_position', 'show_overlay', 'overlay_color',
            'overlay_strength'):
        if setting_id not in header_settings:
            err('R22', 'sections/collection-header.liquid',
                "Collection header is missing '%s'" % setting_id)

    card = read(os.path.join(ROOT, 'blocks', '_collection-card.liquid'))
    group = read(os.path.join(ROOT, 'blocks', '_collection-card-group.liquid'))
    if '"type": "collection_image"' not in card:
        err('R22', 'blocks/_collection-card.liquid',
            'Collection card does not accept Collection image')
    if '"type": "collection_title"' not in group:
        err('R22', 'blocks/_collection-card-group.liquid',
            'Collection card Group does not accept Collection title')

    presets = read(os.path.join(ROOT, 'sections', 'collection-list.liquid'))
    if '"type": "collection_title"' not in presets:
        err('R22', 'sections/collection-list.liquid',
            'collection card presets are missing Collection title')
    if '"type": "collection_image"' not in presets:
        err('R22', 'sections/collection-list.liquid',
            'collection card presets are missing Collection image')


def R23_article_data_contract():
    """Article cards and pages use contextual blocks and shared renderers."""
    title_where = 'blocks/article_title.liquid'
    image_where = 'blocks/article_image.liquid'
    metadata_where = 'blocks/article_metadata.liquid'
    excerpt_where = 'blocks/article_excerpt.liquid'

    def schema_for(where):
        match = SCHEMA_RE.search(read(os.path.join(ROOT, where)))
        if not match:
            return {}
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            return {}

    title_schema = schema_for(title_where)
    title_settings = {
        setting.get('id'): setting
        for setting in title_schema.get('settings', [])
        if setting.get('id')
    }
    title_values = [
        option.get('value')
        for option in title_settings.get('wrap', {}).get('options', [])
    ]
    if title_values != ['default', 'pretty', 'balance']:
        err('R23', title_where, 'Article title Wrap must never hide text')
    title_source = strip_comments(read(os.path.join(ROOT, title_where)))
    if ('closest.article' not in title_source
            or 'preserve_content: true' not in title_source):
        err('R23', title_where,
            'Article title must preserve the closest article title')
    card_title_presets = [
        preset for preset in title_schema.get('presets', [])
        if preset.get('settings', {}).get('element') == 'h2'
    ]
    if not card_title_presets or not all(
            preset.get('settings', {}).get('link_to_article') is True
            for preset in card_title_presets):
        err('R23', title_where,
            'Article card title preset must link the visible title')

    image_schema = schema_for(image_where)
    resource_settings = [
        setting for setting in image_schema.get('settings', [])
        if setting.get('type') in ('image_picker', 'video', 'article')
    ]
    if resource_settings:
        err('R23', image_where,
            'Article image is data-adapted and must not expose an uploader')
    image_source = strip_comments(read(os.path.join(ROOT, image_where)))
    if ('closest.article' not in image_source
            or 'article.image' not in image_source
            or "render 'media-block'" not in image_source
            or 'loading: image_loading' not in image_source):
        err('R23', image_where,
            'Article image must use article data and shared Media loading')

    metadata_source = strip_comments(read(os.path.join(ROOT, metadata_where)))
    if ('closest.article' not in metadata_source
            or "render 'text-block'" not in metadata_source):
        err('R23', metadata_where,
            'Article details must use article data and shared Text')
    excerpt_source = strip_comments(read(os.path.join(ROOT, excerpt_where)))
    if ('closest.article' not in excerpt_source
            or "render 'rich-text-block'" not in excerpt_source):
        err('R23', excerpt_where,
            'Article excerpt must use article data and shared Rich text')
    for contextual_where, contextual_source in (
            (title_where, title_source),
            (image_where, image_source),
            (metadata_where, metadata_source),
            (excerpt_where, excerpt_source)):
        if ("request.page_type == 'article'" not in contextual_source
                or 'source_article = article' not in contextual_source):
            err('R23', contextual_where,
                'Article block must work in the generic Article header')

    card_where = 'blocks/_article-card.liquid'
    card = read(os.path.join(ROOT, card_where))
    for child_type in ('article_image', 'article_metadata', 'article_title',
                       'article_excerpt', 'button'):
        if '"type": "%s"' % child_type not in card:
            err('R23', card_where,
                'Article card is missing %s composition' % child_type)
    if "content_for 'blocks'" not in card:
        err('R23', card_where,
            'Article card must render its merchant-ordered children')

    blog_where = 'templates/blog.json'
    blog_template = read(os.path.join(ROOT, blog_where))
    for child_type in ('article_image', 'article_metadata', 'article_title',
                       'article_excerpt'):
        if '"type": "%s"' % child_type not in blog_template:
            err('R23', blog_where,
                'Default Blog card is missing %s' % child_type)
    if '{{ closest.article.url }}' not in blog_template:
        err('R23', blog_where,
            'Default Blog action must follow the current article')

    article_where = 'templates/article.json'
    article_template = read(os.path.join(ROOT, article_where))
    for child_type in ('article_title', 'article_excerpt',
                       'article_metadata', 'article_image'):
        if '"type": "%s"' % child_type not in article_template:
            err('R23', article_where,
                'Default Article composition is missing %s' % child_type)

    section_where = 'sections/main-article.liquid'
    section_source = strip_comments(read(os.path.join(ROOT, section_where)))
    if "content_for 'blocks', closest.article: article" not in section_source:
        err('R23', section_where,
            'Main article must pass its article to contextual children')
    if 'article.image | image_url' in section_source or 'image_tag:' in section_source:
        err('R23', section_where,
            'Main article must not fork Article image rendering')


def R24_catalog_replacement_lifecycle():
    """A server-rendered catalog replacement must rebind its own root.

    querySelectorAll() searches descendants, never the scope itself. Catalog
    changes replace the owning section and dispatch section:load from that new
    root, so omitting the explicit self-match makes the first change enhanced
    and the next one fall through to a full page navigation.
    """
    where = 'assets/theme.js'
    source = read(os.path.join(ROOT, where))
    if "scope.matches && scope.matches('[data-catalog-section]')" not in source:
        err('R24', where,
            'Catalog init must include a replacement scope that is itself the catalog root')
    if 'catalogRoots.unshift(scope)' not in source:
        err('R24', where,
            'Catalog replacement root must be inserted into the rebinding set')
    if "nextRoot.dispatchEvent(new CustomEvent('shopify:section:load'" not in source:
        err('R24', where,
            'Catalog replacement must dispatch the lifecycle event that rebinds it')


def R25_group_physical_axes():
    """Nested and adapted Groups keep both physical alignment axes effective."""
    css_where = 'assets/base.css'
    source = read(os.path.join(ROOT, css_where))
    group_start = source.find('\n.layout-group__inner {')
    group_rule = source[group_start:source.find('}', group_start) + 1] if group_start >= 0 else ''
    if 'min-height: 100%;' not in group_rule:
        err('R25', css_where,
            'Group inner layout must fill a definite stretched height')
    collection_rule = (
        '.catalog-block-header--layout-side-by-side '
        '.catalog-block-header__content > .layout-group > .layout-group__inner')
    start = source.find(collection_rule)
    rule = source[start:source.find('}', start) + 1] if start >= 0 else ''
    if 'align-items: var(--group-align, stretch);' not in rule:
        err('R25', css_where,
            'Collection header side-by-side layout must respect Group vertical alignment')
    if 'catalog-block-header--vertical-center' in source[source.find(collection_rule):
                                                            source.find('catalog-block-header--has-overlay')]:
        err('R25', css_where,
            'Collection header must not override a nested Group vertical alignment')


def R26_collection_pills_follow_filter_contract():
    """Collection pills use the ordinary catalog loading, motion, and scroll path."""
    controls_where = 'snippets/catalog-controls.liquid'
    controls = read(os.path.join(ROOT, controls_where))
    if controls.count('data-catalog-collection-link') < 2:
        err('R26', controls_where,
            'All collection quick links must identify the filter-like interaction contract')

    js_where = 'assets/theme.js'
    js = read(os.path.join(ROOT, js_where))
    if "link.hasAttribute('data-catalog-collection-link')" not in js:
        err('R26', js_where,
            'Collection quick links must opt into the catalog results scroll')
    for legacy in ('animateCatalogCollection', 'catalogLoadingDelayTimer',
                   'catalog-page--collection-pending'):
        if legacy in js:
            err('R26', js_where,
                'Collection quick links must not keep the legacy %s fork' % legacy)

    section_where = 'sections/main-collection.liquid'
    section = read(os.path.join(ROOT, section_where))
    if 'collection_transition' in section:
        err('R26', section_where,
            'Main collection must expose only the shared product grid motion setting')


def R27_collection_filters_use_shared_buttons():
    """Collection filter navigation uses the shared Button presentation contract."""
    section_where = 'sections/main-collection.liquid'
    section = read(os.path.join(ROOT, section_where))
    if '"id": "collection_filter_button_style"' not in section:
        err('R27', section_where,
            'Main collection must expose a Collection filters Button type')
    if 'quick_button_style: section.settings.collection_filter_button_style' not in section:
        err('R27', section_where,
            'Main collection must pass its Button type to the shared catalog controls')

    filter_where = 'snippets/catalog-filter-button.liquid'
    filter_source = read(os.path.join(ROOT, filter_where))
    if "render 'button'" not in filter_source:
        err('R27', filter_where,
            'Collection filter navigation must render the shared Button')

    controls_where = 'snippets/catalog-controls.liquid'
    controls = read(os.path.join(ROOT, controls_where))
    if "render 'catalog-filter-button'" not in controls:
        err('R27', controls_where,
            'Catalog controls must route collection filters through their shared adapter')

    css_where = 'assets/base.css'
    css = read(os.path.join(ROOT, css_where))
    if '.catalog-pill:not(.btn)' not in css:
        err('R27', css_where,
            'Legacy catalog pill styles must not override the shared Button contract')


def R28_mobile_filter_sheet_closes_downward():
    """The mobile bottom sheet must outrank the shared side-drawer exit rule."""
    where = 'assets/base.css'
    source = read(os.path.join(ROOT, where))
    selector = '.drawer.catalog-filter-overlay--mobile-sheet.is-closing .drawer__panel'
    start = source.find(selector)
    rule = source[start:source.find('}', start) + 1] if start >= 0 else ''
    if 'animation: catalog-sheet-out ' not in rule:
        err('R28', where,
            'Mobile filter sheet close must use the downward catalog-sheet-out animation')


RULES = OrderedDict([
    ('R01', (R01_range_steps, 'range steps are legal (Shopify validates server-side)')),
    ('R02', (R02_select_defaults, "a select's default is one of its options")),
    ('R03', (R03_schema_translations, 'schema t: keys resolve (incl. settings_schema.json)')),
    ('R04', (R04_storefront_translations, 'storefront | t keys resolve')),
    ('R05', (R05_step_callers, 'every step setting offers only ids its resolver knows')),
    ('R06', (R06_setting_references, 'settings.x references a setting that exists')),
    ('R07', (R07_block_types_exist, 'stored block types exist')),
    ('R08', (R08_no_dead_buttons, 'no href="#"')),
    ('R09', (R09_shop_data, 'no literal shop data outside config/')),
    ('R10', (R10_image_lqip, 'every <img> declares data-image-lqip')),
    ('R11', (R11_theme_js_stays_es5, 'assets/*.js stays ES5 so Shopify minifies it')),
    ('R12', (R12_icon_uid, 'an icon declaring an SVG id is rendered with a uid')),
    ('R13', (R13_central_icon_library, 'all icon drawings use the shared icon library')),
    ('R14', (R14_shared_setting_contracts, 'specialised blocks keep their base settings contract')),
    ('R15', (R15_shared_renderers, 'shared contracts call one runtime renderer')),
    ('R16', (R16_shared_button_markup, 'CTA button markup uses the shared renderer')),
    ('R17', (R17_snippet_graph, 'snippet calls resolve and no snippet is orphaned')),
    ('R18', (R18_json_composition, 'JSON templates/groups use real sections within limits')),
    ('R19', (R19_no_runtime_color_literals, 'runtime colours use scheme tokens, never literals')),
    ('R20', (R20_custom_liquid_section, 'Custom Liquid section is addable on every template')),
    ('R21', (R21_product_titles_remain_complete, 'product titles remain complete and linked')),
    ('R22', (R22_collection_data_contract, 'collection titles and images stay data-adapted')),
    ('R23', (R23_article_data_contract, 'article cards and pages stay data-adapted')),
    ('R24', (R24_catalog_replacement_lifecycle, 'catalog replacements rebind their own root')),
    ('R25', (R25_group_physical_axes, 'nested Groups keep both physical alignment axes effective')),
    ('R26', (R26_collection_pills_follow_filter_contract, 'collection pills use the filter interaction contract')),
    ('R27', (R27_collection_filters_use_shared_buttons, 'collection filters use the shared Button contract')),
    ('R28', (R28_mobile_filter_sheet_closes_downward, 'mobile filter sheet closes on its vertical axis')),
])


def main(argv):
    if '--list' in argv:
        for rid, (_, why) in RULES.items():
            print('%s  %s' % (rid, why))
        return 0

    only = None
    if '-o' in argv:
        only = argv[argv.index('-o') + 1].upper()
        if only not in RULES:
            print('unknown rule %s' % only)
            return 2

    for rid, (fn, _) in RULES.items():
        if only and rid != only:
            continue
        fn()

    errors = [p for p in problems if p[0] == 'error']
    warns = [p for p in problems if p[0] == 'warn']

    for level, rid, path, msg in errors + warns:
        print('%-5s %s  %s: %s' % (level.upper(), rid, path, msg))

    ran = 1 if only else len(RULES)
    if errors:
        print('\n%d error(s), %d warning(s) across %d rule(s)'
              % (len(errors), len(warns), ran))
        return 1
    print('clean — %d rule(s), %d warning(s)' % (ran, len(warns)))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
