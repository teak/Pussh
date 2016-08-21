const os = require('os');
const path = require('path');
const fs = require('fs');
const execFile = require('child_process').execFile;

const request = require('request');
const async = require('async');

const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const Tray = electron.Tray;
const Menu = electron.Menu;
const MenuItem = electron.MenuItem;
const NativeImage = electron.nativeImage;
const globalShortcut = electron.globalShortcut;
const clipboard = electron.clipboard;
const shell = electron.shell;
const ipc = electron.ipcMain;
const dialog = electron.dialog;

const Settings = require('./settings');
const Services = require('./services');

const getTrayImage = (state=null, template=false) => {
    if (!state && os.platform() === 'win32') state = 'alt';
    if (template) {
        const trayImg = NativeImage.createFromPath(getTrayImage());
        trayImg.setTemplateImage(true);
        return trayImg;
    }
    return path.join(app.getAppPath(), 'img', `menu-${state ? `${state}-` : ''}icon@2x.png`);
}

class Pussh {
    constructor() {
        this.platform = os.platform();
        this.name = app.getName();
        this.version = app.getVersion();
        this.lastURLs = [];

        this.settingsWindow = null;
        this.editorWindow = null;
        this.workerWindow = null;
        this.cropWindow = null;

        // open hidden window to provide access to dom only apis
        this.workerWindow = new BrowserWindow({show: false});
        this.workerWindow.loadURL(`file://${path.join(app.getAppPath(), 'worker-window.html')}`);

        // worker window needs to be loaded first
        this.workerWindow.webContents.on('did-finish-load', () => {
            this.settings = new Settings();
            this.services = new Services(this.settings);

            this.watch();
            this.buildTrayMenu();
            this.firstLaunch();
            this.checkUpdates();
        });

        // hide the dock icon on os x
        if (this.platform == 'darwin') app.dock.hide();

        // open settings on app activate
        app.on('activate', () => this.showSettingsWindow());

        // keep the app open when closing the last window
        app.on('window-all-closed', () => {
            this.settingsWindow = null;
            this.editorWindow = null;
            this.workerWindow = null;
            this.cropWindow = null;
        });

        // unregister global hotkeys before quit
        app.on('will-quit', () => globalShortcut.unregisterAll());

        // create status item
        this.tray = new Tray(getTrayImage(null, true));
        this.tray.setPressedImage(getTrayImage('alt'));
    }

    firstLaunch() {
        if (this.settings.get('lastVersionLaunched') === this.version) return;
        this.showSettingsWindow();
        this.settings.set('lastVersionLaunched', this.version);
    }

    checkUpdates() {
        if (!this.settings.get('checkForUpdates')) return;

        request.get({
            url: 'https://pussh.me/dl/pussh.json',
            timeout: 10000,
            json: true
        }, (error, response, body) => {
            if (error || !response || response.statusCode !== 200 || !data.version) return;
            
            if (this.version !== data.version) {
                const msg = 'Pussh has an update available. Click "OK" to open the Pussh download page.';
                if (!confirm(msg)) return;
                this.openInBrowser('https://pussh.me/');
            }
        });
    }

    showSettingsWindow() {
        if (this.settingsWindow) {
            this.settingsWindow.focus();
            return;
        }

        this.settingsWindow = new BrowserWindow({
            show: false,
            width: 900,
            height: 600,
            minWidth: 900,
            minHeight: 580,
            'skip-taskbar': true,
            'auto-hide-menu-bar': true
        });
        this.settingsWindow.loadURL(`file://${path.join(app.getAppPath(), 'settings-window.html')}`);
        this.settingsWindow.on('closed', () => this.settingsWindow = null);
        this.settingsWindow.webContents.on('did-finish-load', () => this.settingsWindow.show());
    }

    showEditorWindow() {
        if (!this.editorWindow) {
            this.editorWindow = new BrowserWindow({
                show: false,
                width: 900,
                height: 600,
                minWidth: 900,
                minHeight: 580,
                'skip-taskbar': true,
                'auto-hide-menu-bar': true
            });
            this.editorWindow.on('closed', () => this.editorWindow = null);
            this.editorWindow.webContents.on('did-finish-load', () => this.editorWindow.show());
        }

        this.editorWindow.loadURL(`file://${path.join(app.getAppPath(), `editor-window.html?lastURL=${encodeURIComponent(this.lastURLs[0])}`)}`);
        this.editorWindow.focus();
    }

    setTrayState(state) {
        switch(state) {
            case 'off':
                this.tray.setImage(getTrayImage(null, true));
                break;
            case 'active':
                this.tray.setImage(getTrayImage('active'));
                break;
            case 'complete':
                this.tray.setImage(getTrayImage('done'));
                break;
        }
    }

