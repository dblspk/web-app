var doublespeak = new Doublespeak();
var output;

// Create link to web app in toolbar icon context menu
chrome.contextMenus.create({
	title: 'Doublespeak web app',
	contexts: ['browser_action'],
	onclick: () => {
		chrome.tabs.create({ url: 'http://dblspk.io/' });
	}
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((msg, sender) => {
	extractData(msg, sender.tab.id);
});

// Ping content script on tab switch
chrome.tabs.onActivated.addListener(tab => {
	output = [];
	chrome.tabs.sendMessage(tab.tabId, '');
});

// Listen for connections from popup
chrome.runtime.onConnect.addListener(port => {
	port.postMessage(output);
	window.port = port;
	port.onDisconnect.addListener(() => { window.port = null });
});

/**
 * Extract ciphertext from DOM string.
 * @param {String} domContent
 * @param {Number} tabId
 */
function extractData(domContent, tabId) {
	output = [];
	if (!domContent) return;
	const references = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;'
	};
	const dataObjs = doublespeak.decodeData(domContent);

	for (var obj of dataObjs)
		switch (obj.dataType) {
			case 0x1:
				output.push({
					dataType: 1,
					data: doublespeak.extractText(obj.data).replace(/[&<>]/g, c => references[c]),
					crcMatch: obj.crcMatch
				});
				break;
			case 0x2:
				output.push({
					dataType: 2,
					data: doublespeak.extractFile(obj.data),
					crcMatch: obj.crcMatch
				});
		}

	setBadgeCount(output.length, tabId);
	if (window.port)
		window.port.postMessage(output);
}

/**
 * Set toolbar icon badge text.
 * @param {Number} num
 * @param {Number} tabId
 */
function setBadgeCount(num, tabId) {
	chrome.browserAction.setBadgeText({ text: num ? num.toString() : '', tabId });
}
