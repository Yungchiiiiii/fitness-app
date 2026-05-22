import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const outDir = path.resolve('public')
fs.mkdirSync(outDir, { recursive: true })

const palette = {
  cream: [255, 247, 235, 255],
  shadow: [226, 95, 24, 55],
  orange: [255, 122, 30, 255],
  orangeDark: [226, 88, 19, 255],
  green: [46, 184, 117, 255],
  navy: [28, 42, 67, 255],
  white: [255, 255, 255, 255],
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

function polygon(points) {
  return (px, py) => {
    let inside = false
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i]
      const [xj, yj] = points[j]
      const cross = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
      if (cross) inside = !inside
    }
    return inside
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
  return (x, y) => shapes.some((shape) => shape(x, y))
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
  const s = (n) => n * scale
  const buffer = Buffer.alloc(size * size * 4, 0)

  draw(buffer, size, roundedRect(0, 0, size, size, s(112)), palette.cream)
  draw(buffer, size, ellipse(s(260), s(390), s(152), s(36)), palette.shadow)

  const flame = union(
    polygon([[s(256), s(72)], [s(365), s(242)], [s(318), s(396)], [s(210), s(421)], [s(145), s(309)], [s(186), s(182)]]),
    ellipse(s(254), s(295), s(112), s(136)),
    ellipse(s(205), s(268), s(62), s(88)),
    ellipse(s(310), s(250), s(58), s(102))
  )
  draw(buffer, size, flame, palette.orange)

  const innerFlame = union(
    polygon([[s(260), s(158)], [s(318), s(272)], [s(283), s(362)], [s(223), s(373)], [s(192), s(301)], [s(226), s(222)]]),
    ellipse(s(255), s(304), s(58), s(82))
  )
  draw(buffer, size, innerFlame, palette.orangeDark)

  draw(buffer, size, capsule(s(180), s(330), s(246), s(390), s(22)), palette.white)
  draw(buffer, size, capsule(s(240), s(389), s(354), s(236), s(22)), palette.white)
  draw(buffer, size, capsule(s(188), s(329), s(246), s(382), s(12)), palette.green)
  draw(buffer, size, capsule(s(246), s(382), s(345), s(249), s(12)), palette.green)

  draw(buffer, size, capsule(s(150), s(204), s(348), s(204), s(14)), palette.navy)
  draw(buffer, size, capsule(s(147), s(178), s(147), s(230), s(16)), palette.navy)
  draw(buffer, size, capsule(s(365), s(178), s(365), s(230), s(16)), palette.navy)
  draw(buffer, size, capsule(s(117), s(188), s(117), s(220), s(18)), palette.navy)
  draw(buffer, size, capsule(s(395), s(188), s(395), s(220), s(18)), palette.navy)

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

for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  fs.writeFileSync(path.join(outDir, name), png(size, size, makeIcon(size)))
}
