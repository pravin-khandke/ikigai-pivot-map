import test from 'node:test';
import assert from 'node:assert/strict';
import { redact, validateFile, MAX_CHARS } from '../src/resume.js';

test('redact strips email, phone, url', () => {
  const out = redact('Mail me at a.b@x.com or +1 (555) 123-4567, see https://x.com/me');
  for (const s of ['a.b@x.com', '555', '4567', 'https://x.com']) assert.ok(!out.includes(s), s);
  assert.ok(out.includes('[removed]'));
});

test('redact handles international phones, www urls, street lines', () => {
  const out = redact('Call +44 20 7946 0958 or 555-123-4567\nwww.me.dev\n123 Main Street, Springfield\nSenior engineer');
  for (const s of ['7946', '555-123', 'www.me.dev', 'Main Street']) assert.ok(!out.includes(s), s);
  assert.ok(out.includes('Senior engineer'));
});

test('redact keeps years and plain numbers', () => {
  assert.equal(redact('Worked 2018-2022 on 40 projects'), 'Worked 2018-2022 on 40 projects');
});

test('redact truncates and handles empty', () => {
  assert.equal(redact('x'.repeat(7000)).length, MAX_CHARS);
  assert.equal(redact(''), '');
});

test('validateFile', () => {
  assert.equal(validateFile({ name: 'cv.exe', size: 10 }).ok, false);
  const big = validateFile({ name: 'cv.pdf', size: 3 * 1024 * 1024 });
  assert.equal(big.ok, false);
  assert.match(big.error, /2 MB/);
  assert.equal(validateFile({ name: 'CV.PDF', size: 100 }).ok, true);
});

test('redact strips schemeless urls but not emails mangled', () => {
  const out = redact('linkedin.com/in/jane github.com/jane www.example.com jane.dev x@y.com');
  for (const s of ['linkedin', 'github', 'example', 'jane.dev', 'y.com']) assert.ok(!out.includes(s), s);
});

test('redact phone parenthesis is removed cleanly', () => {
  assert.equal(redact('(555) 123-4567'), '[removed]');
});

test('redact does not wipe lines on false positives', () => {
  assert.match(redact('Managed 300 Park Avenue project'), /Managed.*project/);
  assert.equal(redact('12 Years Of Experience at Ct Corp'), '12 Years Of Experience at Ct Corp');
  const s = 'Led team of 12 at Dr Reddys Labs, 2015 Way forward';
  assert.equal(redact(s), s);
});

test('redact removes only the address fragment on multi-line text', () => {
  const out = redact('Jane Doe\n123 Main Street, Springfield\nSenior engineer');
  assert.ok(!out.includes('Main Street') && !out.includes('Springfield'));
  assert.ok(out.includes('Jane Doe') && out.includes('Senior engineer'));
});

test('redact keeps rest of single-line PDF-style text', () => {
  const out = redact('Jane Doe 123 Main Street, Springfield Senior engineer at Foo. Built many things.');
  assert.ok(!out.includes('Main Street'));
  assert.ok(out.includes('Senior engineer at Foo. Built many things.'));
});
