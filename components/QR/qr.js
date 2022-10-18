export default class QR {
  constructor() {}
  getEncodingMode(string) {
    const NUMERIC_RE = /^\d*$/;
    const ALPHANUMERIC_RE = /^[\dA-Z $%*+\-./:]*$/;
    const LATIN1_RE = /^[\x00-\xff]*$/;
    const KANJI_RE =
      /^[\p{Script_Extensions=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}]*$/u;
    if (NUMERIC_RE.test(string)) {
      return 0b0001;
    }
    if (ALPHANUMERIC_RE.test(string)) {
      return 0b0010;
    }
    if (LATIN1_RE.test(string)) {
      return 0b0100;
    }
    if (KANJI_RE.test(string)) {
      return 0b1000;
    }
    return 0b0111;
  }

  getLengthBits(mode, version) {
    /*
    * bits reserved per version
    * |  Encoding Mode  | Version 1-9 |  Version 10-26  |  Version 27-40  |
    * |-----------------|-------------|-----------------|-----------------|
    * |     Numeric     |     10      |       12        |       14        |
    * |   Alphanumeric  |     9       |       11        |       13        |
    * |       Byte      |     8       |       16        |       16        |
    * |      Kanji      |     8       |       10        |       12        |
   */
    const LENGTH_BITS = [
      [10, 12, 14],
      [9, 11, 13],
      [8, 16, 16],
      [8, 10, 12],
    ];
    // ECI mode folds into byte mode
    // Basically it's `Math.floor(Math.log2(mode))` but much faster
    // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/clz32
    const modeIndex = 31 - Math.clz32(mode);
    const bitsIndex = version > 26 ? 2 : version > 9 ? 1 : 0;
    return LENGTH_BITS[modeIndex][bitsIndex];
  }

  /**
   * Decimal to Binary
   *
   * @param   {Number}  dec  decimal value
   *
   * @return  {Number}       Return binary representation of value
   */
  dec2bin(dec) {
    return (dec >>> 0).toString(2);
  }

  getByteData(content, lengthBits, dataCodewords) {
    const data = new Uint8Array(dataCodewords);
    const rightShift = (4 + lengthBits) & 7;
    const leftShift = 8 - rightShift;
    const andMask = (1 << rightShift) - 1;
    const dataIndexStart = lengthBits > 12 ? 2 : 1;

    data[0] = 64 /* byte mode */ + (content.length >> (lengthBits - 4));
    if (lengthBits > 12) {
      data[1] = (content.length >> rightShift) & 255;
    }
    data[dataIndexStart] = (content.length & andMask) << leftShift;

    for (let index = 0; index < content.length; index++) {
      const byte = content.charCodeAt(index);
      data[index + dataIndexStart] |= byte >> rightShift;
      data[index + dataIndexStart + 1] = (byte & andMask) << leftShift;
    }
    const remaining = dataCodewords - content.length - dataIndexStart - 1;
    for (let index = 0; index < remaining; index++) {
      const byte = index & 1 ? 17 : 236;
      data[index + content.length + 2] = byte;
    }
    return data;
  }
}
