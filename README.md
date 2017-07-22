# Doublespeak

Embeds/extracts messages as zero width Unicode characters in text, as a casual form of [steganography](https://en.wikipedia.org/wiki/Steganography). UI is optimized for real time chat.

Web app: __https://joshuaptfan.github.io/doublespeak/__

## Usage

###### Web interface

__Tab__ / __Shift+Tab__ &mdash; cycle through fields

Output ciphertext is automatically copied by tabbing to or clicking on the field.

Fields automatically highlight on focus, type/paste to replace text. Clear buttons should rarely be needed, even on mobile.

## Features

* CRC-32 error checking
* Multi-message decoding
* Linkifies URLs, emails, phone numbers, and Twitter hashtags
* Preview URLs for images, video, and audio
* [Progressive Web App](https://developers.google.com/web/progressive-web-apps/) &mdash; can be pinned to your Android homescreen

## Possible uses

What can be hidden:

* Text
* URLs (similar use to [QR codes](https://en.wikipedia.org/wiki/QR_code))
* Files (coming soon&trade;)
* Watermarks
* Pre-shared keys for encryption

Possible places for storage:

* Chat messages
* Social media posts
* User profile information
* Forums
* HT‍‍؜؜⁠⁡⁣⁠⁢‍​‎؜᠎᠎‌‎‭‏﻿‪‎​‪‪​‏‎​؜‪؜‪​‏‎‪‍‪‍‪‭​؜‏‪‏﻿‏﻿‏‍​⁣ML
* Emails
* Digital documents
* File names

## How it works

[Unicode](https://en.wikipedia.org/wiki/Unicode) contains some zero width, unprintable characters. We use 16 of them to encode any data in [hexadecimal](https://en.wikipedia.org/wiki/Hexadecimal). For text, the Unicode message to be hidden is converted to a bitstream, which is then encoded using our arbitrary encoding scheme:

| Decimal | Hex | Binary | Character | Description |
| -------:| ---:| ------:| --------- | ----------- |
|    0    |  0  |  0000  | `U+061C`  | [Arabic letter mark](https://codepoints.net/U+061C) |
|    1    |  1  |  0001  | `U+180E`  | [Mongolian vowel separator](https://codepoints.net/U+180E) |
|    2    |  2  |  0010  | `U+200B`  | [zero width space](https://en.wikipedia.org/wiki/Zero-width_space) |
|    3    |  3  |  0011  | `U+200C`  | [zero width non-joiner](https://en.wikipedia.org/wiki/Zero-width_non-joiner) |
|    4    |  4  |  0100  | `U+200D`  | [zero width joiner](https://en.wikipedia.org/wiki/Zero-width_joiner) |
|    5    |  5  |  0101  | `U+200E`  | [left-to-right mark](https://en.wikipedia.org/wiki/Left-to-right_mark) |
|    6    |  6  |  0110  | `U+200F`  | [right-to-left mark](https://en.wikipedia.org/wiki/Right-to-left_mark) |
|    7    |  7  |  0111  | `U+202A`  | [left-to-right embedding](https://codepoints.net/U+202A) |
|    8    |  8  |  1000  | `U+202B`  | [right-to-left embedding](https://codepoints.net/U+202B) |
|    9    |  9  |  1001  | `U+202D`  | [left-to-right override](https://codepoints.net/U+202D) |
|   10    |  A  |  1010  | `U+202E`  | [right-to-left override](https://codepoints.net/U+202E) |
|   11    |  B  |  1011  | `U+2060`  | [word joiner](https://en.wikipedia.org/wiki/Word_joiner) |
|   12    |  C  |  1100  | `U+2061`  | [function application](https://codepoints.net/U+2061) |
|   13    |  D  |  1101  | `U+2062`  | [invisible times](https://codepoints.net/U+2062) |
|   14    |  E  |  1110  | `U+2063`  | [invisible separator](https://codepoints.net/U+2063) |
|   15    |  F  |  1111  | `U+FEFF`  | [zero width non-breaking space](https://en.wikipedia.org/wiki/Byte_order_mark) |

The resulting string of invisible characters is then inserted at a random location in the cover text.

## Efficiency

Each invisible character represents 4 bits, while taking 3 bytes (24 bits) to store. Thus, the hidden data consumes 6 times as much memory as the original data, not including cover text.

## Roadmap

The following features are defined in the [protocol specification](https://docs.google.com/spreadsheets/d/1sx-kw7LFz4f7Qrtmo68lRi8_msIRVGsvGhiQuWppR4A/):

* Encoding and decoding of files
* Optional built-in encryption for convenience (message can be encrypted before encoding even without this feature)

[To do list](https://github.com/joshuaptfan/doublespeak/projects/1)

To suggest a feature, please [create an issue](https://github.com/joshuaptfan/doublespeak/issues).

## Comparison to other steganography techniques

### Pros

* Produces no visible alteration in the text.
* Can store a near-unlimited amount of data regardless of length of the cover text.
* Can be used with software that does not support file transfer.
* Reduces suspicion by not requiring the frequent transfer of large files during communication.

### Cons

* Can be filtered or corrupted by software that does not support Unicode, or that attempts to format user input.
* Extremely easy to detect. Any digital text can be checked for the possible presence of a message by pasting it into the decoder, or a text editor that displays non-printing characters. Large messages may create line breaks in some text fields.

If you are serious about concealing your payload, you should use another form of steganography.

As with any method of communication, security is only as good as the encryption applied. This only provides a casual level of security through obscurity.

## Credits

This project began at [Cal Hacks 3.0](https://calhacks3.devpost.com/) by [a much less memorable name](https://devpost.com/software/invisicrypt).

* [Joshua Fan](https://github.com/joshuaptfan) &mdash; web app
* [Samuel Arnold](https://github.com/Grond66) &mdash; encoding algorithm and Python app
* [Nitzan Orr](https://github.com/orrblue) &mdash; decoding algorithm

## License

[MIT License](https://joshuaptfan.mit-license.org/)
