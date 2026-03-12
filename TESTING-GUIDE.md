# Testing Guide

## Automated Tests in CI/CD Pipeline

The CI/CD pipeline includes automated tests that run during the CodeBuild phase. If tests fail, the deployment is blocked.

## Current Tests

### 1. HTML Content Validation

**Test:** Verify h1 tag contains "AWS Storage"

**Location:** `test.sh`

**Code:**
```bash
#!/bin/bash
set -e

echo "Running HTML content tests..."

# Test: Check if h1 tag contains "AWS Storage"
if grep -q '<h1>.*AWS Storage.*</h1>' public/index.html; then
  echo "✓ Test passed: h1 tag contains 'AWS Storage'"
else
  echo "✗ Test failed: h1 tag does not contain 'AWS Storage'"
  exit 1
fi

echo "All tests passed!"
```

**When it runs:** During CodeBuild build phase (before deployment)

**What happens if it fails:** 
- Build fails with exit code 1
- Deployment is blocked
- Pipeline stops at Build stage
- No changes are deployed to EC2

## Running Tests Locally

```bash
# Make script executable
chmod +x test.sh

# Run tests
./test.sh
```

**Expected output:**
```
Running HTML content tests...
✓ Test passed: h1 tag contains 'AWS Storage'
All tests passed!
```

## Adding More Tests

### Example: Test for specific CSS class

```bash
# Add to test.sh
if grep -q 'class="container"' public/index.html; then
  echo "✓ Test passed: container class exists"
else
  echo "✗ Test failed: container class not found"
  exit 1
fi
```

### Example: Test for JavaScript file

```bash
# Add to test.sh
if [ -f "public/app.js" ]; then
  echo "✓ Test passed: app.js exists"
else
  echo "✗ Test failed: app.js not found"
  exit 1
fi
```

### Example: Test Node.js dependencies

```bash
# Add to buildspec.yml build phase
- npm test  # Runs tests defined in package.json
```

## Integration with CodeBuild

Tests are executed in `buildspec.yml`:

```yaml
version: 0.2
phases:
  build:
    commands:
      - echo "Running tests..."
      - chmod +x test.sh
      - ./test.sh
      - echo "Build completed on $(date)"
```

## Viewing Test Results

### In AWS Console

1. Go to CodePipeline
2. Click on your pipeline
3. Click "Details" on Build stage
4. View "Build logs"

### Using AWS CLI

```bash
# Get latest build ID
BUILD_ID=$(aws codebuild list-builds-for-project \
  --project-name image-uploader-build \
  --query 'ids[0]' \
  --output text)

# View build logs
aws codebuild batch-get-builds \
  --ids $BUILD_ID \
  --query 'builds[0].logs'
```

### View CloudWatch Logs

```bash
# Stream logs
aws logs tail /aws/codebuild/image-uploader-build --follow
```

## Test Failure Example

If you change the h1 tag to remove "AWS Storage":

```html
<!-- This will fail the test -->
<h1>Image Uploader v1</h1>
```

**Build output:**
```
Running HTML content tests...
✗ Test failed: h1 tag does not contain 'AWS Storage'
[Container] 2024/03/12 10:30:45 Command did not exit successfully ./test.sh exit status 1
[Container] 2024/03/12 10:30:45 Phase complete: BUILD State: FAILED
```

**Pipeline status:** Build stage fails, Deploy stage never runs

## Best Practices

1. **Keep tests fast** - Tests run on every commit
2. **Test critical content** - Verify important HTML elements
3. **Test configuration** - Verify environment variables exist
4. **Test dependencies** - Ensure required files are present
5. **Fail fast** - Exit immediately on first failure
6. **Clear messages** - Use descriptive error messages
7. **Run locally first** - Test before pushing to GitHub

## Troubleshooting

### Test passes locally but fails in CodeBuild

**Cause:** Different file paths or environment

**Solution:** Check working directory in buildspec.yml

### Test always passes even when it should fail

**Cause:** Missing `set -e` in script

**Solution:** Add `set -e` at top of test.sh

### Cannot see test output

**Cause:** Logs not enabled

**Solution:** Check CloudWatch Logs for CodeBuild project

## Next Steps

- Add more HTML content tests
- Add JavaScript unit tests (Jest, Mocha)
- Add API endpoint tests
- Add security scanning (npm audit)
- Add code quality checks (ESLint)
- Add performance tests
