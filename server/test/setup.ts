// Test environment: no real database or secrets are needed for these tests.
process.env.NODE_ENV = "test";
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:1/civiconnect-test";
process.env.JWT_SECRET ??= "test-secret-test-secret-test-secret-1234";
process.env.VISION_URL = process.env.TEST_VISION_URL ?? "http://127.0.0.1:1";
