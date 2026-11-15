#!/usr/bin/env python3
"""Make a 1080x1080 woolmer social card.
Usage: python3 tools/card.py '{"eyebrow":"Coming up","headline":"...","sub":"...","url":"woolmer.info/sport","theme":"dark","out":"brand/social/live/2026-11-23-results.png"}'
Needs google-chrome and the Inter / Inter Display fonts (apt: fonts-inter)."""
import json, subprocess, sys, os, html, tempfile
a = json.loads(sys.argv[1])
TREE = '<path d="M13 3.5 L8.5 8.5 M13 3.5 L17.5 8.5 M13 8 L6.5 14.5 M13 8 L19.5 14.5 M13 12.5 L4.5 21 M13 12.5 L21.5 21 M13 3.5 V22.5" stroke-linecap="round" fill="none"/>'
dark = a.get('theme', 'dark') == 'dark'
bg = '#0C243C' if dark else '#FFF8F2'; head = '#FF862F' if dark else '#C4550F'; txt = '#D5DDE5' if dark else '#33475B'
logo = '#FFFFFF' if dark else '#0C243C'; ghost = '#1E3D5E' if dark else '#FFE1C8'
pillbg = '#55C2C3' if dark else '#0C243C'; pillc = '#0C243C' if dark else '#FFFFFF'
e = lambda k: html.escape(a.get(k, ''))
h = a['headline']; hs = 104 if len(h) < 30 else 88 if len(h) < 44 else 76 if len(h) < 60 else 64
doc = f'''<!doctype html><html><head><meta charset="utf-8"><style>
*{{margin:0;box-sizing:border-box}} html,body{{width:1080px;height:1080px;overflow:hidden}}
body{{background:{bg};font-family:Inter,sans-serif;position:relative}}
.ghost{{position:absolute;right:-150px;top:40px;width:760px;height:760px;stroke:{ghost};stroke-width:1.3}}
.logo{{position:absolute;left:90px;top:84px;display:flex;align-items:center;gap:18px;font-family:'Inter Display';font-weight:500;font-size:46px;letter-spacing:-1.5px;color:{logo}}}
.logo svg{{width:52px;height:52px;stroke:#FF862F;stroke-width:2.4}}
.main{{position:absolute;left:90px;right:120px;bottom:120px}}
.eb{{font-weight:600;font-size:26px;letter-spacing:3px;text-transform:uppercase;color:{'#55C2C3' if dark else '#1C7F80'};margin-bottom:26px}}
h1{{font-family:'Inter Display';font-weight:400;font-size:{hs}px;line-height:1.02;letter-spacing:-3.5px;color:{head};max-width:870px}}
p{{font-size:36px;line-height:1.4;color:{txt};margin-top:32px;max-width:820px;white-space:pre-line}}
.pill{{display:inline-block;margin-top:44px;background:{pillbg};color:{pillc};font-weight:600;font-size:32px;padding:18px 38px;border-radius:999px}}
</style></head><body>
<svg class="ghost" viewBox="0 0 26 26">{TREE}</svg>
<div class="logo"><svg viewBox="0 0 26 26">{TREE}</svg>woolmer</div>
<div class="main"><div class="eb">{e('eyebrow')}</div><h1>{e('headline')}</h1><p>{e('sub')}</p><span class="pill">{e('url')}</span></div>
</body></html>'''
out = os.path.abspath(a['out']); os.makedirs(os.path.dirname(out), exist_ok=True)
f = tempfile.NamedTemporaryFile('w', suffix='.html', delete=False); f.write(doc); f.close()
chrome = next((c for c in ['google-chrome', 'chromium', 'chromium-browser'] if subprocess.run(['which', c], capture_output=True).returncode == 0), 'google-chrome')
subprocess.run([chrome, '--headless=new', '--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1080,1080', f'--screenshot={out}', f'file://{f.name}'], capture_output=True)
print(out if os.path.exists(out) else 'FAILED')
