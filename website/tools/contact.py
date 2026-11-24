import sys, math
from PIL import Image
src, out, cols = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src).convert('RGB')
seg = math.ceil(im.height / cols)
gap = 16
sheet = Image.new('RGB', (cols * im.width + (cols + 1) * gap, seg + 2 * gap), '#8A8A90')
for i in range(cols):
    part = im.crop((0, i * seg, im.width, min(im.height, (i + 1) * seg)))
    sheet.paste(part, (gap + i * (im.width + gap), gap))
maxw = int(sys.argv[4]) if len(sys.argv) > 4 else 2000
if sheet.width > maxw:
    sheet = sheet.resize((maxw, int(sheet.height * maxw / sheet.width)), Image.LANCZOS)
sheet.save(out)
print(out, sheet.size)
