#!/bin/sh

LOCAL_BIN_DIRECOTRY=$HOME/bin

if [[ ! -d  "$LOCAL_BIN_DIRECOTRY" ]]; then
	mkdir "$LOCAL_BIN_DIRECOTRY"
fi

yes | cp -rf $PWD/bin/* $HOME/bin/
