import test from 'node:test';
import assert from 'node:assert/strict';
import {botProfile} from '../shared/bot-profile.js';
import {validateTelegram} from '../server/auth.js';
import {readFileSync} from 'node:fs';
test('Telegram branding fits API limits and contains no emoji',()=>{
 assert.ok(botProfile.name.length<=64);assert.ok(botProfile.short_description.length<=120);assert.ok(botProfile.description.length<=512);
 assert.ok(!/\p{Extended_Pictographic}/u.test(JSON.stringify(botProfile)));
 assert.equal(new Set(botProfile.commands.map(c=>c.command)).size,6);
 botProfile.commands.forEach(c=>{assert.match(c.command,/^[a-z_]{1,32}$/);assert.ok(c.description.length>=1&&c.description.length<=256)});
});
test('pixel avatar is a real 512px PNG',()=>{
 const png=readFileSync(new URL('../assets/telegram-avatar.png',import.meta.url));
 assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),512);assert.equal(png.readUInt32BE(20),512);
});
test('unconfigured Telegram access is denied',()=>{
 assert.equal(validateTelegram('','unused',[]),false);
});
