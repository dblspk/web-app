#!/usr/bin/env python3

import sys
import argparse
import random


# complete dummies for now, use real code later
def encode_text_message(text):
    return "[" + text + "]"

def decode_text_message(text):
    return text

def find_message_in_str(string):
    return string

root_parser = argparse.ArgumentParser(description="A utility for hiding and revealing messages in plain text")
sub_parsers = root_parser.add_subparsers(dest="mode")
hide_parser = sub_parsers.add_parser("hide")
reveal_parser = sub_parsers.add_parser("reveal")
hide_parser.add_argument("decoytext", type=str, help="Hide the message in this string")
hide_parser.add_argument("hidetext", type=str, help="Text to be hidden in plain sight")
reveal_parser.add_argument("revealtext", type=str, help="Find and decode hidden messages in this text")

cmdline_options = sys.argv[1:]
if len(cmdline_options) == 0:
    root_parser.print_help()
    sys.exit(1)
options = root_parser.parse_args(cmdline_options)

if options.mode == "hide":
    if len(options.decoytext) < 2:
        exit("error: decoy text must be longer must be at least 2 characters long")
    encoded_text = encode_text_message(options.hidetext)
    insert_after = random.randint(1, len(options.decoytext)-1)
    print(options.decoytext[:insert_after] + encoded_text + options.decoytext[insert_after:])
else: # options.mode == "reveal"
    encoded_message = find_message_in_str(options.revealtext)
    if not encoded_message:
        exit("It seems that there really isn't anything to see here...")
    decoded_text = decode_text_message(encoded_message)
    print(decoded_text)
