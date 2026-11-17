import os, json, re

BASE_ALP = "https://raw.githubusercontent.com/PaulleDemon/awesome-landing-pages/main"
BASE_SW = "https://raw.githubusercontent.com/swebsy/templates/main"

ROOT = "/tmp/alp"
INDUSTRY = {"saas":"SaaS","apps":"Mobile Apps","law":"Legal","ngo":"Nonprofit","others":"Services","portfolio":"Portfolio","products":"E-commerce","realestate":"Real Estate","restaurant":"Restaurant"}
SCREENSHOT_MAP = {"celestialsaas":"celestialsaas.png","saas-ai":"ai-saas.png","saasydark":"saasydark.png","finance":"finance.png","pixaai":"pixa.png","aisales":"aisales.png","chatorigin":"chat-origin.png","navigator":"navigator.png","traveler":"traveler.png","lawfire":"law-fire.png","lawgroup":"lawgroup.png","project-africa":"project-africa.png","carwash":"carwash.png","jamie-portfolio":"jamie-dev-portfolio.png","bella":"bella.png","jrdev":"dev.png","notion":"notion.png","brickproperty":"brickstone.png","bistro":"bistro.png","nutrio":"nutrio.png"}

entries = []
for cat in sorted(os.listdir(os.path.join(ROOT,"src"))):
    catdir = os.path.join(ROOT,"src",cat)
    if not os.path.isdir(catdir) or cat=="tailwind-css": continue
    for folder in sorted(os.listdir(catdir)):
        fdir = os.path.join(catdir,folder)
        if not os.path.isdir(fdir): continue
        hp = os.path.join(fdir,"index.html")
        if not os.path.exists(hp): continue
        shot = SCREENSHOT_MAP.get(folder.lower())
        if not shot: continue
        html = open(hp,encoding="utf-8").read()
        base = f"{BASE_ALP}/src/{cat}/{folder}"
        html = html.replace("../../tailwind-css/tailwind-runtime.css", f"{BASE_ALP}/src/tailwind-css/tailwind-runtime.css")
        html = html.replace("./", base + "/")
        html = html.replace('href="css/', f'href="{base}/css/')
        html = html.replace('src="css/', f'src="{base}/css/')
        # Any remaining relative src (assets/, index.js, ...) still points inside the template folder.
        html = re.sub(r'src="(?!/|https?:|data:|#)([^"]+)"', lambda m: 'src="' + base + '/' + m.group(1) + '"', html)
        html = re.sub(r'srcset="(?!/|https?:|data:|#)([^"]+)"', lambda m: 'srcset="' + base + '/' + m.group(1) + '"', html)
        # Fix known broken references in the upstream sources (missing extension / empty src).
        html = html.replace('homepage/tripadvisor-travellers', 'homepage/tripadvisor-travellers%20choice.png')
        html = re.sub(r'\ssrc=""', '', html)
        entries.append({"id":f"{cat}-{folder}".lower().replace(" ","-"),"name":folder.replace("-"," ").title(),"industry":INDUSTRY.get(cat,"General"),"description":f"{folder.replace('-',' ').title()} — free {INDUSTRY.get(cat,'general').lower()} landing page template (MIT).","screenshot":f"{BASE_ALP}/src/{cat}/screenshots/{shot}","previewUrl":f"{base}/index.html","sourceUrl":"https://github.com/PaulleDemon/awesome-landing-pages","license":"MIT","isFree":True,"html":html,"css":""})

SW_ROOT = "/tmp/swebsy"


def unwrap_layers(css):
    """Flatten @layer blocks so GrapesJS' CSS parser (which predates cascade layers)
    keeps the rules. Order is preserved, so the cascade result is equivalent for these
    utility stylesheets. @layer a,b,c; ordering statements are dropped."""
    out = []
    i = 0
    n = len(css)
    while i < n:
        m = re.match(r'@layer\s+[\w\-.,\s]+;', css[i:])
        if m:
            i += m.end()
            continue
        m = re.match(r'@layer\s+[\w\-]+\s*\{', css[i:])
        if m:
            depth = 1
            j = i + m.end()
            start = j
            while j < n and depth:
                if css[j] == '{': depth += 1
                elif css[j] == '}': depth -= 1
                j += 1
            out.append(css[start:j-1])
            i = j
            continue
        out.append(css[i])
        i += 1
    return ''.join(out)


