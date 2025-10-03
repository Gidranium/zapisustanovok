import sys

import os

INTERP = os.path.expanduser("/var/www/u1258856/data/door_installer/bin/python")
if sys.executable != INTERP:
   os.execl(INTERP, INTERP, *sys.argv)

sys.path.append(os.getcwd())

from main import application
