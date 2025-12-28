.PHONY: build build-frontend clean run test default

default: test build

test:
	@echo "Running integration tests..."
	@go test -v .

build: build-frontend
	@echo "Building Go application..."
	@go build
	@echo "Build complete."

build-frontend:
	@mkdir -p static/js static/css
	./node_modules/.bin/esbuild frontend/src/index.tsx --bundle --minify --outfile=static/js/bundle.js --alias:react=preact/compat --alias:react-dom=preact/compat
	./node_modules/.bin/esbuild frontend/css/main.css --bundle --minify --outfile=static/css/bundle.css
	@echo "Frontend assets bundled into static/ using esbuild"

clean: 
	@rm -rf static/js static/css
	@echo "Cleaned static/js and static/css directories"
	@rm -rf downloads
	@mkdir -p downloads
	@rm -f lowtide.db
	@echo "Cleaned downloads directory and lowtide.db"


run: build-frontend
	@go run .
