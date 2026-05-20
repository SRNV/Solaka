import os, json, math

def hex_to_rgb(h):
    return (int(h[0:2],16), int(h[2:4],16), int(h[4:6],16))

def rgb_to_hsl(r,g,b):
    r,g,b = r/255,g/255,b/255
    mx,mn = max(r,g,b),min(r,g,b)
    l = (mx+mn)/2
    if mx==mn: return 0,0,l
    d = mx-mn
    s = d/(2-mx-mn) if l>0.5 else d/(mx+mn)
    if mx==r:   h = (g-b)/d + (6 if g<b else 0)
    elif mx==g: h = (b-r)/d + 2
    else:       h = (r-g)/d + 4
    return h/6*360, s, l

def name_palette(filename):
    parts = filename.replace('-64px.png','').split('_')
    colors = [hex_to_rgb(p) for p in parts if len(p)==6]
    if not colors: return 'Matcap','#ffffff'

    hsls = [rgb_to_hsl(*c) for c in colors]
    avg_h = sum(h for h,s,l in hsls)/len(hsls)
    avg_s = sum(s for h,s,l in hsls)/len(hsls)
    avg_l = sum(l for h,s,l in hsls)/len(hsls)

    # Highlight color for outline (second value)
    oc = f'#{parts[1]}' if len(parts)>1 else '#ffffff'

    # --- Tone classification ---
    is_neutral = avg_s < 0.10
    is_metallic_gray = avg_s < 0.18

    if is_neutral:
        if avg_l < 0.12: base = 'Void'
        elif avg_l < 0.22: base = 'Obsidian'
        elif avg_l < 0.35: base = 'Charcoal'
        elif avg_l < 0.48: base = 'Graphite'
        elif avg_l < 0.60: base = 'Pewter'
        elif avg_l < 0.72: base = 'Silver'
        elif avg_l < 0.85: base = 'Platinum'
        else: base = 'Pearl'
        return base, oc

    if is_metallic_gray:
        if avg_l < 0.3:   base = 'Dark Steel'
        elif avg_l < 0.5: base = 'Steel'
        elif avg_l < 0.65: base = 'Brushed Metal'
        else:              base = 'Chrome'
        return base, oc

    # --- Hue classification ---
    h = avg_h
    l = avg_l
    s = avg_s

    bright = l > 0.65
    dark   = l < 0.28
    deep_s = s > 0.6

    if h < 15 or h >= 345:   # red
        if dark and deep_s:  base = 'Crimson'
        elif dark:           base = 'Maroon'
        elif bright:         base = 'Rose Quartz'
        elif deep_s:         base = 'Ruby'
        else:                base = 'Brick'
    elif h < 30:  # red-orange
        if dark:    base = 'Mahogany'
        elif bright: base = 'Salmon'
        else:       base = 'Terracotta'
    elif h < 45:  # orange
        if dark:    base = 'Rust'
        elif bright: base = 'Tangerine'
        elif deep_s: base = 'Ember'
        else:       base = 'Sienna'
    elif h < 60:  # amber/orange-yellow
        if dark:    base = 'Copper'
        elif bright: base = 'Amber'
        elif deep_s: base = 'Caramel'
        else:       base = 'Ochre'
    elif h < 80:  # yellow
        if dark:    base = 'Olive'
        elif bright: base = 'Citrine'
        elif deep_s: base = 'Gold'
        else:       base = 'Mustard'
    elif h < 100: # yellow-green
        if dark:    base = 'Moss'
        elif bright: base = 'Lime'
        else:       base = 'Fern'
    elif h < 135: # green
        if dark and deep_s: base = 'Malachite'
        elif dark:   base = 'Forest'
        elif bright: base = 'Jade'
        elif deep_s: base = 'Emerald'
        else:        base = 'Sage'
    elif h < 160: # blue-green
        if dark:    base = 'Deep Sea'
        elif bright: base = 'Mint'
        else:       base = 'Teal'
    elif h < 185: # cyan/teal
        if dark:    base = 'Abyss'
        elif bright: base = 'Aqua'
        elif deep_s: base = 'Glacial'
        else:       base = 'Cerulean'
    elif h < 210: # sky blue
        if dark:    base = 'Ocean'
        elif bright: base = 'Ice Blue'
        else:       base = 'Horizon'
    elif h < 240: # blue
        if dark and deep_s: base = 'Sapphire'
        elif dark:   base = 'Navy'
        elif bright: base = 'Sky'
        elif deep_s: base = 'Cobalt'
        else:        base = 'Denim'
    elif h < 265: # indigo
        if dark:    base = 'Midnight'
        elif bright: base = 'Lavender'
        elif deep_s: base = 'Lapis'
        else:       base = 'Indigo'
    elif h < 290: # violet/purple
        if dark:    base = 'Plum'
        elif bright: base = 'Orchid'
        elif deep_s: base = 'Amethyst'
        else:       base = 'Violet'
    elif h < 320: # magenta/purple-pink
        if dark:    base = 'Aubergine'
        elif bright: base = 'Lilac'
        elif deep_s: base = 'Magenta'
        else:       base = 'Mauve'
    elif h < 345: # pink/rose
        if dark:    base = 'Burgundy'
        elif bright: base = 'Blossom'
        elif deep_s: base = 'Fuchsia'
        else:       base = 'Dusty Rose'
    else:
        base = 'Prismatic'

    return base, oc


folder = os.path.dirname(os.path.abspath(__file__))
files = sorted([f for f in os.listdir(folder) if f.endswith('.png')])

used = {}
entries = []
for f in files:
    base, oc = name_palette(f)
    used[base] = used.get(base, 0) + 1
    entries.append((f, base, oc))

# Count totals to decide when to add numbers
totals = {}
for _, base, _ in entries:
    totals[base] = totals.get(base, 0) + 1

counters = {}
result = []
for f, base, oc in entries:
    if totals[base] > 1:
        counters[base] = counters.get(base, 0) + 1
        name = f'{base} {counters[base]}'
    else:
        name = base
    fid = f.replace('-64px.png','').replace('_','-').lower()
    result.append({
        'id': fid,
        'name': name,
        'path': f'/assets/matcaps/unnamed/{f}',
        'outlineColor': oc
    })

print(json.dumps(result, indent=2, ensure_ascii=False))
