"""Drives the real fzf with fzf/fzfrc through a pseudo-terminal and checks the vim modes.

Run: python3 fzf/test_fzfrc.py   (skips when fzf is not installed)
"""
import os
import fcntl
import pty
import struct
import termios
import select
import shutil
import subprocess
import sys
import time
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
FZF = shutil.which("fzf")


def run_fzf(items, keys, *args, prompt="Pick > "):
    """Feed items on stdin, type keys on the tty, return (exit code, selection)."""
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 24, 80, 0, 0))
    env = dict(os.environ, FZF_DEFAULT_OPTS_FILE=os.path.join(HERE, "fzfrc"),
               FZF_DEFAULT_OPTS="", TERM="xterm-256color", SHELL="/bin/sh")
    env.pop("FZF_DEFAULT_COMMAND", None)

    def as_tty():
        os.setsid()
        os.close(os.open(os.ttyname(slave), os.O_RDWR))  # becomes the controlling tty

    proc = subprocess.Popen([FZF, "--prompt", prompt, *args], stdin=subprocess.PIPE,
                            stdout=subprocess.PIPE, stderr=slave, env=env,
                            preexec_fn=as_tty, pass_fds=(slave,))
    proc.stdin.write("".join(f"{item}\n" for item in items).encode())
    proc.stdin.close()
    drain(master, 0.8)  # let fzf draw before typing
    for key in keys:
        os.write(master, key.encode())
        drain(master, 0.25)
    try:
        out, _ = proc.communicate(timeout=5)
    finally:
        if proc.poll() is None:
            proc.kill()
            proc.wait()
        proc.stdout.close()
    os.close(master)
    os.close(slave)
    return proc.returncode, out.decode().strip()


def drain(fd, seconds):
    end = time.time() + seconds
    while time.time() < end:
        ready, _, _ = select.select([fd], [], [], 0.05)
        if ready:
            try:
                os.read(fd, 65536)
            except OSError:
                return


ESC, ENTER = "\x1b", "\r"


@unittest.skipUnless(FZF, "fzf not installed")
class FzfVimModes(unittest.TestCase):
    items = ["alpha", "jam", "kilo", "golf"]

    def test_insert_mode_types_j_and_k(self):
        self.assertEqual(run_fzf(self.items, ["j", "a", ENTER]), (0, "jam"))

    # j/k move the cursor visually down/up, so with the list top-down (--layout=reverse) j goes
    # to the next item, and in fzf's default bottom-up layout k does.
    def test_ctrl_j_moves_in_insert_mode(self):
        self.assertEqual(run_fzf(self.items, ["\x0a", ENTER], "--layout=reverse"), (0, "jam"))

    def test_normal_mode_j_k_g(self):
        reverse = "--layout=reverse"
        self.assertEqual(run_fzf(self.items, [ESC, "j", "j", ENTER], reverse), (0, "kilo"))
        self.assertEqual(run_fzf(self.items, [ESC, "G", "k", ENTER], reverse), (0, "kilo"))
        self.assertEqual(run_fzf(self.items, [ESC, "G", "g", ENTER], reverse), (0, "alpha"))
        self.assertEqual(run_fzf(self.items, [ESC, "k", ENTER]), (0, "jam"))

    def test_i_returns_to_insert(self):
        self.assertEqual(run_fzf(self.items, [ESC, "i", "g", "o", ENTER]), (0, "golf"))

    def test_quit_from_normal_mode(self):
        self.assertEqual(run_fzf(self.items, [ESC, "q"])[0], 130)
        self.assertEqual(run_fzf(self.items, [ESC, ESC])[0], 130)


if __name__ == "__main__":
    unittest.main(verbosity=2)
