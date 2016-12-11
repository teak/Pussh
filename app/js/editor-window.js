const remote = require('electron').remote;
const app = remote.app;
const dialog = remote.dialog;
const clipboard = remote.clipboard;

const execFile = require('child_process').execFile;
const fs = require('fs');
const os = require('os');
const path = require('path');

const Jimp = require('jimp');

$(() => {
    const imageURL = decodeURIComponent(window.location.href.split('?last_url=')[1]);
    const platform = os.platform();
    let isVector = false;

    $('.img').attr('src', imageURL);

    $('.save').on('click', () => {
        if (isVector) {
            const savePath = dialog.showSaveDialog({
                filters: [{
                    name: 'Images', extensions: ['svg']
                }]
            });

            if (savePath) {
                fs.writeFileSync(savePath, fs.readFileSync(path.join(app.getPath('temp'), 'potrace.svg')));
            }
        } else {
            // save canvas as png
        }
    });

    $('.vector').on('click', () => {
        Jimp.read(imageURL, (error, image) => {
            if (error) return;

            const imgPath = path.join(app.getPath('temp'), 'potrace.bmp');

            let binPath;
            if (platform == 'darwin') {
                binPath = path.join(app.getAppPath(), 'bin', 'osx', 'potrace');
            } else if (platform == 'win32') {
                binPath = path.join(app.getAppPath(), 'bin', 'win', 'potrace.exe');
            } else {
                return;
            }

            image.write(imgPath, () => {
                execFile(binPath, ['-s', '-n', imgPath], (error, stdout) => {
                    if (error) return;

                    isVector = true;
                    $('.img').attr('src', path.join(app.getPath('temp'), 'potrace.svg'));

                    // console.log(clipboard.availableFormats());
                    // clipboard.writeHtml(fs.readFileSync(path.join(app.getPath('temp'), 'potrace.svg')), 'text/svg');
                });
            });
        });
    });
});
