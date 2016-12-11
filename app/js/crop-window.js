const remote = require('electron').remote;
const app = remote.app;
const cropWindow = remote.getCurrentWindow();

const os = require('os');
const path = require('path');

const Jimp = require('jimp');

$(() => {
    cropWindow.on('blur', () => cropWindow.destroy());

    // temp files
    const imagePath = decodeURIComponent(window.location.href.split('?image_path=')[1]);

    // load the img preview
    $('#img').attr('src', imagePath);
    $('#img').css({
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
    });
    $('#img').load(() => {
        cropWindow.show();
        cropWindow.focus();

        // flash white
        setTimeout(() => $('#white').fadeOut(200), 100);
    });

    // close on esc key
    $(document).keyup(e => e.keyCode == 27 && cropWindow.destroy());

    let dragging = false;
    let mouseLoc = {x: 0, y: 0};
    let dragStart = {x: 0, y: 0};
    let dragSize = {x: 0, y: 0};
    let dragEnd = {x: 0, y: 0};
    let scale = {x: 1, y: 1};

    // update mouse location
    $(window).on('mousemove', e => {
        mouseLoc.x = e.clientX;
        mouseLoc.y = e.clientY;

        if (mouseLoc.x > $(document).width()) mouseLoc.x = $(document).width();
        if (mouseLoc.y > $(document).height()) mouseLoc.y = $(document).height();

        if (mouseLoc.x < 0) mouseLoc.x = 0;
        if (mouseLoc.y < 0) mouseLoc.y = 0;

        scale.x = $('#img')[0].naturalWidth / $('#img').width();
        scale.y = $('#img')[0].naturalHeight / $('#img').height();

        $('#cords').css({
            top: mouseLoc.y,
            left: mouseLoc.x
        });

        if (dragging) {
            dragSize.x = Math.abs(mouseLoc.x - dragStart.x) + 1;
            dragSize.y = Math.abs(mouseLoc.y - dragStart.y) + 1;

            if (mouseLoc.y < dragStart.y) {
                $('#selection').css('top', mouseLoc.y);
            }
            if (mouseLoc.x < dragStart.x) {
                $('#selection').css('left', mouseLoc.x);
            }

            $('#selection').css({
                height: dragSize.y,
                width: dragSize.x
            });

            $('#cords').html(Math.round(dragSize.x * scale.x) + '<br />' + Math.round(dragSize.y * scale.y));
        } else {
            $('#cords').html(Math.round(mouseLoc.x * scale.x) + '<br />' + Math.round(mouseLoc.y * scale.y));
        }
    });

    // start cropping
    $(window).on('mousedown', e => {
        dragging = true;

        dragStart.x = mouseLoc.x;
        dragStart.y = mouseLoc.y;
        dragSize.x = 0;
        dragSize.y = 0;
        dragEnd.x = 0;
        dragEnd.y = 0;

        $('#selection').css({
            'top': mouseLoc.y,
            'left': mouseLoc.x,
            'height': 0,
            'width': 0
        });
        $('#selection').show();
    });

    // stop cropping
    $(window).on('mouseup', e => {
        if (!dragging) return;
        dragging = false;

        dragEnd.x = mouseLoc.x + 1;
        dragEnd.y = mouseLoc.y + 1;

        dragSize.x = Math.abs(mouseLoc.x - dragStart.x) + 1;
        dragSize.y = Math.abs(mouseLoc.y - dragStart.y) + 1;

        $('#selection').hide();
        $('#selection').css({
            'height': 0,
            'width': 0
        });

        // dont upload if the crop is 0
        if (dragSize.x <= 1 && dragSize.y <= 1) {
            cropWindow.destroy();
        } else {
            let left = dragEnd.x > dragStart.x ? dragStart.x : dragEnd.x;
            let top = dragEnd.y > dragStart.y ? dragStart.y : dragEnd.y;
            left = left * scale.x;
            top = top * scale.y;

            const width = dragSize.x * scale.x;
            const height = dragSize.y * scale.y;

            // crop and save img. main script looks for the cropped file on window closed
            Jimp.read(imagePath, (error, image) => {
                if (error) return;

                image.crop(left, top, width, height);

                image.write(imagePath, () => cropWindow.close());
            });
        }
    });
});
