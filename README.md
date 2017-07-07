# Doublespeak

Embeds/extracts messages as zero width Unicode characters in text, as a form of [steganography](https://en.wikipedia.org/wiki/Steganography). UI is optimized for real time chat.

__https://joshuaptfan.github.io/doublespeak/__

## Usage

###### Web interface

__Tab__ / __Shift+Tab__ &mdash; cycle through fields

Output ciphertext is automatically copied by tabbing to or clicking on the field.

Fields automatically highlight on focus, type/paste to replace text. Clear buttons should not be needed, even on mobile.

## How it works

[Unicode](https://en.wikipedia.org/wiki/Unicode) contains some zero width, unprintable characters. 4 of these are sufficiently resilient to input sanitation on the web to be useful. This allows us to encode any data in [quaternary](https://en.wikipedia.org/wiki/Quaternary_numeral_system). For text, the Unicode message to be hidden is converted to a bitstream, which is then encoded using our arbitrary encoding scheme:

| Bits | Character | Description |
| ---- | --------- | ----------- |
| 00   | U+200B    | [zero width space](https://en.wikipedia.org/wiki/Zero-width_space) |
| 01   | U+200C    | [zero width non-joiner](https://en.wikipedia.org/wiki/Zero-width_non-joiner) |
| 10   | U+200D    | [zero width joiner](https://en.wikipedia.org/wiki/Zero-width_joiner) |
| 11   | U+FEFF    | [zero width non-breaking space](https://en.wikipedia.org/wiki/Byte_order_mark) |

The resulting string of invisible characters is then inserted at a random location in the cover text.

## Efficiency

Each invisible character represents 2 bits, while taking 1 byte (8 bits) to store. Thus, the hidden data consumes 4 times as much memory as the original data, not including cover text.

## Roadmap

The following features are defined in the [protocol specification](https://docs.google.com/spreadsheets/d/1sx-kw7LFz4f7Qrtmo68lRi8_msIRVGsvGhiQuWppR4A/edit):

* Simultaneous decoding of multiple chained messages
* Encoding and decoding of files
* Optional built-in encryption for convenience (message can be encrypted before encoding even without this feature)

## Credits

This project began at [Cal Hacks 3.0](https://calhacks3.devpost.com/) by [a much less memorable name](https://devpost.com/software/invisicrypt).

* [Joshua Fan](https://github.com/joshuaptfan) — web interface
* [Samuel Arnold](https://github.com/Grond66) — encoding algorithm and Python interface
* [Nitzan Orr](https://github.com/orrblue) — decoding algorithm
