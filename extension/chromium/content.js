// Send DOM string on first load
if (!document.hidden)
	chrome.runtime.sendMessage(document.documentElement.outerHTML);

// Respond to background ping with DOM string
chrome.runtime.onMessage.addListener(() => {
	chrome.runtime.sendMessage(document.documentElement.outerHTML);
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
