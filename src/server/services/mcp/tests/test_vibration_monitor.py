"""Hardware-free tests of vibration_monitor.py against a simulated LSM6DSOX and TCA9548A."""

import base64
import importlib.util
from pathlib import Path
import struct
import unittest

SPEC = importlib.util.spec_from_file_location('vibration_monitor', Path(__file__).resolve().parents[1] / 'vibration_monitor.py')
monitor = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(monitor)


class FakeImu:
    """LSM6DSOX register map with a tagged FIFO. `wraps`: burst reads roll back from 7Eh to 78h."""

    def __init__(self, whoami=0x6C, wraps=True, fine=0):
        self.regs = {0x0F: whoami, 0x12: 0x04, 0x18: 0xE0, 0x63: fine & 0xFF}
        self.fifo = []
        self.wraps = wraps
        self.overrun = False
        self.writes = []

    def push(self, tag, x, y, z):
        self.fifo.append(bytes([tag << 3]) + struct.pack('<hhh', x, y, z))

    def write(self, data):
        reg = data[0]
        self.writes.append((reg, data[1]))
        value = data[1]
        if reg == 0x12 and value & 0x01:
            value &= ~0x01  # reset completes at once
        self.regs[reg] = value

    def read(self, reg, buf):
        if reg == 0x3A:
            count = len(self.fifo)
            buf[0] = count & 0xFF
            buf[1] = ((count >> 8) & 0x03) | (0x40 if self.overrun else 0)
            self.overrun = False
            return
        if reg == 0x78:
            out = bytearray()
            while len(out) < len(buf):
                if not self.fifo:
                    out.extend(bytes(7))
                    continue
                word = self.fifo.pop(0)
                if self.wraps or not out:
                    out.extend(word)
                else:
                    # No rollback: the address runs on past 7Eh into other registers.
                    out.extend(bytes([0xFF]) * 7)
            buf[:] = out[:len(buf)]
            return
        for i in range(len(buf)):
            buf[i] = self.regs.get(reg + i, 0)


class FakeI2C:
    def __init__(self, devices, muxes=()):
        self.devices = devices
        self.muxes = {addr: 0 for addr in muxes}
        self.mux_writes = []
        self.locked = False
        self.behind = {}

    def attach_behind(self, mux_addr, channel, addr, device):
        self.behind[(mux_addr, channel, addr)] = device

    def try_lock(self):
        if self.locked:
            return False
        self.locked = True
        return True

    def unlock(self):
        self.locked = False

    def device(self, addr):
        # Every device that would see this address right now: the root one,
        # plus any behind an OPEN mux channel. Two = a bus collision.
        found = []
        if addr in self.devices:
            found.append(self.devices[addr])
        for mux_addr, mask in self.muxes.items():
            for channel in range(8):
                if mask & (1 << channel) and (mux_addr, channel, addr) in self.behind:
                    found.append(self.behind[(mux_addr, channel, addr)])
        if len(found) > 1:
            raise OSError('bus collision: %d devices answered 0x%02x' % (len(found), addr))
        if not found:
            raise OSError('no ACK from 0x%02x' % addr)
        return found[0]

    def writeto(self, addr, data):
        assert self.locked
        if addr in self.muxes:
            self.muxes[addr] = data[0]
            self.mux_writes.append((addr, data[0]))
            return
        self.device(addr).write(bytes(data))

    def writeto_then_readfrom(self, addr, out, buf):
        assert self.locked
        self.device(addr).read(out[0], buf)

    def scan(self):
        return sorted(list(self.devices) + list(self.muxes))

    def deinit(self):
        pass


def decode(msg, key='a'):
    raw = base64.b64decode(msg[key])
    return [struct.unpack_from('<hhh', raw, i) for i in range(0, len(raw), 6)]


