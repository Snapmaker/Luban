import { strict as assert } from 'assert';

import {
    describeSourceChoice,
    ffmpegInputArgs,
    matchAudioDevice,
    parseArecordList,
    parseDshowDevices,
    parsePactlSources,
    parsePipewireDump,
} from '../audioSelection';

// snapcnclaptop as surveyed 2026-09-29: one HDA capture card, PipeWire.
const PW_DUMP = [
    { type: 'PipeWire:Interface:Node', info: { props: { 'media.class': 'Audio/Sink', 'node.name': 'alsa_output.pci-0000_00_0e.0.analog-stereo' } } },
    {
        type: 'PipeWire:Interface:Node',
        info: {
            props: {
                'media.class': 'Audio/Source',
                'node.name': 'alsa_input.pci-0000_00_0e.0.analog-stereo',
                'node.description': 'Built-in Audio Analogue Stereo',
                'node.nick': 'ALC269VC Analog',
                'api.alsa.card.name': 'HDA Intel PCH',
                'object.path': 'alsa:pcm:0:front:0:capture',
            },
        },
    },
    {
        type: 'PipeWire:Interface:Node',
        info: {
            props: {
                'media.class': 'Audio/Source',
                'node.name': 'alsa_input.usb-Generic_USB_Camera_200901010001-02.mono-fallback',
                'node.description': 'USB Camera Mono',
                'node.nick': 'USB Camera',
            },
        },
    },
    { type: 'PipeWire:Interface:Node', info: { props: { 'media.class': 'Video/Source', 'node.name': 'v4l2_input.pci-0000_00_15.0-usb-0_5_1.0' } } },
];

const ARECORD = `**** List of CAPTURE Hardware Devices ****
card 0: PCH [HDA Intel PCH], device 0: ALC269VC Analog [ALC269VC Analog]
  Subdevices: 1/1
  Subdevice #0: subdevice #0
card 1: Camera [USB Camera], device 0: USB Audio [USB Audio]
  Subdevices: 1/1
`;

