// Send DOM string on first load
chrome.runtime.sendMessage(document.documentElement.outerHTML);

// Respond to background callback with DOM string
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	sendResponse(document.documentElement.outerHTML);
});

// Send DOM string on DOM change
new MutationObserver(() => {
	chrome.runtime.sendMessage(document.documentElement.outerHTML);
}).observe(document, {
	childList: true,
	attributes: true,
	characterData: true,
	subtree: true
});
