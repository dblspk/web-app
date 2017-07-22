var encVals = {
	'\u061C': 0,  // Arabic letter mark
	'\u180E': 1,  // Mongolian vowel separator
	'\u200B': 2,  // zero width space
	'\u200C': 3,  // zero width non-joiner
	'\u200D': 4,  // zero width joiner
	'\u200E': 5,  // left-to-right mark
	'\u200F': 6,  // right-to-left mark
	'\u202A': 7,  // left-to-right embedding
	'\u202B': 8,  // right-to-left embedding
	'\u202D': 9,  // left-to-right override
	'\u202E': 10, // right-to-left override
	'\u2060': 11, // word joiner
	'\u2061': 12, // function application
	'\u2062': 13, // invisible times
	'\u2063': 14, // invisible separator
	'\uFEFF': 15  // zero width non-breaking space
};
var encChars = Object.keys(encVals);
var encRegex = /[\u061C\u180E\u200B-\u200F\u202A\u202B\u202D\u202E\u2060-\u2063\uFEFF]/g;
var textarea = [];

document.onreadystatechange = function () {
	if (!window.TextEncoder) {
		var script = document.createElement('script');
		script.src = 'polyfills/text-encoding.js';
		document.head.appendChild(script);
	}

	var textareas = [
		'out-plain',
		'out-cover',
		'out-cipher',
		'in-cipher',
		'in-plain'
	];
	for (var i = 0; i < 5; i++)
		textarea[i] = document.getElementById(textareas[i]);

	resizeBody();
	new Clipboard('.copy');
	document.addEventListener('dragover', dragOverFile, false);
	document.addEventListener('drop', dropFile, false);

	// Service worker caches page for offline use
	if ('serviceWorker' in navigator)
		navigator.serviceWorker.register('/doublespeak/sw.js');

	if (/Mac|iP(hone|od|ad)/.test(navigator.userAgent)) {
		textarea[2].placeholder = 'Copy [Command+C] output ciphertext';
		textarea[3].placeholder = 'Paste [Command+V] input ciphertext';
	}
};

// Embed plaintext in cover text
function embedData() {
	// Filter out ciphertext to prevent double encoding
	var plaintext = textarea[0].value.replace(encRegex, '');
	// 0x44 0x0 == 'D\u0000' protocol signature and version
	var encodedStr = plaintext ? (data => encodeBytes(0x44, 0x0, crc32(plaintext), 0x1,
		encodeLength(data.length >> 1)) + data)(encodeUTF8(plaintext)) : '';
	var coverStr = textarea[1].value.replace(encRegex, '');
	// Select random position in cover text to insert encoded text
	var insertPos = Math.floor(Math.random() * (coverStr.length - 1) + 1);
	textarea[2].value = coverStr.slice(0, insertPos) + encodedStr + coverStr.slice(insertPos);
	resizeTextarea(textarea[2]);
	// Flash textarea border
	textarea[2].classList.add('encode');
	window.setTimeout(function () {
		textarea[2].classList.remove('encode');
	}, 200);
}

// Extract received ciphertext
function initExtractData() {
	textarea[3].maxLength = 0x7FFFFFFF;
	clearInPlain();
	window.setTimeout(function () {
		// Discard cover text
		extractData(textarea[3].value.match(encRegex));
	}, 1);
}

