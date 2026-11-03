// Focused password-recovery contracts. Static only; no network or Supabase calls.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (file) => readFileSync(file, "utf8");

test("login exposes the canonical forgot-password destination without changing password sign-in", () => {
  const login = read("app/login/page.tsx");
  assert.match(login, /href="\/forgot-password"/);
  assert.match(login, /Забули пароль\?/);
  assert.match(login, /supabase\.auth\.signInWithPassword\(/);
  assert.match(login, /<AuthRecoveryCard/);
  assert.match(login, /vc-panel-warning/);
  assert.match(login, /vc-panel-danger/);
  assert.equal((login.match(/role="alert" aria-live="assertive"/g) ?? []).length, 2);
  assert.doesNotMatch(login, /(?:bg|text|border)-(?:white|gray|green|red|orange)-(?:\d+)/);
});

test("forgot-password uses the browser Supabase recovery API and enumeration-safe copy", () => {
  const page = read("app/forgot-password/page.tsx");
  assert.match(page, /supabase\.auth\.resetPasswordForEmail\(normalizedEmail/);
  assert.match(page, /const \{ error \} = await supabase\.auth\.resetPasswordForEmail/);
  assert.match(page, /if \(error\) \{[\s\S]*setErrorMessage\([\s\S]*return;/);
  assert.match(page, /window\.location\.origin/);
  assert.match(page, /\/auth\/confirm\?type=recovery&next=/);
  assert.match(page, /encodeURIComponent\("\/update-password"\)/);
  assert.match(page, /Якщо обліковий запис із цією адресою існує, ми надіслали посилання/);
  assert.doesNotMatch(page, /user not found|користувача не знайдено/i);
});

test("existing confirmation callback establishes OTP or PKCE recovery session with fixed destination", () => {
  const confirm = read("app/auth/confirm/route.ts");
  assert.match(confirm, /supabase\.auth\.verifyOtp\(/);
  assert.match(confirm, /supabase\.auth\.exchangeCodeForSession\(code!\)/);
  assert.match(confirm, /requestedNext === "\/update-password"/);
  assert.match(confirm, /type === "recovery"/);
  assert.match(confirm, /"\/update-password"/);
  assert.doesNotMatch(confirm, /redirectTo\.pathname\s*=\s*requestedNext/);
});

test("update-password validates session, matching passwords and established length policy", () => {
  const form = read("components/auth/UpdatePasswordForm.tsx");
  assert.match(form, /supabase\.auth\.getUser\(\)/);
  assert.match(form, /password !== confirmation/);
  assert.match(form, /Паролі не збігаються/);
  assert.match(form, /MIN_PASSWORD_LENGTH = 12/);
  assert.match(form, /MAX_PASSWORD_LENGTH = 128/);
  assert.match(form, /supabase\.auth\.updateUser\(\{ password \}\)/);
  assert.match(form, /supabase\.auth\.signOut\(\)/);
  assert.doesNotMatch(form, /service_role|admin\.updateUser|updateUserById/);
});

test("invalid recovery links remain recoverable and auth routing preserves existing boundaries", () => {
  const form = read("components/auth/UpdatePasswordForm.tsx");
  const routing = read("lib/auth/accountRouting.ts");
  assert.match(form, /Посилання недійсне/);
  assert.match(form, /href="\/forgot-password"/);
  assert.match(routing, /pathname === "\/forgot-password"/);
  assert.match(routing, /pathname === "\/update-password"/);
  assert.match(routing, /if \(identity === "guest"\) return guestPage \? null : "\/login"/);
});