class MonitorTests(unittest.TestCase):
    def setUp(self):
        self.lines = []
        self.saved_emit = monitor.emit
        monitor.emit = self.lines.append
        self.saved_batch = monitor.BATCH_S
        monitor.BATCH_S = 0.0

    def tearDown(self):
        monitor.emit = self.saved_emit
        monitor.BATCH_S = self.saved_batch

    def spec(self, **extra):
        spec = {'id': 'head', 'chip': 'lsm6dsox', 'mode': 'fifo', 'address': 0x6A, 'mux': None, 'rate_hz': 1666, 'range_g': 4, 'gyro': False}
        spec.update(extra)
        return spec

    def test_start_programs_rate_range_and_continuous_fifo(self):
        imu = FakeImu(fine=-10)
        sensor = monitor.FifoSensor(monitor.Bus(FakeI2C({0x6A: imu})), self.spec(), 9)
        sensor.start()
        regs = dict(imu.writes)
        self.assertEqual(regs[0x10], (8 << 4) | (2 << 2))  # 1666 Hz, +-4 g
        self.assertEqual(regs[0x09], 8)  # accel batched at 1666, gyro not
        self.assertEqual(imu.regs[0x0A], 0x06)  # continuous mode last
        self.assertEqual(regs[0x12], 0x44)  # BDU | IF_INC
        self.assertTrue(imu.regs[0x18] & 0x02)
        self.assertAlmostEqual(sensor.odr_actual, 6667 * (1 - 0.015) / 4, places=6)
        self.assertAlmostEqual(sensor.accel_scale, 0.000122)

    def test_wrong_chip_is_refused_with_its_whoami(self):
        sensor = monitor.FifoSensor(monitor.Bus(FakeI2C({0x6A: FakeImu(whoami=0x6A)})), self.spec(), 9)
        with self.assertRaises(RuntimeError) as ctx:
            sensor.start()
        self.assertIn('0x6a', str(ctx.exception))

    def test_poll_streams_accel_words_and_skips_gyro_words_into_their_own_stream(self):
        imu = FakeImu()
        sensor = monitor.FifoSensor(monitor.Bus(FakeI2C({0x6A: imu})), self.spec(gyro=True), 4)
        sensor.start()
        for i in range(10):
            imu.push(0x02, i, -i, 8192)
            imu.push(0x01, 100 + i, 0, -1)
        sensor.poll()
        batches = [line for line in self.lines if line.get('t') == 'batch']
        self.assertEqual(len(batches), 1)
        batch = batches[0]
        self.assertEqual(batch['n'], 10)
        self.assertEqual(decode(batch)[3], (3, -3, 8192))
        self.assertEqual(batch['ng'], 10)
        self.assertEqual(decode(batch, 'g')[2], (102, 0, -1))
        self.assertFalse(batch['ovr'])
        self.assertIn('ts', batch)
        self.assertEqual(sensor.bad_tags, 0)

    def test_overrun_is_flagged_on_the_next_batch(self):
        imu = FakeImu()
        sensor = monitor.FifoSensor(monitor.Bus(FakeI2C({0x6A: imu})), self.spec(), 9)
        sensor.start()
        imu.push(0x02, 1, 2, 3)
        imu.overrun = True
        sensor.poll()
        batch = [line for line in self.lines if line.get('t') == 'batch'][0]
        self.assertTrue(batch['ovr'])
        self.assertEqual(sensor.overruns, 1)

    def test_samples_read_before_an_overrun_go_out_in_their_own_batch(self):
        imu = FakeImu()
        sensor = monitor.FifoSensor(monitor.Bus(FakeI2C({0x6A: imu})), self.spec(), 9)
        sensor.start()
        saved = monitor.BATCH_S
        monitor.BATCH_S = 10.0  # hold the batch open
        try:
            imu.push(0x02, 1, 0, 0)
            sensor.poll()
            imu.push(0x02, 2, 0, 0)
            imu.overrun = True
            sensor.poll()
        finally:
            monitor.BATCH_S = saved
        batches = [line for line in self.lines if line.get('t') == 'batch']
        self.assertEqual(len(batches), 1)
        self.assertFalse(batches[0]['ovr'])
        self.assertEqual([x for x, _, _ in decode(batches[0])], [1])
        sensor.emit_batch()
        last = [line for line in self.lines if line.get('t') == 'batch'][-1]
        self.assertTrue(last['ovr'])
        self.assertEqual([x for x, _, _ in decode(last)], [2])

    def test_accel_and_gyro_go_out_in_equal_counts_and_the_remainder_waits(self):
        imu = FakeImu()
        sensor = monitor.FifoSensor(monitor.Bus(FakeI2C({0x6A: imu})), self.spec(gyro=True), 9)
        sensor.start()
        for i in range(3):
            imu.push(0x02, i, 0, 0)
            imu.push(0x01, 10 + i, 0, 0)
        imu.push(0x02, 3, 0, 0)  # the read ends between an accel and its gyro word
        sensor.poll()
        batch = [line for line in self.lines if line.get('t') == 'batch'][0]
        self.assertEqual(batch['n'], 3)
        self.assertEqual(batch['ng'], 3)
        self.assertEqual(len(sensor.accel), 6)  # sample 3 waits for its gyro word

    def test_a_bad_tag_splits_the_batch_and_marks_the_next_as_a_gap(self):
        imu = FakeImu()
        sensor = monitor.FifoSensor(monitor.Bus(FakeI2C({0x6A: imu})), self.spec(), 9)
        sensor.start()
        imu.push(0x02, 1, 0, 0)
        imu.push(0x02, 2, 0, 0)
        imu.fifo.append(bytes([0x1F << 3]) + bytes(6))  # a corrupt word
        imu.push(0x02, 3, 0, 0)
        saved = monitor.BATCH_S
        monitor.BATCH_S = 10.0
        try:
            sensor.poll()
        finally:
            monitor.BATCH_S = saved
        batches = [line for line in self.lines if line.get('t') == 'batch']
        self.assertEqual([x for x, _, _ in decode(batches[0])], [1, 2])
        self.assertFalse(batches[0]['ovr'])
        sensor.emit_batch()
        last = [line for line in self.lines if line.get('t') == 'batch'][-1]
        self.assertEqual([x for x, _, _ in decode(last)], [3])
        self.assertTrue(last['ovr'], 'the sample after the hole starts a new run')
        self.assertEqual(sensor.bad_tags, 1)

    def test_a_root_poll_sensor_never_reaches_a_device_behind_an_open_mux_channel(self):
        # The configured muxed sensor is at 0x6A; another device on the same
        # channel answers at 0x6B, the root sensor's address. A root read with
        # that channel still open would collide.
        root = FakeImu()
        behind = FakeImu()
        neighbour = FakeImu()
        i2c = FakeI2C({0x6B: root}, muxes=(0x70,))
        i2c.attach_behind(0x70, 1, 0x6A, behind)
        i2c.attach_behind(0x70, 1, 0x6B, neighbour)
        bus = monitor.Bus(i2c)
        fifo = monitor.FifoSensor(bus, self.spec(id='tail', mux={'address': 0x70, 'channel': 1}), 9)

        class Driver:
            # Reads WHO_AM_I through whatever i2c object it was given, as an Adafruit driver would.
            def __init__(self, i2c_obj, addr):
                self.i2c = i2c_obj
                self.addr = addr
                self.reads = 0

            @property
            def acceleration(self):
                while not self.i2c.try_lock():
                    pass
                try:
                    buf = bytearray(1)
                    self.i2c.writeto_then_readfrom(self.addr, bytes([0x0F]), buf)
                finally:
                    self.i2c.unlock()
                self.reads += 1
                return (0.0, 0.0, 9.80665)

        saved = monitor.driver_for
        monitor.driver_for = lambda chip, i2c_obj, addr: Driver(i2c_obj, addr)
        try:
            poll = monitor.PollSensor(bus, self.spec(id='head', chip='bno055', mode='poll', rate_hz=1000, address=0x6B))
            fifo.start()  # leaves mux channel 1 open
            poll.start()
            for i in range(20):
                behind.push(0x02, i, 0, 0)
                fifo.poll()
                poll.next_due = 0
                poll.poll()  # would collide if the channel were still open
        finally:
            monitor.driver_for = saved
        self.assertEqual(poll.driver.reads, 20)
        self.assertIn((0x70, 0), i2c.mux_writes)
        self.assertFalse([line for line in self.lines if line.get('t') == 'warn'])

    def test_eight_sensors_on_four_mux_channels_stream_without_cross_talk(self):
        i2c = FakeI2C({}, muxes=(0x70,))
        imus = {}
        specs = []
        for channel in range(4):
            for addr in (0x6A, 0x6B):
                imu = FakeImu()
                i2c.attach_behind(0x70, channel, addr, imu)
                sid = 's%d_%x' % (channel, addr)
                imus[sid] = imu
                specs.append(self.spec(id=sid, address=addr, mux={'address': 0x70, 'channel': channel}, gyro=(channel % 2 == 1)))
        bus = monitor.Bus(i2c)
        sensors = monitor.make_sensors(bus, {'sensors': specs})
        for sensor in sensors:
            monitor.start_sensor(sensor)
        self.assertTrue(all(sensor.state == 'ok' for sensor in sensors))
        expected = {sid: [] for sid in imus}
        for round_no in range(25):
            for k, (sid, imu) in enumerate(sorted(imus.items())):
                for j in range(1 + (round_no + k) % 5):
                    value = k * 1000 + len(expected[sid])
                    expected[sid].append(value)
                    imu.push(0x02, value, -value, k)
                    if sid.startswith(('s1', 's3')):
                        imu.push(0x01, value, 0, 0)
            for sensor in sensors:
                sensor.poll()
        for sensor in sensors:
            if sensor.accel:
                sensor.emit_batch()
        got = {sid: [] for sid in imus}
        for line in self.lines:
            if line.get('t') == 'batch':
                got[line['id']].extend(x for x, _, _ in decode(line))
        self.assertEqual(got, expected)
        self.assertFalse([line for line in self.lines if line.get('t') == 'warn'])
        self.assertTrue(all(not line['ovr'] for line in self.lines if line.get('t') == 'batch'))

    def test_a_part_without_address_rollback_falls_back_to_one_word_per_read(self):
        imu = FakeImu(wraps=False)
        sensor = monitor.FifoSensor(monitor.Bus(FakeI2C({0x6A: imu})), self.spec(), 9)
        sensor.start()
        for i in range(30):
            imu.push(0x02, i, 0, 0)
        sensor.poll()
        self.assertTrue(sensor.per_word)
        self.assertTrue(any(line.get('t') == 'warn' and 'one word per read' in line['error'] for line in self.lines))
        for i in range(5):
            imu.push(0x02, 50 + i, 0, 0)
        self.lines.clear()
        sensor.poll()
        batch = [line for line in self.lines if line.get('t') == 'batch'][0]
        self.assertEqual([x for x, _, _ in decode(batch)], [50, 51, 52, 53, 54])

    def test_mux_channel_is_selected_before_each_sensor_and_others_closed(self):
        a = FakeImu()
        b = FakeImu()
        i2c = FakeI2C({}, muxes=(0x70, 0x71))
        i2c.attach_behind(0x70, 2, 0x6A, a)
        i2c.attach_behind(0x71, 5, 0x6A, b)
        bus = monitor.Bus(i2c)
        first = monitor.FifoSensor(bus, self.spec(id='tail', mux={'address': 0x70, 'channel': 2}), 9)
        second = monitor.FifoSensor(bus, self.spec(id='chuck', mux={'address': 0x71, 'channel': 5}), 9)
        first.start()
        second.start()
        self.assertIn((0x70, 1 << 2), i2c.mux_writes)
        self.assertIn((0x70, 0), i2c.mux_writes)  # closed before the other mux opened
        self.assertIn((0x71, 1 << 5), i2c.mux_writes)
        self.assertTrue(a.writes and b.writes)

    def test_open_i2c_uses_the_pins_the_devices_answer_on(self):
        class Board:
            board_id = 'qtpy_rp2040'
            SCL = 'GP25'
            SDA = 'GP24'
            SCL1 = 'GP23'
            SDA1 = 'GP22'

        buses = {'GP23': FakeI2C({0x6A: FakeImu()}), 'GP25': FakeI2C({})}

        class Busio:
            @staticmethod
            def I2C(scl, sda, frequency):
                return buses[scl]

        i2c, pins, scans = monitor.open_i2c({'sensors': [self.spec()], 'i2c_hz': 400000}, Board, Busio)
        self.assertIs(i2c, buses['GP23'])
        self.assertEqual(pins, 'SCL1/SDA1')

        class OnlyRoot:
            SCL = 'GP25'
            SDA = 'GP24'

        with self.assertRaises(RuntimeError) as ctx:
            monitor.open_i2c({'sensors': [self.spec()]}, OnlyRoot, Busio)
        self.assertIn('no configured device answered', str(ctx.exception))

    def test_poll_mode_quantises_m_s2_to_g_with_per_sample_offsets(self):
        class Driver:
            acceleration = (0.0, 0.0, 9.80665)
            gyro = (0.0, 0.0, 0.0)

        sensor = monitor.PollSensor(monitor.Bus(FakeI2C({})), self.spec(chip='bno055', mode='poll', rate_hz=100, range_g=4))
        sensor.driver = Driver()
        sensor.state = 'ok'
        sensor.next_due = 0
        sensor.poll()
        batch = [line for line in self.lines if line.get('t') == 'batch'][0]
        x, y, z = decode(batch)[0]
        self.assertEqual((x, y), (0, 0))
        self.assertAlmostEqual(z * batch['as'], 1.0, places=3)
        self.assertEqual(struct.unpack('<I', base64.b64decode(batch['dt']))[0], 0)


if __name__ == '__main__':
    unittest.main()