function extractData(str) {
	// Check protocol signature and revision
	if (!str || decodeBytes(str.slice(0, 4)).toString() !== '68,0') {
		console.error(!str ? 'No message detected' : 'Protocol mismatch\nData: ' + decodeUTF8(str));
		return;
	}
	// Get length of variable length quantity data length field by checking
	// the first bit of each byte from VLQ start position in its encoded form
	var VLQLen = 1;
	while (encVals[str[12 + VLQLen * 2]] > 7)
		VLQLen++;
	var dataStart = 14 + VLQLen * 2;
	var header = decodeBytes(str.slice(4, dataStart));
	// Get data type field
	var dataType = header[4];
	// Get length and end position of data field
	var dataLen = decodeLength(header.slice(5));
	var dataEnd = dataStart + dataLen * 4;
	var data = decodeUTF8(str.slice(dataStart, dataEnd));
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
					embeds.push({ type: 'image', 'url': url });
				else if (/^(mp4|webm|gifv|ogv)$/i.test(ext))
					embeds.push({ type: 'video', 'url': url });
				else if (/^(mp3|wav|ogg)$/i.test(ext))
					embeds.push({ type: 'audio', 'url': url });
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

function outputText(str, crcMatch) {
	// Create deletable property on global object
	embeds = [];
	var outputStr = autolinker.link(str);
	var textDiv;
	if (textarea[4].lastChild.innerHTML) {
		// Generate pseudo-textarea
		textDiv = document.createElement('div');
		textDiv.className = 'text-div';
		textDiv.onfocus = function () { selectText(this); };
		textDiv.tabIndex = -1;
		textarea[4].appendChild(textDiv);
	}
	textDiv = textarea[4].lastChild;
	// Output text
	textDiv.innerHTML = outputStr;
	if (!crcMatch) {
		// Notify of CRC fail
		textDiv.classList.add('error');
		var errorDiv = document.createElement('div');
		errorDiv.className = 'notify error-div';
		errorDiv.innerHTML = 'CRC FAILED';
		textarea[4].appendChild(errorDiv);
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
		textarea[4].appendChild(embedDiv);
	}
	delete embeds;
	// Flash textarea border
	textDiv.classList.add('decode');
	window.setTimeout(function () {
		textDiv.classList.remove('decode');
	}, 1000);
}

// Encode length of data as variable length quantity in byte array
function encodeLength(n) {
	var bytes = [n & 0x7F];
	while (n > 127) {
		n >>= 7;
		bytes.unshift(n & 0x7F | 0x80);
	}
	return Uint8Array.from(bytes);
}

// Decode VLQ to integer
function decodeLength(byteArray) {
	var len = 0;
	for (var i = 0; i < byteArray.length; i++)
		len = len << 7 | byteArray[i] & 0x7F;
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

// Convert encoding characters to byte arrays
function decodeBytes(str) {
	var bytes = [];
	var encVals = window.encVals;
	for (var i = 0, sLen = str.length; i < sLen; i += 2)
		bytes.push((encVals[str[i]] << 4) + encVals[str[i + 1]]);
	return Uint8Array.from(bytes);
}

// Convert UTF-8 to encoding characters
function encodeUTF8(str) {
	var out = '';
	var encChars = window.encChars;
	var bytes = new TextEncoder().encode(str);
	for (var i = 0, bLen = bytes.length; i < bLen; i++)
		out += encChars[bytes[i] >> 4] + encChars[bytes[i] & 0xF];
	return out;
}

// Convert encoding characters to UTF-8
function decodeUTF8(str) {
	var bytes = [];
	var encVals = window.encVals;
	for (var i = 0, sLen = str.length / 2; i < sLen; i++) {
		bytes[i] = (encVals[str[i * 2]] << 4) + encVals[str[i * 2 + 1]];
	}
	var out = new TextDecoder().decode(Uint8Array.from(bytes));
	// Sanitize unsafe HTML characters
	var references = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;'
	};
	return out.replace(/[&<>]/g, c => references[c]);
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

function crc32(str) {
	var crcTable = window.crcTable || (window.crcTable = makeCRCTable());
	var crc = 0 ^ -1;
	for (var i = 0, sLen = str.length; i < sLen; i++)
		crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xFF];
	return numToByteArray((crc ^ -1) >>> 0, 4);
}

function numToByteArray(num, size) {
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
	textarea[0].value = '';
	resizeTextarea(textarea[0]);
	embedData();
	textarea[0].focus();
}

function clearOut() {
	textarea[1].value = '';
	resizeTextarea(textarea[1]);
	embedData();
	textarea[1].focus();
}

function clearIn() {
	clearInPlain();
	textarea[3].value = '';
	resizeTextarea(textarea[3]);
	textarea[3].focus();
}

function clearInPlain() {
	textarea[4].firstChild.innerHTML = '';
	textarea[4].firstChild.className = 'text-div';
	while (textarea[4].childNodes.length > 1)
		textarea[4].removeChild(textarea[4].lastChild);
}

function notifyCopy(el, copied) {
	el = document.getElementById(el);
	copied = document.getElementById(copied);
	el.classList.add('copy');
	copied.classList.add('show');
	window.setTimeout(function () {
		el.classList.remove('copy');
		copied.classList.remove('show');
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
		zoom.style.top = el.height * 0.5 + fontSize * 0.1 + parent.offsetTop - document.body.scrollTop + 'px';
		zoom.style.left = el.width * 0.5 + fontSize * 0.1 + parent.offsetLeft + parent.offsetParent.offsetLeft + 'px';
		zoom.onclick = function () { unzoomImage(); };
		var bg = document.createElement('div');
		bg.id = 'background';
		bg.className = 'fade';
		bg.onclick = function () { unzoomImage(); };
		document.body.appendChild(bg);
		document.body.appendChild(zoom);
		// Force element reflow to enable transition
		void zoom.offsetWidth;
		zoom.removeAttribute('style');
		// Zoom image
		zoom.className = 'zoom-end';
		// Create deletable property on global object
		zoomedImage = el;
	}
}

function unzoomImage() {
	var fontSize = parseFloat(document.documentElement.style.fontSize);
	var parent = zoomedImage.parentElement;
	var zoom = document.getElementById('zoom');
	// Unzoom image
	zoom.style.top = zoomedImage.height * 0.5 + fontSize * 0.1 + parent.offsetTop - document.body.scrollTop + 'px';
	zoom.style.left = zoomedImage.width * 0.5 + fontSize * 0.1 + parent.offsetLeft + parent.offsetParent.offsetLeft + 'px';
	zoom.style.width = zoomedImage.width + 'px';
	delete zoomedImage;
	var bg = document.getElementById('background');
	bg.style.animationDirection = 'reverse';
	bg.className = '';
	// Force element reflow to restart animation
	void bg.offsetWidth;
	bg.className = 'fade';
	zoom.addEventListener('transitionend', function removeZoom() {
		zoom.removeEventListener('transitionend', removeZoom);
		document.body.removeChild(zoom);
		document.body.removeChild(bg);
	});
}

function checkZoomable(el) {
	var embedWidth = textarea[4].scrollWidth;
	if (el) {
		if (el.naturalWidth > embedWidth)
			el.classList.add('zoomable');
		return;
	}
	var images = textarea[4].getElementsByTagName('img');
	for (var i = 0; i < images.length; i++) {
		if (images[i].naturalWidth > embedWidth)
			images[i].classList.add('zoomable');
		else
			images[i].classList.remove('zoomable');
	}
}

// Scale elements according to viewport size
function resizeBody() {
	if (window.innerWidth > 480 && screen.width > 480)
		document.documentElement.style.fontSize = Math.min(window.innerWidth, window.innerHeight) * 0.03 + 'px';
	else
		document.documentElement.style.fontSize = Math.min(window.innerWidth, window.innerHeight * 1.2) * 0.04 + 'px';
	for (var i = 0; i < 4; i++)
		resizeTextarea(textarea[i]);
	checkZoomable();
}

// Scale textarea according to font size
function resizeTextarea(el) {
	var fontSize = parseFloat(document.documentElement.style.fontSize);
	el.style.height = '';
	el.style.height = Math.min(el.scrollHeight + fontSize * 0.3, fontSize * 12) + 'px';
}
