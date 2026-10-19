#!/usr/bin/env python3
"""Bump-test the probe feed GPIO wiring the way the MCP server will see it.

Reads the SAME configuration the server uses (~/.snapmaker-luban.json keys
mcpGpioPin*/mcpGpioInverted/mcpGpioU2if, overridden by LUBAN_MCP_GPIO_*
environment variables), opens the pins through Blinka with the configured
pulls, and prints every change as raw value -> interpreted state (idle or
TRIGGERED, polarity applied exactly like probeFeed.ts isTriggeredValue).
Trigger each sensor by hand while it runs; the summary says whether each
channel was seen idle AND triggered, and flags a channel whose resting state
reads TRIGGERED (polarity almost certainly wrong).

    ~/dev/Luban/.venv/bin/python src/server/services/mcp/gpio_bumptest.py --seconds 90

Run under the interpreter named by mcpGpioPython (the venv from
requirements.txt). Stdlib + Blinka only.
"""
import argparse
import json
import os
import sys
import time

CHANNELS = ('toolsetter', 'overtravel', 'probe')
CONFIG_KEYS = {
    'toolsetter': ('LUBAN_MCP_GPIO_PIN_TOOLSETTER', 'mcpGpioPinToolsetter'),
    'overtravel': ('LUBAN_MCP_GPIO_PIN_OVERTRAVEL', 'mcpGpioPinOvertravel'),
    'probe': ('LUBAN_MCP_GPIO_PIN_PROBE', 'mcpGpioPinProbe'),
    'inverted': ('LUBAN_MCP_GPIO_INVERTED', 'mcpGpioInverted'),
    'blinkaEnv': ('LUBAN_MCP_GPIO_BLINKA_ENV', 'mcpGpioBlinkaEnv'),
}
DEFAULT_BLINKA_ENV = 'BLINKA_U2IF=1'


def load_settings(config_path):
    stored = {}
    if os.path.exists(config_path):
        with open(config_path, encoding='utf-8') as handle:
            stored = json.load(handle)
    settings = {}
    for name, (env, key) in CONFIG_KEYS.items():
        value = os.environ.get(env, '').strip() or str(stored.get(key, '') or '').strip()
        settings[name] = value
    return settings


def parse_pin(spec):
    """'GP6:up' -> ('GP6', 'up'); bare name -> floating."""
    parts = [part.strip() for part in spec.split(':')]
    name = parts[0]
    pull = (parts[1] if len(parts) > 1 and parts[1] else 'float').lower()
    if pull not in ('up', 'down', 'float'):
        raise SystemExit('pin %r: pull must be up, down or float' % spec)
    return name, pull


def is_triggered(raw, inverted):
    # Mirrors isTriggeredValue: numeric > 0 is "on", inverted flips it.
    return (not raw) if inverted else raw


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--seconds', type=float, default=0,
                        help='stop after this long (default: run until Ctrl-C)')
    parser.add_argument('--poll-ms', type=float, default=10)
    parser.add_argument('--config', default=os.path.expanduser('~/.snapmaker-luban.json'))
    args = parser.parse_args()

    settings = load_settings(args.config)
    # Same Blinka environment the server hands its monitor (gpioFeed.ts):
    # NAME=VALUE pairs, or "native" for Blinka's own board detection.
    blinka_env = settings['blinkaEnv'] or DEFAULT_BLINKA_ENV
    if blinka_env.strip().lower() not in ('native', 'none', 'off'):
        for token in blinka_env.replace(',', ' ').split():
            if '=' not in token:
                raise SystemExit('Blinka environment entry %r is not NAME=VALUE' % token)
            name, value = token.split('=', 1)
            os.environ[name] = value

    pins = {}
    for channel in CHANNELS:
        if settings[channel]:
            pins[channel] = parse_pin(settings[channel])
    if not pins:
        raise SystemExit('No pins configured (mcpGpioPin* in %s or LUBAN_MCP_GPIO_PIN_*).' % args.config)
    inverted = {name.strip().lower() for name in settings['inverted'].split(',') if name.strip()}

    import board  # noqa: E402  (after the Blinka environment is set)
    import digitalio  # noqa: E402

    board_id = getattr(board, 'board_id', 'unknown')
    print('board: %s   config: %s' % (board_id, args.config))
    lines = {}
    for channel, (name, pull) in pins.items():
        if not hasattr(board, name):
            available = ', '.join(n for n in dir(board) if not n.startswith('_') and n[:1].isupper())
            raise SystemExit('board %s has no pin %s. Available: %s' % (board_id, name, available))
        line = digitalio.DigitalInOut(getattr(board, name))
        line.direction = digitalio.Direction.INPUT
        if pull == 'up':
            line.pull = digitalio.Pull.UP
        elif pull == 'down':
            line.pull = digitalio.Pull.DOWN
        lines[channel] = line
        print('  %-10s %-4s pull-%-5s %s' % (channel, name, pull,
                                             'INVERTED (contact reads 0)' if channel in inverted else 'direct (contact reads 1)'))
    print('Trigger each sensor by hand. Ctrl-C to stop.\n')

    started = time.monotonic()
    last = {}
    seen = {channel: set() for channel in lines}
    resting = {}
    try:
        while True:
            for channel, line in lines.items():
                raw = bool(line.value)
                if last.get(channel) == raw:
                    continue
                last[channel] = raw
                triggered = is_triggered(raw, channel in inverted)
                seen[channel].add(triggered)
                if channel not in resting:
                    resting[channel] = triggered
                stamp = '%7.2fs' % (time.monotonic() - started)
                print('%s  %-10s %-4s raw=%d -> %s' % (stamp, channel, pins[channel][0], int(raw),
                                                        'TRIGGERED' if triggered else 'idle'))
            if args.seconds and time.monotonic() - started >= args.seconds:
                break
            time.sleep(args.poll_ms / 1000.0)
    except KeyboardInterrupt:
        pass
    finally:
        for line in lines.values():
            line.deinit()

    print('\nSummary:')
    exit_code = 0
    for channel in lines:
        states = seen[channel]
        if resting.get(channel):
            verdict = 'RESTING STATE READS TRIGGERED - polarity is almost certainly wrong (toggle it in mcpGpioInverted)'
            exit_code = 1
        elif states == {False, True}:
            verdict = 'OK - seen idle and TRIGGERED'
        else:
            verdict = 'never triggered - only idle seen (not exercised, or wiring/pin wrong)'
            exit_code = 1
        print('  %-10s %s' % (channel, verdict))
    return exit_code


if __name__ == '__main__':
    sys.exit(main())
