const app = require('electron').app;
const fs = require('fs');
const path = require('path');

const servicesPath = path.join(app.getAppPath(), 'js', 'services');

class Services {
    constructor(settings) {
        this.settings = settings;
        this.services = {};

        this.load();
    }

    load() {
        fs.readdirSync(servicesPath).forEach(file => {
            if(!/\.js$/.test(file)) return;

            const module = require(path.join(servicesPath, file));

            const initModule = new module(this.settings);

            this.services[initModule._name] = initModule;
        });
    }

    list() {
        return Object.keys(this.services).map(name => this.services[name]);
    }

    get(name) {
        return this.services[name];
    }

    set(name, data) {
        return this.services[name].save(data);
    }
}

module.exports = Services;
