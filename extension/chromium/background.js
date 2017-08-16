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

// Listen for messages sent from content script
chrome.runtime.onMessage.addListener(msg => {
	extractData(msg);
});

// Send callback to content script on tab switch
chrome.tabs.onActivated.addListener(tab => {
	setBadgeCount(0);
	output = [];
	chrome.tabs.sendMessage(tab.tabId, '', extractData);
});

// Listen for requests from popup
chrome.runtime.onConnect.addListener(port => {
	port.postMessage(output);
});

/**
 * Extract ciphertext from DOM string.
 * @param {String} domContent
 */
function extractData(domContent) {
	if (!domContent) return;
	const references = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;'
	};
	const dataObjs = doublespeak.decodeData(domContent);
	output = [];

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

	setBadgeCount(output.length);
}

/**
 * Set toolbar icon badge text.
 * @param {Number} num
 */
function setBadgeCount(num) {
	chrome.browserAction.setBadgeText({ text: num ? num.toString() : '' });
}
