# Snapmakerjs

## Features

* [Desktop App for Linux, Mac OS X, and Windows](https://github.com/cncjs/cncjs/wiki/Desktop-App)
* 3D Visualizer
* Allows multiple HTTP connections at the same serial port
* Customizable workspace
* Commands
* Events
* [Keyboard Shortcuts](https://cnc.js.org/docs/user-guide/#keyboard-shortcuts)
* [Contour ShuttleXpress](https://cnc.js.org/docs/user-guide/#contour-shuttlexpress)
* Multi-Language Support
* Watch Directory
* Z-Probe

## Getting Started

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

Check out an example configuration file [here](https://github.com/whimsycwd/Snapmakerjs/blob/master/examples/.cncrc).

## License

Licensed under the [MIT License](https://raw.githubusercontent.com/whimsycwd/Snapmakerjs/master/LICENSE).
