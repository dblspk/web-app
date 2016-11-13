#!/usr/bin/env python3

import io
import sys
import argparse
import random
import math
import re
import os
import os.path
from tkinter import *
from tkinter.ttk import *

encoding_chars = [
    "\u200B", # ZERO WIDTH SPACE
    "\u200C", # ZERO WIDTH NON-JOINER
    "\u200D", # ZERO WIDTH JOINER
    "\uFEFF", # ZERO WIDTH NON-BREAKING SPACE
]

def gulp_file(filename):
    fh = open(filename)
    ret = fh.read(-1)
    fh.close()
    return ret

def encode_bytes(string_bytes):
    output_string = io.StringIO()
    for char in string_bytes:
        for j in range(6, -2, -2):
            output_string.write(encoding_chars[(char >> j) & 0x3])
    return output_string.getvalue()

def encode_string(string):
    string_bytes = bytes(string, encoding="utf-8")
    return encode_bytes(string_bytes)

def encode_text_message(text):
    return encode_string("STR\0" + text)

def openFile(file_path):

    filename, file_extension = os.path.splitext(file_path)

    file_contents = []
    try:
        with open(filename, "rb") as f:
            byte = f.read(1)
            while byte:
                file_contents.append(byte[0]) #return integers
                byte = f.read(1)

    except OSError as e:
        return "File Cannot be Opened"

    return file_contents, file_extension

def encode_file_message(filename):
    file_contents, file_type = openFile(filename)

    if file_type == ".txt" or file_type == "":
        file_type = "text/plain"
    else:
        image_fmt = imghdr.what(None, h=file_contents)
        if image_fmt:
            file_type = "image/" + image_fmt
        else:
            file_type = "text/plain"

    return \
        encode_string("FIL\0" + filename + "\0" + file_type + "\0") + \
        encode_bytes(file_contents)

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
    return "".join([c for c in string if c in encoding_chars])

def message_type(msg):
    m = re.match(r'(?P<msg_type>(STR|FIL))\0(?P<msg_body>.+)', msg)
    if not m:
        raise ValueError("Unable to parse message type")
    return m.group("msg_type"), m.group("msg_body")

def hide_message(decoy_text, msg_type, msg):
    if msg_type == "text":
        encoded_text = encode_text_message(msg)
    elif msg_type == "file":
        encoded_text = encode_file_message(msg)
    else:
        raise ValueError("unknown message type: " + msg_type)

    insertion_points = math.ceil(len(encoded_text) / 10)
    if len(decoy_text) <= insertion_points:
        raise ValueError("error: decoy text must be longer! (at least " + str(insertion_points + 1) + " characters long)")
    output_string = io.StringIO()
    i = 0
    for j in range(0, len(encoded_text), 10):
        output_string.write(decoy_text[i])
        i += 1
        output_string.write(encoded_text[j : j + 10])
    output_string.write(decoy_text[i:])
    return output_string.getvalue()


def reveal_message(decoyed_message):
    encoded_message = find_message_in_str(decoyed_message)
    if not encoded_message:
        raise ValueError("This message doesn't contain a hidden message")
    decoded_message = decode_string(encoded_message)
    msg_type, msg = message_type(decoded_message)
    if msg_type == "STR":
        return msg
    elif msg_type == "FIL":
        file_name = str[1 : str[1:].index('\0')]
        file_data = str[str[1:].index('\0') : ]
        if not os.path.isfile(file_name):
            fil = open(file_name, "wb")
            fil.write(file_data)


    else:
        raise ValueError("Message has unknown type: " + msg_type)

root_parser = argparse.ArgumentParser(description="A utility for hiding and revealing messages in plain text")
sub_parsers = root_parser.add_subparsers(dest="mode")
hide_parser = sub_parsers.add_parser("hide")
reveal_parser = sub_parsers.add_parser("reveal")
gui_parser = sub_parsers.add_parser("gui")
hide_parser.add_argument("--file", action="store_true", help="Hide files instead of messages", dest="hide_file")
hide_parser.add_argument("--decoy-file", action="store_true", help="Use a file for the decoy", dest="decoy_use_file")
hide_parser.add_argument("decoy", type=str, help="Hide the message in this string (or file)")
hide_parser.add_argument("message", type=str, help="Message or file to be hidden")
reveal_parser.add_argument("decoyed", type=str, help="Find and decode hidden messages in this text")
reveal_parser.add_argument("--file", action="store_true", help="Reveal the contents of a file, rather than a string", dest="reveal_file")

