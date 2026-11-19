set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

root_dir := justfile_directory()
server := root_dir + "/server.js"

default:
	@just --list

dev:
	node {{server}}

install:
	cd {{root_dir}} && npm install

deploy:
	git -C {{root_dir}} pull
	cd {{root_dir}} && npm ci
	pm2 restart tarot
