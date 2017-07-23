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
	document.addEventListener('dragover', dragOverFile, false);
	document.addEventListener('drop', dropFile, false);

	new Clipboard('#out-copy', {
		text: () => { embedData(); }
	});

	// Service worker caches page for offline use
	if ('serviceWorker' in navigator)
		navigator.serviceWorker.register('/doublespeak/sw.js');

	if (/Mac|iP(hone|od|ad)/.test(navigator.userAgent)) {
		textarea[2].placeholder = 'Copy [Command+C] output ciphertext';
		textarea[3].placeholder = 'Paste [Command+V] input ciphertext';
	}
};

// Mirror cover text to ciphertext box, pretending to embed data
// Embed does not actually occur until copy event
// Visual cues are still important for intuitive UX
function mirrorCover() {
	textarea[2].value = textarea[1].value;
	resizeTextarea(textarea[2]);
	// Flash textarea border
	textarea[2].classList.add('encoded');
	window.setTimeout(function () {
		textarea[2].classList.remove('encoded');
	}, 200);
}

// Embed plaintext in cover text
function embedData() {
	// Filter out ciphertext to prevent double encoding
	var plainStr = textarea[0].value.replace(encRegex, '');
	var bytes = new TextEncoder().encode(plainStr);
	// 0x44 0x0 == 'D\u0000' protocol signature and version
	var encodedStr = bytes.length > 0 ? encodeBytes(0x44, 0x0, crc32(bytes), 0x1,
		encodeLength(bytes.length), bytes) : '';
	var coverStr = textarea[1].value.replace(encRegex, '');
	// Select random position in cover text to insert encoded text
	var insertPos = Math.floor(Math.random() * (coverStr.length - 1) + 1);
	textarea[2].value = coverStr.slice(0, insertPos) + encodedStr + coverStr.slice(insertPos);
	console.info('Original size:', bytes.length, 'bytes,', plainStr.length, 'characters',
		'\nEncoded size:', encodedStr.length * 3, 'bytes,', encodedStr.length, 'characters');
}

