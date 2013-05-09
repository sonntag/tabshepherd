#!/bin/sh
if [ -z "$1" ]; then
  echo "provide a release number"
  exit;
fi
git archive $1 -o dist/ts$1.zip