    buildTrayMenu() {
        const menu = new Menu();

        if (this.lastURLs.length) {
            this.lastURLs.forEach(url => {
                menu.append(new MenuItem({
                    label: url,
                    click: () => this.copyToClipboard(url) && this.openInBrowser(url)
                }));
            });

            menu.append(new MenuItem({
                type: 'separator'
            }));

            // menu.append(new MenuItem({
            //     label: 'Open Editor',
            //     click: () => this.showEditorWindow()
            // }));

            // menu.append(new MenuItem({
            //     type: 'separator'
            // }));
        }

        menu.append(new MenuItem({
            label: 'Cropped Capture',
            click: () => {
                switch(this.platform) {
                    case 'darwin':
                        execFile('/usr/bin/osascript', ['-e', 'tell application "System Events" to keystroke "$" using {command down, shift down}']);
                        break;
                    case 'win32':
                        this.windowsCapture(true);
                        break;
                }
            }
        }));

        menu.append(new MenuItem({
            label: 'Screen Capture',
            click: () => {
                switch(this.platform) {
                    case 'darwin':
                        execFile('/usr/bin/osascript', ['-e', 'tell application "System Events" to keystroke "#" using {command down, shift down}']);
                        break;
                    case 'win32':
                        this.windowsCapture();
                        break;
                }
            }
        }));

        menu.append(new MenuItem({
            type: 'separator'
        }));

        menu.append(new MenuItem({
            label: 'Settings',
            click: () => this.showSettingsWindow()
        }));

        menu.append(new MenuItem({
            label: 'Quit '+this.name,
            click: () => app.quit()
        }));

        this.tray.setContextMenu(menu);
    }

    watch() {
        switch(this.platform) {
            case 'darwin':
                const desktopFolder = path.join(process.env['HOME'], 'Desktop');
                const checkedFiles = [];

                const checker = () => {
                    fs.readdir(desktopFolder, (err, files) => {
                        if (err || !files.length) return setTimeout(() => checker(), 1000);

                        // remove checked files that no longer exist on the desktop
                        checkedFiles
                        .filter(file => files.indexOf(file) === -1)
                        .forEach(file => checkedFiles.splice(checkedFiles.indexOf(file), 1));

                        // check for new screenshots
                        async.each(
                            files.filter(file => checkedFiles.indexOf(file) === -1 && /.png$/.test(file)),
                            (file, callback) => {
                                const filePath = path.join(desktopFolder, file);

                                // if file is too old, never check it again
                                if (Date.now() - fs.statSync(filePath).ctime.getTime() > 3000) {
                                    checkedFiles.push(file);
                                    return callback();
                                }

                                execFile('/usr/bin/mdls', ['--raw', '--name', 'kMDItemIsScreenCapture', filePath], (error, stdout) => {
                                    // 1 = screenshot, 0 = not a screenshot
                                    if (error || !parseInt(stdout)) return callback();

                                    console.log('Uploading %s', filePath);

                                    this.upload(this.moveToTemp(filePath), filePath);

                                    checkedFiles.push(file);
                                    callback();
                                });
                            },
                            () => {
                                setTimeout(() => checker(), 1000);
                            }
                        );
                    });
                };
                checker();
                break;
            case 'win32':
                globalShortcut.register("Alt+Shift+3", () => this.windowsCapture());
                globalShortcut.register("Alt+Shift+4", () => this.windowsCapture(true));
                break;
        }
    }

    windowsCapture(crop=false) {
        if (this.platform !== 'win32') return;

        // temp files
        const fullImg = path.join(app.getPath('temp'), 'pussh_screen.png');
        const cropImg = path.join(app.getPath('temp'), 'pussh_screen_crop.png');

        // take the screenshot and start crop if needed
        execFile(path.join(app.getAppPath(), 'bin', 'win', 'PusshCap.exe'), [fullImg], (error, stdout) => {
            if (error) return;

            if (!crop || !stdout) {
                this.upload(this.moveToTemp(fullImg), fullImg);
                return;
            }

            const output = stdout.split(',');
            const scale = 0.9;
            let width = parseInt(output[2]);
            let height = parseInt(output[3]);
            let left = parseInt(output[0]);
            let top = parseInt(output[1]);

            width = width * scale;
            height = height * scale;
            left = left + ((width - (width * scale)) / 2);
            top = top + ((height - (height * scale)) / 2);

            this.cropWindow = new BrowserWindow({
                width: width,
                height: height,
                x: left,
                y: top,
                show: false,
                frame: false,
                'skip-taskbar': true,
                'auto-hide-menu-bar': true
            });

            this.cropWindow.on('closed', () => {
                this.cropWindow = null;
                if (!fs.existsSync(cropImg)) return;
                this.deleteFile(fullImg);
                this.upload(this.moveToTemp(cropImg), cropImg);
            });

            this.cropWindow.loadURL(`file://${path.join(app.getAppPath(), 'crop-window.html')}`);
        });
    }

