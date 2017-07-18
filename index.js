var textarea = [];
var autolinker = new Autolinker({
	stripPrefix: false,
	stripTrailingSlash: false,
	hashtag: 'twitter',
	replaceFn: function (match) {
		if (match.getType() === 'url') {
			// collect embeddable URLs
			var url = match.getUrl();
			var ext = (m => m && m[1])(/\.(\w{3,4})$/.exec(url));
			if (ext) {
				if (/^(jpe?g|gif|png|bmp|svg)$/i.test(ext))
					embeds.push({ type: 'image', 'url': url });
				else if (/^(mp4|webm|gifv|ogv)$/i.test(ext))
					embeds.push({ type: 'video', 'url': url.replace(/gifv$/i, 'mp4') });
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

document.onreadystatechange = function () {
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
	var encodedStr = (val => val ? encodeText('D\u0000\u0000\u0000\u0000\u0000\u0001' +
		encodeLength(val.length) + val) : '')(textarea[0].value.replace(/[\u200B\u200C\u200D\uFEFF]{2,}/g, ''));
	var coverStr = textarea[1].value.replace(/[\u200B\u200C\u200D\uFEFF]{2,}/g, '');
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
		extractData(textarea[3].value.match(/[\u200B\u200C\u200D\uFEFF]/g));
	}, 1);
}

function extractData(str) {
	// console.log(decodeText(str));
	// Check protocol signature and revision
	if (!str || decodeText(str.slice(0, 8)) !== 'D\u0000') {
		console.error(!str ? 'No message detected' : 'Protocol mismatch\nData: ' + decodeText(str));
		return;
	}
	var encodingVals = {
		'\u200B': 0,
		'\u200C': 1,
		'\u200D': 2,
		'\uFEFF': 3
	};
	// Get length of variable length quantity data length field
	var VLQLen = 1;
	while (encodingVals[str[24 + VLQLen * 4]] > 1)
		VLQLen++;
	// console.log('VLQLen', VLQLen);
	var header = decodeText(str.slice(8, 28 + VLQLen * 4));
	// Read data type field
	var dataType = header[4];
	// Get length and end position of data field
	var dataLen = decodeLength(header.slice(5));
	var dataEnd = 28 + (VLQLen + dataLen) * 4;
	// console.log('dataEnd', dataEnd, 'length', str.length);

	switch (dataType) {
		case '\u0001':
			outputText(str.slice(28 + VLQLen * 4, dataEnd));
			break;
		case '\u0002':
		case '\u0000':
		default:
			console.warn('Only text decoding is supported at this time.');
	}

	// Recurse until all messages extracted
	if (str.length > dataEnd)
		extractData(str.slice(dataEnd));
}

function outputText(str) {
	embeds = [];
	var outputStr = autolinker.link(decodeText(str));
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
					media.src = embeds[i].url;
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

// Encode length of data as variable length quantity in binary string form
function encodeLength(n) {
	var outputStr = String.fromCharCode(n & 0x7F);
	while (n > 127) {
		n >>= 7;
		outputStr = String.fromCharCode(n & 0x7F | 0x80) + outputStr;
	}
	return outputStr;
}

// Decode VLQ to integer
function decodeLength(str) {
	var length = 0;
	for (var i = 0; i < str.length; i++)
		length = length << 7 | str.charCodeAt(i) & 0x7F;
	return length;
}

function encodeText(str) {
	var outputStr = '';
	var encodingChars = [
			'\u200B', // zero width space
			'\u200C', // zero width non-joiner
			'\u200D', // zero width joiner
			'\uFEFF'  // zero width non-breaking space
		];
	for (var i = 0, sLen = str.length; i < sLen; i++)
		for (var j = 6; j >= 0; j -= 2)
			outputStr += encodingChars[(str.codePointAt(i) >> j) & 0x3];
	return outputStr;
}

function decodeText(str) {
	var outputStr = '';
	var encodingVals = {
		'\u200B': 0,
		'\u200C': 1,
		'\u200D': 2,
		'\uFEFF': 3
	};
	var references = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;'
	};
	for (var i = 0, sLen = str.length; i < sLen; i += 4) {
		var charCode = 0;
		for (var j = 0; j < 4; j++)
			charCode += encodingVals[str[i + j]] << (6 - j * 2);
		outputStr += String.fromCodePoint(charCode);
	}
	// Sanitize unsafe HTML characters
	return outputStr.replace(/[&<>]/g, c => references[c]);
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
		zoomedImage = el;
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
	for (var i = 0, iLen = images.length; i < iLen; i++) {
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
