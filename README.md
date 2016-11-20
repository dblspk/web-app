# Doublespeak

__https://joshuaptfan.github.io/Doublespeak/__

Embeds/extracts messages as zero width Unicode characters in text.

## How it works

[Unicode](https://en.wikipedia.org/wiki/Unicode) contains some zero width, unprintable characters. 4 of these are sufficiently resilient to input sanitation on the web to be useful:

| Character | Description                   |
| --------- | ----------------------------- |
| U+200B    | [zero width space](https://en.wikipedia.org/wiki/Zero-width_space) |
| U+200C    | [zero width non-joiner](https://en.wikipedia.org/wiki/Zero-width_non-joiner) |
| U+200D    | [zero width joiner](https://en.wikipedia.org/wiki/Zero-width_joiner) |
| U+FEFF    | [zero width non-breaking space](https://en.wikipedia.org/wiki/Byte_order_mark) |

With 4 characters, we can encode any data in [quaternary](https://en.wikipedia.org/wiki/Quaternary_numeral_system). For text, the Unicode message to be hidden is converted to a bitstream, which is then encoded using our arbitrary encoding scheme:

| Bits | Character |
| ---- | --------- |
| 00   | U+200B    |
| 01   | U+200C    |
| 10   | U+200D    |
| 11   | U+FEFF    |

The resulting string of invisible characters is then interspersed throughout the cover text.

We discovered during testing that the Linux [X11](https://en.wikipedia.org/wiki/X_Window_System) clipboard drops consecutive invisible characters past 10. We accomodate this by distributing the encoded characters throughout the cover text in groups of 10, and, optionally, prompting the user to provide more characters of cover text as needed. If neither participant in a conversation is using X11, the default mode of operation is to pack the end of the encoded string between the last and second-to-last characters of cover text.

## Efficiency

Each invisible character represents 2 bits, while taking 1 byte (8 bits) to store. Thus, the hidden data takes up 4 times as much memory as the original data, not including cover text.
