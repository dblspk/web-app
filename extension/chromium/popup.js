document.onreadystatechange = function () {
	const port = chrome.runtime.connect();
	port.postMessage('');
	port.onMessage.addListener(dataObjs => {
		clearInPlain();
		for (var obj of dataObjs)
			switch (obj.dataType) {
				case 0x1:
					outputText(obj.data, obj.crcMatch);
					break;
				case 0x2:
					outputFile(obj.data, obj.crcMatch);
			}
	});
};

function outputText(str, crcMatch) {
	const textDiv = getTextDiv();

	textDiv.innerHTML = str;

	if (!crcMatch)
		outputError(textDiv, 'CRC mismatch');
}

function outputFile(data, crcMatch) {
	const { type, name, url, size } = data;

	// Generate file details UI
	const textDiv = getTextDiv();
	textDiv.textContent = name;
	const info = document.createElement('p');
	info.className = 'file-info';
	info.textContent = (type || 'unknown') + ', ' + size + ' bytes';
	textDiv.appendChild(info);
	const link = document.createElement('a');
	link.className = 'file-download';
	link.href = url;
	link.download = name;
	link.textContent = 'Download';
	textDiv.appendChild(link);

	if (!crcMatch)
		outputError(textDiv, 'CRC mismatch');
}

function getTextDiv() {
	const inPlain = document.getElementById('in-plain');
	let textDiv;
	if (inPlain.lastChild.innerHTML) {
		// Generate pseudo-textarea
		textDiv = document.createElement('div');
		textDiv.className = 'text-div';
		textDiv.onfocus = function () { selectText(this); };
		textDiv.tabIndex = -1;
		inPlain.appendChild(textDiv);
	}
	return textDiv || inPlain.lastChild;
}

function outputError(el, msg) {
	el.classList.add('error');
	const errorDiv = document.createElement('div');
	errorDiv.className = 'notify error-div';
	errorDiv.textContent = msg.toUpperCase();
	el.parentElement.appendChild(errorDiv);
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

function clearInPlain() {
	const inPlain = document.getElementById('in-plain');
	inPlain.firstChild.innerHTML = '';
	inPlain.firstChild.className = 'text-div';
	while (inPlain.childNodes.length > 1)
		inPlain.removeChild(inPlain.lastChild);
}
