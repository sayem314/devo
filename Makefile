IMAGE ?= sayem314/devo
VERSION ?= $(shell node -p "require('./package.json').version")
PLATFORMS ?= linux/amd64,linux/arm64

.PHONY: docker-build docker-push docker-publish

docker-build:
	docker build \
		-t $(IMAGE):$(VERSION) \
		-t $(IMAGE):latest \
		.

docker-push:
	docker buildx build \
		--platform $(PLATFORMS) \
		-t $(IMAGE):$(VERSION) \
		-t $(IMAGE):latest \
		--push \
		.

docker-publish: docker-push
