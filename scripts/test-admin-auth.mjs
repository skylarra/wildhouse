#!/usr/bin/env node
/**
 * Admin auth helper checks (pure).
 * Run: node scripts/test-admin-auth.mjs
 */
import assert from "node:assert/strict";
import { checkAdmin } from "../functions/api/_admin-auth.js";

function req(auth) {
  return {
    headers: {
      get(name) {
        if (name.toLowerCase() === "authorization") return auth || "";
        return null;
      },
    },
  };
}

assert.equal(checkAdmin(req("Bearer secret"), { ADMIN_PASSWORD: "secret" }).ok, true);
assert.equal(checkAdmin(req("Bearer wrong"), { ADMIN_PASSWORD: "secret" }).ok, false);
assert.equal(checkAdmin(req(""), { ADMIN_PASSWORD: "secret" }).ok, false);
assert.equal(checkAdmin(req("Bearer secret"), {}).ok, false);
assert.equal(checkAdmin(req("Bearer secret"), {}).reason, "ADMIN_PASSWORD not configured");
assert.equal(checkAdmin(req("Bearer wrong"), { ADMIN_PASSWORD: "secret" }).reason, "bad token");

console.log("test-admin-auth: all passed");
