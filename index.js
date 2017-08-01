var encVals = {
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
};
var encChars = Object.keys(encVals);
var encRegex = /[\u200C\u200D\u2060-\u2064\u206A-\u206F\uFE00\uFE01\uFEFF]{8,}/g;
var textarea = [];
var crcTable = makeCRCTable();

document.onreadystatechange = function () {
	if (!window.TextEncoder) {
		var script = document.createElement('script');
		script.src = 'polyfills/text-encoding.js';
		document.head.appendChild(script);
	}

	var textareas = [
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
	document.addEventListener('dragover', dragOverFile, false);
	document.addEventListener('drop', dropFile, false);

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
	// Flash textarea border
	textarea[4].classList.add('encoded');
	setTimeout(() => {
		textarea[4].classList.remove('encoded');
	}, 200);
}

// Embed plaintext in cover text
function embedData() {
	// Filter out ciphertext to prevent double encoding
	var plainStr = ((v => v ? v + ' ' : '')(textarea[0].value) + textarea[2].value +
		(v => v ? ' ' + v : '')(textarea[1].value)).replace(encRegex, '');
	var bytes = new TextEncoder().encode(plainStr);
	// 0x44 0x0 == 'D\u0000' protocol signature and version
	var encodedStr = bytes.length > 0 ? encodeBytes(0x44, 0x0, crc32(bytes), 0x1,
		encodeLength(bytes.length), bytes) : '';
	var coverStr = textarea[3].value.replace(encRegex, '');
	// Select random position in cover text to insert encoded text
	var insertPos = Math.floor(Math.random() * (coverStr.length - 1) + 1);
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
		// Discard cover text
		extractData((m => m && m.join(''))(textarea[5].value.match(encRegex)));
	}, 0);
}

function extractData(str) {
	// Check protocol signature and version
	if (!str || str.slice(0, 4) !== '\u2062\u2062\u200C\u200C') {
		console.error(!str ? 'No message detected' :
			'Protocol mismatch\nData: ' + new TextDecoder().decode(decodeBytes(str)));
		return;
	}
	// Get length of variable length quantity data length field by checking
	// the first bit of each byte from VLQ start position in its encoded form
	var VLQLen = 0;
	while (encVals[str[12 + ++VLQLen * 2]] > 7) {}
	// Get start position of data field
	var dataStart = 14 + VLQLen * 2;
	var header = decodeBytes(str.slice(4, dataStart));
	// Get data type field
	var dataType = header[4];
	// Get end position of data field
	var dataEnd = dataStart + decodeLength(header.slice(5)) * 2;
	var data = decodeBytes(str.slice(dataStart, dataEnd));
	console.info('Original size:', data.length, 'bytes',
		'\nEncoded size:', dataEnd * 3, 'bytes,', dataEnd, 'characters');
	// Check CRC-32
	var crcMatch = crc32(data).every((v, i) => v === header[i]);

	switch (dataType) {
		case 0x1:
			outputText(data, crcMatch);
			break;
		case 0x2:
		case 0x0:
		default:
			console.warn('Only text decoding is supported at this time.');
	}

	// Recurse until all messages extracted
	if (str.length > dataEnd)
		extractData(str.slice(dataEnd));
}

