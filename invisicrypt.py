#!/usr/bin/env python3

import io
import sys
import argparse
import random

encoding_chars = [
    "\u200B", # ZERO WIDTH SPACE
    "\u200C", # ZERO WIDTH NON-JOINER
    "\u200D", # ZERO WIDTH JOINER
    "\uFEFF", # ZERO WIDTH NON-BREAKING SPACE
]

def encode_string(string):
    output_string = io.StringIO()
    string_bytes = bytes(string, encoding="utf-8")
    for char in string_bytes:
        for j in range(6, -2, -2):
            output_string.write(encoding_chars[(char >> j) & 0x3])
    return output_string.getvalue()

def encode_text_message(text):
    return encode_string("STR:" + text)

def decode_string(string):
    back_to_tokens = [zero_char_to_token(ord(char)) for char in string]
    return two_bit_list_to_string(back_to_tokens)

def two_bit_list_to_string(lst):
    byte_list = [int(lst[i] + lst[i+1] +
        lst[i+2] + lst[i+3]) for i in range(0, len(lst)-2, 4)]
    return byte_to_string(byte_list)

def byte_to_string(byte_list):
    byte_list = [int(str(elem), 2) for elem in byte_list]
    return "".join(map(chr, byte_list))

#Helper function
def zero_char_to_token(zero_char_val):
    return {
        8203: '00',
        8204: '01',
        8205: '10',
        65279:'11',
    }[zero_char_val]

def decode_text_message(text):
    return text

def find_message_in_str(string):
    index_begin, index_end, index = 0, 0, 0
    found_begin = False

    #Finds beginning and end of ZW chars
    for char in string:
        if not found_begin and char in encoding_chars: #found first hidden char
            index_begin = index
            found_begin = True
        elif found_begin and not char in encoding_chars: #found first non hidden char
            index_end = index
            break
        index += 1
    if found_begin and index_end == 0: #hidden chars reach end of message
        index_end = index

    return string[index_begin : index_end]

root_parser = argparse.ArgumentParser(description="A utility for hiding and revealing messages in plain text")
sub_parsers = root_parser.add_subparsers(dest="mode")
hide_parser = sub_parsers.add_parser("hide")
reveal_parser = sub_parsers.add_parser("reveal")
hide_parser.add_argument("decoy_text", type=str, help="Hide the message in this string")
hide_parser.add_argument("message_str", type=str, help="Message to be hidden")
reveal_parser.add_argument("combined_text", type=str, help="Find and decode hidden messages in this text")

cmdline_options = sys.argv[1:]
if len(cmdline_options) == 0:
    root_parser.print_help()
    sys.exit(1)
options = root_parser.parse_args(cmdline_options)

if options.mode == "hide":
    if len(options.decoy_text) < 2:
        exit("error: decoy text must be longer must be at least 2 characters long")
    encoded_text = encode_text_message(options.message_str)
    insert_position = random.randint(1, len(options.decoy_text)-1)
    print(options.decoy_text[:insert_position] + encoded_text + options.decoy_text[insert_position:])
else: # options.mode == "reveal"
    encoded_message = find_message_in_str(options.combined_text)
    if not encoded_message:
        exit("It seems that there really isn't anything to see here...")
    print("<" + encoded_message + ">")
    decoded_text = decode_string(encoded_message)
    print(decoded_text)
