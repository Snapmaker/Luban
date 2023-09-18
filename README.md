Snapmaker Luban
===============

[![Build Status](https://github.com/Snapmaker/Luban/workflows/Build%20on%20Release%20created/badge.svg)](https://github.com/Snapmaker/Luban/actions)

Snapmaker Luban is an easy-to-use 3-in-1 software tailor-made for Snapmaker machines.
You can customize the printer settings and control the machine in Luban anytime with ease.
The software also provides G-code generation support for 3D models, laser engraving / cutting, and CNC milling.

Our goal is to provide a multi-functional 3D software, while making it as accessible and customizable as possible for new users / beginners.

The software is inspired by [cncjs](https://github.com/cncjs/cncjs) by cheton.
We use [LunarSlicer](https://github.com/Snapmaker/LunarSlicer) for 3D slicing.

![Software Screenshot](https://user-images.githubusercontent.com/3749551/219274513-0f0d1e56-2e0a-4c9b-ad8b-7b5801a00cde.jpg)


## How to install and run

### Run released applications

You can download latest releases of software under the ["**Releases**"](https://github.com/Snapmaker/Luban/releases) section.
It's recommended to use a stable release version unless you want to do some modifications on the source code.

For Linux distros (Debian for example), you may need to run following commands to install dependencies for Luban:

```Bashhist
> sudo dpkg --install snapmaker-luban-{version}-linux-amd64.deb
> sudo apt install --fix-broken
```

### Run from source code

Checkout [Development](./docs/Development.md) to how to run and develop from source code.

## Feedback & Contribution

- To submit a bug or feature request, [file an issue](https://github.com/Snapmaker/Luban/issues/new) in github issues.
- To contribute some code, make sure you have read and followed our guidelines for [contributing](https://github.com/Snapmaker/Luban/blob/master/CONTRIBUTING.md).

## Translations

We use crowdin for collaborative translations. We would greatly appreciate your assistance in improving our translations.

| Language | Crowdin Link |
| ---------| -------------|
| Ukrainian (Українська) | [Ukrainian translations](https://crowdin.com/project/luban/uk) |
| German (Deutsch) | [German translations](https://crowdin.com/project/luban/de) |
| Italian (Italiano) | [Italian translations](https://crowdin.com/project/luban/it) |
| Chinese Simplified (简体中文) | [Chinese translations](https://crowdin.com/project/luban/zh-CN) |


## License
Snapmaker Luban is released under terms of the AGPLv3 License.

Terms of the license can be found in the LICENSE file or at http://www.gnu.org/licenses/agpl-3.0.html.
