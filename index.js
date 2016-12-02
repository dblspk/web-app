var textarea = [];

function embedText() {
    var encodedStr = textarea[0].value != '' ? encodeText('T\0' + textarea[0].value) : '',
        coverStr = textarea[1].value,
        insertPos = Math.floor(Math.random() * (coverStr.length - 1) + 1);
    textarea[2].value = coverStr.slice(0, insertPos) + encodedStr + coverStr.slice(insertPos);
    resizeTextarea(textarea[2]);
    textarea[2].classList.add('encode');
    window.setTimeout(function() {
        textarea[2].classList.remove('encode');
    }, 200);
}

function encodeText(str) {
    var outputStr = '',
        encodingChars = [
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

function extractText() {
    textarea[3].maxLength = 0x7FFFFFFF;
    window.setTimeout(function() {
        // Discard cover text
        var hiddenStr = textarea[3].value.match(/[\u200B\u200C\u200D\uFEFF]/g),
            outputStr = '';
        if (hiddenStr != null)
            outputStr = decodeText(hiddenStr);
        if (outputStr.slice(0, 2) == 'T\0') {
            textarea[4].value = outputStr.slice(2);
            resizeTextarea(textarea[4]);
            textarea[4].classList.add('decode');
            window.setTimeout(function() {
                textarea[4].classList.remove('decode');
            }, 1000);
        } else
            console.log('Only text extraction is supported at this time.')
    }, 1);
}

function decodeText(str) {
    var outputStr = '',
        encodingVals = {
            '\u200B':0,
            '\u200C':1,
            '\u200D':2,
            '\uFEFF':3
        };
    for (var i = 0, sLen = str.length; i < sLen; i += 4) {
        var charCode = 0;
        for (var j = 0; j < 4; j++)
            charCode += encodingVals[str[i + j]] << (6 - j * 2);
        outputStr += String.fromCharCode(charCode);
    }
    return outputStr;
}

function clearOutHidden() {
    textarea[0].value = '';
    resizeTextarea(textarea[0]);
    embedText();
    textarea[0].focus();
}

function clearOut() {
    textarea[1].value = '';
    resizeTextarea(textarea[1]);
    embedText();
    textarea[1].focus();
}

function clearIn() {
    textarea[3].value = '';
    textarea[4].value = '';
    resizeTextarea(textarea[3]);
    resizeTextarea(textarea[4]);
    textarea[3].focus();
}

function notifyCopy(ta, copied) {
    var copiedBanner = document.getElementById(copied);
    textarea[ta].classList.add('copy');
    copiedBanner.classList.add('show')
    window.setTimeout(function() {
        textarea[ta].classList.remove('copy');
        copiedBanner.classList.remove('show');
    }, 800)
}

function resizeBody() {
    document.body.style.fontSize = Math.min(window.innerWidth, window.innerHeight) * 0.03 + 'px';
    for (var i = 0; i < 5; i++)
        resizeTextarea(textarea[i]);
}

function resizeTextarea(el) {
    var fontSize = parseFloat(document.body.style.fontSize);
    el.style.height = '';
    el.style.height = Math.min(el.scrollHeight + fontSize * 0.3, fontSize * 12) + 'px';
}

window.addEventListener('keyup', function(e) {
    // Select textareas with keys
    if (e.altKey)
        switch (e.keyCode) {
            case 81: // Alt+Q
                textarea[0].focus();
                break;
            case 65: // Alt+A
                textarea[1].focus();
                break;
            case 90: // Alt+Z
                textarea[2].focus();
                break;
            case 83: // Alt+S
                textarea[3].focus();
                break;
            case 88: // Alt+X
                textarea[4].focus();
                document.getElementById('in-copy').click();
        }
}, false);

document.onreadystatechange = function() {
    var textareas = ['out-hidden',
                     'out-cover',
                     'out-cipher',
                     'in-cipher',
                     'in-hidden',
        ];
    for (var i = 0; i < 5; i++)
        textarea[i] = document.getElementById(textareas[i]);

    resizeBody();
    new Clipboard('.copy');

    if (navigator.userAgent.match(/Mac|iP(hone|od|ad)/)) {
        textarea[2].placeholder = 'Copy [Command+C] output ciphertext';
        textarea[3].placeholder = 'Paste [Command+V] input ciphertext';
    }
}
