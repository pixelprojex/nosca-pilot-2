import pathlib
B = pathlib.Path(__file__).parent
F = B.parent  # writes website/index.html and website/preview.html
src = (B / "src.html").read_text()
mark = '<svg class="mk" viewBox="0 0 40 25" aria-hidden="true" focusable="false"><path d="M18.651 19.734 A 8.6 8.6 0 1 1 21.108 17.341"/><path d="M21.349 5.266 A 8.6 8.6 0 1 1 18.892 7.659"/></svg>'
slots = "\n      ".join(f'<li class="slot rv" style="transition-delay:{i*70}ms">{mark}</li>' for i in range(6))
out = (src.replace("%%QR%%", (B / "qr.svg").read_text())
          .replace("%%TICKS%%", (B / "ticks.svg").read_text())
          .replace("%%SLOTS%%", slots)
          .replace("%%JS%%", (B / "main.js").read_text()))
assert "%%" not in out
(F / "index.html").write_text(out)
head = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
        '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui,-apple-system,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>')
(F / "preview.html").write_text(head + out + "</body></html>")
print("index.html", len(out.encode()), "bytes")
