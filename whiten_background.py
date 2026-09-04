from PIL import Image

src = "/var/folders/67/r7lgztzs46ggm1c3zc3lh6580000gn/T/codex-clipboard-dd80b6af-e709-4ad2-8427-c95665e6ae93.png"
dst = "/Users/kaze/work/bdi-edit/codex-clipboard-background-white.png"

im = Image.open(src).convert("RGBA")
pix = im.load()
for y in range(im.height):
    for x in range(im.width):
        r, g, b, a = pix[x, y]
        # Replace the cool, low-saturation gray page background only.
        # Keep white panels, blue accent, and dark UI glyphs untouched.
        if 215 <= r <= 248 and 218 <= g <= 249 and 222 <= b <= 252 and b >= g >= r and (b - r) <= 18:
            pix[x, y] = (255, 255, 255, a)

im.save(dst)
print(dst)
