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

    A Product title is Text whose content comes from a product; Add to cart is
    Button whose action submits a product form. Their behaviour is allowed to
    differ, but their appearance controls are one editor contract. This catches
    the quiet drift where one copy gains an option, label or visibility rule
    and its siblings do not. Group's private contextual copies are covered for
    the same reason.
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
            'blocks/product_vendor.liquid',
            'blocks/product_price.liquid',
            'blocks/_collection-count-text.liquid',
            'blocks/_hotspot-count-text.liquid',
        )),
        ('blocks/rich-text.liquid', {'text'}, set(), (
            'blocks/product_description.liquid',
            'blocks/product_text.liquid',
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
        ('sections/collection-header.liquid', set(), {'height'}, (
            'sections/search-header.liquid',
        )),
        ('sections/featured-products.liquid',
         {'collection', 'limit_products', 'products_to_show'},
         {'padding_top', 'padding_bottom'}, (
            'sections/product-recommendations.liquid',
        )),
        ('sections/main-list-collections.liquid', {'columns'}, {'padding_bottom'}, (
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
                if normalise(base_setting, role_default) != normalise(
                        target[setting_id], role_default):
                    err('R14', target_path, "%s setting '%s' has drifted from %s"
                        % (base_path, setting_id, base_path))


def R15_shared_renderers():
    """Blocks sharing an editor contract also call its one runtime renderer."""
    contracts = {
        'text-block': (
            'blocks/text.liquid',
            'blocks/product_title.liquid',
            'blocks/product_vendor.liquid',
            'blocks/product_price.liquid',
            'blocks/_collection-count-text.liquid',
            'blocks/_hotspot-count-text.liquid',
        ),
        'rich-text-block': (
            'blocks/rich-text.liquid',
            'blocks/product_description.liquid',
            'blocks/product_text.liquid',
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
