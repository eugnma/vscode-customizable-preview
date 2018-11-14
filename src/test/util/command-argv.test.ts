import * as assert from 'assert';
import { commandArgv } from '../../util/command-argv';

suite("command-argv", function () {
    test("Parse empty commands", function () {
        // assert.throws(() => commandArgv(undefined), (err: Error) => err.message === 'Not found any valid command.');
        // assert.throws(() => commandArgv(null), (err: Error) => err.message === 'Not found any valid command.');
        assert.throws(() => commandArgv(''), (err: Error) => err.message === 'Not found any valid command.');
        assert.throws(() => commandArgv(' '), (err: Error) => err.message === 'Not found any valid command.');
    });

    test("Parse basic commands", function () {
        assert.deepStrictEqual(commandArgv('command aaa 123'), ['command', 'aaa', '123']);
    });

    test("Parse escaped commands", function () {
        assert.deepStrictEqual(commandArgv('command aaa\\ 123'), ['command', 'aaa 123']);
        assert.throws(() => commandArgv('command aaa \\'), (err: Error) => err.message === 'Not found the following characters of the last escape character.');
    });

    test("Parse quoted commands", function () {
        assert.deepStrictEqual(commandArgv('command "aaa 123"'), ['command', 'aaa 123']);
        assert.deepStrictEqual(commandArgv("command 'aaa 123'"), ['command', 'aaa 123']);
        assert.throws(() => commandArgv('command "aaa 123'), (err: Error) => err.message === 'Invalid pair of the last quotation mark.');
        assert.throws(() => commandArgv("command 'aaa 123"), (err: Error) => err.message === 'Invalid pair of the last quotation mark.');
        assert.throws(() => commandArgv('command aaa"123'), (err: Error) => err.message === 'Quotation marks are part of arguments should be escaped.');
        assert.throws(() => commandArgv("command aaa'123"), (err: Error) => err.message === 'Quotation marks are part of arguments should be escaped.');
    });
});