const electron = require('electron');
const app = electron.remote.app;
const ipc = electron.ipcRenderer;
const shell = electron.shell;

const path = require('path');

const tink = new Audio(path.join(app.getAppPath(), 'aud', 'ts-tink.ogg'));

ipc.on('audio-notify', () => {
    tink.load();
    tink.play();
});

ipc.on('system-notify', (evt, body, url) => {
    const notify = new Notification('Pussh', {
        body: body,
        silent: true
    });

    if (!url) return;
    notify.onclick = () => shell.openExternal(url);
});
