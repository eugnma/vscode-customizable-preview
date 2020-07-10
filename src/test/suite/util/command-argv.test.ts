import * as assert from 'assert';
import { commandArgv } from '../../../util/command-argv';

suite("command-argv", function (): void {
    test("Parse empty commands", function (): void {
        // assert.throws(() => commandArgv(undefined), (err: Error) => err.message === 'Not found any valid command.');
        // assert.throws(() => commandArgv(null), (err: Error) => err.message === 'Not found any valid command.');
        assert.throws((): string[] => commandArgv(''), (err: Error): boolean => err.message === 'Not found any valid command.');
        assert.throws((): string[] => commandArgv(' '), (err: Error): boolean => err.message === 'Not found any valid command.');
    });

    test("Parse basic commands", function (): void {
        assert.deepStrictEqual(commandArgv('command aaa 123'), ['command', 'aaa', '123']);
    });

    test("Parse escaped commands", function (): void {
        assert.deepStrictEqual(commandArgv('command aaa\\ 123'), ['command', 'aaa 123']);
        assert.throws((): string[] => commandArgv('command aaa \\'), (err: Error): boolean => err.message === 'Not found the following characters of the last escape character.');
    });

    test("Parse quoted commands", function (): void {
        assert.deepStrictEqual(commandArgv('command "aaa 123"'), ['command', 'aaa 123']);
        assert.deepStrictEqual(commandArgv("command 'aaa 123'"), ['command', 'aaa 123']);
        assert.throws((): string[] => commandArgv('command "aaa 123'), (err: Error): boolean => err.message === 'Invalid pair of the last quotation mark.');
        assert.throws((): string[] => commandArgv("command 'aaa 123"), (err: Error): boolean => err.message === 'Invalid pair of the last quotation mark.');
        assert.throws((): string[] => commandArgv('command aaa"123'), (err: Error): boolean => err.message === 'Quotation marks are part of arguments should be escaped.');
        assert.throws((): string[] => commandArgv("command aaa'123"), (err: Error): boolean => err.message === 'Quotation marks are part of arguments should be escaped.');
    });
});