cmdline_options = sys.argv[1:]
if len(cmdline_options) == 0:
    root_parser.print_help()
    sys.exit(1)
options = root_parser.parse_args(cmdline_options)

if options.mode == "hide":
    if options.decoy_use_file:
        try:
            options.decoy = gulp_file(options.decoy)
        except BaseException as e:
            exit("Error reading decoy data from file: " + str(e))

    try:
        print(hide_message(options.decoy, "file" if options.hide_file else "text", options.message))
    except BaseException as e:
        exit("Error generating message: " + str(e))
elif options.mode == "reveal":
    if options.reveal_file:
        try:
            options.decoyed = gulp_file(options.decoyed)
        except BaseException as e:
            exit("Error reading decoyed data from file: " + str(e))

    try:
        print(reveal_message(options.decoyed))
    except BaseException as e:
        exit("Error finding and decoding message: " + str(e))
else: # options.mode == "gui":
    root = Tk()

    root.minsize(width=500, height=500)

    tabset = Notebook(root)

    # HIDE tab
    hide_tab = Frame(tabset, padding="10 10 10 10")
    hide_tab.pack(expand=1, fill="both")

    decoy_input_label = Label(hide_tab, text="Decoy Message:")
    decoy_input_label.pack()

    decoy_input_box_contents = StringVar()
    decoy_input_box = Entry(hide_tab, width=50, font="Arial 22 bold", exportselection=1, justify="center", textvariable=decoy_input_box_contents)
    decoy_input_box.pack(expand=1, fill="both")

    message_input_label = Label(hide_tab, text="Real Message:")
    message_input_label.pack()

    message_input_box_contents = StringVar()
    message_input_box = Entry(hide_tab, width=50, font="Arial 22 bold", exportselection=1, justify="center", textvariable=message_input_box_contents)
    message_input_box.pack(expand=1, fill="both")

    def do_hiding():
        try:
            decoyed_output_box_contents.set(
                hide_message(
                    decoy_input_box_contents.get(),
                    "text",
                    message_input_box_contents.get()
                )
            )
        except BaseException as e:
            exit("Error generating message: " + str(e))

    hide_button = Button(hide_tab, text="Hide!", command=do_hiding)
    hide_button.pack()

    decoyed_output_label = Label(hide_tab, text="Output:")
    decoyed_output_label.pack()

    decoyed_output_box_contents = StringVar()
    decoyed_output_box = Entry(hide_tab, width=50, font="Arial 22 bold", exportselection=1, justify="center", textvariable=decoyed_output_box_contents)
    decoyed_output_box.pack(expand=1, fill="both")

    tabset.add(hide_tab, text="Hide")

    # REVEAL tab
    reveal_tab = Frame(tabset, padding="10 10 10 10")
    reveal_tab.pack(expand=1, fill="both")

    decoyed_input_label = Label(reveal_tab, text="Input Message:")
    decoyed_input_label.pack()

    decoyed_input_box_contents = StringVar()
    decoyed_input_box = Entry(reveal_tab, width=50, font="Arial 22 bold", exportselection=1, justify="center", textvariable=decoyed_input_box_contents)
    decoyed_input_box.pack(expand=1, fill="both")

    def do_reveal():
        try:
            recovered_message_box_contents.set(reveal_message(decoyed_input_box_contents.get()))
        except BaseException as e:
            exit("Error extracting message from message: " + str(e))

    reveal_button = Button(reveal_tab, text="Reveal!", command=do_reveal)
    reveal_button.pack()

    recoved_message_label = Label(reveal_tab, text="Hidden Message:")
    recoved_message_label.pack()

    recovered_message_box_contents = StringVar()
    recovered_message_box = Entry(reveal_tab, width=50, font="Arial 22 bold", exportselection=1, justify="center", textvariable=recovered_message_box_contents)
    recovered_message_box.pack(expand=1, fill="both")

    tabset.add(reveal_tab, text="Reveal")

    tabset.pack(expand=1, fill="both")

    root.mainloop()
