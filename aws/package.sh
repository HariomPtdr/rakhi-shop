#!/bin/sh
# ════════════════════════════════════════════════════════════════════
#  Build the zip to upload to Lambda.
#
#      sh aws/package.sh
#      → aws/rzp-lambda.zip
#
#  The three payment handlers are NOT duplicated in this directory.
#  They are copied out of netlify/functions at packaging time, so there
#  is one copy of the code that checks a payment signature and it is the
#  one that was tested. Two copies of that, drifting apart, is how a
#  payment check quietly stops matching the payment.
#
#  No npm, no node_modules: the handlers use only fetch and node:crypto,
#  both built into the Node 20+ runtime.
# ════════════════════════════════════════════════════════════════════
set -e
cd "$(dirname "$0")/.."

OUT="aws/rzp-lambda.zip"
STAGE="aws/.stage"

rm -rf "$STAGE" "$OUT"
mkdir -p "$STAGE/handlers"

cp aws/lambda/index.mjs "$STAGE/index.mjs"
cp netlify/functions/rzp-create-order.mjs \
   netlify/functions/rzp-verify.mjs \
   netlify/functions/rzp-webhook.mjs "$STAGE/handlers/"

# stored with paths relative to the zip root, which is where Lambda looks
( cd "$STAGE" && zip -q -r "../../$OUT" . )
rm -rf "$STAGE"

echo "  $OUT"
# awk rather than head -n -2: BSD head has no negative count, so the same
# line on a Mac printed nothing but an error
unzip -l "$OUT" | awk '/\.mjs$/ {printf "    %-34s %7s bytes\n", $4, $1}'
echo
echo "  Upload it in Lambda → Code → Upload from → .zip file"
echo "  Handler stays the default: index.handler"
