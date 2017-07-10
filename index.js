var textarea = [];
var autolinker = new Autolinker({
	stripPrefix: false,
	stripTrailingSlash: false,
	hashtag: 'twitter'
});

document.onreadystatechange = function() {
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

	if (/Mac|iP(hone|od|ad)/.test(navigator.userAgent)) {
		textarea[2].placeholder = 'Copy [Command+C] output ciphertext';
		textarea[3].placeholder = 'Paste [Command+V] input ciphertext';
	}
}

// Embed plaintext in cover text
function embedData() {
	// Filter out ciphertext to prevent double encoding
	var encodedStr = (val => val !== '' ? encodeText('D\u0000\u0000\u0000\u0000\u0000\u0001' + encodeLength(val.length) + val) : '')(textarea[0].value.replace(/[\u200B\u200C\u200D\uFEFF]{2,}/g, ''));
	var coverStr = textarea[1].value.replace(/[\u200B\u200C\u200D\uFEFF]{2,}/g, '');
	var insertPos = Math.floor(Math.random() * (coverStr.length - 1) + 1);
	textarea[2].value = coverStr.slice(0, insertPos) + encodedStr + coverStr.slice(insertPos);
	resizeTextarea(textarea[2]);
	// Flash textarea border
	textarea[2].classList.add('encode');
	window.setTimeout(function() {
		textarea[2].classList.remove('encode');
	}, 200);
}

// Extract received ciphertext
function initExtractData() {
	textarea[3].maxLength = 0x7FFFFFFF;
	clearInPlain();
	window.setTimeout(function() {
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
	//console.log('VLQLen', VLQLen);
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
		case '\u0000':
		case '\u0002':
		default:
			console.warn('Only text decoding is supported at this time.')
	}

	// Recurse until all messages extracted	
	if (str.length > dataEnd)
		extractData(str.slice(dataEnd));
}

function outputText(str) {
	var outputStr = decodeText(str);
	if (textarea[4].lastChild.innerHTML) {
		// Generate textarea-like div
		var div = document.createElement('div');
		div.onfocus = function() { selectText(this); };
		div.tabIndex = -1;
		textarea[4].appendChild(div);
	}
	var div = textarea[4].lastChild;
	div.innerHTML = autolinker.link(outputStr);
	resizeTextarea(div);
	// Flash textarea border
	div.classList.add('decode');
	window.setTimeout(function() {
		div.classList.remove('decode');
	}, 1000);
}

// encode length of data as variable length quantity in binary string form
function encodeLength(n) {
	var outputStr = String.fromCharCode(n & 0x7F);
	while (n > 127) {
		n >>= 7;
		outputStr = String.fromCharCode(n & 0x7F | 0x80) + outputStr;
	}
	return outputStr;
}

// decode VLQ to integer
function decodeLength(str) {
	var length = 0;
	for (var i = 0; i < str.length; i++)
		length = length << 7 | str.codePointAt(i) & 0x7F;
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
			outputStr += encodingChars[(str.charCodeAt(i) >> j) & 0x3];
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
	for (var i = 0, sLen = str.length; i < sLen; i += 4) {
		var charCode = 0;
		for (var j = 0; j < 4; j++)
			charCode += encodingVals[str[i + j]] << (6 - j * 2);
		outputStr += String.fromCharCode(charCode);
	}
	return outputStr;
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
	reader.onload = function() {
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
	resizeTextarea(textarea[4].lastChild);
	textarea[3].focus();
}

function clearInPlain() {
	textarea[4].firstChild.innerHTML = '';
	while (textarea[4].childNodes.length > 1)
		textarea[4].removeChild(textarea[4].lastChild);
}

function notifyCopy(el, copied) {
	var el = document.getElementById(el);
	var copied = document.getElementById(copied);
	el.classList.add('copy');
	copied.classList.add('show')
	window.setTimeout(function() {
		el.classList.remove('copy');
		copied.classList.remove('show');
	}, 800)
}

// Scale elements according to viewport size
function resizeBody() {
	if (window.innerWidth > 480 && screen.width > 480)
		document.documentElement.style.fontSize = Math.min(window.innerWidth, window.innerHeight) * 0.03 + 'px';
	else
		document.documentElement.style.fontSize = Math.min(window.innerWidth, window.innerHeight * 1.2) * 0.04 + 'px';
	for (var i = 0; i < 4; i++)
		resizeTextarea(textarea[i]);
	for (var i = 0, iLen = textarea[4].childNodes.length; i < iLen; i++)
		resizeTextarea(textarea[4].childNodes[i]);
}

// Scale textarea according to font size
function resizeTextarea(el) {
	var fontSize = parseFloat(document.documentElement.style.fontSize);
	el.style.height = '';
	el.style.height = Math.min(el.scrollHeight + fontSize * 0.3, fontSize * 12) + 'px';
}
