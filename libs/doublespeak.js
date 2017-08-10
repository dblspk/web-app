var encVals = Object.freeze({
	'\u200C': 0x0, // zero width non-joiner
	'\u200D': 0x1, // zero width joiner
	'\u2060': 0x2, // word joiner
	'\u2061': 0x3, // function application
	'\u2062': 0x4, // invisible times
	'\u2063': 0x5, // invisible separator
	'\u2064': 0x6, // invisible plus
	'\u206A': 0x7, // inhibit symmetric swapping
	'\u206B': 0x8, // activate symmetric swapping
	'\u206C': 0x9, // inhibit Arabic form shaping
	'\u206D': 0xA, // activate Arabic form shaping
	'\u206E': 0xB, // national digit shapes
	'\u206F': 0xC, // nominal digit shapes
	'\uFE00': 0xD, // variation selector-1
	'\uFE01': 0xE, // variation selector-2
	'\uFEFF': 0xF  // zero width non-breaking space
});
var encChars = Object.freeze(Object.keys(encVals));
var crcTable = Object.freeze(makeCRCTable());

/**
 * Encode data length as variable length quantity in byte array.
 *
 * @param {Number} n
 * @return {Uint8Array}
 */
function encodeLength(n) {
	let bytes = [n & 0x7F];
	while (n > 127) {
		n >>= 7;
		bytes.unshift(n & 0x7F | 0x80);
	}

	return Uint8Array.from(bytes);
}

/**
 * Decode VLQ to integer.
 *
 * @param {Uint8Array} bytes
 * @return {Number}
 */
function decodeLength(bytes) {
	let len = 0;
	for (var i = 0; i < bytes.length; i++)
		len = len << 7 | bytes[i] & 0x7F;

	return len;
}

/**
 * Convert byte arrays to encoding characters.
 *
 * @param {...Uint8Array} args
 * @return {String}
 */
function encodeBytes(...args) {
	const encChars = window.encChars;

	let out = '';
	for (var arg of args) {
		if (!(arg instanceof Uint8Array))
			arg = Uint8Array.of(arg);
		for (var i = 0, aLen = arg.length; i < aLen; i++)
			out += encChars[arg[i] >> 4] + encChars[arg[i] & 0xF];
	}

	return out;
}

/**
 * Convert encoded messages in string to byte array.
 *
 * @param {String} str
 * @return {Object}
 */
function decodeBytes(str) {
	const encVals = window.encVals;

	// Collect encoding characters and translate to half-bytes
	let nybles = [];
	let seqLens = [];
	for (var i = 0, sLen = str.length; i < sLen;) {
		var val = encVals[str[i++]];
		if (val !== undefined) {
			let seq = [];
			do {
				seq.push(val);
				val = encVals[str[i++]];
			} while (val !== undefined);
			// Ignore short sequences of encoding characters
			if (seq.length < 16) continue;
			// If sequence is truncated by an odd number of half-bytes,
			// drop last half-byte to preserve byte alignment
			if (seq.length & 1) seq.pop();
			nybles = nybles.concat(seq);
			seqLens.push(seq.length >> 1);
		}
	}

	// Convert half-bytes to bytes
	let bytes = [];
	for (var i = 0, nLen = nybles.length; i < nLen; i += 2)
		bytes.push(nybles[i] << 4 | nybles[i + 1]);

	return { bytes: Uint8Array.from(bytes), seqLens };
}

/**
 * Remove encoded messages from string.
 *
 * @param {String} str
 * @return {String}
 */
function filterStr(str) {
	const encVals = window.encVals;

	let out = '';
	for (var i = 0, sLen = str.length; i < sLen;) {
		if (encVals[str[i]] === undefined)
			out += str[i++];
		else {
			let seq = str[i];
			while (encVals[str[++i]] !== undefined)
				seq += str[i];
			if (seq.length < 16)
				out += seq;
		}
	}

	return out;
}

/**
 * Encode plaintext to ciphertext.
 *
 * @param {String} str
 * @return {String}
 */
function encodeText(str) {
	const bytes = new TextEncoder().encode(filterStr(str));
	// 0x44 0x0 == 'D\u0000' protocol signature and version
	const out = bytes.length ? encodeBytes(0x44, 0x0, crc32(bytes), 0x1, encodeLength(bytes.length), bytes) : '';
	console.info('Original size:', bytes.length, 'bytes,', str.length, 'characters',
		'\nEncoded size:', out.length * 3, 'bytes,', out.length, 'characters');

	return out;
}

/**
 * Encode file info and file byte array to ciphertext.
 *
 * @param {Uint8Array} bytes
 * @param {String} type
 * @param {String} name
 * @return {Object}
 */
