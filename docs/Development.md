# Development

If you want to contribute to Luban, you will need to have `Node.js` development environment.

Or you can follow the instructions below to set up the development environment for specific platform:

- macOS: (No documentation for now)
- Linux (Ubuntu/Debian/CentOS): [Linux Environment](Environment-Linux.md)
- Windows: [Windows Environment](Environment-Windows.md)


### Install dependencies and start dev server

- Clone this repository and initialize submodules. **Note: As we use submodules to manage large resources, it's always recommended to use [SSH](https://docs.github.com/en/authentication/connecting-to-github-with-ssh) to manage your repository.**

    ```Bash
    > git clone git@github.com:Snapmaker/Luban.git
    > cd Luban
    > git submodule update --init
    ```

- Use `npm` to install package dependencies:

    ```Bash
    > npm install
    ```

- Start dev server locally:

    ```Bash
    > npm run dev
    ```

### Build installer locally

```Bash
> npm run build && npm run build:mac-x64 (for macOS)
> npm run build && npm run build:win-x64 (for Windows)
```

The installer packs `dist/Luban` into a single `resources/app.asar` archive, so a
cold start reads one file instead of crawling thousands. Native addons, the two
engine packages (LunarTPP, LubanEngine) and the `resources/` tree are unpacked
beside it; the list is `asarUnpack` in `electron-builder.yml`. Plain `fs` reads
work through the archive in every Electron process, including the forked
server, but anything that hands a path to the OS (spawning a binary, opening a
folder) needs the real file: see `unpackedPath()` and `requireUnpacked()` in
`src/server/lib/paths.ts`. Paths to bundled assets (i18n, views, resources,
workers) come from that module, never from the working directory.

Every process ships as a webpack bundle: the renderer (`src/app`), the server
(`webpack.config.server.production.js`, forked as `src/server-cli.js`) and the
Electron main process (`webpack.config.main.production.js`, which emits
`main.js` and `server-cli.js` into `dist/Luban/src`). Dependencies are compiled
in; the few that cannot be (native addons, the engine packages that spawn a
binary out of their own directory, lazily required Electron glue) are listed as
`KEEP_EXTERNAL` in each config and mirrored in `build/pkgsync.js`, which is
what the packaged app installs into `node_modules`. The server config also
records how each formerly external package was brought into the bundle; two of
them (formidable, opencv-wasm) are patched while webpack reads them, by
`build/webpack-replace-loader.js`, which fails the build if the patched line
is no longer there.

### Build release assets with GitHub Actions

Publish a release or prerelease whose tag includes the current
[release workflow](../.github/workflows/build-on-create-release.yml). **Build Release
Assets** runs on `release.published`, including prereleases published from a draft.
It builds the tagged source and attaches Windows x64 `.exe`, macOS x64/arm64
`.dmg` and `.zip`, and Linux x64 `.deb`, `.rpm`, and `.tar.gz` packages to that
release. Generated update metadata and blockmaps are included when present. The
release keeps its prerelease status, title, and notes. Package filenames and the
app version come from the tagged source's package version, not the release tag.

No personal access token is required for the public submodules or GitHub asset
uploads: checkout uses `SACP_TOKEN` when configured and otherwise `github.token`;
uploads use the workflow's `GITHUB_TOKEN` with `contents: write`. Node 22 and the
platform dependency setup match the normal build workflow. Shared packaging
scripts handle missing Apple credentials: empty certificate secrets are unset,
macOS apps are ad-hoc signed, and notarization is skipped without Apple account
credentials. Such macOS packages still need the user's first-launch Gatekeeper
approval. OSS uploads remain restricted to `Snapmaker/Luban`.

To recover an existing release, select **Actions → Build Release Assets → Run
workflow**, choose a branch containing the updated workflow, enter its existing
published `release_tag`, and select `windows`, `macos`, `linux`, or `all`. The
workflow definition must also be present on the repository's default branch for
manual dispatch to be available. The build checks out the release tag, not the
selected workflow branch; older tags also retain their older packaging scripts.
Draft or nonexistent releases are rejected. Retries replace assets with matching
names; runs for the same tag are serialized. The `release-windows`,
`release-macos`, and `release-linux` Actions artifacts retain the packages even if
uploading them to the release fails.

Re-running an old failed run uses its old workflow revision. Use manual dispatch
to apply these workflow fixes to an existing tag, or publish a new release tagged
after the workflow change was merged. Neither this workflow nor a normal CI
build installs the application on a machine.

### Additional Notes

- For developers in China, you can use taobao mirror to install npm packages.

    ```Bash
    > npm config set registry https://registry.npm.taobao.org/
    > ELECTRON_MIRROR="https://npm.taobao.org/mirrors/electron/" npm install
    ```

### FAQ

- **Q:** Encounter a `RequestError` when installing electron?

  **A:** Check your system proxy and try `rm -rf node_modules/electron && npm install` again.

- **Q:** Develop in Firefox encounters an blank screen?

  **A:** There is a compatible problem of `getScreenCTM()` in using SVG in Firefox, switch to Chrome.

