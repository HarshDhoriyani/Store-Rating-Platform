import test from "node:test";
import assert from "node:assert/strict";
import { isValidAddress, isValidName, isValidPassword } from "../server/validation.js";

test("accepts a valid password", () => {
  assert.equal(isValidPassword("Secure@123"), true);
});

test("rejects passwords without uppercase letters", () => {
  assert.equal(isValidPassword("secure@123"), false);
});

test("rejects passwords without special characters", () => {
  assert.equal(isValidPassword("Secure123"), false);
});

test("rejects passwords outside 8-16 characters", () => {
  assert.equal(isValidPassword("Ab@123"), false);
  assert.equal(isValidPassword("Abcdefghi@1234567"), false);
});

test("enforces trimmed name length between 20 and 60 characters", () => {
  assert.equal(isValidName("a".repeat(20)), true);
  assert.equal(isValidName("a".repeat(19)), false);
  assert.equal(isValidName("a".repeat(61)), false);
  assert.equal(isValidName(" ".repeat(20)), false);
});

test("limits addresses to 400 characters and requires text", () => {
  assert.equal(isValidAddress("a".repeat(400)), true);
  assert.equal(isValidAddress("a".repeat(401)), false);
  assert.equal(isValidAddress(null), false);
});
