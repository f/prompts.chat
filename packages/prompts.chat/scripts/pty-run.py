#!/usr/bin/env python3
"""Runs a command in a pseudo-terminal with a fixed window size, relaying stdin and stdout.

Used by pack-smoke.mjs to drive the TUI with a known window size, whatever terminal (if any) the
caller has.

    pty-run.py <columns> <rows> <command> [args...]
"""
import fcntl
import os
import pty
import select
import struct
import sys
import termios

cols, rows, argv = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3:]
winsize = struct.pack("HHHH", rows, cols, 0, 0)
pid, fd = pty.fork()
if pid == 0:
    # Set before exec so the program never sees a 0x0 terminal
    fcntl.ioctl(0, termios.TIOCSWINSZ, winsize)
    os.execvp(argv[0], argv)

fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
stdin_open = True
while True:
    readable, _, _ = select.select([fd] + ([sys.stdin.fileno()] if stdin_open else []), [], [])
    if fd in readable:
        try:
            data = os.read(fd, 65536)
        except OSError:
            break
        if not data:
            break
        sys.stdout.buffer.write(data)
        sys.stdout.buffer.flush()
    if stdin_open and sys.stdin.fileno() in readable:
        data = os.read(sys.stdin.fileno(), 1024)
        if data:
            os.write(fd, data)
        else:
            stdin_open = False

_, status = os.waitpid(pid, 0)
sys.exit(os.waitstatus_to_exitcode(status))
