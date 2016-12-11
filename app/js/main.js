// windows start menu add/delete /w squirrel install/uninstall
if(require('electron-squirrel-startup')) return;

const os = require('os');
const path = require('path');
const fs = require('fs');
const execFile = require('child_process').execFile;

const request = require('request');
const async = require('async');
const trash = require('trash');

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

const electronDebug = require('electron-debug')();

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
        this.settings.save();
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
            skipTaskbar: true,
            autoHideMenuBar: true
        });
        this.settingsWindow.setMenu(null);
        this.settingsWindow.loadURL(`file://${path.join(app.getAppPath(), 'settings-window.html')}`);
        this.settingsWindow.on('closed', () => this.settingsWindow = null);
        this.settingsWindow.webContents.on('did-finish-load', () => this.settingsWindow.show());
    }

    showEditorWindow() {
        if (!this.editorWindow) {
            this.editorWindow = new BrowserWindow({
                width: 900,
                height: 600,
                minWidth: 900,
                minHeight: 580,
                skipTaskbar: true,
                autoHideMenuBar: true
            });
            this.editorWindow.on('closed', () => this.editorWindow = null);
        }

        this.editorWindow.loadURL(`file://${path.join(app.getAppPath(), `editor-window.html?last_url=${encodeURIComponent(this.lastURLs[0])}`)}`);
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

        // temp file
        const date = new Date().toISOString().slice(0, 19).replace('T', ' ').replace(/:/g, '.');
        const imagePath = path.join(app.getPath('temp'), `Screen Shot at ${date}.png`);

        // take the screenshot and start crop if needed
        execFile(path.join(app.getAppPath(), 'bin', 'win', 'nircmd.exe'), ['savescreenshotfull', imagePath], (error, stdout) => {
            if (error) return;

            if (!crop) {
                this.upload(this.moveToTemp(imagePath), imagePath);
                return;
            }

            const allScreens = electron.screen.getAllDisplays();
            allScreens.forEach(s => {
                s.bounds.maxX = s.bounds.x + s.bounds.width;
                s.bounds.maxY = s.bounds.y + s.bounds.height;
            });
            const minX = allScreens.reduce((pv, cv) => pv < cv.bounds.x ? pv : cv.bounds.x, 0);
            const minY = allScreens.reduce((pv, cv) => pv < cv.bounds.y ? pv : cv.bounds.y, 0);
            const maxWidth = allScreens.reduce((pv, cv) => pv <= cv.bounds.maxX ? cv.bounds.maxX : pv, 0) + Math.abs(minX);
            const maxHeight = allScreens.reduce((pv, cv) => pv <= cv.bounds.maxY ? cv.bounds.maxY : pv, 0) + Math.abs(minY);

            this.cropWindow = new BrowserWindow({
                width: maxWidth,
                height: maxHeight,
                x: minX,
                y: minY,
                show: false,
                frame: false,
                alwaysOnTop: true,
                skipTaskbar: true,
                autoHideMenuBar: true,
                enableLargerThanScreen: true,
                thickFrame: false
            });
            this.cropWindow.setSize(maxWidth, maxHeight);

            this.cropWindow.on('close', () => {
                this.cropWindow = null;
                this.upload(this.moveToTemp(imagePath), imagePath);
            });

            this.cropWindow.loadURL(`file://${path.join(app.getAppPath(), `crop-window.html?image_path=${encodeURIComponent(imagePath)}`)}`);
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
        const tmpFile = path.join(app.getPath('temp'), Date.now() + path.basename(file));
        fs.writeFileSync(tmpFile, fs.readFileSync(file));
        return tmpFile;
    }

    trash(file) {
        if (this.settings.get('sendToTrash') === false) return;

        trash([file]);
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
