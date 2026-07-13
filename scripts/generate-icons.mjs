import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const outDir = path.resolve('public')
fs.mkdirSync(outDir, { recursive: true })

const palette = {
  white: [255, 255, 255, 255],
  ink: [38, 54, 79, 255],
  coral: [225, 116, 103, 255],
  mint: [130, 186, 170, 255],
  blush: [250, 221, 210, 255],
  shadow: [38, 54, 79, 28],
}

function blend(dst, src, a) {
  const inv = 1 - a
  dst[0] = Math.round(src[0] * a + dst[0] * inv)
  dst[1] = Math.round(src[1] * a + dst[1] * inv)
  dst[2] = Math.round(src[2] * a + dst[2] * inv)
  dst[3] = 255
}

function roundedRect(x, y, w, h, r) {
  return (px, py) => {
    const cx = Math.max(x + r, Math.min(px, x + w - r))
    const cy = Math.max(y + r, Math.min(py, y + h - r))
    return (px - cx) ** 2 + (py - cy) ** 2 <= r ** 2
  }
}

function ellipse(cx, cy, rx, ry) {
  return (px, py) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1
}

function capsule(x1, y1, x2, y2, r) {
  return (px, py) => {
    const dx = x2 - x1
    const dy = y2 - y1
    const len2 = dx * dx + dy * dy
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2))
    const x = x1 + t * dx
    const y = y1 + t * dy
    return (px - x) ** 2 + (py - y) ** 2 <= r ** 2
  }
}

function union(...shapes) {
  return (x, y) => shapes.some(shape => shape(x, y))
}

function draw(buffer, size, shape, color, samples = 4) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hit = 0
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const px = x + (sx + 0.5) / samples
          const py = y + (sy + 0.5) / samples
          if (shape(px, py)) hit++
        }
      }
      if (!hit) continue
      const i = (y * size + x) * 4
      blend(buffer.subarray(i, i + 4), color, (hit / (samples * samples)) * (color[3] / 255))
    }
  }
}

function makeIcon(size) {
  const scale = size / 512
  const s = n => n * scale
  const buffer = Buffer.alloc(size * size * 4, 0)

  draw(buffer, size, roundedRect(0, 0, size, size, s(112)), palette.white)
  draw(buffer, size, ellipse(s(256), s(470), s(135), s(18)), palette.shadow)
  draw(buffer, size, ellipse(s(256), s(318), s(132), s(118)), palette.blush, 3)

  // Dumbbell outline.
  draw(buffer, size, capsule(s(126), s(146), s(386), s(146), s(10)), palette.ink)
  draw(buffer, size, capsule(s(126), s(146), s(386), s(146), s(3.5)), palette.white)
  for (const [x, width, height] of [[82, 32, 100], [112, 23, 78], [398, 32, 100], [377, 23, 78]]) {
    draw(buffer, size, roundedRect(s(x), s(96 + (100 - height) / 2), s(width), s(height), s(10)), palette.ink)
    draw(buffer, size, roundedRect(s(x + 8), s(104 + (100 - height) / 2), s(width - 16), s(height - 16), s(5)), palette.white)
  }

  // Cute line-art person lifting the bar.
  draw(buffer, size, ellipse(s(256), s(274), s(39), s(39)), palette.ink)
  draw(buffer, size, ellipse(s(256), s(274), s(31), s(31)), palette.white)
  draw(buffer, size, ellipse(s(242), s(273), s(4), s(5)), palette.ink, 3)
  draw(buffer, size, ellipse(s(270), s(273), s(4), s(5)), palette.ink, 3)
  draw(buffer, size, capsule(s(248), s(290), s(264), s(290), s(2.5)), palette.coral, 3)
  draw(buffer, size, ellipse(s(231), s(286), s(7), s(4)), palette.coral, 3)
  draw(buffer, size, ellipse(s(281), s(286), s(7), s(4)), palette.coral, 3)

  draw(buffer, size, capsule(s(232), s(340), s(177), s(167), s(9)), palette.ink)
  draw(buffer, size, capsule(s(280), s(340), s(335), s(167), s(9)), palette.ink)
  draw(buffer, size, ellipse(s(174), s(161), s(13), s(13)), palette.mint)
  draw(buffer, size, ellipse(s(338), s(161), s(13), s(13)), palette.mint)
  draw(buffer, size, capsule(s(256), s(320), s(256), s(399), s(10)), palette.ink)
  draw(buffer, size, capsule(s(256), s(333), s(256), s(389), s(5)), palette.mint)
  draw(buffer, size, capsule(s(256), s(397), s(215), s(458), s(9)), palette.ink)
  draw(buffer, size, capsule(s(256), s(397), s(297), s(458), s(9)), palette.ink)
  draw(buffer, size, capsule(s(208), s(461), s(185), s(461), s(8)), palette.ink)
  draw(buffer, size, capsule(s(304), s(461), s(327), s(461), s(8)), palette.ink)

  return buffer
}

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])))
  return Buffer.concat([len, typeBuffer, data, crc])
}

function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  fs.writeFileSync(path.join(outDir, name), png(size, size, makeIcon(size)))
}
