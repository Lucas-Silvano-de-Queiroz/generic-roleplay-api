#!/bin/sh
set -eu

: "${S3_BUCKET:?S3_BUCKET must be set}"
if ! awslocal s3api head-bucket --bucket "$S3_BUCKET" >/dev/null 2>&1; then
	awslocal s3api create-bucket --bucket "$S3_BUCKET"
fi
versioning="$(awslocal s3api get-bucket-versioning --bucket "$S3_BUCKET")"
case "$versioning" in
	*'"Status":'*) echo "S3 bucket versioning must be disabled for media cleanup." >&2; exit 1 ;;
esac
awslocal s3api put-public-access-block \
	--bucket "$S3_BUCKET" \
	--public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
awslocal s3api put-bucket-cors \
	--bucket "$S3_BUCKET" \
	--cors-configuration file:///etc/localstack/init/ready.d/media-cors.json
