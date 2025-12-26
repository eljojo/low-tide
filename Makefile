.PHONY: build-frontend

build-frontend:
	@mkdir -p static/js static/css
	./node_modules/.bin/esbuild frontend/src/index.tsx --bundle --minify --outfile=static/js/bundle.js --alias:react=preact/compat --alias:react-dom=preact/compat
	./node_modules/.bin/esbuild frontend/css/main.css --bundle --minify --outfile=static/css/bundle.css
	@echo "Frontend assets bundled into static/ using esbuild"
