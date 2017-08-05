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
var encQueue = [];
var textarea = [];
var crcTable = Object.freeze(makeCRCTable());

document.onreadystatechange = function () {
	if (!window.TextEncoder) {
		const script = document.createElement('script');
		script.src = 'polyfills/text-encoding.js';
		document.head.appendChild(script);
	}

	const textareas = [
		'out-prepend',
		'out-append',
		'out-plain',
		'out-cover',
		'out-cipher',
		'in-cipher',
		'in-plain'
	];
	for (var i = 0; i < 7; i++)
		textarea[i] = document.getElementById(textareas[i]);

	resizeBody();
	document.addEventListener('dragover', dragOverFiles, false);

	// Service worker caches page for offline use
	if ('serviceWorker' in navigator)
		navigator.serviceWorker.register('/doublespeak/sw.js');

	if (/Mac|iP(hone|od|ad)/.test(navigator.userAgent)) {
		textarea[4].placeholder = 'Copy [Command+C] output ciphertext';
		textarea[5].placeholder = 'Paste [Command+V] input ciphertext';
	}
};

// Mirror cover text to ciphertext box, pretending to embed data
// Embed does not actually occur until copy event
// Visual cues are still important for intuitive UX
function mirrorCover(el) {
	resizeTextarea(el);
	if (el === textarea[3]) {
		textarea[4].value = textarea[3].value;
		resizeTextarea(textarea[4]);
	}
	flashBorder(textarea[4], 'encoded', 200);
}

// Embed plaintext in cover text
function embedData() {
	// Filter out ciphertext to prevent double encoding
	const plainStr = filterStr((v => v ? v + ' ' : '')(textarea[0].value) +
		textarea[2].value + (v => v ? ' ' + v : '')(textarea[1].value));
	const bytes = new TextEncoder().encode(plainStr);
	// 0x44 0x0 == 'D\u0000' protocol signature and version
	const encodedStr = (bytes.length > 0 ? encodeBytes(0x44, 0x0, crc32(bytes), 0x1,
		encodeLength(bytes.length), bytes) : '').concat(...encQueue);
	const coverStr = filterStr(textarea[3].value);
	// Select random position in cover text to insert encoded text
	const insertPos = Math.floor(Math.random() * (coverStr.length - 1) + 1);
	textarea[4].value = coverStr.slice(0, insertPos) + encodedStr + coverStr.slice(insertPos);
	textarea[4].select();
	document.execCommand('copy');
	console.info('Original size:', bytes.length, 'bytes,', plainStr.length, 'characters',
		'\nEncoded size:', encodedStr.length * 3, 'bytes,', encodedStr.length, 'characters');
}

// Extract received ciphertext
function initExtractData() {
	textarea[5].maxLength = 0x7FFFFFFF;
	clearInPlain();
	setTimeout(() => {
		extractData(decodeBytes(textarea[5].value));
	}, 0);
}

function extractData(bytes) {
	// Check protocol signature and version
	if (!bytes.length || (bytes[0] != 0x44 && bytes[1] != 0x0)) {
		textarea[6].lastChild.classList.add('error');
		if (!bytes.length)
			outputError('No message detected');
		else {
			outputError('Protocol mismatch', '\nData: ' + new TextDecoder().decode(bytes));
			if (seqLens.length)
				extractData(bytes.slice(seqLens.shift()));
		}
		return;
	}
	// Get length of variable length quantity data length field
	// by checking the first bit of each byte from VLQ start position
	let VLQLen = 0;
	while (bytes[6 + ++VLQLen] & 0x80) {}
	// Get start position of data field
	const dataStart = 7 + VLQLen;
	const header = bytes.slice(2, dataStart);
	// Get data type field
	const dataType = header[4];
	// Get end position of data field
	const dataEnd = dataStart + decodeLength(header.slice(5));
	// Get data field
	const data = bytes.slice(dataStart, dataEnd);
	console.info('Original size:', data.length, 'bytes',
		'\nEncoded size:', dataEnd * 6, 'bytes,', dataEnd * 2, 'characters');
	// Check CRC-32
	const crcMatch = crc32(data).every((v, i) => v === header[i]);

	switch (dataType) {
		case 0x1:
			outputText(data, crcMatch);
			break;
		case 0x2:
			outputFile(data, crcMatch);
			break;
		case 0x0:
		default:
			console.error('Unsupported data type');
	}

	if (crcMatch) {
		if (dataEnd < seqLens[0])
			// Update sequence length for concatenated messages
			seqLens[0] -= dataEnd;
		else
			// Discard sequence length if no concatenation
			seqLens.shift();
	}
	// Recurse until all messages extracted
	if (bytes.length > dataEnd)
		// If CRC mismatch, discard current sequence
		extractData(bytes.slice(crcMatch ? dataEnd : seqLens.shift()));
}

