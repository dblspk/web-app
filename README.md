# Doublespeak

Embeds/extracts messages as zero width Unicode characters in text, as a casual form of [steganography](https://en.wikipedia.org/wiki/Steganography). Optimized for real time chat.

TL;DR: It hides secret messages in text.

Web app: __https://joshuaptfan.github.io/doublespeak/__

## Usage

###### Web app

__Tab__ / __Shift+Tab__ &mdash; cycle through fields

Output ciphertext is automatically copied by tabbing to or clicking on the field.

Drag and drop files onto page to encode.

## Features

* File transmission
* [CRC-32](https://en.wikipedia.org/wiki/Cyclic_redundancy_check) error checking
* Multi-message decoding
* Linkifies URLs, emails, phone numbers, and Twitter hashtags
* Preview URLs for images, video, and audio
* [Progressive Web App](https://developers.google.com/web/progressive-web-apps/) &mdash; can be pinned to your Android homescreen

## Possible uses

What can be hidden:

* Text
* URLs (similar use to [QR codes](https://en.wikipedia.org/wiki/QR_code))
* Watermarks
* Small files

Possible places for storage:

* Chat messages
* Social media posts
* User profile information
* Forums
* HT⁢⁢‌‌⁮⁯︁⁮︀⁢⁠⁣‌‍‍⁡⁣⁬⁤﻿⁪⁣⁠⁪⁪⁠⁤⁣⁠‌⁪‌⁪⁠⁤⁣⁪⁢⁪⁢⁪⁬⁠‌⁤⁪⁤﻿⁤﻿⁤⁢⁠︁ML
* Emails
* Digital documents
* File names (very short messages only)

## How it works

[Unicode](https://en.wikipedia.org/wiki/Unicode) contains some zero width, unprintable characters. We use 16 of them to encode any data in [hexadecimal](https://en.wikipedia.org/wiki/Hexadecimal), using our arbitrary encoding scheme:

| Decimal | Hex | Binary | Character | Description |
| -------:| ---:| ------:| --------- | ----------- |
|    0    |  0  |  0000  | `U+200C`  | [zero width non-joiner](https://en.wikipedia.org/wiki/Zero-width_non-joiner) |
|    1    |  1  |  0001  | `U+200D`  | [zero width joiner](https://en.wikipedia.org/wiki/Zero-width_joiner) |
|    2    |  2  |  0010  | `U+2060`  | [word joiner](https://en.wikipedia.org/wiki/Word_joiner) |
|    3    |  3  |  0011  | `U+2061`  | [function application](https://codepoints.net/U+2061) |
|    4    |  4  |  0100  | `U+2062`  | [invisible times](https://codepoints.net/U+2062) |
|    5    |  5  |  0101  | `U+2063`  | [invisible separator](https://codepoints.net/U+2063) |
|    6    |  6  |  0110  | `U+2064`  | [invisible plus](https://codepoints.net/U+2064) |
|    7    |  7  |  0111  | `U+206A`  | [inhibit symmetric swapping](https://codepoints.net/U+206A) |
|    8    |  8  |  1000  | `U+206B`  | [activate symmetric swapping](https://codepoints.net/U+206B) |
|    9    |  9  |  1001  | `U+206C`  | [inhibit Arabic form shaping](https://codepoints.net/U+206C) |
|   10    |  A  |  1010  | `U+206D`  | [activate Arabic form shaping](https://codepoints.net/U+206D) |
|   11    |  B  |  1011  | `U+206E`  | [national digit shapes](https://codepoints.net/U+206E) |
|   12    |  C  |  1100  | `U+206F`  | [nominal digit shapes](https://codepoints.net/U+206F) |
|   13    |  D  |  1101  | `U+FE00`  | [variation selector-1](https://en.wikipedia.org/wiki/Variation_Selectors_(Unicode_block)) |
|   14    |  E  |  1110  | `U+FE01`  | [variation selector-2](https://en.wikipedia.org/wiki/Variation_Selectors_(Unicode_block)) |
|   15    |  F  |  1111  | `U+FEFF`  | [zero width non-breaking space](https://en.wikipedia.org/wiki/Byte_order_mark) |

A header, encoded in the same way, is prepended:

| Size | Field | Description |
| ---- | ----- | ----------- |
| 1 byte | Protocol signature | ASCII letter "D", or 0x44 |
| 1 byte | Protocol version | 0x00 |
| 4 bytes | CRC-32 | Calculated on decoded data field |
| 1 byte | Data type | 0x00: Encryption wrapper<br>0x01: UTF-8 text<br>0x02: File |
| 1+ bytes | Data length | [Variable length quantity](https://en.wikipedia.org/wiki/Variable-length_quantity), representing length of the data field<br>Needed to allow decoding of multiple concatenated messages |
| Varies | Data | Depends on data type |

The resulting string of invisible characters is then inserted at a random location in the cover text.

## Efficiency

Each invisible character represents 4 bits, while taking 3 bytes (24 bits) to store. Thus, the hidden data consumes 6 times as much memory as the original data, not including header data and cover text.

## Roadmap

The following planned features are defined in the [protocol specification](https://docs.google.com/spreadsheets/d/1sx-kw7LFz4f7Qrtmo68lRi8_msIRVGsvGhiQuWppR4A/):

* Optional built-in encryption for convenience (message can be encrypted before encoding even without this feature)

[To-do list](https://github.com/joshuaptfan/doublespeak/projects/1)

To suggest a feature, please [create an issue](https://github.com/joshuaptfan/doublespeak/issues).

## Comparison to other steganography techniques

### Pros

* Produces no visible alteration in the text.
* Can store a near-unlimited amount of data regardless of length of the cover text.
* Can be used with applications that do not support file transfers.
* Reduces suspicion by not requiring the frequent transfer of large files during communication.

### Cons

* Can be filtered or corrupted by applications that do not support Unicode, or that attempt to format user input.
* Extremely easy to detect. Any digital text can be checked for the possible presence of a message by pasting it into a decoder, or a text editor that displays non-printing characters. Large messages may create line breaks in some applications.

__If you are serious about concealing your payload, you should use another form of steganography.__

As with any method of communication, security is only as good as the encryption applied. This only provides a casual level of security through obscurity.

## Credits

This project began at [Cal Hacks 3.0](https://calhacks3.devpost.com/) by [a much less memorable name](https://devpost.com/software/invisicrypt).

* [Joshua Fan](https://github.com/joshuaptfan) &mdash; web app
* [Samuel Arnold](https://github.com/Grond66) &mdash; encoding algorithm and Python app
* [Nitzan Orr](https://github.com/orrblue) &mdash; decoding algorithm

## License

[MIT License](https://joshuaptfan.mit-license.org/)
