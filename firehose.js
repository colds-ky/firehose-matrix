var coldsky = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.js
  var index_exports = {};
  __export(index_exports, {
    firehose: () => firehose,
    known$Types: () => known$Types,
    readCAR: () => readCAR,
    sequenceReadCAR: () => sequenceReadCAR,
    version: () => version
  });

  // src/decode/car/utilities/byte-reader.js
  var createUint8Reader = (buf) => {
    let pos = 0;
    return {
      get pos() {
        return pos;
      },
      seek(size) {
        pos += size;
      },
      upto(size) {
        return buf.subarray(pos, pos + Math.min(size, buf.length - pos));
      },
      exactly(size, seek) {
        if (size > buf.length - pos) {
          throw new RangeError("unexpected end of data");
        }
        const slice = buf.subarray(pos, pos + size);
        if (seek) {
          pos += size;
        }
        return slice;
      }
    };
  };

  // src/decode/multibase/utils.js
  var allocUnsafe = (size) => {
    return new Uint8Array(size);
  };
  var createRfc4648Encode = (alphabet, bitsPerChar, pad) => {
    return (bytes) => {
      const mask = (1 << bitsPerChar) - 1;
      let str = "";
      let bits = 0;
      let buffer = 0;
      for (let i = 0; i < bytes.length; ++i) {
        buffer = buffer << 8 | bytes[i];
        bits += 8;
        while (bits > bitsPerChar) {
          bits -= bitsPerChar;
          str += alphabet[mask & buffer >> bits];
        }
      }
      if (bits !== 0) {
        str += alphabet[mask & buffer << bitsPerChar - bits];
      }
      if (pad) {
        while ((str.length * bitsPerChar & 7) !== 0) {
          str += "=";
        }
      }
      return str;
    };
  };
  var createRfc4648Decode = (alphabet, bitsPerChar, pad) => {
    const codes = {};
    for (let i = 0; i < alphabet.length; ++i) {
      codes[alphabet[i]] = i;
    }
    return (str) => {
      let end = str.length;
      while (pad && str[end - 1] === "=") {
        --end;
      }
      const bytes = allocUnsafe(end * bitsPerChar / 8 | 0);
      let bits = 0;
      let buffer = 0;
      let written = 0;
      for (let i = 0; i < end; ++i) {
        const value = codes[str[i]];
        if (value === void 0) {
          throw new SyntaxError(`invalid base string`);
        }
        buffer = buffer << bitsPerChar | value;
        bits += bitsPerChar;
        if (bits >= 8) {
          bits -= 8;
          bytes[written++] = 255 & buffer >> bits;
        }
      }
      if (bits >= bitsPerChar || (255 & buffer << 8 - bits) !== 0) {
        throw new SyntaxError("unexpected end of data");
      }
      return bytes;
    };
  };

  // src/decode/multibase/base32.js
  var BASE32_CHARSET = "abcdefghijklmnopqrstuvwxyz234567";
  var toBase32 = /* @__PURE__ */ createRfc4648Encode(BASE32_CHARSET, 5, false);

  // src/decode/cbor/varint.js
  var MSB = 128;
  var REST = 127;
  var MSBALL = ~REST;
  var INT = 2 ** 31;
  var N1 = 2 ** 7;
  var N2 = 2 ** 14;
  var N3 = 2 ** 21;
  var N4 = 2 ** 28;
  var N5 = 2 ** 35;
  var N6 = 2 ** 42;
  var N7 = 2 ** 49;
  var N8 = 2 ** 56;
  var N9 = 2 ** 63;
  var encode = (num, buf, offset = 0) => {
    if (num > Number.MAX_SAFE_INTEGER) {
      throw new RangeError("could not encode varint");
    }
    const start = offset;
    while (num >= INT) {
      buf[offset++] = num & 255 | MSB;
      num /= 128;
    }
    while (num & MSBALL) {
      buf[offset++] = num & 255 | MSB;
      num >>>= 7;
    }
    buf[offset] = num | 0;
    return offset - start + 1;
  };
  var decode = (buf, offset = 0) => {
    let l = buf.length;
    let res = 0;
    let shift = 0;
    let counter = offset;
    let b;
    do {
      if (counter >= l) {
        throw new RangeError("could not decode varint");
      }
      b = buf[counter++];
      res += shift < 28 ? (b & REST) << shift : (b & REST) * Math.pow(2, shift);
      shift += 7;
    } while (b >= MSB);
    return [res, counter - offset];
  };
  var encodingLength = (num) => {
    return num < N1 ? 1 : num < N2 ? 2 : num < N3 ? 3 : num < N4 ? 4 : num < N5 ? 5 : num < N6 ? 6 : num < N7 ? 7 : num < N8 ? 8 : num < N9 ? 9 : 10;
  };

  // src/decode/cbor/cid.js
  var inspect = (initialBytes) => {
    let offset = 0;
    const next = () => {
      const [i, length] = decode(initialBytes.subarray(offset));
      offset += length;
      return i;
    };
    let version2 = next();
    let codec = 112;
    if (version2 === 18) {
      version2 = 0;
      offset = 0;
    } else {
      codec = next();
    }
    if (version2 !== 1) {
      throw new RangeError(`only cidv1 is supported`);
    }
    const prefixSize = offset;
    const multihashCode = next();
    const digestSize = next();
    const size = offset + digestSize;
    const multihashSize = size - prefixSize;
    return { version: version2, codec, multihashCode, digestSize, multihashSize, size };
  };
  var decodeFirst = (bytes) => {
    const specs = inspect(bytes);
    const prefixSize = specs.size - specs.multihashSize;
    const multihashBytes = bytes.subarray(prefixSize, prefixSize + specs.multihashSize);
    if (multihashBytes.byteLength !== specs.multihashSize) {
      throw new RangeError("incorrect cid length");
    }
    const digestBytes = multihashBytes.subarray(specs.multihashSize - specs.digestSize);
    const digest = {
      code: specs.multihashCode,
      size: specs.multihashSize,
      digest: digestBytes,
      bytes: multihashBytes
    };
    const cid = {
      version: 1,
      code: specs.codec,
      digest,
      bytes: bytes.subarray(0, specs.size)
    };
    return [cid, bytes.subarray(specs.size)];
  };
  var decode2 = (bytes) => {
    const [cid, remainder] = decodeFirst(bytes);
    if (remainder.length !== 0) {
      throw new Error(`incorrect cid length`);
    }
    return cid;
  };
  var encode2 = (version2, code, multihash) => {
    const codeOffset = encodingLength(version2);
    const hashOffset = codeOffset + encodingLength(code);
    const bytes = new Uint8Array(hashOffset + multihash.byteLength);
    encode(version2, bytes, 0);
    encode(code, bytes, codeOffset);
    bytes.set(multihash, hashOffset);
    return bytes;
  };

  // src/decode/multibase/base64.js
  var BASE64_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var HAS_UINT8_BASE64_SUPPORT = "fromBase64" in Uint8Array;
  var _fromBase64Polyfill = /* @__PURE__ */ createRfc4648Decode(BASE64_CHARSET, 6, false);
  var _toBase64Polyfill = /* @__PURE__ */ createRfc4648Encode(BASE64_CHARSET, 6, false);
  var WS_PAD_RE = /[\s=]/;
  var _fromBase64Native = (str) => {
    if (str.length % 4 === 1 || WS_PAD_RE.test(str)) {
      throw new SyntaxError(`invalid base64 string`);
    }
    return (
      /** @type {*} */
      Uint8Array.fromBase64(str, { alphabet: "base64", lastChunkHandling: "loose" })
    );
  };
  var _toBase64Native = (bytes) => {
    return bytes.toBase64({ alphabet: "base64", omitPadding: true });
  };
  var fromBase64 = !HAS_UINT8_BASE64_SUPPORT ? _fromBase64Polyfill : _fromBase64Native;
  var toBase64 = !HAS_UINT8_BASE64_SUPPORT ? _toBase64Polyfill : _toBase64Native;

  // src/decode/cbor/bytes.js
  var BytesWrapper = class {
    buf;
    constructor(buf) {
      this.buf = buf;
    }
    get $bytes() {
      return toBase64(this.buf);
    }
    toJSON() {
      return { $bytes: this.$bytes };
    }
  };
  var toBytes = (buf) => {
    return new BytesWrapper(buf);
  };
  var fromBytes = (bytes) => {
    if (bytes instanceof BytesWrapper) {
      return bytes.buf;
    }
    return fromBase64(bytes.$bytes);
  };

  // src/decode/cbor/cid-link.js
  var CIDLinkWrapper = class {
    $bytes;
    constructor($bytes) {
      this.$bytes = $bytes;
    }
    get $cid() {
      return decode2(this.$bytes);
    }
    get $link() {
      return "b" + toBase32(this.$bytes);
    }
    toJSON() {
      return { $link: this.$link };
    }
  };
  var toCIDLink = (value) => {
    return "b" + toBase32(value.bytes || value);
    if (value instanceof Uint8Array) {
      return "b" + toBase32(value);
      return new CIDLinkWrapper(value);
    }
    return "b" + toBase32(value.bytes);
    return new CIDLinkWrapper(value.bytes);
  };

  // src/decode/cbor/decode.js
  var utf8d = new TextDecoder();
  var readArgument = (state, info) => {
    if (info < 24) {
      return info;
    }
    switch (info) {
      case 24:
        return readUint8(state);
      case 25:
        return readUint16(state);
      case 26:
        return readUint32(state);
      case 27:
        return readUint64(state);
    }
    throw new Error(`invalid argument encoding; got ${info}`);
  };
  var readFloat64 = (state) => {
    const value = state.v.getFloat64(state.p);
    state.p += 8;
    return value;
  };
  var readUint8 = (state) => {
    const value = state.v.getUint8(state.p);
    state.p += 1;
    return value;
  };
  var readUint16 = (state) => {
    const value = state.v.getUint16(state.p);
    state.p += 2;
    return value;
  };
  var readUint32 = (state) => {
    const value = state.v.getUint32(state.p);
    state.p += 4;
    return value;
  };
  var readUint64 = (state) => {
    const hi = state.v.getUint32(state.p);
    const lo = state.v.getUint32(state.p + 4);
    if (hi > 2097151) {
      throw new RangeError(`can't decode integers beyond safe integer range`);
    }
    const value = hi * 2 ** 32 + lo;
    state.p += 8;
    return value;
  };
  var readString = (state, length) => {
    const slice = state.b.subarray(state.p, state.p += length);
    return utf8d.decode(slice);
  };
  var readBytes = (state, length) => {
    const slice = state.b.subarray(state.p, state.p += length);
    return toBytes(slice);
  };
  var readCid = (state, length) => {
    const slice = state.b.subarray(state.p + 1, state.p += length);
    return toCIDLink(slice);
  };
  var readValue = (state) => {
    const prelude = readUint8(state);
    const type = prelude >> 5;
    const info = prelude & 31;
    if (type === 0) {
      const value = readArgument(state, info);
      return value;
    }
    if (type === 1) {
      const value = readArgument(state, info);
      return -1 - value;
    }
    if (type === 2) {
      const len = readArgument(state, info);
      return readBytes(state, len);
    }
    if (type === 3) {
      const len = readArgument(state, info);
      return readString(state, len);
    }
    if (type === 4) {
      const len = readArgument(state, info);
      const array = new Array(len);
      for (let idx = 0; idx < len; idx++) {
        array[idx] = readValue(state);
      }
      return array;
    }
    if (type === 5) {
      const len = readArgument(state, info);
      const object = {};
      for (let idx = 0; idx < len; idx++) {
        const key = readValue(state);
        if (typeof key !== "string") {
          throw new TypeError(`expected map to only have string keys; got ${typeof key}`);
        }
        object[key] = readValue(state);
      }
      return object;
    }
    if (type === 6) {
      const tag = readArgument(state, info);
      if (tag === 42) {
        const prelude2 = readUint8(state);
        const type2 = prelude2 >> 5;
        const info2 = prelude2 & 31;
        if (type2 !== 2) {
          throw new TypeError(`expected cid tag to have bytes value; got ${type2}`);
        }
        const len = readArgument(state, info2);
        return readCid(state, len);
      }
      throw new TypeError(`unsupported tag; got ${tag}`);
    }
    if (type === 7) {
      switch (info) {
        case 20:
          return false;
        case 21:
          return true;
        case 22:
          return null;
        case 27:
          return readFloat64(state);
      }
      throw new Error(`invalid simple value; got ${info}`);
    }
    throw new TypeError(`invalid type; got ${type}`);
  };
  var decodeFirst2 = (buf) => {
    const state = {
      b: buf,
      v: new DataView(buf.buffer, buf.byteOffset, buf.byteLength),
      p: 0
    };
    const value = readValue(state);
    const remainder = buf.subarray(state.p);
    return [value, remainder];
  };
  var decode3 = (buf) => {
    const [value, remainder] = decodeFirst2(buf);
    if (remainder.length !== 0) {
      throw new Error(`decoded value contains remainder`);
    }
    return value;
  };

  // src/decode/car/utilities/sync-car-reader.js
  var isCarV1Header = (value) => {
    if (value === null || typeof value !== "object") {
      return false;
    }
    const { version: version2, roots } = value;
    return version2 === 1 && Array.isArray(roots) && roots.every((root) => typeof root === "string");
  };
  var readVarint = (reader, size) => {
    const buf = reader.upto(size);
    if (buf.length === 0) {
      throw new RangeError(`unexpected end of data`);
    }
    const [int, read] = decode(buf);
    reader.seek(read);
    return int;
  };
  var readHeader = (reader) => {
    const length = readVarint(reader, 8);
    if (length === 0) {
      throw new RangeError(`invalid car header; length=0`);
    }
    const rawHeader = reader.exactly(length, true);
    const header = decode3(rawHeader);
    if (!isCarV1Header(header)) {
      throw new TypeError(`expected a car v1 archive`);
    }
    return header;
  };
  var readMultihashDigest = (reader) => {
    const first = reader.upto(8);
    const [code, codeOffset] = decode(first);
    const [size, sizeOffset] = decode(first.subarray(codeOffset));
    const offset = codeOffset + sizeOffset;
    const bytes = reader.exactly(offset + size, true);
    const digest = bytes.subarray(offset);
    return {
      code,
      size,
      digest,
      bytes
    };
  };
  var readCid2 = (reader) => {
    const version2 = readVarint(reader, 8);
    if (version2 !== 1) {
      throw new Error(`expected a cidv1`);
    }
    const codec = readVarint(reader, 8);
    const digest = readMultihashDigest(reader);
    const cid = {
      version: version2,
      code: codec,
      digest,
      bytes: encode2(version2, codec, digest.bytes)
    };
    return cid;
  };
  var readBlockHeader = (reader) => {
    const start = reader.pos;
    let size = readVarint(reader, 8);
    if (size === 0) {
      throw new Error(`invalid car section; length=0`);
    }
    size += reader.pos - start;
    const cid = readCid2(reader);
    const blockSize = size - Number(reader.pos - start);
    return { cid, blockSize };
  };
  var createCarReader = (reader) => {
    const { roots } = readHeader(reader);
    return {
      roots,
      /** @returns {Generator<{ cid: import('../../cbor/cid').CID; bytes: Uint8Array }>} */
      *iterate() {
        while (reader.upto(8).length > 0) {
          const { cid, blockSize } = readBlockHeader(reader);
          const bytes = reader.exactly(blockSize, true);
          yield { cid, bytes };
        }
      }
    };
  };

  // src/decode/car/reader.js
  var readCar = (buffer) => {
    const reader = createUint8Reader(buffer);
    return createCarReader(reader);
  };

  // src/read-car.js
  var YIELD_AFTER_ITERATION = 300;
  function readCAR(messageBuf, did) {
    if (typeof messageBuf === "string")
      [messageBuf, did] = /** @type {[any, any]} */
        [did, messageBuf];
    let last;
    for (const _chunk of sequenceReadCAR(messageBuf, did)) {
      if (_chunk) last = _chunk;
    }
    return (
      /** @type {NonNullable<typeof last>} */
      last
    );
  }
  function* sequenceReadCAR(messageBuf, did) {
    if (typeof messageBuf === "string")
      [messageBuf, did] = /** @type {[any, any]} */
        [did, messageBuf];
    const parseStart = Date.now();
    let pauseTime = 0;
    const bytes = messageBuf instanceof ArrayBuffer ? new Uint8Array(messageBuf) : messageBuf;
    const car = readCar(bytes);
    const recordsByCID = /* @__PURE__ */ new Map();
    const keyByCID = /* @__PURE__ */ new Map();
    const errors = [];
    const decoder = new TextDecoder();
    let iteration = 0;
    for (const block of car.iterate()) {
      iteration++;
      if (iteration % YIELD_AFTER_ITERATION === YIELD_AFTER_ITERATION - 1) {
        const pauseStart = Date.now();
        yield;
        pauseTime += Date.now() - pauseStart;
      }
      const record = decode3(block.bytes);
      if (record.$type) {
        const blockCID = "b" + toBase32(block.cid.bytes);
        recordsByCID.set(blockCID, record);
      } else if (Array.isArray(record.e)) {
        let key = "";
        for (const sub of record.e) {
          iteration++;
          if (iteration % YIELD_AFTER_ITERATION === YIELD_AFTER_ITERATION - 1) {
            const pauseStart = Date.now();
            yield;
            pauseTime += Date.now() - pauseStart;
          }
          if (!sub.k || !sub.v) continue;
          try {
            const keySuffix = decoder.decode(sub.k.buf);
            key = key.slice(0, sub.p || 0) + keySuffix;
            let cid;
            if (typeof sub.v === "string") {
              cid = sub.v;
            } else if (sub.v.value) {
              const expandWithoutZero = sub.v.value[0] ? sub.v.value : (
                /** @type {Uint8Array} */
                sub.v.value.subarray(1)
              );
              cid = decode2(expandWithoutZero);
            } else if (sub.v.$bytes) {
              cid = sub.v.$link;
            }
            if (!cid) continue;
            keyByCID.set(cid, key);
          } catch (error) {
            if (!errors.length) console.error(error);
            errors.push(error);
          }
        }
      }
    }
    const records = (
      /** @type {*} */
      []
    );
    for (const entry of recordsByCID) {
      iteration++;
      if (iteration % YIELD_AFTER_ITERATION === YIELD_AFTER_ITERATION - 1) {
        const pauseStart = Date.now();
        records.parseTime = pauseStart - parseStart - pauseTime;
        yield;
        pauseTime += Date.now() - pauseStart;
      }
      const cid = entry[0];
      const record = entry[1];
      record.repo = did;
      record.cid = cid;
      const key = keyByCID.get(cid);
      if (key) {
        record.path = key;
        record.uri = "at://" + did + "/" + key;
      }
      records.push(record);
    }
    records.parseTime = Date.now() - parseStart - pauseTime;
    yield records;
    return records;
  }

  // package.json
  var version = "0.9.5";

  // src/firehose.js
  var emptyUint8Array = new Uint8Array();
  var known$Types = (
    /** @type {const} */
    [
      "app.bsky.feed.like",
      "app.bsky.feed.post",
      "app.bsky.feed.repost",
      "app.bsky.feed.threadgate",
      "app.bsky.graph.follow",
      "app.bsky.graph.block",
      "app.bsky.graph.list",
      "app.bsky.graph.listitem",
      "app.bsky.graph.listblock",
      "app.bsky.actor.profile",
      "app.bsky.feed.generator",
      "app.bsky.feed.postgate",
      "chat.bsky.actor.declaration",
      "app.bsky.graph.starterpack"
    ]
  );
  firehose.knownTypes = known$Types;
  function requireWebsocket() {
    const globalObj = typeof global !== "undefined" && global || typeof globalThis !== "undefined" && globalThis;
    const requireFn = globalObj?.["require"];
    if (typeof requireFn === "function") return (
      /** @type {typeof WebSocket} */
      requireFn("ws")
    );
    throw new Error("WebSocket not available");
  }
  firehose.each = each;
  firehose.version = version;
  async function* firehose(address) {
    const WebSocketImpl = typeof WebSocket === "function" ? WebSocket : requireWebsocket();
    const wsAddress = address || "wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos";
    const ws = new WebSocketImpl(wsAddress);
    ws.binaryType = "arraybuffer";
    ws.addEventListener("message", handleMessage);
    ws.addEventListener("error", handleError);
    ws.addEventListener("close", handleClose);
    let buf = createAwaitPromise();
    let closed = false;
    try {
      while (true) {
        await buf.promise;
        if (buf.block?.length) {
          const block = buf.block;
          buf = createAwaitPromise();
          if (closed) {
            block["messages"] = block;
            if (block.length) yield block;
            break;
          }
          yield block;
        } else {
          buf = createAwaitPromise();
        }
      }
    } finally {
      if (!closed) {
        try {
          ws.close();
        } catch (error) {
        }
      }
    }
    function handleClose() {
      closed = true;
      buf.resolve();
    }
    function handleMessage(event) {
      const receiveTimestamp = Date.now();
      if (typeof event.data?.byteLength === "number") {
        parseMessageBufAndResolve(receiveTimestamp, event.data);
      } else if (typeof event.data?.arrayBuffer === "function") {
        event.data.arrayBuffer().then((arrayBuffer) => parseMessageBufAndResolve(receiveTimestamp, arrayBuffer));
      } else {
        buf.block.push({
          $type: "error",
          message: "WebSocket message type not supported.",
          data: event.data,
          receiveTimestamp,
          parseTime: 0
        });
        buf.resolve();
      }
    }
    function parseMessageBufAndResolve(receiveTimestamp, arrayBuf) {
      parseMessageBuf(receiveTimestamp, new Uint8Array(arrayBuf));
      buf.resolve();
    }
    function parseMessageBuf(receiveTimestamp, messageBuf) {
      const parseStart = performance.now();
      try {
        parseMessageBufWorker(receiveTimestamp, parseStart, messageBuf);
        buf.resolve();
      } catch (parseError) {
        buf.block.push({
          $type: "error",
          message: parseError.message,
          receiveTimestamp,
          parseTime: performance.now() - parseStart
        });
      }
      buf.resolve();
    }
    function parseMessageBufWorker(receiveTimestamp, parseStart, messageBuf) {
      const [header, remainder] = decodeFirst2(messageBuf);
      const [body, remainder2] = decodeFirst2(remainder);
      if (remainder2.length > 0) {
        return buf.block.push({
          $type: "error",
          message: "Excess bytes in message.",
          receiveTimestamp,
          parseTime: performance.now() - parseStart
        });
      }
      const { t, op } = header;
      if (op === -1) {
        return buf.block.push({
          $type: "error",
          message: "Error header#" + body.error + ": " + body.message,
          receiveTimestamp,
          parseTime: performance.now() - parseStart
        });
      }
      if (t === "#commit") {
        const commit = body;
        if (!("blocks" in commit) || !commit.blocks.$bytes.length) {
          return buf.block.push({
            $type: "com.atproto.sync.subscribeRepos#commit",
            ...commit,
            blocks: emptyUint8Array,
            ops: [],
            receiveTimestamp,
            parseTime: performance.now() - parseStart
          });
        }
        const blocks = fromBytes(commit.blocks);
        const car = readCarToMap(blocks);
        for (let opIndex = 0; opIndex < commit.ops.length; opIndex++) {
          const op2 = commit.ops[opIndex];
          const action = op2.action;
          const now = performance.now();
          const record = op2.cid ? car.get(op2.cid) : void 0;
          if (action === "create" || action === "update") {
            if (!op2.cid) {
              buf.block.push({
                $type: "error",
                message: "Missing commit.ops[" + (opIndex - 1) + "].cid.",
                receiveTimestamp,
                parseTime: now - parseStart,
                commit
              });
              parseStart = now;
              continue;
            }
            if (!record) {
              buf.block.push({
                $type: "error",
                message: "Unresolved commit.ops[" + (opIndex - 1) + "].cid " + op2.cid,
                receiveTimestamp,
                parseTime: now - parseStart,
                commit
              });
              parseStart = now;
              continue;
            }
            record.action = action;
            record.uri = "at://" + commit.repo + "/" + op2.path;
            record.path = op2.path;
            record.cid = op2.cid;
            record.receiveTimestamp = receiveTimestamp;
            record.parseTime = now - parseStart;
            buf.block.push(record);
            continue;
          } else if (action === "delete") {
            buf.block.push({
              action,
              path: op2.path,
              receiveTimestamp,
              parseTime: now - parseStart
            });
            parseStart = now;
          } else {
            buf.block.push({
              $type: "error",
              message: "Unknown action " + op2.action,
              ...record,
              receiveTimestamp,
              parseTime: now - parseStart
            });
            parseStart = now;
            continue;
          }
        }
        return;
      }
      return buf.block.push({
        $type: t,
        ...body,
        receiveTimestamp,
        parseTime: performance.now() - parseStart
      });
    }
    function handleError(error) {
      console.error(error);
      const errorText = error.message || "WebSocket error " + error;
      buf.reject(new Error(errorText));
    }
  }
  async function* each() {
    for await (const block of firehose()) {
      yield* block;
    }
  }
  function createAwaitPromise() {
    const result = {
      /** @type {FirehoseRecord[]} */
      block: []
    };
    result.promise = new Promise((resolve, reject) => {
      result.resolve = resolve;
      result.reject = reject;
    });
    return (
      /** @type {*} */
      result
    );
  }
  function readCarToMap(buffer) {
    const records = /* @__PURE__ */ new Map();
    for (const { cid, bytes } of readCar(buffer).iterate()) {
      records.set(toCIDLink(cid), decode3(bytes));
    }
    return records;
  }
  return __toCommonJS(index_exports);
})();
//# sourceMappingURL=index.js.map
