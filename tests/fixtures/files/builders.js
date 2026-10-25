// Синтетические файлы для тестов пакета «Файлы»: ZIP (stored/deflate/ZipCrypto), PNG/JPEG/GIF, .class.
// ZipCrypto реализован здесь независимо от браузерного кода (шифратор), чтобы проверка была настоящей.
const zlib = require('node:zlib');

const crc32 = (buf) => zlib.crc32(buf) >>> 0;
const u16 = (n) => Buffer.from([n & 255, (n >> 8) & 255]);
const u32 = (n) => Buffer.from([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
const be16 = (n) => Buffer.from([(n >> 8) & 255, n & 255]);
const be32 = (n) => Buffer.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);

// --- ZipCrypto (шифратор) ---
function zipCryptoEncrypt(plain, password, crc) {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const keys = [0x12345678, 0x23456789, 0x34567890];
  const upd = (b) => {
    keys[0] = (table[(keys[0] ^ b) & 255] ^ (keys[0] >>> 8)) >>> 0;
    keys[1] = (Math.imul((keys[1] + (keys[0] & 255)) >>> 0, 134775813) + 1) >>> 0;
    keys[2] = (table[(keys[2] ^ (keys[1] >>> 24)) & 255] ^ (keys[2] >>> 8)) >>> 0;
  };
  const streamByte = () => { const t = (keys[2] | 2) & 0xffff; return ((t * (t ^ 1)) >>> 8) & 255; };
  for (const c of Buffer.from(password, 'utf8')) upd(c);
  const header = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, crc >>> 24]);
  const out = [];
  for (const p of Buffer.concat([header, plain])) {
    out.push(p ^ streamByte());
    upd(p);
  }
  return Buffer.from(out);
}

/**
 * @param {{name:string, data:Buffer|string, method?:'store'|'deflate', password?:string, aes?:boolean}[]} entries
 * @param {{comment?:string, noCentral?:boolean}} [opts]
 */
function makeZip(entries, opts) {
  const o = opts || {};
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const e of entries) {
    const raw = Buffer.from(e.data);
    const name = Buffer.from(e.name, 'utf8');
    const deflate = e.method === 'deflate';
    const crc = crc32(raw);
    let body = deflate ? zlib.deflateRawSync(raw) : raw;
    let flags = 0x800;
    let method = deflate ? 8 : 0;
    if (e.password) { body = zipCryptoEncrypt(body, e.password, crc); flags |= 1; }
    if (e.aes) { flags |= 1; method = 99; }
    const local = Buffer.concat([u32(0x04034b50), u16(20), u16(flags), u16(method), u16(0x6000), u16(0x5821), u32(crc), u32(body.length), u32(raw.length), u16(name.length), u16(0), name, body]);
    centrals.push(Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(flags), u16(method), u16(0x6000), u16(0x5821), u32(crc), u32(body.length), u32(raw.length),
      u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
    locals.push(local);
    offset += local.length;
  }
  const cd = Buffer.concat(centrals);
  const comment = Buffer.from(o.comment || '');
  const eocd = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(cd.length), u32(offset), u16(comment.length), comment]);
  return o.noCentral ? Buffer.concat(locals) : Buffer.concat([...locals, cd, eocd]);
}

// --- изображения ---
function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  return Buffer.concat([be32(data.length), t, data, be32(crc32(Buffer.concat([t, data])))]);
}

function makePng(extra) {
  const ihdr = Buffer.concat([be32(1), be32(1), Buffer.from([8, 2, 0, 0, 0])]);
  const idat = zlib.deflateSync(Buffer.from([0, 255, 0, 0]));
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
  return extra ? Buffer.concat([png, Buffer.from(extra)]) : png;
}

function makeJpeg(extra) {
  const app0 = Buffer.concat([Buffer.from([0xff, 0xe0]), be16(16), Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0')]);
  // Данные скана содержат 0xFF00 (стаффинг) и RST-маркер — они не должны считаться концом.
  const sos = Buffer.concat([Buffer.from([0xff, 0xda]), be16(8), Buffer.from([1, 1, 0, 0, 63, 0]), Buffer.from([0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56])]);
  const jpg = Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sos, Buffer.from([0xff, 0xd9])]);
  return extra ? Buffer.concat([jpg, Buffer.from(extra)]) : jpg;
}

function makeGif(extra) {
  const head = Buffer.concat([Buffer.from('GIF89a'), u16(1), u16(1), Buffer.from([0x80, 0, 0]), Buffer.from([0, 0, 0, 255, 255, 255])]);
  const image = Buffer.concat([Buffer.from([0x2c]), u16(0), u16(0), u16(1), u16(1), Buffer.from([0]), Buffer.from([2, 2, 0x44, 0x01, 0])]);
  const gif = Buffer.concat([head, image, Buffer.from([0x3b])]);
  return extra ? Buffer.concat([gif, Buffer.from(extra)]) : gif;
}

// --- .class ---
function makeClass(className, strings) {
  const cp = [];
  const utf = (s) => { cp.push(Buffer.concat([Buffer.from([1]), be16(Buffer.byteLength(s)), Buffer.from(s)])); return cp.length; };
  const clsName = utf(className);
  cp.push(Buffer.concat([Buffer.from([7]), be16(clsName)]));
  const thisIdx = cp.length;
  const objName = utf('java/lang/Object');
  cp.push(Buffer.concat([Buffer.from([7]), be16(objName)]));
  const superIdx = cp.length;
  for (const s of strings) {
    const u = utf(s);
    cp.push(Buffer.concat([Buffer.from([8]), be16(u)]));
  }
  return Buffer.concat([be32(0xcafebabe), be16(0), be16(52), be16(cp.length + 1), ...cp,
    be16(0x21), be16(thisIdx), be16(superIdx), be16(0), be16(0), be16(0), be16(0)]);
}

module.exports = { makeZip, makePng, makeJpeg, makeGif, makeClass, crc32 };