const autolinker = new Autolinker({
	stripPrefix: false,
	stripTrailingSlash: false,
	hashtag: 'twitter',
	replaceFn: function (match) {
		if (match.getType() === 'url') {
			// Collect embeddable URLs
			const url = match.getUrl();
			const ext = (m => m && m[1])(/\.(\w{3,4})$/.exec(url));
			if (ext) {
				if (/^(jpe?g|gif|png|bmp|svg)$/i.test(ext))
					embeds.push({ type: 'image', url });
				else if (/^(mp4|webm|gifv|ogv)$/i.test(ext))
					embeds.push({ type: 'video', url });
				else if (/^(mp3|wav|ogg)$/i.test(ext))
					embeds.push({ type: 'audio', url });
			} else {
				// Extract ID and timestamp components
				const youtube = /youtu(?:\.be\/|be\.com\/(?:embed\/|.*v=))([\w-]+)(?:.*start=(\d+)|.*t=(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?)?/.exec(url);
				if (youtube)
					embeds.push({ type: 'youtube', id: youtube[1], h: youtube[3] || 0, m: youtube[4] || 0, s: youtube[5] || youtube[2] || 0 });
				const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
				if (vimeo)
					embeds.push({ type: 'vimeo', id: vimeo[1] });
			}
		}
		return match.buildTag().setAttr('tabindex', -1);
	}
});

function outputText(bytes, crcMatch) {
	window.embeds = [];
	const references = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;'
	};
	const textDiv = getTextDiv();
	// 1. Decode byte array to UTF-8
	// 2. Sanitize unsafe HTML characters
	// 3. Linkify URLs
	textDiv.innerHTML = autolinker.link(new TextDecoder().decode(bytes).replace(/[&<>]/g, c => references[c]));

	if (!crcMatch) {
		textDiv.classList.add('error');
		outputError('CRC mismatch');
	}

	if (embeds.length) {
		// Generate embed container
		const embedDiv = document.createElement('div');
		embedDiv.className = 'embed-div';
		// Embed media
		for (var i = 0; i < embeds.length; i++) {
			switch (embeds[i].type) {
				case 'image':
					const div = document.createElement('div');
					div.className = 'embed-img-container blocked';
					const img = document.createElement('img');
					img.className = 'embed';
					img.onerror = function () { this.style.display = 'none'; };
					img.onload = function () { checkZoomable(this); };
					img.onclick = function () { clickImage(this); };
					img.src = embeds[i].url;
					div.appendChild(img);
					embedDiv.appendChild(div);
					break;
				case 'video':
				case 'audio':
					const media = document.createElement(embeds[i].type);
					media.className = 'embed';
					media.src = embeds[i].url.replace(/gifv$/i, 'mp4');
					media.loop = /gifv$/i.test(embeds[i].url) && true;
					media.controls = true;
					media.preload = 'metadata';
					media.tabIndex = -1;
					embedDiv.appendChild(media);
					break;
				case 'youtube':
				case 'vimeo':
					const iframe = document.createElement('iframe');
					iframe.className = 'embed';
					if (embeds[i].type === 'youtube')
						iframe.src = 'https://www.youtube.com/embed/' + embeds[i].id +
							'?start=' + (embeds[i].h * 3600 + embeds[i].m * 60 + parseInt(embeds[i].s));
					else
						iframe.src = 'https://player.vimeo.com/video/' + embeds[i].id;
					iframe.allowFullscreen = true;
					iframe.tabIndex = -1;
					embedDiv.appendChild(iframe);
			}
		}
		textarea[6].appendChild(embedDiv);
	}
	window.embeds = null;

	flashBorder(textDiv, 'decoded', 1000);
}

