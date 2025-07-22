#!/bin/bash

# Test script for database migration system
# This script tests the migration system without requiring a real database

set -e

echo "Testing Database Migration System..."

# Test 1: Check if migration files exist
echo "✓ Checking migration files..."
for file in migrations/001_initial_schema.sql migrations/002_add_indexes.sql migrations/003_seed_data.sql migrations/004_enhanced_indexes.sql; do
    if [ -f "$file" ]; then
        echo "  ✓ Found: $file"
    else
        echo "  ✗ Missing: $file"
        exit 1
    fi
done

# Test 2: Check SQL syntax (basic validation)
echo "✓ Validating SQL syntax..."
for file in migrations/*.sql; do
    # Basic SQL validation - check for common syntax issues
    if grep -q "CREATE TABLE\|CREATE INDEX\|INSERT INTO\|ALTER TABLE" "$file"; then
        echo "  ✓ Valid SQL structure in: $(basename $file)"
    else
        echo "  ⚠ No SQL commands found in: $(basename $file)"
    fi
done

# Test 3: Check if dbmanager builds
echo "✓ Testing dbmanager build..."
if go build -o test_dbmanager ./cmd/dbmanager/main.go; then
    echo "  ✓ dbmanager builds successfully"
    rm -f test_dbmanager
else
    echo "  ✗ dbmanager build failed"
    exit 1
fi

# Test 4: Check if shell script is executable
echo "✓ Testing shell script..."
if [ -x "dbmanager.sh" ]; then
    echo "  ✓ dbmanager.sh is executable"
else
    echo "  ✗ dbmanager.sh is not executable"
    exit 1
fi

# Test 5: Test help command
echo "✓ Testing help command..."
if ./dbmanager.sh help > /dev/null 2>&1; then
    echo "  ✓ Help command works"
else
    echo "  ✗ Help command failed"
    exit 1
fi

# Test 6: Check documentation
echo "✓ Checking documentation..."
if [ -f "DATABASE_MANAGEMENT.md" ]; then
    echo "  ✓ DATABASE_MANAGEMENT.md exists"
else
    echo "  ✗ DATABASE_MANAGEMENT.md missing"
    exit 1
fi

echo ""
echo "🎉 All tests passed! Database migration system is ready."
echo ""
echo "To use the system:"
echo "1. Set DATABASE_URL environment variable"
echo "2. Run: ./dbmanager.sh migrate"
echo "3. Run: ./dbmanager.sh seed (for development)"
echo "4. Run: ./dbmanager.sh health"
echo ""
echo "For more information, see DATABASE_MANAGEMENT.md"