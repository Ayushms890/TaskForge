import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { supervise } from "./processes.mjs";

function setup(platform = "linux") {
  const host = new EventEmitter();
  const children = [];
  const launches = [];
  const kills = [];
  supervise(
    [
      { name: "api", cwd: "api", args: ["tsx", "watch", "server.ts"] },
      { name: "web", cwd: "web", args: ["next", "dev"] },
    ],
    {
      host,
      platform,
      spawn(executable, args, options) {
        launches.push({ executable, args, options });
        const child = new EventEmitter();
        child.pid = children.length + 100;
        children.push(child);
        return child;
      },
      killTree(child, signal) {
        kills.push({ child, signal });
      },
    },
  );
  return { host, children, launches, kills };
}

test("launches Node entrypoints without a shell on both platforms", () => {
  for (const platform of ["linux", "win32"]) {
    const { host, children, launches } = setup(platform);
    assert.equal(launches.length, 2);
    assert.equal(launches[0].executable, process.execPath);
    assert.deepEqual(launches[1].args, ["next", "dev"]);
    assert.equal(launches[0].options.shell, undefined);
    assert.equal(launches[0].options.stdio, "inherit");
    assert.equal(launches[0].options.detached, platform !== "win32");
    host.emit("SIGINT");
    children.forEach((child) => child.emit("exit", null, "SIGINT"));
  }
});

test("a failed server shuts down its sibling and preserves its exit status", () => {
  const { host, children, kills } = setup();
  children[0].emit("exit", 7, null);
  assert.equal(host.exitCode, 7);
  assert.ok(kills.some(({ child }) => child === children[1]));
  children[1].emit("exit", 0, null);
  assert.equal(host.exitCode, 7);
  assert.equal(host.listenerCount("SIGINT"), 0);
});

test("Ctrl+C and termination stop both children exactly once", () => {
  for (const [signal, code] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ]) {
    const { host, children, kills } = setup();
    host.emit(signal);
    host.emit(signal);
    assert.equal(host.exitCode, code);
    assert.equal(kills.length, 2);
    assert.ok(kills.every((kill) => kill.signal === signal));
    children.forEach((child) => child.emit("exit", 0, null));
    assert.equal(host.listenerCount("SIGTERM"), 0);
  }
});

test("normal child completion shuts down the sibling with a successful status", () => {
  const { host, children, kills } = setup();
  children[0].emit("exit", 0, null);
  assert.equal(host.exitCode, 0);
  assert.ok(kills.some(({ child }) => child === children[1]));
  children[1].emit("exit", null, "SIGTERM");
  assert.equal(host.exitCode, 0);
});