def flatten_css(css):
    """GrapesJS' CSS engine predates cascade layers, @supports and @property, and it aborts
    the whole parse on an at-rule it does not understand. Unwrap the container at-rules
    (their contents are ordinary rules) and drop @property descriptors, which only affect
    Tailwind CSS variable fallbacks. @media and @font-face are kept."""
    out = []
    i = 0
    n = len(css)
    unwrap = ('@layer', '@supports')
    drop = ('@property',)
    while i < n:
        if css[i] != '@':
            out.append(css[i]); i += 1; continue
        m = re.match(r'@(layer|supports|property)\s+[^{;]+;', css[i:])
        if m:
            i += m.end(); continue
        m = re.match(r'@(layer|supports|property)\s+[^{]+\{', css[i:])
        if m:
            name = '@' + m.group(1)
            depth = 1
            j = i + m.end()
            start = j
            while j < n and depth:
                if css[j] == '{': depth += 1
                elif css[j] == '}': depth -= 1
                j += 1
            if name in unwrap:
                out.append(css[start:j-1])
            i = j
            continue
        out.append(css[i]); i += 1
    return ''.join(out)

def inline_css(site_dir, base):
    """Read every local stylesheet referenced by the template and return one CSS string
    whose url(...) references point at absolute raw URLs. Returns (css, html_without_links)."""
    parts = []
    for name in sorted(os.listdir(os.path.join(site_dir, "css"))) if os.path.isdir(os.path.join(site_dir,"css")) else []:
        if not name.endswith(".css"):
            continue
        content = open(os.path.join(site_dir, "css", name), encoding="utf-8").read()
        # ../fonts/... and ../assets/... are relative to the css/ directory.
        content = content.replace("url(../fonts/", f"url({base}/fonts/")
        content = content.replace("url(../assets/", f"url({base}/assets/")
        content = content.replace("url(./", f"url({base}/")
        content = content.replace("url('../fonts/", f"url('{base}/fonts/")
        content = content.replace('url("../fonts/', f'url("{base}/fonts/')
        content = content.replace("url('../assets/", f"url('{base}/assets/")
        content = content.replace('url("../assets/', f'url("{base}/assets/')
        parts.append(content)
    css = "\n".join(parts)
    # Unwrapping an outer @layer can expose nested @supports/@layer, so iterate to a fixpoint.
    for _ in range(8):
        nxt = flatten_css(css)
        if nxt == css:
            break
        css = nxt
    return css

def strip_local_runtime(html):
    # Drop local stylesheet links (CSS is inlined) and local module scripts (not needed for static render).
    html = re.sub(r'<link[^>]+href="\./css/[^"]+"[^>]*>', '', html)
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.S)
    return html

for folder in sorted(os.listdir(SW_ROOT)):
    fdir = os.path.join(SW_ROOT, folder)
    if not os.path.isdir(fdir): continue
    site = os.path.join(fdir, "site")
    hp = os.path.join(site, "index.html")
    if not os.path.exists(hp): continue
    thumb = os.path.join(fdir, "thumb.webp")
    if not os.path.exists(thumb): continue
    html = open(hp, encoding="utf-8").read()
    base = f"{BASE_SW}/{folder}/site"
    css = inline_css(site, base)
    html = strip_local_runtime(html)
    # Re-root remaining relative asset references (images live in assets/).
    html = html.replace('src="assets/', f'src="{base}/assets/')
    html = html.replace('href="assets/', f'href="{base}/assets/')
    html = html.replace('srcset="assets/', f'srcset="{base}/assets/')
    html = html.replace('url(assets/', f'url({base}/assets/')
    # Remaining relative references (preloads, in-page files, secondary pages).
    html = html.replace('href="./', f'href="{base}/')
    html = html.replace('src="./', f'src="{base}/')
    html = html.replace('href="fonts/', f'href="{base}/fonts/')
    html = html.replace('href="js/', f'href="{base}/js/')
    html = re.sub(r'href="([\w\-]+\.html)(#[^"]*)?"', lambda m: 'href="' + base + '/' + m.group(1) + (m.group(2) or ''), html)
    name = folder.replace("-", " ").title()
    entries.append({"id":f"swebsy-{folder}","name":name,"industry":"Landing Page","description":f"{name} — free landing page template by Swebsy (MIT).","screenshot":f"{BASE_SW}/{folder}/thumb.webp","previewUrl":f"{base}/index.html","sourceUrl":"https://github.com/swebsy/templates","license":"MIT","isFree":True,"html":html,"css":css})

out_path = "/workspace/chats/3eca683cdaeb16a0c45bd736/src/data/templateCatalog.ts"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, "w", encoding="utf-8") as fh:
    fh.write("// Auto-generated: awesome-landing-pages (MIT) + swebsy/templates (MIT).\n")
    fh.write("export type LandingTemplate = {\n  id: string\n  name: string\n  industry: string\n  description: string\n  screenshot: string\n  previewUrl: string\n  sourceUrl: string\n  license: string\n  isFree: boolean\n  html: string\n  css: string\n}\n\n")
    fh.write("export const LANDING_TEMPLATES: LandingTemplate[] = ")
    fh.write(json.dumps(entries, ensure_ascii=False, indent=2))
    fh.write("\n")

print("total templates:", len(entries), "| sw with css:", sum(1 for e in entries if e["id"].startswith("swebsy-") and e["css"]))