export const tests: Array<[string, () => void]> = [
    ['pw-dump: only Audio/Source nodes, with nick / description / card aliases', () => {
        const sources = parsePipewireDump(PW_DUMP);
        assert.deepEqual(sources.map((s) => s.entry), [
            'pulse:alsa_input.pci-0000_00_0e.0.analog-stereo',
            'pulse:alsa_input.usb-Generic_USB_Camera_200901010001-02.mono-fallback',
        ]);
        assert.equal(sources[0].builtIn, true);
        assert.equal(sources[0].usb, false);
        assert.ok(sources[0].aliases.includes('ALC269VC Analog'));
        assert.ok(sources[0].aliases.includes('HDA Intel PCH'));
        assert.equal(sources[1].usb, true);
        assert.equal(sources[1].builtIn, false);
    }],

    ['pactl short list skips monitors', () => {
        const sources = parsePactlSources('0\talsa_output.pci.monitor\tPipeWire\ts32le 2ch 48000Hz\tSUSPENDED\n1\talsa_input.pci-0000_00_0e.0.analog-stereo\tPipeWire\ts32le 2ch 48000Hz\tSUSPENDED\n');
        assert.deepEqual(sources.map((s) => s.entry), ['pulse:alsa_input.pci-0000_00_0e.0.analog-stereo']);
    }],

    ['arecord -l: hw:CARD=...,DEV=... entries with numeric and plughw aliases', () => {
        const sources = parseArecordList(ARECORD);
        assert.deepEqual(sources.map((s) => s.entry), ['alsa:hw:CARD=PCH,DEV=0', 'alsa:hw:CARD=Camera,DEV=0']);
        assert.equal(sources[0].description, 'HDA Intel PCH, ALC269VC Analog');
        assert.ok(sources[0].aliases.includes('hw:0,0'));
        assert.ok(sources[0].aliases.includes('plughw:CARD=PCH,DEV=0'));
        assert.equal(sources[1].usb, true);
    }],

    ['dshow listing: both the typed and the sectioned ffmpeg formats, audio only', () => {
        const typed = `[dshow @ 000001] "Integrated Camera" (video)
[dshow @ 000001]   Alternative name "@device_pnp_..."
[dshow @ 000001] "Microphone (USB Camera)" (audio)
[dshow @ 000001]   Alternative name "@device_cm_..."
[dshow @ 000001] "Microphone Array (Realtek High Definition Audio)" (audio)`;
        assert.deepEqual(parseDshowDevices(typed).map((s) => s.entry), ['dshow:Microphone (USB Camera)', 'dshow:Microphone Array (Realtek High Definition Audio)']);
        const sectioned = `[dshow @ 000001] DirectShow video devices
[dshow @ 000001]  "Integrated Camera"
[dshow @ 000001] DirectShow audio devices
[dshow @ 000001]  "Microphone (USB Camera)"`;
        const sources = parseDshowDevices(sectioned);
        assert.deepEqual(sources.map((s) => s.entry), ['dshow:Microphone (USB Camera)']);
        assert.deepEqual(ffmpegInputArgs(sources[0]), ['-f', 'dshow', '-i', 'audio=Microphone (USB Camera)']);
    }],

    ['matching: exact entry, alias, unique substring; never a bare number or an empty string', () => {
        const sources = [...parsePipewireDump(PW_DUMP), ...parseArecordList(ARECORD)];
        assert.equal(matchAudioDevice('pulse:alsa_input.pci-0000_00_0e.0.analog-stereo', sources).source?.entry, 'pulse:alsa_input.pci-0000_00_0e.0.analog-stereo');
        assert.equal(matchAudioDevice('hw:1,0', sources).source?.entry, 'alsa:hw:CARD=Camera,DEV=0');
        const sub = matchAudioDevice('mono-fallback', sources);
        assert.equal(sub.ok, true);
        assert.equal(sub.matchedOn, 'substring');
        const empty = matchAudioDevice('', sources);
        assert.equal(empty.ok, false);
        assert.match(empty.reason as string, /No audio capture device is configured/);
        const numeric = matchAudioDevice('0', sources);
        assert.equal(numeric.ok, false);
        assert.match(numeric.reason as string, /bare number/);
    }],

    ['ambiguous substrings are refused with the candidates named', () => {
        const sources = [...parsePipewireDump(PW_DUMP), ...parseArecordList(ARECORD)];
        const usb = matchAudioDevice('USB Camera', sources); // pulse node AND alsa card
        assert.equal(usb.ok, false);
        assert.match(usb.reason as string, /(names|matches) 2 capture sources/);
        const none = matchAudioDevice('Blue Yeti', sources);
        assert.equal(none.ok, false);
        assert.match(none.reason as string, /No capture source matches/);
    }],

    ['ffmpeg input arguments per backend', () => {
        const [pw] = parsePipewireDump(PW_DUMP);
        assert.deepEqual(ffmpegInputArgs(pw), ['-f', 'pulse', '-i', 'alsa_input.pci-0000_00_0e.0.analog-stereo']);
        const [alsa] = parseArecordList(ARECORD);
        assert.deepEqual(ffmpegInputArgs(alsa), ['-f', 'alsa', '-i', 'hw:CARD=PCH,DEV=0']);
    }],

    ['the guidance prefers a USB microphone and never selects one', () => {
        const withUsb = describeSourceChoice(parsePipewireDump(PW_DUMP));
        assert.match(withUsb, /Prefer a microphone near the toolhead/);
        assert.match(withUsb, /Nothing is selected automatically/);
        const laptopOnly = describeSourceChoice(parsePipewireDump(PW_DUMP.slice(0, 2)));
        assert.match(laptopOnly, /No USB microphone was found/);
        assert.match(describeSourceChoice([]), /No audio capture sources were found/);
    }],
];
