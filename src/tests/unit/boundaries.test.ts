import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { authorized, validHealthRequest } from '../../shared/contract';
import { prepareDataRoot, productionRoot, acquireRootLock, OWNER } from '../../main/data-root';
import { resourceKey, resourceResponse } from '../../main/resources';
import { isolatedRoot } from '../helpers';
import { ManualClock } from '../../shared/testing';

test('health validation rejects types, unknown/dangerous keys and inherited objects', () => {
  assert.equal(validHealthRequest({}), true);
  for (const value of [null, undefined, [], '', 0, true, { extra: 1 }, JSON.parse('{"__proto__":{}}'), { constructor: 'x' }, Object.create({ inherited: 1 })]) assert.equal(validHealthRequest(value), false);
});
test('caller must match window, main frame and exact document', () => {
  const caller = { senderId: 3, frameIsMain: true, frameURL: 'app://workstation/index.html' };
  assert.equal(authorized(caller, 3, caller.frameURL), true);
  for (const changed of [{ senderId: 4 }, { frameIsMain: false }, { frameURL: caller.frameURL + '?x' }, { frameURL: 'app://other/index.html' }]) assert.equal(authorized({ ...caller, ...changed }, 3, caller.frameURL), false);
});
test('unknown and future data roots are never overwritten', () => {
  const fixture = isolatedRoot();
  try {
    const root = path.join(fixture.root, 'data');
    fs.mkdirSync(root); fs.writeFileSync(path.join(root, 'unknown.txt'), 'fictional');
    assert.throws(() => prepareDataRoot(root), /UNKNOWN_DATA_ROOT/);
    assert.equal(fs.readFileSync(path.join(root, 'unknown.txt'), 'utf8'), 'fictional');
    assert.equal(fs.existsSync(path.join(root, 'owner.json')), false);
    fs.writeFileSync(path.join(root, 'owner.json'), JSON.stringify({ ...OWNER, formatVersion: 2 }));
    assert.throws(() => prepareDataRoot(root), /INCOMPATIBLE_OWNER/);
  } finally { fixture.cleanup(); }
});
test('data ownership and root lock are repeatable and exclusive', () => {
  const fixture = isolatedRoot();
  try {
    const root = path.join(fixture.root, 'data'); prepareDataRoot(root); prepareDataRoot(root);
    const release = acquireRootLock(root);
    assert.throws(() => acquireRootLock(root), /DATA_ROOT_IN_USE/);
    release(); const again = acquireRootLock(root); again();
    assert.equal(fs.existsSync(path.join(root, 'instance.lock')), false);
    assert.equal(productionRoot('C:\\Users\\Fictional\\AppData\\Local'), 'C:\\Users\\Fictional\\AppData\\Local\\WorkStation');
    assert.throws(() => productionRoot(undefined), /LOCALAPPDATA_REQUIRED/);
  } finally { fixture.cleanup(); }
});
test('resource manifest serves only intact approved files', async () => {
  const fixture = isolatedRoot();
  try {
    fs.writeFileSync(path.join(fixture.root, 'index.html'), '<h1>fixture</h1>');
    const bytes = fs.readFileSync(path.join(fixture.root, 'index.html'));
    const manifest = { 'index.html': { sha256: createHash('sha256').update(bytes).digest('hex'), mime: 'text/html' } };
    const good = await resourceResponse('app://workstation/index.html', 'GET', fixture.root, manifest);
    assert.equal(good.status, 200); assert.equal(await good.text(), bytes.toString());
    for (const url of ['app://workstation/../owner.json', 'app://workstation/%2e%2e/owner.json', 'app://workstation/index.html?x', 'file:///C:/Windows/win.ini', 'app://evil/index.html', 'app://workstation/no.txt', 'app://workstation/__proto__']) assert.equal((await resourceResponse(url, 'GET', fixture.root, manifest)).status, 404);
    assert.equal((await resourceResponse('app://workstation/index.html', 'POST', fixture.root, manifest)).status, 404);
    fs.writeFileSync(path.join(fixture.root, 'index.html'), 'changed');
    assert.equal((await resourceResponse('app://workstation/index.html', 'GET', fixture.root, manifest)).status, 404);
    assert.equal(resourceKey('app://workstation/a\\b'), null);
  } finally { fixture.cleanup(); }
});
test('linked data roots and linked resources are rejected', async () => {
  const fixture = isolatedRoot();
  try {
    const outside = path.join(fixture.root, 'outside'); fs.mkdirSync(outside);
    const linked = path.join(fixture.root, 'linked'); fs.symlinkSync(outside, linked, 'junction');
    assert.throws(() => prepareDataRoot(linked), /LINKED_DATA_ROOT/);
    assert.equal(fs.readdirSync(outside).length, 0);
    fs.unlinkSync(linked);
  } finally { fixture.cleanup(); }
});
test('manual clock advances deterministically and rejects negative travel', () => {
  const clock = new ManualClock(100); clock.advance(50); assert.equal(clock.now(), 150);
  assert.throws(() => clock.advance(-1), /INVALID_ADVANCE/);
});
