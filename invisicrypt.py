#!/usr/bin/env python3

import io
import sys
import argparse
import random

def encode_string(string):
    encoding_chars = [
        "\u200B", # ZERO WIDTH SPACE
        "\u200C", # ZERO WIDTH NON-JOINER
        "\u200D", # ZERO WIDTH JOINER
        "\uFEFF", # ZERO WIDTH NON-BREAKING SPACE
    ]
    output_string = io.StringIO()
    string_bytes = bytes(string, encoding="utf-8")
    for char in string_bytes:
        for j in range(6, -2, -2):
            output_string.write(encoding_chars[(char >> j) & 0x3])
    return output_string.getvalue()

# complete dummies for now, use real code later
def encode_text_message(text):
    return encode_string("STR:" + text)

def decode_text_message(text):
    return text

def find_message_in_str(string):
    return string

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
    decoded_text = decrypt_message(encoded_message)
    print(decoded_text)


def decrypt_message(msg):
    return decrypt(msg)


def decrypt(received_message):
    ZW = [8203, 8204, 8205, 65279]
    index_begin, index_end, index = 0, 0, 0
    found_begin = False


    #Finds beginning and end of ZW chars
    for char in received_message:
        if not found_begin and ord(char) in ZW: #found first hidden char
            index_begin = index
            found_begin = True
        elif found_begin and not ord(char) in ZW: #found first non hidden char
            index_end = index
            break
        index += 1
    if index_end == 0: #hidden chars reach end of message
        index_end = index


    message_to_decrypt = received_message[index_begin : index_end]
    back_to_tokens = [zero_char_to_token(ord(char)) for char in message_to_decrypt]
    return two_bit_list_to_string(back_to_tokens)


    #Helper function
def zero_char_to_token(zero_char_val):
    return {
        8203: '00',
        8204: '01',
        8205: '10',
        65279:'11',
    }[zero_char_val]