function outputFile(bytes, crcMatch) {
	// Slice byte array by null terminators
	let nullPos = [];
	for (var i = 0, bLen = bytes.length; i < bLen; i++) {
		if (!bytes[i]) {
			nullPos.push(i);
			if (nullPos.length > 1)
				break;
		}
	}
	const type = new TextDecoder().decode(bytes.slice(0, nullPos[0]));
	const name = new TextDecoder().decode(bytes.slice(nullPos[0] + 1, nullPos[1]));
	const blob = new Blob([bytes.slice(nullPos[1] + 1)], { type });

	// Generate file details UI
	const textDiv = getTextDiv();
	textDiv.textContent = name;
	const info = document.createElement('p');
	info.className = 'file-info';
	info.textContent = (type || 'unknown') + ', ' + blob.size + ' bytes';
	textDiv.appendChild(info);
	const link = document.createElement('a');
	link.className = 'file-download';
	link.href = window.URL.createObjectURL(blob);
	link.download = name;
	link.textContent = 'Download';
	textDiv.appendChild(link);

	if (!crcMatch) {
		textDiv.classList.add('error');
		outputError('CRC mismatch');
	}

	flashBorder(textDiv, 'decoded', 1000);
}

function getTextDiv() {
	let textDiv;
	if (textarea[6].lastChild.innerHTML) {
		// Generate pseudo-textarea
		textDiv = document.createElement('div');
		textDiv.className = 'text-div';
		textDiv.onfocus = function () { selectText(this); };
		textDiv.tabIndex = -1;
		textarea[6].appendChild(textDiv);
	}
	textDiv = textarea[6].lastChild;
	return textDiv;
}

function dragOverFiles(e) {
	e.stopPropagation();
	e.dataTransfer.dropEffect = 'copy';

	if ((a => a[a.length - 1])(e.dataTransfer.types) === 'Files') {
		e.preventDefault();
		const dropTarget = document.getElementById('drop-target');
		dropTarget.style.display = 'block';
		dropTarget.addEventListener('dragleave', dragLeaveFiles);
	}
}

function dragLeaveFiles() {
	const dropTarget = document.getElementById('drop-target');
	dropTarget.removeEventListener('dragleave', dragLeaveFiles);
	dropTarget.style.display = 'none';
}

function dropFiles(e) {
	e.stopPropagation();
	e.preventDefault();
	dragLeaveFiles();

	const files = e.dataTransfer.files;
	readFiles(files);
}

function readFiles(files) {
	for (var i = 0; i < files.length; i++)
		(file => {
			const reader = new FileReader();
			reader.onload = () => {
				encodeFile(new Uint8Array(reader.result), file.type, file.name);
			};
			reader.readAsArrayBuffer(file);
		})(files[i]);
}

// Convert file header and byte array to encoding characters and push to output queue
function encodeFile(bytes, type, name) {
	const head = new TextEncoder().encode(type + '\0' + name + '\0');
	let pack = new Uint8Array(head.length + bytes.length);
	pack.set(head);
	pack.set(bytes, head.length);
	// 0x44 0x0 == 'D\u0000' protocol signature and version
	encQueue.push(encodeBytes(0x44, 0x0, crc32(pack), 0x2, encodeLength(pack.length), pack));
	console.info('File:', name + ',', (type || 'unknown'),
		'\nOriginal size:', bytes.length, 'bytes',
		'\nEncoded size:', pack.length * 3, 'bytes');

	// Generate file details UI
	const textDiv = document.createElement('div');
	textDiv.className = 'text-div';
	textDiv.textContent = name;
	const remove = document.createElement('button');
	remove.className = 'file-remove';
	remove.onclick = function () { removeFile(this); };
	remove.tabIndex = -1;
	remove.innerHTML = '&times;';
	textDiv.appendChild(remove);
	const info = document.createElement('p');
	info.className = 'file-info';
	info.textContent = (type || 'unknown') + ', ' + bytes.length + ' bytes';
	textDiv.appendChild(info);
	textarea[2].parentElement.appendChild(textDiv);
}

