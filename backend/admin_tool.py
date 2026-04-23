from auth import create_license

if __name__ == "__main__":
    test_key = "PRO-TEST-123"
    if create_license(test_key, "test@example.com"):
        print(f"✅ Created test key: {test_key}")
    else:
        print(f"❌ Key {test_key} already exists")
