#!/usr/bin/env python3
"""Turn a square woolmer social graphic into a 10-second 9:16 TikTok video.
Usage: python3 tools/tiktok.py in.png out.mp4 ["Top line"]
Needs ffmpeg and the Inter fonts (apt: ffmpeg fonts-inter)."""
import subprocess, sys, os
src, out = sys.argv[1], sys.argv[2]
top = (sys.argv[3] if len(sys.argv) > 3 else 'Whitehill & Bordon').replace("'", "’").replace(':', '\\:')
font = '/usr/share/fonts/opentype/inter/InterDisplay-Medium.otf'
if not os.path.exists(font):
    font = next((os.path.join(r, f) for r, _, fs in os.walk('/usr/share/fonts') for f in fs if 'Inter' in f and f.endswith(('.otf', '.ttf'))), '')
fz = f":fontfile={font}" if font else ''
vf = (
    "[0]scale=1000:1000,format=rgba[img];"
    "color=c=0x0C243C:s=1080x1920:d=10,format=rgba[bg];"
    "[bg][img]overlay=40:460[base];"
    "[base]zoompan=z='1+0.05*on/300':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,"
    f"drawtext=text='{top}'{fz}:fontsize=58:fontcolor=0xD5DDE5:x=(w-text_w)/2:y=250,"
    f"drawtext=text='woolmer.info'{fz}:fontsize=72:fontcolor=0xFF862F:x=(w-text_w)/2:y=1580,"
    "fade=t=in:st=0:d=0.5,format=yuv420p[v]"
)
cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-loop', '1', '-t', '10', '-i', src,
       '-f', 'lavfi', '-t', '10', '-i', 'anullsrc=r=44100:cl=stereo',
       '-filter_complex', vf, '-map', '[v]', '-map', '1:a', '-t', '10',
       '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-r', '30', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', out]
subprocess.run(cmd, check=True)
print(out, os.path.getsize(out))
