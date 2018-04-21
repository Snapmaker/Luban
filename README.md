# cncjs [![Travis CI Build Status](https://travis-ci.org/cncjs/cncjs.svg)](https://travis-ci.org/cncjs/cncjs) [![AppVeyor Build status](https://ci.appveyor.com/api/projects/status/qxx53wq32w3edule?svg=true)](https://ci.appveyor.com/project/cheton/cncjs) [![Coverage Status](https://coveralls.io/repos/github/cncjs/cncjs/badge.svg?branch=master)](https://coveralls.io/github/cncjs/cncjs?branch=master)

Snapmakerjs! Let's rock.

[![NPM](https://nodei.co/npm/cncjs.png?downloads=true&stars=true)](https://www.npmjs.com/package/cncjs)
![cncjs](https://raw.githubusercontent.com/cncjs/cncjs/master/media/banner.png)

A web-based interface for CNC milling controller running [Grbl](https://github.com/grbl/grbl), [Smoothieware](https://github.com/Smoothieware/Smoothieware), or [TinyG](https://github.com/synthetos/TinyG). It runs on an [Raspberry Pi](https://www.raspberrypi.org/) or a laptop computer that you have Node.js installed, connecting to the Arduino over a serial connection using a USB serial port, a Bluetooth serial module, or a  Serial-to-WiFi module like [XBee](https://www.arduino.cc/en/Guide/ArduinoWirelessShieldS2) or [USR-WIFI232-T](https://gist.github.com/ajfisher/1fdbcbbf96b7f2ba73cd).

![cncjs](https://cloud.githubusercontent.com/assets/447801/24392019/aa2d725e-13c4-11e7-9538-fd5f746a2130.png)

==
## Features

* Supported CNC controllers
    - [Grbl](https://github.com/gnea/grbl) and [Grbl-Mega](https://github.com/gnea/grbl-Mega)
    - [Smoothieware](https://github.com/Smoothieware/Smoothieware)
    - [TinyG](https://github.com/synthetos/TinyG) and [g2core](https://github.com/synthetos/g2)
* [Desktop App for Linux, Mac OS X, and Windows](https://github.com/cncjs/cncjs/wiki/Desktop-App)
* 3D Visualizer
* Allows multiple HTTP connections at the same serial port
* Responsive view for small screen display with device width less than 720px
    - <i>Safari on an iPhone 5S</i> [\[1\]](https://cloud.githubusercontent.com/assets/447801/15633749/b817cd4a-25e7-11e6-9beb-600c65ea1324.PNG) [\[2\]](https://cloud.githubusercontent.com/assets/447801/15633750/b819b5f6-25e7-11e6-8bfe-d3e6247e443b.PNG)
* Customizable workspace
* My Account
* Commands
* Events
* [Keyboard Shortcuts](https://cnc.js.org/docs/user-guide/#keyboard-shortcuts)
* [Contour ShuttleXpress](https://cnc.js.org/docs/user-guide/#contour-shuttlexpress)
* Multi-Language Support
* Watch Directory
* Z-Probe

## Pendant

* [cncjs-pendant-boilerplate](https://github.com/cncjs/cncjs-pendant-boilerplate)
* [cncjs-pendant-ps3](https://github.com/cncjs/cncjs-pendant-ps3)
* [cncjs-pendant-tinyweb](https://github.com/cncjs/cncjs-pendant-tinyweb)

## Browser Support

![Chrome](https://raw.github.com/alrra/browser-logos/master/src/chrome/chrome_48x48.png)<br>Chrome | ![Edge](https://raw.github.com/alrra/browser-logos/master/src/edge/edge_48x48.png)<br>Edge | ![Firefox](https://raw.github.com/alrra/browser-logos/master/src/firefox/firefox_48x48.png)<br>Firefox | ![IE](https://raw.github.com/alrra/browser-logos/master/src/archive/internet-explorer_9-11/internet-explorer_9-11_48x48.png)<br>IE | ![Opera](https://raw.github.com/alrra/browser-logos/master/src/opera/opera_48x48.png)<br>Opera | ![Safari](https://raw.github.com/alrra/browser-logos/master/src/safari/safari_48x48.png)<br>Safari
--- | --- | --- | --- | --- | --- |
 Yes | Yes | Yes| Not supported | Yes | Yes |

## Getting Started

### Node.js Installation

Node.js 4 or higher is recommended. You can install [Node Version Manager](https://github.com/creationix/nvm) to manage multiple Node.js versions. If you have `git` installed, just clone the `nvm` repo, and check out the latest version:
```
git clone https://github.com/creationix/nvm.git ~/.nvm
cd ~/.nvm
git checkout `git describe --abbrev=0 --tags`
cd ..
. ~/.nvm/nvm.sh
```

Add these lines to your `~/.bash_profile`, `~/.bashrc`, or `~/.profile` file to have it automatically sourced upon login:
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" # This loads nvm
```

Once installed, you can select Node.js versions with:
```
nvm install 4
nvm use 4
```

If you're using Node.js 4 or earlier versions, it's recommended that you upgrade npm to the latest version. To upgrade, run:
```
npm install npm@latest -g
```

### Installation

Install cncjs as a non-root user, or the [serialport](https://github.com/EmergingTechnologyAdvisors/node-serialport) module may not install correctly on some platforms like Raspberry Pi.
```
npm install -g cncjs
```

If you're going to use sudo or root to install cncjs, you need to specify the `--unsafe-perm` option to run npm as the root account.
```
sudo npm install --unsafe-perm -g cncjs
```

It's recommended that you run [Raspbian Jessie](https://www.raspberrypi.org/downloads/raspbian/) on the RPi2 or RPi3. For Raspbian Wheezy, be sure to [install gcc/g++ 4.8](https://somewideopenspace.wordpress.com/2014/02/28/gcc-4-8-on-raspberry-pi-wheezy/) before npm install.

Check out [https://cnc.js.org/docs/installation/](https://cnc.js.org/docs/installation/) for other installation methods.

### Upgrade

Run `npm install -g cncjs@latest` to install the latest version. To determine the version, use `cnc -V`.

### Usage

Run `cnc` to start the server, and visit `http://yourhostname:8000/` to view the web interface. Pass `--help` to `cnc` for more options.

```
pi@rpi3$ cnc -h

  Usage: cnc [options]

  Options:

    -h, --help                          output usage information
    -V, --version                       output the version number
    -p, --port                          set listen port (default: 8000)
    -l, --host                          set listen address or hostname (default: 0.0.0.0)
    -b, --backlog                       set listen backlog (default: 511)
    -c, --config <filename>             set config file (default: ~/.cncrc)
    -v, --verbose                       increase the verbosity level
    -m, --mount [<url>:]<path>          set the mount point for serving static files (default: /static:static)
    -w, --watch-directory <path>        watch a directory for changes
    --access-token-lifetime <lifetime>  access token lifetime in seconds or a time span string (default: 30d)
    --allow-remote-access               allow remote access to the server
    --controller <type>                 specify CNC controller: Grbl|Smoothie|TinyG|g2core (default: '')

  Examples:

    $ cnc -vv
    $ cnc --mount /pendant:/home/pi/tinyweb
    $ cnc --watch-directory /home/pi/watch
    $ cnc --access-token-lifetime 60d  # e.g. 3600, 30m, 12h, 30d
    $ cnc --allow-remote-access
    $ cnc --controller Grbl
```

Instead of passing command line options for `--watch-directory`, `--access-token-lifetime`, `--allow-remote-access`, and `--controller`, you can create a `~/.cncrc` file that contains the following configuration in JSON format:
```json
{
    "watchDirectory": "/path/to/dir",
    "accessTokenLifetime": "30d",
    "allowRemoteAccess": false,
    "controller": ""
}
```

To troubleshoot issues, run:
```
cnc -vvv
```

### Configuration File

The configuration file <b>.cncrc</b> contains settings that are equivalent to the cnc command-line options. The configuration file is stored in user's home directory. To find out the actual location of the home directory, do the following:

* Linux/Mac
  ```sh
  echo $HOME
  ```

* Windows
  ```sh
  echo %USERPROFILE%
  ```

Check out an example configuration file [here](https://github.com/cncjs/cncjs/blob/master/examples/.cncrc).

### File Format

```json
{
  "ports": [
     {
       "comName": "/dev/ttyAMA0",
       "manufacturer": ""
     }
  ],
  "baudrates": [115200, 250000],
  "watchDirectory": "/path/to/dir",
  "accessTokenLifetime": "30d",
  "allowRemoteAccess": false,
  "controller": "",
  "state": {
    "checkForUpdates": true
  },
  "commands": [
    {
      "title": "Update (root user)",
      "commands": "sudo npm install -g cncjs@latest --unsafe-perm; pkill -a -f cnc"
    },
    {
      "title": "Update (non-root user)",
      "commands": "npm install -g cncjs@latest; pkill -a -f cnc"
    },
    {
      "title": "Reboot",
      "commands": "sudo /sbin/reboot"
    },
    {
      "title": "Shutdown",
      "commands": "sudo /sbin/shutdown"
    }
  ],
  "events": [],
  "macros": [],
  "users": []
}
```

## Documentation

https://cnc.js.org/docs/

## License

Licensed under the [MIT License](https://raw.githubusercontent.com/cncjs/cncjs/master/LICENSE).
