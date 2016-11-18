var textarea = [],
    safe = false; // if true, accomodate X11 clipboard limitations

function embedString() {
    var decoyStr = textarea[2].value,
        encodedStr = encodeString('S\0' + textarea[3].value),
        outputStr = '',
        i = 0,
        j = 0;
    while (i < decoyStr.length-1) {
        outputStr += decoyStr[i++];
        for (; j < i * 10; j++)
            if (encodedStr[j])
                outputStr += encodedStr[j];
    }
    if (!safe) {
        if (j < encodedStr.length)
            outputStr += encodedStr.slice(j);
    } else {
        var warn = document.getElementById('warn');
        if (j < encodedStr.length) {
            warn.style.opacity = 1;
            warn.innerHTML = 'Please provide ' + Math.ceil(encodedStr.slice(j).length / 10) + ' more characters of decoy text to store entire message.';
        } else
            warn.style.opacity = 0;
    }
    if (decoyStr.length > 0)
        outputStr += decoyStr[i];
    textarea[4].value = outputStr;
    resizeTextarea(textarea[4]);
    textarea[4].classList.add('encode');
    window.setTimeout(function() {
        textarea[4].classList.remove('encode');
    }, 100);
}

function encodeString(str) {
    var strBytes = stringToBytes(str),
        outputStr = '',
        encodingChars = [
            '\u200B', // zero width space
            '\u200C', // zero width non-joiner
            '\u200D', // zero width joiner
            '\uFEFF'  // zero width non-breaking space
        ];
    for (var i = 0, sLen = str.length; i < sLen; i++)
        for (var j = 6; j >= 0; j -= 2)
            outputStr += encodingChars[(strBytes[i] >> j) & 0x3];
    return outputStr;
}

function decodeString() {
    window.setTimeout(function() {
        var secretStr = textarea[0].value.match(/[\u200B\u200C\u200D\uFEFF]/g),
            outputStr = '',
            encodingVals = {
                '\u200B':0,
                '\u200C':1,
                '\u200D':2,
                '\uFEFF':3
            };
        if (secretStr != null) {
            for (var i = 0, sLen = secretStr.length; i < sLen; i += 4) {
                var charCode = 0;
                for (var j = 0; j < 4; j++)
                    charCode += encodingVals[secretStr[i + j]] << (6 - j * 2);
                outputStr += String.fromCharCode(charCode);
            }
        }
        if (outputStr.slice(0, 2) == 'S\0') {
            textarea[1].value = outputStr.slice(2);
            resizeTextarea(textarea[1]);
            textarea[1].classList.add('decode');
            window.setTimeout(function() {
                textarea[1].classList.remove('decode');
            }, 500);
        } else
            console.log('File extraction is not supported at this time.')
    }, 1);
}

// Credit: http://stackoverflow.com/questions/1240408/reading-bytes-from-a-javascript-string
function stringToBytes(str) {
    var byteArray = [];
    for (var i = 0; i < str.length; i++)
        if (str.charCodeAt(i) <= 0x7F)
            byteArray.push(str.charCodeAt(i));
        else {
            var h = encodeURIComponent(str.charAt(i)).substr(1).split('%');
            for (var j = 0; j < h.length; j++)
                byteArray.push(parseInt(h[j], 16));
        }
    return byteArray;
};

function clearIn() {
    textarea[0].value = '';
    textarea[1].value = '';
    resizeTextarea(textarea[0]);
    resizeTextarea(textarea[1]);
}

function clearOut() {
    textarea[2].value = '';
    textarea[3].value = '';
    resizeTextarea(textarea[2]);
    resizeTextarea(textarea[3]);
}

function clearOutSecret() {
    textarea[3].value = '';
    resizeTextarea(textarea[3]);
}

function clickCopy(ta, copied) {
    var copiedBanner = document.getElementById(copied);
    textarea[ta].classList.add('copy');
    copiedBanner.classList.add('show')
    window.setTimeout(function() {
        textarea[ta].classList.remove('copy');
        copiedBanner.classList.remove('show');
        textarea[ta].select();
    }, 500)
}

function resizeBody() {
    document.body.style.fontSize = Math.min(window.innerWidth, window.innerHeight * 1.8) * 0.03 + 'px';
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
    if (e.altKey) {
        if (e.keyCode === 65) // Alt+A
            textarea[0].focus();
        else if (e.keyCode === 90) { // Alt+Z
            textarea[1].focus();
            document.getElementById('in-copy').click();
        }
        else if (e.keyCode === 87) // Alt+W
            textarea[2].focus();
        else if (e.keyCode === 83) // Alt+S
            textarea[3].focus();
        else if (e.keyCode === 88) { // Alt+X
            textarea[4].focus();
            document.getElementById('out-copy').click();
        }
    }
}, false);

document.onreadystatechange = function() {
    var textareas = ['in-package',
                     'in-secret',
                     'out-decoy',
                     'out-secret',
                     'out-package'
        ];
    for (var i = 0; i < 5; i++)
        textarea[i] = document.getElementById(textareas[i]);
    
    resizeBody();
    textarea[2].addEventListener('keyup', embedString, false);
    textarea[3].addEventListener('keyup', embedString, false);
    new Clipboard('.copy');

    if (navigator.platform.match(/Mac|iP(hone|od|ad)/)) {
        textarea[0].placeholder = 'Paste [Command+V] input';
        textarea[4].placeholder = 'Copy [Command+C] output';
    }
}
