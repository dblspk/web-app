var textarea = [];

function embedData() {
    var coverStr = textarea[1].value,
        encodedStr = textarea[0].value != '' ? encodeText('D\u0000\u0000\u0000\u0000\u0000\u0001' + encodeLength(textarea[0].value.length) + textarea[0].value) : '',
        insertPos = Math.floor(Math.random() * (coverStr.length - 1) + 1);
    textarea[2].value = coverStr.slice(0, insertPos) + encodedStr + coverStr.slice(insertPos);
    resizeTextarea(textarea[2]);
    textarea[2].classList.add('encode');
    window.setTimeout(function() {
        textarea[2].classList.remove('encode');
    }, 200);
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

function decodeLength(str) {
    var length = 0;
    for (var i = 0; i < str.length; i++)
        length = length << 7 | str.codePointAt(i) & 0x7F;
    return length;
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

function initExtractData() {
    textarea[3].maxLength = 0x7FFFFFFF;
    window.setTimeout(function() {
        // Discard cover text
        extractData(textarea[3].value.match(/[\u200B\u200C\u200D\uFEFF]/g));
    }, 1);
}

function extractData(array) {
    //console.log(decodeText(array));
    var t0 = performance.now();
    // Discard cover text
    var encodingVals = {
            '\u200B':0,
            '\u200C':1,
            '\u200D':2,
            '\uFEFF':3
        };
    if (!array || decodeText(array.slice(0, 8)) != 'D\u0000') {
        console.log('Protocol mismatch');
        return;
    }
    var dataType = decodeText(array.slice(24, 28)),
        VLQLen = 1;
    while (encodingVals[array[24 + VLQLen * 4]] > 1)
        VLQLen ++;
    //console.log('VLQLen', VLQLen);
    var dataLen = decodeLength(decodeText(array.slice(28, 28 + VLQLen * 4))),
        dataEnd = 28 + (VLQLen + dataLen) * 4;
    //console.log('dataEnd', dataEnd, array.length);

    switch (dataType) {
        case '\u0001':
            outputText(array.slice(28 + VLQLen * 4, dataEnd));
            break;
        case '\u0000':
        case '\u0002':
        default:
            console.log('Only text extraction is supported at this time.')
    }
    console.log((performance.now() - t0).toFixed(2) + ' ms');

    if (array.length > dataEnd)
        extractData(array.slice(dataEnd));
}

function decodeText(array) {
    var outputStr = '',
        encodingVals = {
            '\u200B':0,
            '\u200C':1,
            '\u200D':2,
            '\uFEFF':3
        };
    for (var i = 0, sLen = array.length; i < sLen; i += 4) {
        var charCode = 0;
        for (var j = 0; j < 4; j++)
            charCode += encodingVals[array[i + j]] << (6 - j * 2);
        outputStr += String.fromCharCode(charCode);
    }
    return outputStr;
}

function outputText(array) {
    var outputStr = decodeText(array);
    textarea[4].value = outputStr;
    resizeTextarea(textarea[4]);
    textarea[4].classList.add('decode');
    window.setTimeout(function() {
        textarea[4].classList.remove('decode');
    }, 1000);
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

function clearOutHidden() {
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
                     'in-hidden'
        ];
    for (var i = 0; i < 5; i++)
        textarea[i] = document.getElementById(textareas[i]);

    resizeBody();
    new Clipboard('.copy');
    document.addEventListener('dragover', dragOverFile, false);
    document.addEventListener('drop', dropFile, false);

    if (navigator.userAgent.match(/Mac|iP(hone|od|ad)/)) {
        textarea[2].placeholder = 'Copy [Command+C] output ciphertext';
        textarea[3].placeholder = 'Paste [Command+V] input ciphertext';
    }
}
