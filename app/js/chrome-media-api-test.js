// was in worker window
ipc.on('chrome-cap', () => {
    navigator.webkitGetUserMedia({
        video: {
            mandatory: {
                chromeMediaSource: 'screen',
                maxWidth: 1920,
                maxHeight: 2250
            },
            optional: []
        },
        audio: false
    }, stream => {
        const video = document.createElement('video');

        video.addEventListener('loadedmetadata', () => {
            // setup path
            const savePath = path.join(app.getPath('temp'), 'pussh_screen.png');
            console.log(savePath);

            // use canvas to conver data to somthing usable
            var canvas = document.createElement('canvas');
            canvas.width = this.videoWidth;
            canvas.height = this.videoHeight;
            var ctx = canvas.getContext("2d");
            ctx.drawImage(this, 0, 0);

            //create data url
            const imageDataURL = canvas.toDataURL();

            // end meadia stream
            stream.getTracks()[0].stop();

            // remove 'data' from base64 url
            const matches = imageDataURL.match(/^data:.+\/(.+);base64,(.*)$/);
            const ext = matches[1];
            const data = matches[2];

            // save file
            const buffer = new Buffer(data, 'base64');
            fs.writeFileSync(savePath, buffer);

            ipc.sendSync('screen-saved', savePath);
        }, false);

        video.src = URL.createObjectURL(stream);
        video.play();

    }, err => {
        console.log("An error occured! " + err);
    });
});