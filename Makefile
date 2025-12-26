.PHONY: build-frontend

build-frontend:
	@mkdir -p static/js static/css
	cat frontend/css/*.css > static/css/bundle.css
	cat frontend/js/*.js > static/js/bundle.js
	@echo "Frontend assets bundled into static/"
