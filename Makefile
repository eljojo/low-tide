.PHONY: build build-frontend clean run test test-e2e test-all default clean-dev-db clean-run open-screenshots

default: clean test-all
	@echo "ready to sail! 🚤"

test:
	@echo "Running Go integration tests..."
	@go test -v .

test-e2e: build
	@echo "Running Playwright E2E tests..."
	@npx playwright test

test-all: build test test-e2e
	@echo "All tests passed."

build: build-frontend
	@echo "Building Go application..."
	@go build
	@echo "Build complete."

build-frontend:
	@echo "Building frontend..."
	@mkdir -p static/js static/css
	@./node_modules/.bin/esbuild frontend/src/index.tsx --bundle --minify --outfile=static/js/bundle.js --alias:react=preact/compat --alias:react-dom=preact/compat
	@./node_modules/.bin/esbuild frontend/css/main.css --bundle --minify --outfile=static/css/bundle.css
	@echo "Frontend assets bundled into static/ using esbuild"

clean: 
	@rm -rf static/js static/css
	@echo "Cleaned static/js and static/css directories"
	@rm -rf e2e/tmp
	@mkdir -p e2e/tmp
	@echo "Cleaned e2e/tmp"

clean-dev-db:
	@rm -rf downloads
	@mkdir -p downloads
	@rm -f lowtide.db
	@echo "Cleaned downloads and lowtide.db"

clean-run: clean-dev-db run
run: build-frontend
	@go run .

open-screenshots:
	@echo "Opening E2E test screenshots..."
	@open e2e/tmp/screenshots