function removeFile(el) {
	const textDiv = el.parentElement;
	const parent = textDiv.parentElement;
	const index = Array.prototype.indexOf.call(parent.children, textDiv) - 1;
	encQueue.splice(index, 1);
	parent.removeChild(textDiv);
}

// Encode data length as variable length quantity in byte array
function encodeLength(n) {
	let bytes = [n & 0x7F];
	while (n > 127) {
		n >>= 7;
		bytes.unshift(n & 0x7F | 0x80);
	}
	return Uint8Array.from(bytes);
}

// Decode VLQ to integer
function decodeLength(bytes) {
	let len = 0;
	for (var i = 0; i < bytes.length; i++)
		len = len << 7 | bytes[i] & 0x7F;
	return len;
}

// Convert byte arrays to encoding characters
function encodeBytes(...args) {
	const encChars = window.encChars;
	let out = '';
	for (var i = 0; i < args.length; i++) {
		if (!(args[i] instanceof Uint8Array))
			args[i] = Uint8Array.of(args[i]);
		for (var j = 0, aLen = args[i].length; j < aLen; j++)
			out += encChars[args[i][j] >> 4] + encChars[args[i][j] & 0xF];
	}
	return out;
}

// Convert encoding characters in string to byte array
function decodeBytes(str) {
	const encVals = window.encVals;
	// Collect encoding characters and translate to half-bytes
	window.seqLens = [];
	let nybles = [];
	for (var i = 0, sLen = str.length; i < sLen;) {
		var val = encVals[str[i++]];
		if (val !== undefined) {
			var seq = [];
			do {
				seq.push(val);
				val = encVals[str[i++]];
			} while (val !== undefined);
			// Ignore short sequences of encoding characters
			if (seq.length >= 16) {
				// If sequence is truncated by an odd number of half-bytes,
				// drop last half-byte to preserve byte alignment
				if (seq.length & 1) seq.pop();
				nybles = nybles.concat(seq);
				seqLens.push(seq.length >> 1);
			}
		}
	}
	// Convert half-bytes to bytes
	let bytes = [];
	for (var i = 0, nLen = nybles.length; i < nLen; i += 2)
		bytes.push(nybles[i] << 4 | nybles[i + 1]);
	return Uint8Array.from(bytes);
}

// Filter encoding characters out of string
function filterStr(str) {
	const encVals = window.encVals;
	let out = '';
	for (var i = 0, sLen = str.length; i < sLen; i++)
		if (encVals[str[i]] === undefined)
			out += str[i];
	return out;
}

function makeCRCTable() {
	let crcTable = [];
	let c;
	for (var n = 0; n < 256; n++) {
		c = n;
		for (var k = 0; k < 8; k++)
			c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
		crcTable[n] = c;
	}
	return crcTable;
}

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

function outputError(msg, details) {
	console.error(msg, details || '');
	if (textarea[6].lastChild.classList.contains('error-div')) return;
	const errorDiv = document.createElement('div');
	errorDiv.className = 'notify error-div';
	errorDiv.textContent = msg.toUpperCase();
	textarea[6].appendChild(errorDiv);
}

function flashBorder(el, style, ms) {
	el.classList.add(style);
	setTimeout(() => {
		el.classList.remove(style);
	}, ms);
}

function selectText(el) {
	const range = document.createRange();
	const selection = window.getSelection();
	range.selectNodeContents(el);
	selection.removeAllRanges();
	selection.addRange(range);
}

function clearOutPlain() {
	encQueue = [];
	const outPlainParent = textarea[2].parentElement;
	while (outPlainParent.childNodes.length > 1)
		outPlainParent.removeChild(outPlainParent.lastChild);
	textarea[2].value = '';
	resizeTextarea(textarea[2]);
	textarea[2].focus();
}

function clearOut() {
	textarea[3].value = '';
	textarea[4].value = '';
	resizeTextarea(textarea[3]);
	resizeTextarea(textarea[4]);
	textarea[3].focus();
}

