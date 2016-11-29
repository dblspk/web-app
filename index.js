var textarea = [];

function embedData() {
    var coverStr = textarea[3].value,
        encodedStr = textarea[2].value ? encodeData('T' + encodeLength(textarea[2].value.length) + textarea[2].value) : '',
        insertPos = Math.floor(Math.random() * (coverStr.length - 1) + 1);
    textarea[4].value = coverStr.slice(0, insertPos) + encodedStr + coverStr.slice(insertPos);
    resizeTextarea(textarea[4]);
    textarea[4].classList.add('encode');
    window.setTimeout(function() {
        textarea[4].classList.remove('encode');
    }, 200);
}

function encodeLength(n) {
    //console.log(n);
    var outputStr = '';
    while (n > 127) {
        outputStr += String.fromCharCode(n & 0x7F || 0x80);
        n >>= 7;
    }
    outputStr += String.fromCharCode(n & 0x7F);
    return outputStr;
}

function encodeData(str) {
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

function extractData() {
    textarea[0].maxLength = 0x7FFFFFFF;
    window.setTimeout(function() {
        // Discard cover text
        var hiddenStr = textarea[0].value.match(/[\u200B\u200C\u200D\uFEFF]/g),
            outputStr = '',
            encodingVals = {
                '\u200B':0,
                '\u200C':1,
                '\u200D':2,
                '\uFEFF':3
            };
        if (hiddenStr) {
            if (decodeText(hiddenStr.slice(0, 4)) == 'T') {
                for (var i = 0, sLen = hiddenStr.length; i < sLen; i += 4) {
                    var charCode = 0;
                    for (var j = 0; j < 4; j++)
                        charCode += encodingVals[hiddenStr[i + j]] << (6 - j * 2);
                    outputStr += String.fromCharCode(charCode);
                }
                textarea[1].value = outputStr.slice(1);
                resizeTextarea(textarea[1]);
                textarea[1].classList.add('decode');
                window.setTimeout(function() {
                    textarea[1].classList.remove('decode');
                }, 1000);
            } else
                console.log('Only text extraction is supported at this time.')
        }
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

function dragOverFile(e) {
    e.stopPropagation();
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
}

function dropFile(e) {
    e.stopPropagation();
    e.preventDefault();
    
    var file = e.dataTransfer.files[0],
        reader = new FileReader();
    reader.onload = function() {
        console.log(new Uint8Array(reader.result));
    };
    reader.readAsArrayBuffer(file);
}

function clearIn() {
    textarea[0].value = '';
    textarea[1].value = '';
    resizeTextarea(textarea[0]);
    resizeTextarea(textarea[1]);
    textarea[0].focus();
}

function clearOut() {
    textarea[3].value = '';
    resizeTextarea(textarea[3]);
    embedData();
    textarea[3].focus();
}

function clearOutHidden() {
    textarea[2].value = '';
    resizeTextarea(textarea[2]);
    embedData();
    textarea[2].focus();
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
            case 65: // Alt+A
                textarea[0].focus();
                break;
            case 90: // Alt+Z
                textarea[1].focus();
                document.getElementById('in-copy').click();
                break;
            case 87: // Alt+W
                textarea[2].focus();
                break;
            case 83: // Alt+S
                textarea[3].focus();
                break;
            case 88: // Alt+X
                textarea[4].focus();
        }
}, false);

document.onreadystatechange = function() {
    var textareas = ['in-cipher',
                     'in-hidden',
                     'out-hidden',
                     'out-cover',
                     'out-cipher'
        ];
    for (var i = 0; i < 5; i++)
        textarea[i] = document.getElementById(textareas[i]);

    resizeBody();
    new Clipboard('.copy');
    document.addEventListener('dragover', dragOverFile, false);
    document.addEventListener('drop', dropFile, false);

    if (navigator.userAgent.match(/Mac|iP(hone|od|ad)/)) {
        textarea[0].placeholder = 'Paste [Command+V] input ciphertext';
        textarea[4].placeholder = 'Copy [Command+C] output ciphertext';
    }
}