var autolinker = new Autolinker({
	stripPrefix: false,
	stripTrailingSlash: false,
	hashtag: 'twitter',
	replaceFn: function (match) {
		if (match.getType() === 'url') {
			// Collect embeddable URLs
			var url = match.getUrl();
			var ext = (m => m && m[1])(/\.(\w{3,4})$/.exec(url));
			if (ext) {
				if (/^(jpe?g|gif|png|bmp|svg)$/i.test(ext))
					embeds.push({ type: 'image', url });
				else if (/^(mp4|webm|gifv|ogv)$/i.test(ext))
					embeds.push({ type: 'video', url });
				else if (/^(mp3|wav|ogg)$/i.test(ext))
					embeds.push({ type: 'audio', url });
			} else {
				// Extract ID and timestamp components
				var youtube = /youtu(?:\.be\/|be\.com\/(?:embed\/|.*v=))([\w-]+)(?:.*start=(\d+)|.*t=(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?)?/.exec(url);
				if (youtube)
					embeds.push({ type: 'youtube', id: youtube[1], h: youtube[3] || 0, m: youtube[4] || 0, s: youtube[5] || youtube[2] || 0 });
				var vimeo = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
				if (vimeo)
					embeds.push({ type: 'vimeo', id: vimeo[1] });
			}
		}
		return match.buildTag().setAttr('tabindex', -1);
	}
});

function outputText(bytes, crcMatch) {
	window.embeds = [];
	var references = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;'
	};
	// 1. Decode byte array to UTF-8
	// 2. Sanitize unsafe HTML characters
	// 3. Linkify URLs
	var outputStr = autolinker.link(new TextDecoder().decode(bytes).replace(/[&<>]/g, c => references[c]));
	var textDiv;
	if (textarea[6].lastChild.innerHTML) {
		// Generate pseudo-textarea
		textDiv = document.createElement('div');
		textDiv.className = 'text-div';
		textDiv.onfocus = function () { selectText(this); };
		textDiv.tabIndex = -1;
		textarea[6].appendChild(textDiv);
	}
	textDiv = textarea[6].lastChild;
	// Output text
	textDiv.innerHTML = outputStr;
	if (!crcMatch) {
		// Notify of CRC fail
		console.error('CRC-32 mismatch');
		textDiv.classList.add('error');
		var errorDiv = document.createElement('div');
		errorDiv.className = 'notify error-div';
		errorDiv.innerHTML = 'CRC MISMATCH';
		textarea[6].appendChild(errorDiv);
	}
	if (embeds[0]) {
		// Generate embed container
		var embedDiv = document.createElement('div');
		embedDiv.className = 'embed-div';
		// Embed media
		for (var i = 0; i < embeds.length; i++) {
			switch (embeds[i].type) {
				case 'image':
					var div = document.createElement('div');
					div.className = 'embed-img-container blocked';
					var img = document.createElement('img');
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
					var media = document.createElement(embeds[i].type);
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
					var iframe = document.createElement('iframe');
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
	// Flash textarea border
	textDiv.classList.add('decoded');
	setTimeout(() => {
		textDiv.classList.remove('decoded');
	}, 1000);
}

// Encode data length as variable length quantity in byte array
function encodeLength(n) {
	var bytes = [n & 0x7F];
	while (n > 127) {
		n >>= 7;
		bytes.unshift(n & 0x7F | 0x80);
	}
	return Uint8Array.from(bytes);
}

// Decode VLQ to integer
function decodeLength(bytes) {
	var len = 0;
	for (var i = 0; i < bytes.length; i++)
		len = len << 7 | bytes[i] & 0x7F;
	return len;
}

// Convert byte arrays to encoding characters
function encodeBytes(...args) {
	var out = '';
	var encChars = window.encChars;
	for (var i = 0; i < args.length; i++) {
		if (!(args[i] instanceof Uint8Array))
			args[i] = Uint8Array.of(args[i]);
		for (var j = 0, aLen = args[i].length; j < aLen; j++)
			out += encChars[args[i][j] >> 4] + encChars[args[i][j] & 0xF];
	}
	return out;
}

// Convert encoding characters to byte array
function decodeBytes(str) {
	var bytes = [];
	var encVals = window.encVals;
	for (var i = 0, sLen = str.length; i < sLen; i += 2)
		bytes.push(encVals[str[i]] << 4 | encVals[str[i + 1]]);
	return Uint8Array.from(bytes);
}

function makeCRCTable() {
	var c;
	var crcTable = [];
	for (var n = 0; n < 256; n++) {
		c = n;
		for (var k = 0; k < 8; k++)
			c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
		crcTable[n] = c;
	}
	return crcTable;
}

function crc32(bytes) {
	var crcTable = window.crcTable;
	var crc = -1;
	for (var i = 0, bLen = bytes.length; i < bLen; i++)
		crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xFF];
	crc = (crc ^ -1) >>> 0;
	console.info('CRC-32: 0x' + ('0000000' + crc.toString(16)).slice(-8));
	return numToBytes(crc, 4);
}

function numToBytes(num, size) {
	var bytes = [];
	for (var i = (size - 1) * 8; i >= 0; i -= 8)
		bytes.push(num >> i & 0xFF);
	return Uint8Array.from(bytes);
}

function dragOverFile(e) {
	e.stopPropagation();
	e.preventDefault();
	e.dataTransfer.dropEffect = 'copy';
}

function dropFile(e) {
	e.stopPropagation();
	e.preventDefault();

	var file = e.dataTransfer.files[0];
	var reader = new FileReader();
	reader.onload = function () {
		console.log(new Uint8Array(reader.result));
	};
	reader.readAsArrayBuffer(file);
}

function selectText(el) {
	var range = document.createRange();
	var selection = window.getSelection();
	range.selectNodeContents(el);
	selection.removeAllRanges();
	selection.addRange(range);
}

function clearOutPlain() {
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
	var inPlain = textarea[6];
	inPlain.firstChild.innerHTML = '';
	inPlain.firstChild.className = 'text-div';
	while (inPlain.childNodes.length > 1)
		inPlain.removeChild(inPlain.lastChild);
}

function notifyCopy() {
	copied = document.getElementById('out-copied');
	textarea[4].classList.add('copied');
	copied.classList.add('copied');
	setTimeout(() => {
		textarea[4].classList.remove('copied');
		copied.classList.remove('copied');
	}, 800);
}

function clickImage(el) {
	var parent = el.parentElement;
	if (parent.classList.contains('blocked'))
		parent.classList.remove('blocked');
	else if (el.classList.contains('zoomable')) {
		var fontSize = parseFloat(document.documentElement.style.fontSize);
		// Clone clicked image at same position
		var zoom = el.cloneNode();
		zoom.id = 'zoom';
		zoom.style.top = el.height * 0.5 + fontSize * 0.1 + parent.offsetTop + parent.offsetParent.offsetTop - document.body.scrollTop + 'px';
		zoom.style.left = el.width * 0.5 + fontSize * 0.1 + parent.offsetLeft + 'px';
		zoom.onclick = function () { unzoomImage(); };
		var bg = document.createElement('div');
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
	var fontSize = parseFloat(document.documentElement.style.fontSize);
	var parent = zoomedImage.parentElement;
	var zoom = document.getElementById('zoom');
	// Unzoom image
	zoom.style.top = zoomedImage.height * 0.5 + fontSize * 0.1 + parent.offsetTop + parent.offsetParent.offsetTop - document.body.scrollTop + 'px';
	zoom.style.left = zoomedImage.width * 0.5 + fontSize * 0.1 + parent.offsetLeft + 'px';
	zoom.style.width = zoomedImage.width + 'px';
	window.zoomedImage = null;
	var bg = document.getElementById('background');
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
	var embedWidth = textarea[6].scrollWidth;
	if (el) {
		if (el.naturalWidth > embedWidth)
			el.classList.add('zoomable');
		return;
	}
	var images = textarea[6].getElementsByTagName('img');
	for (var i = 0; i < images.length; i++) {
		if (images[i].naturalWidth > embedWidth)
			images[i].classList.add('zoomable');
		else
			images[i].classList.remove('zoomable');
	}
}

function clickNav(el) {
	var labels = document.getElementsByTagName('label');
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
	var fontSize = parseFloat(document.documentElement.style.fontSize);
	el.style.height = '';
	el.style.height = Math.min(el.scrollHeight + fontSize * 0.3, fontSize * 12) + 'px';
}