function clearIn() {
	clearInPlain();
	textarea[5].value = '';
	resizeTextarea(textarea[5]);
	textarea[5].focus();
}

function clearInPlain() {
	const inPlain = textarea[6];
	inPlain.firstChild.innerHTML = '';
	inPlain.firstChild.className = 'text-div';
	while (inPlain.childNodes.length > 1)
		inPlain.removeChild(inPlain.lastChild);
}

function clickImage(el) {
	const parent = el.parentElement;
	if (parent.classList.contains('blocked'))
		parent.classList.remove('blocked');
	else if (el.classList.contains('zoomable')) {
		const fontSize = parseFloat(document.documentElement.style.fontSize);
		// Clone clicked image at same position
		const zoom = el.cloneNode();
		zoom.id = 'zoom';
		zoom.style.top = el.height * 0.5 + fontSize * 0.1 + parent.offsetTop + parent.offsetParent.offsetTop - document.body.scrollTop + 'px';
		zoom.style.left = el.width * 0.5 + fontSize * 0.1 + parent.offsetLeft + 'px';
		zoom.onclick = function () { unzoomImage(); };
		const bg = document.createElement('div');
		bg.id = 'background';
		bg.className = 'fade-in';
		bg.onclick = function () { unzoomImage(); };
		document.body.appendChild(bg);
		document.body.appendChild(zoom);
		// Force element reflow to enable transition
		void zoom.offsetWidth;
		zoom.removeAttribute('style');
		// Zoom image
		zoom.className = 'zoom-end';
		window.zoomedImage = el;
	}
}

function unzoomImage() {
	const fontSize = parseFloat(document.documentElement.style.fontSize);
	const parent = zoomedImage.parentElement;
	const zoom = document.getElementById('zoom');
	// Unzoom image
	zoom.style.top = zoomedImage.height * 0.5 + fontSize * 0.1 + parent.offsetTop + parent.offsetParent.offsetTop - document.body.scrollTop + 'px';
	zoom.style.left = zoomedImage.width * 0.5 + fontSize * 0.1 + parent.offsetLeft + 'px';
	zoom.style.width = zoomedImage.width + 'px';
	window.zoomedImage = null;
	const bg = document.getElementById('background');
	bg.style.animationDirection = 'reverse';
	bg.className = '';
	// Force element reflow to restart animation
	void bg.offsetWidth;
	bg.className = 'fade-in';
	zoom.addEventListener('transitionend', function removeZoom() {
		zoom.removeEventListener('transitionend', removeZoom);
		document.body.removeChild(zoom);
		document.body.removeChild(bg);
	});
}

function checkZoomable(el) {
	const embedWidth = textarea[6].scrollWidth;
	if (el) {
		if (el.naturalWidth > embedWidth)
			el.classList.add('zoomable');
		return;
	}
	const images = textarea[6].getElementsByTagName('img');
	for (var i = 0; i < images.length; i++) {
		if (images[i].naturalWidth > embedWidth)
			images[i].classList.add('zoomable');
		else
			images[i].classList.remove('zoomable');
	}
}

function clickNav(el) {
	const labels = document.getElementsByTagName('label');
	for (var i = 0; i < 2; i++)
		labels[i].classList.remove('selected');
	el.classList.add('selected');
	if (el.getAttribute('for') === 'nav-main')
		setTimeout(() => { resizeBody(); }, 0);
}

// Scale elements according to viewport size
function resizeBody() {
	if (window.innerWidth > 480 && screen.width > 480)
		document.documentElement.style.fontSize = Math.min(window.innerWidth, window.innerHeight) * 0.03 + 'px';
	else
		document.documentElement.style.fontSize = Math.min(window.innerWidth, window.innerHeight * 1.2) * 0.04 + 'px';
	for (var i = 0; i < 6; i++)
		resizeTextarea(textarea[i]);
	checkZoomable();
}

// Scale textarea according to font size
function resizeTextarea(el) {
	const fontSize = parseFloat(document.documentElement.style.fontSize);
	el.style.height = '';
	el.style.height = Math.min(el.scrollHeight + fontSize * 0.3, fontSize * 12) + 'px';
}