function encodeFile(type, name, bytes) {
	const head = new TextEncoder().encode(type + '\0' + name + '\0');
	let pack = new Uint8Array(head.length + bytes.length);
	pack.set(head);
	pack.set(bytes, head.length);

	// 0x44 0x0 == 'D\u0000' protocol signature and version
	const str = encodeBytes(0x44, 0x0, crc32(pack), 0x2, encodeLength(pack.length), pack);
	console.info('File:', name + ',', (type || 'unknown'),
		'\nOriginal size:', bytes.length, 'bytes',
		'\nEncoded size:', str.length * 3, 'bytes,', str.length, ' characters');

	return str;
}

/**
 * Convert byte array to UTF-8 text.
 *
 * @param {Uint8Array} bytes
 * @return {String}
 */
function extractText(bytes) {
	return new TextDecoder().decode(bytes);
}

/**
 * Convert byte array to file components.
 *
 * @param {Uint8Array} bytes
 * @return {Object}
 */
function extractFile(bytes) {
	// Slice byte array by null terminators
	let nullPos = [];
	for (var i = 0, bLen = bytes.length; i < bLen; i++)
		if (!bytes[i]) {
			nullPos.push(i);
			if (nullPos.length > 1) break;
		}

	const type = new TextDecoder().decode(bytes.subarray(0, nullPos[0]));
	const name = new TextDecoder().decode(bytes.subarray(nullPos[0] + 1, nullPos[1]));
	const blob = new Blob([bytes.subarray(nullPos[1] + 1)], { type });

	return { type, name, blob };
}

/**
 * Decode encoded messages in string to array of data objects.
 *
 * @param {String} str
 * @return {Object[]}
 */
function decodeData(str) {
	let { bytes, seqLens } = decodeBytes(str);
	let out = [];
	// Loop until all messages extracted
	do {
		// Check protocol signature and version
		if (!bytes.length || (bytes[0] != 0x44 && bytes[1] != 0x0)) {
			if (!bytes.length)
				out.push({ error: 'No message detected' });
			else {
				out.push({
					error: 'Protocol mismatch',
					details: '\nData: ' + new TextDecoder().decode(bytes.subarray(seqLens[0]))
				});
				if (seqLens.length) {
					bytes = bytes.subarray(seqLens.shift());
					continue;
				}
			}
			break;
		}

		// Get length of variable length quantity data length field
		// by checking the first bit of each byte from VLQ start position
		let VLQLen = 0;
		while (bytes[6 + ++VLQLen] & 0x80) {}
		// Get start position of data field
		const dataStart = 7 + VLQLen;
		const header = bytes.subarray(2, dataStart);
		// Get data type field
		const dataType = header[4];
		// Get end position of data field
		const dataEnd = dataStart + decodeLength(header.subarray(5));
		// Get data field
		const data = bytes.subarray(dataStart, dataEnd);
		console.info('Original size:', data.length, 'bytes',
			'\nEncoded size:', dataEnd * 6, 'bytes,', dataEnd * 2, 'characters');
		// Check CRC-32
		const crcMatch = crc32(data).every((v, i) => v === header[i]);

		out.push({ crcMatch, dataType, data });

		if (crcMatch) {
			if (dataEnd < seqLens[0])
				// Update sequence length for concatenated messages
				seqLens[0] -= dataEnd;
			else
				// Discard sequence length if no concatenation
				seqLens.shift();
		}
		// If CRC mismatch, discard current sequence
		bytes = bytes.subarray(crcMatch ? dataEnd : seqLens.shift());
	} while (bytes.length);

	return out;
}

/**
 * Initialize CRC-32 table.
 *
 * @return {Number[]}
 */
function makeCRCTable() {
	let crcTable = [];
	let c;
	for (var n = 0; n < 256; n++) {
		c = n;
		for (var i = 0; i < 8; i++)
			c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
		crcTable[n] = c;
	}
	return crcTable;
}

/**
 * Convert byte array to file components.
 *
 * @param {Uint8Array} bytes
 * @return {Uint8Array}
 */
function crc32(bytes) {
	const crcTable = window.crcTable;
	let crc = -1;
	for (var i = 0, bLen = bytes.length; i < bLen; i++)
		crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xFF];
	crc = (crc ^ -1) >>> 0;
	console.info('CRC-32: 0x' + ('0000000' + crc.toString(16)).slice(-8));

	bytes = [];
	for (i = 24; i >= 0; i -= 8)
		bytes.push(crc >> i & 0xFF);
	return Uint8Array.from(bytes);
}