// Extract received ciphertext
function initExtractData() {
	textarea[3].maxLength = 0x7FFFFFFF;
	clearInPlain();
	window.setTimeout(function () {
		// Discard cover text
		extractData(textarea[3].value.match(encRegex).join(''));
	}, 1);
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
		console.error('CRC-32 mismatch');
		textDiv.classList.add('error');
		var errorDiv = document.createElement('div');
		errorDiv.className = 'notify error-div';
		errorDiv.innerHTML = 'CRC MISMATCH';
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
	delete window.embeds;
	// Flash textarea border
	textDiv.classList.add('decoded');
	window.setTimeout(function () {
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
		bytes.push((encVals[str[i]] << 4) + encVals[str[i + 1]]);
	return Uint8Array.from(bytes);
}

var crcTable = [0x0, 0x77073096, 0xee0e612c, 0x990951ba, 0x76dc419, 0x706af48f, 0xe963a535, 0x9e6495a3, 0xedb8832, 0x79dcb8a4, 0xe0d5e91e, 0x97d2d988, 0x9b64c2b, 0x7eb17cbd, 0xe7b82d07, 0x90bf1d91, 0x1db71064, 0x6ab020f2, 0xf3b97148, 0x84be41de, 0x1adad47d, 0x6ddde4eb, 0xf4d4b551, 0x83d385c7, 0x136c9856, 0x646ba8c0, 0xfd62f97a, 0x8a65c9ec, 0x14015c4f, 0x63066cd9, 0xfa0f3d63, 0x8d080df5, 0x3b6e20c8, 0x4c69105e, 0xd56041e4, 0xa2677172, 0x3c03e4d1, 0x4b04d447, 0xd20d85fd, 0xa50ab56b, 0x35b5a8fa, 0x42b2986c, 0xdbbbc9d6, 0xacbcf940, 0x32d86ce3, 0x45df5c75, 0xdcd60dcf, 0xabd13d59, 0x26d930ac, 0x51de003a, 0xc8d75180, 0xbfd06116, 0x21b4f4b5, 0x56b3c423, 0xcfba9599, 0xb8bda50f, 0x2802b89e, 0x5f058808, 0xc60cd9b2, 0xb10be924, 0x2f6f7c87, 0x58684c11, 0xc1611dab, 0xb6662d3d, 0x76dc4190, 0x1db7106, 0x98d220bc, 0xefd5102a, 0x71b18589, 0x6b6b51f, 0x9fbfe4a5, 0xe8b8d433, 0x7807c9a2, 0xf00f934, 0x9609a88e, 0xe10e9818, 0x7f6a0dbb, 0x86d3d2d, 0x91646c97, 0xe6635c01, 0x6b6b51f4, 0x1c6c6162, 0x856530d8, 0xf262004e, 0x6c0695ed, 0x1b01a57b, 0x8208f4c1, 0xf50fc457, 0x65b0d9c6, 0x12b7e950, 0x8bbeb8ea, 0xfcb9887c, 0x62dd1ddf, 0x15da2d49, 0x8cd37cf3, 0xfbd44c65, 0x4db26158, 0x3ab551ce, 0xa3bc0074, 0xd4bb30e2, 0x4adfa541, 0x3dd895d7, 0xa4d1c46d, 0xd3d6f4fb, 0x4369e96a, 0x346ed9fc, 0xad678846, 0xda60b8d0, 0x44042d73, 0x33031de5, 0xaa0a4c5f, 0xdd0d7cc9, 0x5005713c, 0x270241aa, 0xbe0b1010, 0xc90c2086, 0x5768b525, 0x206f85b3, 0xb966d409, 0xce61e49f, 0x5edef90e, 0x29d9c998, 0xb0d09822, 0xc7d7a8b4, 0x59b33d17, 0x2eb40d81, 0xb7bd5c3b, 0xc0ba6cad, 0xedb88320, 0x9abfb3b6, 0x3b6e20c, 0x74b1d29a, 0xead54739, 0x9dd277af, 0x4db2615, 0x73dc1683, 0xe3630b12, 0x94643b84, 0xd6d6a3e, 0x7a6a5aa8, 0xe40ecf0b, 0x9309ff9d, 0xa00ae27, 0x7d079eb1, 0xf00f9344, 0x8708a3d2, 0x1e01f268, 0x6906c2fe, 0xf762575d, 0x806567cb, 0x196c3671, 0x6e6b06e7, 0xfed41b76, 0x89d32be0, 0x10da7a5a, 0x67dd4acc, 0xf9b9df6f, 0x8ebeeff9, 0x17b7be43, 0x60b08ed5, 0xd6d6a3e8, 0xa1d1937e, 0x38d8c2c4, 0x4fdff252, 0xd1bb67f1, 0xa6bc5767, 0x3fb506dd, 0x48b2364b, 0xd80d2bda, 0xaf0a1b4c, 0x36034af6, 0x41047a60, 0xdf60efc3, 0xa867df55, 0x316e8eef, 0x4669be79, 0xcb61b38c, 0xbc66831a, 0x256fd2a0, 0x5268e236, 0xcc0c7795, 0xbb0b4703, 0x220216b9, 0x5505262f, 0xc5ba3bbe, 0xb2bd0b28, 0x2bb45a92, 0x5cb36a04, 0xc2d7ffa7, 0xb5d0cf31, 0x2cd99e8b, 0x5bdeae1d, 0x9b64c2b0, 0xec63f226, 0x756aa39c, 0x26d930a, 0x9c0906a9, 0xeb0e363f, 0x72076785, 0x5005713, 0x95bf4a82, 0xe2b87a14, 0x7bb12bae, 0xcb61b38, 0x92d28e9b, 0xe5d5be0d, 0x7cdcefb7, 0xbdbdf21, 0x86d3d2d4, 0xf1d4e242, 0x68ddb3f8, 0x1fda836e, 0x81be16cd, 0xf6b9265b, 0x6fb077e1, 0x18b74777, 0x88085ae6, 0xff0f6a70, 0x66063bca, 0x11010b5c, 0x8f659eff, 0xf862ae69, 0x616bffd3, 0x166ccf45, 0xa00ae278, 0xd70dd2ee, 0x4e048354, 0x3903b3c2, 0xa7672661, 0xd06016f7, 0x4969474d, 0x3e6e77db, 0xaed16a4a, 0xd9d65adc, 0x40df0b66, 0x37d83bf0, 0xa9bcae53, 0xdebb9ec5, 0x47b2cf7f, 0x30b5ffe9, 0xbdbdf21c, 0xcabac28a, 0x53b39330, 0x24b4a3a6, 0xbad03605, 0xcdd70693, 0x54de5729, 0x23d967bf, 0xb3667a2e, 0xc4614ab8, 0x5d681b02, 0x2a6f2b94, 0xb40bbe37, 0xc30c8ea1, 0x5a05df1b, 0x2d02ef8d];

function crc32(bytes) {
	var crcTable = window.crcTable;
	var crc = (bytes.reduce(function (crc, b) {
		return (crc >>> 8) ^ crcTable[(crc ^ b) & 0xFF];
	}, -1) ^ -1) >>> 0;
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
	textarea[0].value = '';
	resizeTextarea(textarea[0]);
	embedData();
	textarea[0].focus();
}

function clearOut() {
	textarea[1].value = '';
	resizeTextarea(textarea[1]);
	mirrorCover();
	textarea[1].focus();
}

function clearIn() {
	clearInPlain();
	textarea[3].value = '';
	resizeTextarea(textarea[3]);
	textarea[3].focus();
}

function clearInPlain() {
	var inPlain = textarea[4];
	inPlain.firstChild.innerHTML = '';
	inPlain.firstChild.className = 'text-div';
	while (inPlain.childNodes.length > 1)
		inPlain.removeChild(inPlain.lastChild);
}

function notifyCopy(el, copied) {
	el = document.getElementById(el);
	copied = document.getElementById(copied);
	el.classList.add('copied');
	copied.classList.add('copied');
	window.setTimeout(function () {
		el.classList.remove('copied');
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
		window.zoomedImage = el;
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
	delete window.zoomedImage;
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