    upload(file, oldFile) {
        const selectedService = this.settings.get('selectedService');

        file = this.randomizeFilename(file);
        file = this.prefixFilename(file);

        // set status icon to active
        this.setTrayState('active');

        this.resize(file, () => {
            this.services.get(selectedService).upload(file, (err, url) => {
                if (err || !url) {
                    this.setTrayState('off');
                    dialog.showMessageBox({type: 'error', buttons: ['Ok'], message: 'An error has occured :(', detail: err.message});
                    return;
                }

                this.lastURLs.unshift(url);
                this.lastURLs = this.lastURLs.slice(0, 10);

                // rebuild the tray menu with the new url
                this.buildTrayMenu();

                // save link to clipboard
                this.copyToClipboard(url);

                // remove files
                if (oldFile) this.trash(oldFile);
                this.deleteFile(file);

                // audio notification
                if (this.settings.get('audioNotifications')) {
                    this.workerWindow.webContents.send('audio-notify', 'fire');
                }

                // open in browser
                if (this.settings.get('openBrowser')) {
                    this.openInBrowser(url);
                }

                // set status icon to 'complete' for 3 seconds
                this.setTrayState('complete');
                setTimeout(() => this.setTrayState('off'), 3000);
            });
        });
    }

    moveToTemp(file) {
        const tmpFile = path.join(app.getPath('temp'), path.basename(file));
        fs.writeFileSync(tmpFile, fs.readFileSync(file));
        return tmpFile;
    }

    trash(file) {
        if (this.settings.get('sendToTrash') === false) return;

        let trashFolder;

        switch(this.platform) {
            case 'win32':
                // this does not work
                trashFolder = path.join(process.env['SystemRoot'], '$Recycle.bin', process.env['SID']);
                break;
            case 'darwin':
                trashFolder = path.join(process.env['HOME'], '.Trash');
                break;
            case 'linux':
                trashFolder = path.join(process.env['HOME'], '.local', 'share', 'Trash');
                break;
            default:
                return;
        }

        // We could just delete the file, but what if the user wants it back
        fs.rename(file, path.join(trashFolder, path.basename(file)));
    }

    deleteFile(file) {
        fs.unlinkSync(file);
    }

    randomizeFilename(file) {
        if (this.settings.get('randomizeFilenames') === false) return file;

        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let newName = "";
        for(let i = 0; i < this.settings.get('randomizeFilenamesLength'); i++) {
            newName += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        newName += path.extname(file); // Append file extension

        var newFile = path.join(path.dirname(file), newName);
        fs.renameSync(file, newFile);
        return newFile;
    }

    prefixFilename(file) {
        if (!this.settings.get('prefixFilenames')) return file;

        var newName = this.settings.get('prefixFilenames') + path.basename(file);

        var newFile = path.join(path.dirname(file), newName);
        fs.renameSync(file, newFile);
        return newFile;
    }

    // Retina screens cause huge screenshots, so we give the option to resize
    resize(file, callback) {
        if (this.platform !== 'darwin' || this.settings.get('retinaResize') === false) return callback();

        execFile('/usr/bin/sips', ['-g', 'dpiWidth', '-g', 'pixelWidth', file], (error, stdout) => {
            if (error) return callback();

            const lines = stdout.split('\n');

            const dpiWidth = parseFloat(lines[1].split(':')[1].trim());
            const pixelWidth = parseInt(lines[2].split(':')[1].trim());

            if (parseInt(dpiWidth) === 72) return callback();

            const newWidth = Math.round((72 / dpiWidth) * pixelWidth);

            execFile('/usr/bin/sips', ['--resampleWidth', newWidth, file], (error, stdout) => {
                callback();
            });
        });
    }

    notify(body, url) {
        if (!this.settings.get('enableNotifications')) return;

        this.workerWindow.webContents.send('system-notify', body, url);
    }

    openInBrowser(url) {
        shell.openExternal(url);
    }

    copyToClipboard(url) {
        clipboard.writeText(url);
        this.notify('The screenshot URL has been copied to your clipboard.', url);
    }
}

app.on('ready', () => global.Pussh = new Pussh());