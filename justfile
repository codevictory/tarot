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
	{{root_dir}}/scripts/deploy.sh
