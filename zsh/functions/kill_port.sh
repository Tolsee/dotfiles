function kill_port() {
	lsof -i tcp:$1
}
