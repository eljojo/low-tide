.PHONY: build-frontend

build-frontend:
	@mkdir -p static/js static/css
	./node_modules/.bin/esbuild frontend/src/main.ts --bundle --outfile=static/js/bundle.js
	./node_modules/.bin/esbuild frontend/css/main.css --bundle --outfile=static/css/bundle.css
	@echo "Frontend assets bundled into static/ using esbuild"
