# Luban MCP vibration monitor: streams I2C accelerometer (and gyroscope)
# samples as JSON lines for the accelerometer feed (vibrationFeed.ts).
#
# One file, two places to run it:
#   - on the Luban host under CPython + Adafruit Blinka (transport "blinka"):
#     Luban spawns it with the configuration as argv[1], on a USB I2C bridge
#     of its own (MCP2221A, FT232H) or a Raspberry Pi header;
#   - on a CircuitPython microcontroller (transport "serial"): copy this file
#     to the board's CIRCUITPY drive as code.py. Luban opens the board's USB
#     serial port and sends the configuration as one JSON line; the board
#     re-initialises whenever a new configuration arrives. A board near the
#     machine reads the sensors at full I2C speed and streams only the data.
#
# Protocol: one JSON object per stdout line, field "t":
#   progress  {stage, ...}                 how far start-up got
#   ready     {board, sensors: [...]}      per sensor: state, whoami, odr_actual
#   batch     {id, n, a, as, ...}          samples (see emit_batch)
#   hb        {sensors: {...}, busy}       1 Hz heartbeat with counters
#   warn      {id?, error}                 a sensor failed; it is retried
#   fatal     {error}                      the monitor cannot run; it exits
#
# Samples are little-endian int16, interleaved x,y,z, base64 encoded;
# multiply by "as" for g ("gs" for degrees/s). FIFO batches are evenly
# spaced at the chip's output data rate and stamped with the time the read
# finished; poll batches carry each sample's own offset ("dt", uint32 us).
#
# Plain Python 3 that CircuitPython also runs: no f-strings, no backticks,
# nothing that needs the host. Hardware-free tests: tests/test_vibration_monitor.py.

import json
import struct
import sys
import time

try:
    import binascii
except ImportError:  # pragma: no cover - very old CircuitPython
    import ubinascii as binascii

CIRCUITPY = getattr(sys, 'implementation', None) is not None and sys.implementation.name == 'circuitpython'

# LSM6DSO-family registers (LSM6DSOX, LSM6DSO32, ISM330DHCX share the map).
WHO_AM_I = 0x0F
FIFO_CTRL3 = 0x09
FIFO_CTRL4 = 0x0A
CTRL1_XL = 0x10
CTRL2_G = 0x11
CTRL3_C = 0x12
CTRL9_XL = 0x18
FIFO_STATUS1 = 0x3A
INTERNAL_FREQ_FINE = 0x63
FIFO_DATA_OUT_TAG = 0x78

WHOAMI = {'lsm6dsox': (0x6C,), 'lsm6dso32': (0x6C,), 'ism330dhcx': (0x6B,)}
ODR_CODE = {12.5: 1, 26: 2, 52: 3, 104: 4, 208: 5, 416: 6, 833: 7, 1666: 8, 3332: 9, 6664: 10}
# The real rates are 6667 Hz / coefficient (1666 is 1666.75, 12.5 is 13.02),
# trimmed per part by INTERNAL_FREQ_FINE (datasheet, ODR_Actual formula).
ODR_COEFF = {12.5: 512, 26: 256, 52: 128, 104: 64, 208: 32, 416: 16, 833: 8, 1666: 4, 3332: 2, 6664: 1}
# full scale g -> (FS_XL bits, mg per LSB)
FS_XL = {
    'lsm6dsox': {2: (0, 0.061), 4: (2, 0.122), 8: (3, 0.244), 16: (1, 0.488)},
    'ism330dhcx': {2: (0, 0.061), 4: (2, 0.122), 8: (3, 0.244), 16: (1, 0.488)},
    'lsm6dso32': {4: (0, 0.122), 8: (2, 0.244), 16: (3, 0.488), 32: (1, 0.976)},
}
GYRO_FS_BITS = 0x0C  # +-2000 dps
GYRO_MDPS_PER_LSB = 70.0
TAG_GYRO = 0x01
TAG_ACCEL = 0x02
STANDARD_GRAVITY = 9.80665

RETRY_S = 5.0
BATCH_S = 0.1


def emit(obj):
    print(json.dumps(obj))
    if not CIRCUITPY:
        sys.stdout.flush()


def b64(data):
    return binascii.b2a_base64(bytes(data)).decode('ascii').strip()


if CIRCUITPY and hasattr(time, 'monotonic_ns'):
    def stamp():
        # A board clock: microseconds, integer (a float would lose
        # resolution after hours on 30-bit-float builds).
        return {'tus': time.monotonic_ns() // 1000}

    def clock_s():
        # Differences of this stay exact; the absolute value may be large.
        return time.monotonic_ns() / 1e9
elif CIRCUITPY:
    def stamp():
        # Still the board's clock (time.time() is the RTC in whole seconds).
        return {'tus': int(time.monotonic() * 1000000)}

    def clock_s():
        return time.monotonic()
else:
    def stamp():
        # The host clock, the same one Luban reads.
        return {'ts': time.time()}

    def clock_s():
        return time.monotonic()


class Bus:
    """The I2C bus with TCA9548A channel selection. Every operation locks."""

    def __init__(self, i2c):
        self.i2c = i2c
        self.selected = {}
        self.busy_s = 0.0

    def lock(self):
        while not self.i2c.try_lock():
            pass

    def unlock(self):
        self.i2c.unlock()

    def select_locked(self, mux):
        if mux is None:
            # Root-bus devices must not see a channel left open on a mux
            # behind which another device answers at the same address.
            for addr in list(self.selected):
                if self.selected[addr] is not None:
                    self.i2c.writeto(addr, bytes([0]))
                    self.selected[addr] = None
            return
        addr = mux['address']
        channel = mux['channel']
        for other in list(self.selected):
            if other != addr and self.selected[other] is not None:
                self.i2c.writeto(other, bytes([0]))
                self.selected[other] = None
        if self.selected.get(addr) != channel:
            self.i2c.writeto(addr, bytes([1 << channel]))
            self.selected[addr] = channel

    def write_reg(self, mux, addr, reg, value):
        start = clock_s()
        self.lock()
        try:
            self.select_locked(mux)
            self.i2c.writeto(addr, bytes([reg, value & 0xFF]))
        finally:
            self.unlock()
            self.busy_s += clock_s() - start

    def read_regs(self, mux, addr, reg, buf):
        start = clock_s()
        self.lock()
        try:
            self.select_locked(mux)
            self.i2c.writeto_then_readfrom(addr, bytes([reg]), buf)
        finally:
            self.unlock()
            self.busy_s += clock_s() - start

    def read_reg(self, mux, addr, reg):
        buf = bytearray(1)
        self.read_regs(mux, addr, reg, buf)
        return buf[0]


class MuxChannelI2C:
    """busio.I2C look-alike that selects its mux channel - or, for a root
    device (mux None), closes every channel - whenever it is locked. Every
    Adafruit driver goes through one, so a root transaction can never reach
    a muxed device left selected at the same address."""

    def __init__(self, bus, mux):
        self.bus = bus
        self.mux = mux

    def try_lock(self):
        if not self.bus.i2c.try_lock():
            return False
        try:
            self.bus.select_locked(self.mux)
        except Exception:
            self.bus.i2c.unlock()
            raise
        return True

    def unlock(self):
        self.bus.i2c.unlock()

    def writeto(self, *args, **kwargs):
        return self.bus.i2c.writeto(*args, **kwargs)

    def readfrom_into(self, *args, **kwargs):
        return self.bus.i2c.readfrom_into(*args, **kwargs)

    def writeto_then_readfrom(self, *args, **kwargs):
        return self.bus.i2c.writeto_then_readfrom(*args, **kwargs)

    def scan(self):
        return self.bus.i2c.scan()


class Sensor:
    def __init__(self, bus, spec):
        self.bus = bus
        self.spec = spec
        self.id = spec['id']
        self.mux = spec.get('mux')
        self.addr = spec['address']
        self.state = 'init'
        self.error = None
        self.retry_at = 0.0
        self.samples = 0
        self.overruns = 0
        self.errors = 0
        self.seq = 0
        self.batch_started = clock_s()

    def describe(self):
        return {'id': self.id, 'state': self.state, 'error': self.error, 'mode': self.spec['mode']}

    def counters(self):
        return {'state': self.state, 'samples': self.samples, 'overruns': self.overruns, 'errors': self.errors}

    def fail(self, err):
        self.state = 'failed'
        self.error = str(err)
        self.errors += 1
        self.retry_at = clock_s() + RETRY_S
        emit({'t': 'warn', 'id': self.id, 'error': self.error})


class FifoSensor(Sensor):
    """LSM6DSO-family tagged FIFO, read in whole 7-byte words."""

    def __init__(self, bus, spec, chunk_words):
        Sensor.__init__(self, bus, spec)
        self.chunk_words = chunk_words
        self.chip = spec['chip']
        self.accel = bytearray()
        self.gyro = bytearray()
        self.overrun_pending = False
        self.bad_tags = 0
        self.per_word = False
        self.whoami = None
        self.odr_actual = None
        self.accel_scale = None
        self.status = bytearray(2)

    def start(self):
        chip = self.chip
        who = self.bus.read_reg(self.mux, self.addr, WHO_AM_I)
        self.whoami = who
        if who not in WHOAMI[chip]:
            raise RuntimeError('WHO_AM_I 0x%02x at 0x%02x is not a %s (expected %s)' % (
                who, self.addr, chip, '/'.join(['0x%02x' % w for w in WHOAMI[chip]])))
        self.bus.write_reg(self.mux, self.addr, CTRL3_C, 0x01)  # SW_RESET
        deadline = clock_s() + 0.1
        while self.bus.read_reg(self.mux, self.addr, CTRL3_C) & 0x01:
            if clock_s() > deadline:
                raise RuntimeError('software reset did not complete')
        self.bus.write_reg(self.mux, self.addr, CTRL3_C, 0x44)  # BDU | IF_INC
        # I3C off (LSM6DSOX/DSO32) and DEVICE_CONF (ISM330DHCX): bit 1 on both.
        ctrl9 = self.bus.read_reg(self.mux, self.addr, CTRL9_XL)
        self.bus.write_reg(self.mux, self.addr, CTRL9_XL, ctrl9 | 0x02)
        rate = self.spec['rate_hz']
        code = ODR_CODE[rate]
        fs_bits, mg = FS_XL[chip][self.spec['range_g']]
        self.accel_scale = mg / 1000.0
        self.bus.write_reg(self.mux, self.addr, FIFO_CTRL4, 0x00)  # bypass: empties the FIFO
        self.bus.write_reg(self.mux, self.addr, CTRL1_XL, (code << 4) | (fs_bits << 2))
        bdr = code
        if self.spec.get('gyro'):
            self.bus.write_reg(self.mux, self.addr, CTRL2_G, (code << 4) | GYRO_FS_BITS)
            bdr |= code << 4
        else:
            self.bus.write_reg(self.mux, self.addr, CTRL2_G, 0x00)
        self.bus.write_reg(self.mux, self.addr, FIFO_CTRL3, bdr)
        self.bus.write_reg(self.mux, self.addr, FIFO_CTRL4, 0x06)  # continuous
        fine = self.bus.read_reg(self.mux, self.addr, INTERNAL_FREQ_FINE)
        if fine > 127:
            fine -= 256
        # Datasheet: 6667 Hz trimmed by 0.15 % per LSB, divided down.
        self.odr_actual = 6667.0 * (1.0 + 0.0015 * fine) / ODR_COEFF[rate]
        self.accel = bytearray()
        self.gyro = bytearray()
        self.batch_started = clock_s()
        self.state = 'ok'
        self.error = None

    def describe(self):
        info = Sensor.describe(self)
        info.update({'chip': self.chip, 'whoami': self.whoami, 'odr_nominal': self.spec['rate_hz'],
                     'odr_actual': self.odr_actual, 'accel_scale_g': self.accel_scale, 'gyro': bool(self.spec.get('gyro'))})
        return info

    def counters(self):
        info = Sensor.counters(self)
        info.update({'bad_tags': self.bad_tags, 'per_word': self.per_word})
        return info

    def decode(self, buf, words):
        bad = 0
        for i in range(words):
            base = i * 7
            tag = buf[base] >> 3
            if tag == TAG_ACCEL:
                self.accel.extend(buf[base + 1:base + 7])
            elif tag == TAG_GYRO:
                self.gyro.extend(buf[base + 1:base + 7])
            else:
                # A discarded word is a lost sample: what came before goes
                # out as its own batch and the next one is marked, so the
                # clock never spaces samples across the hole.
                bad += 1
                if len(self.accel) >= 6:
                    self.emit_batch()
                self.overrun_pending = True
        return bad

    def poll(self):
        self.bus.read_regs(self.mux, self.addr, FIFO_STATUS1, self.status)
        count = self.status[0] | ((self.status[1] & 0x03) << 8)
        if self.status[1] & 0x48:  # FIFO_OVR_IA | FIFO_OVR_LATCHED
            self.overruns += 1
            # Samples read before the loss go out first, so the gap falls
            # BETWEEN batches (the clock spaces a batch's samples evenly).
            if len(self.accel) >= 6:
                self.emit_batch()
            self.overrun_pending = True
        while count > 0:
            words = 1 if self.per_word else min(count, self.chunk_words)
            buf = bytearray(7 * words)
            self.bus.read_regs(self.mux, self.addr, FIFO_DATA_OUT_TAG, buf)
            bad = self.decode(buf, words)
            self.bad_tags += bad
            if bad and not self.per_word and words > 1 and bad * 2 >= words:
                # The address did not roll back from 7Eh to 78h on this part
                # or bridge: read one word per transaction from now on.
                self.per_word = True
                emit({'t': 'warn', 'id': self.id, 'error': 'FIFO burst returned %d bad tags in %d words - switching to one word per read' % (bad, words)})
            count -= words
        if len(self.accel) >= 6 and clock_s() - self.batch_started >= BATCH_S:
            self.emit_batch()

    def emit_batch(self):
        n = len(self.accel) // 6
        ng = len(self.gyro) // 6
        if self.spec.get('gyro') and ng:
            # Accel and gyro words interleave in the FIFO; a read can end
            # between the two. Send the common count, keep the remainder.
            n = min(n, ng)
            ng = n
        msg = {'t': 'batch', 'id': self.id, 'mode': 'fifo', 'seq': self.seq, 'n': n,
               'a': b64(self.accel[:n * 6]), 'as': self.accel_scale, 'odr': self.odr_actual, 'ovr': self.overrun_pending}
        if ng:
            msg['ng'] = ng
            msg['g'] = b64(self.gyro[:ng * 6])
            msg['gs'] = GYRO_MDPS_PER_LSB / 1000.0
        msg.update(stamp())
        emit(msg)
        self.samples += n
        self.seq += 1
        self.accel = self.accel[n * 6:]
        self.gyro = self.gyro[ng * 6:]
        self.overrun_pending = False
        self.batch_started = clock_s()


def driver_for(chip, i2c, addr):
    if chip in ('lsm6dsox', 'lsm6dso32', 'ism330dhcx', 'lsm6ds3trc', 'lsm6ds33'):
        module = __import__('adafruit_lsm6ds.' + chip, None, None, [chip])
        cls = getattr(module, chip.upper())
        return cls(i2c, address=addr)
    if chip == 'lsm9ds1':
        import adafruit_lsm9ds1
        return adafruit_lsm9ds1.LSM9DS1_I2C(i2c, xg_address=addr)
    if chip == 'bno055':
        import adafruit_bno055
        sensor = adafruit_bno055.BNO055_I2C(i2c, address=addr)
        try:
            # Raw accelerometer (gravity included), no fusion filtering.
            sensor.mode = adafruit_bno055.ACCGYRO_MODE
        except Exception:
            pass
        return sensor
    if chip == 'mpu6050':
        import adafruit_mpu6050
        return adafruit_mpu6050.MPU6050(i2c, address=addr)
    if chip == 'icm20948':
        import adafruit_icm20x
        return adafruit_icm20x.ICM20948(i2c, address=addr)
    if chip == 'lis3dh':
        import adafruit_lis3dh
        return adafruit_lis3dh.LIS3DH_I2C(i2c, address=addr)
    if chip == 'adxl34x':
        import adafruit_adxl34x
        return adafruit_adxl34x.ADXL345(i2c, address=addr)
    raise RuntimeError('no driver for chip %s' % chip)


class PollSensor(Sensor):
    """Any supported chip through its Adafruit driver, read on a timer and stamped on arrival."""

    def __init__(self, bus, spec):
        Sensor.__init__(self, bus, spec)
        self.driver = None
        self.period = 1.0 / spec['rate_hz']
        self.next_due = 0.0
        self.scale = spec['range_g'] / 32767.0
        self.accel = bytearray()
        self.gyro = bytearray()
        self.offsets = bytearray()
        self.t0 = None
        self.t0_clock = None

    def start(self):
        self.driver = driver_for(self.spec['chip'], MuxChannelI2C(self.bus, self.mux), self.addr)
        self.next_due = clock_s()
        self.state = 'ok'
        self.error = None

    def describe(self):
        info = Sensor.describe(self)
        info.update({'chip': self.spec['chip'], 'poll_hz': self.spec['rate_hz'], 'accel_scale_g': self.scale})
        return info

    def clamp(self, value):
        q = int(round(value / self.scale))
        return max(-32768, min(32767, q))

    def poll(self):
        now = clock_s()
        if now < self.next_due:
            return
        self.next_due += self.period
        if self.next_due < now:
            self.next_due = now + self.period
        start = clock_s()
        accel = self.driver.acceleration
        gyro = self.driver.gyro if self.spec.get('gyro') and hasattr(self.driver, 'gyro') else None
        self.bus.busy_s += clock_s() - start
        if accel is None or None in accel:
            return
        if self.t0 is None:
            self.t0 = stamp()
            self.t0_clock = now
        offset_us = int((now - self.t0_clock) * 1000000)
        self.offsets.extend(struct.pack('<I', offset_us))
        self.accel.extend(struct.pack('<hhh', self.clamp(accel[0] / STANDARD_GRAVITY), self.clamp(accel[1] / STANDARD_GRAVITY),
                                      self.clamp(accel[2] / STANDARD_GRAVITY)))
        if gyro is not None and None not in gyro:
            k = 57.29577951308232 / 0.07  # rad/s -> 70 mdps LSB
            self.gyro.extend(struct.pack('<hhh', *[max(-32768, min(32767, int(round(v * k)))) for v in gyro]))
        if now - self.t0_clock >= BATCH_S:
            self.emit_batch()

    def emit_batch(self):
        n = len(self.accel) // 6
        if not n:
            return
        msg = {'t': 'batch', 'id': self.id, 'mode': 'poll', 'seq': self.seq, 'n': n,
               'a': b64(self.accel), 'as': self.scale, 'dt': b64(self.offsets)}
        if len(self.gyro) // 6 == n:
            msg['ng'] = n
            msg['g'] = b64(self.gyro)
            msg['gs'] = 0.07
        msg.update(self.t0)
        emit(msg)
        self.samples += n
        self.seq += 1
        self.accel = bytearray()
        self.gyro = bytearray()
        self.offsets = bytearray()
        self.t0 = None


def wanted_addresses(cfg):
    out = []
    for spec in cfg['sensors']:
        out.append(spec['mux']['address'] if spec.get('mux') else spec['address'])
    return out


def open_i2c(cfg, board, busio):
    """The bus the configured devices answer on: SCL1/SDA1 (STEMMA QT on many boards) or SCL/SDA."""
    wanted = wanted_addresses(cfg)
    pairs = []
    if cfg.get('i2c_pins'):
        pairs.append(tuple(cfg['i2c_pins']))
    else:
        for pair in (('SCL1', 'SDA1'), ('SCL', 'SDA')):
            if hasattr(board, pair[0]) and hasattr(board, pair[1]):
                pairs.append(pair)
    if not pairs:
        raise RuntimeError('board %s has no SCL/SDA pins' % getattr(board, 'board_id', '?'))
    tried = []
    for scl, sda in pairs:
        try:
            i2c = busio.I2C(getattr(board, scl), getattr(board, sda), frequency=cfg.get('i2c_hz', 400000))
        except Exception as err:
            tried.append('%s/%s: %s' % (scl, sda, err))
            continue
        while not i2c.try_lock():
            pass
        try:
            found = i2c.scan()
        finally:
            i2c.unlock()
        tried.append('%s/%s: %s' % (scl, sda, ' '.join(['0x%02x' % a for a in found]) or 'nothing'))
        if any(a in found for a in wanted):
            return i2c, scl + '/' + sda, tried
        try:
            i2c.deinit()
        except Exception:
            pass
    raise RuntimeError('no configured device answered on any I2C bus (scan: %s) - check the STEMMA QT cable and the addresses' % '; '.join(tried))


def make_sensors(bus, cfg):
    chunk = cfg.get('chunk_words') or (36 if CIRCUITPY else 9)
    sensors = []
    for spec in cfg['sensors']:
        if spec['mode'] == 'fifo':
            sensors.append(FifoSensor(bus, spec, chunk))
        else:
            sensors.append(PollSensor(bus, spec))
    return sensors


def start_sensor(sensor):
    try:
        sensor.start()
        emit({'t': 'progress', 'stage': 'sensor', 'id': sensor.id, 'state': 'ok'})
    except Exception as err:
        sensor.fail(err)


class ConfigReader:
    """CircuitPython: non-blocking line reader on the USB serial console."""

    def __init__(self):
        self.partial = ''
        try:
            import supervisor
            self.supervisor = supervisor
        except ImportError:
            self.supervisor = None

    def poll(self):
        if self.supervisor is None:
            return None
        while self.supervisor.runtime.serial_bytes_available:
            ch = sys.stdin.read(1)
            if ch in ('\n', '\r'):
                line = self.partial.strip()
                self.partial = ''
                if line.startswith('{'):
                    try:
                        msg = json.loads(line)
                    except ValueError:
                        continue
                    if msg.get('t') == 'config':
                        return msg
            else:
                self.partial += ch
                if len(self.partial) > 8192:
                    self.partial = ''
        return None


def run(cfg, board, busio, reader):
    """Stream until the process ends (host) or a new configuration arrives (CircuitPython: returned)."""
    i2c, pins, scans = open_i2c(cfg, board, busio)
    emit({'t': 'progress', 'stage': 'i2c', 'pins': pins, 'scans': scans})
    bus = Bus(i2c)
    sensors = make_sensors(bus, cfg)
    for sensor in sensors:
        start_sensor(sensor)
    emit({'t': 'ready', 'board': getattr(board, 'board_id', 'unknown'), 'circuitpython': CIRCUITPY, 'pins': pins,
          'sensors': [s.describe() for s in sensors]})
    hb_s = cfg.get('heartbeat_ms', 1000) / 1000.0
    next_hb = clock_s() + hb_s
    window_start = clock_s()
    busy_at_window = 0.0
    while True:
        did = False
        for sensor in sensors:
            if sensor.state == 'ok':
                try:
                    sensor.poll()
                    did = True
                except Exception as err:
                    sensor.fail(err)
            elif clock_s() >= sensor.retry_at:
                start_sensor(sensor)
        now = clock_s()
        if now >= next_hb:
            span = max(now - window_start, 1e-6)
            busy = (bus.busy_s - busy_at_window) / span
            window_start = now
            busy_at_window = bus.busy_s
            next_hb = now + hb_s
            hb = {'t': 'hb', 'busy': round(busy, 3), 'sensors': {}}
            for sensor in sensors:
                hb['sensors'][sensor.id] = sensor.counters()
            hb.update(stamp())
            emit(hb)
        if reader is not None:
            fresh = reader.poll()
            if fresh is not None:
                try:
                    i2c.deinit()
                except Exception:
                    pass
                return fresh
        if not did:
            time.sleep(0.005)
        else:
            time.sleep(0.001)


def load_board():
    try:
        import board
        import busio
    except Exception as err:
        emit({'t': 'fatal', 'error': 'Blinka/CircuitPython import failed (pip install adafruit-blinka): %s' % err})
        return None, None
    emit({'t': 'progress', 'stage': 'imported', 'board': getattr(board, 'board_id', 'unknown')})
    return board, busio


def main():
    board, busio = load_board()
    if board is None:
        return 1
    if not CIRCUITPY:
        cfg = json.loads(sys.argv[1])
        try:
            run(cfg, board, busio, None)
        except Exception as err:
            emit({'t': 'fatal', 'error': str(err)})
            return 1
        return 0
    reader = ConfigReader()
    cfg = None
    try:
        with open('/vibration_config.json') as handle:
            cfg = json.load(handle)
    except (OSError, ValueError):
        cfg = None
    while True:
        if cfg is None:
            # Waiting for Luban: say so once a second until a configuration arrives.
            emit({'t': 'progress', 'stage': 'waiting-config'})
            deadline = clock_s() + 1.0
            while cfg is None and clock_s() < deadline:
                cfg = reader.poll()
                time.sleep(0.01)
            continue
        try:
            cfg = run(cfg, board, busio, reader)
        except Exception as err:
            emit({'t': 'fatal', 'error': str(err)})
            cfg = None
            time.sleep(RETRY_S)


if __name__ == '__main__':
    sys.exit(main())
