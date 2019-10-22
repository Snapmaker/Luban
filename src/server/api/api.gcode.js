import store from '../store';
import {
    PROTOCOL_TEXT,
    ERR_BAD_REQUEST,
    ERR_INTERNAL_SERVER_ERROR
} from '../constants';


export const set = (req, res) => {
    const { port, dataSource = PROTOCOL_TEXT, name, gcode } = req.body;

    if (!port) {
        res.status(ERR_BAD_REQUEST).send({
            msg: 'No port specified'
        });
        return;
    }
    if (!gcode) {
        res.status(ERR_BAD_REQUEST).send({
            msg: 'Empty G-code'
        });
        return;
    }

    const controller = store.get(`controllers["${port}/${dataSource}"]`);
    if (!controller) {
        /*
        res.status(ERR_BAD_REQUEST).send({
            msg: 'Controller not found'
        });
        */
        res.send({
            msg: 'Controller not found'
        });
        return;
    }

    // Load G-code
    controller.command(null, 'gcode:load', name, gcode, (err) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({
                msg: `Failed to load G-code: ${err}`
            });
            return;
        }

        res.end();
    });
};

export const get = (req, res) => {
    // const port = req.query.port;
    const { port, dataSource = PROTOCOL_TEXT } = req.query;

    if (!port) {
        res.status(ERR_BAD_REQUEST).send({
            msg: 'No port specified'
        });
        return;
    }

    const controller = store.get(`controllers["${port}/${dataSource}"]`);
    if (!controller) {
        /*
        res.status(ERR_BAD_REQUEST).send({
            msg: 'Controller not found'
        });
        */
        res.send({
            msg: 'Controller not found'
        });
        return;
    }

    const { sender } = controller;

    res.send({
        ...sender.toJSON(),
        data: sender.state.gcode
    });
};

export const download = (req, res) => {
    // const port = req.query.port;
    const { port, dataSource } = req.query;

    if (!port) {
        res.status(ERR_BAD_REQUEST).send({
            msg: 'No port specified'
        });
        return;
    }

    const controller = store.get(`controllers["${port}/${dataSource}"]`);
    if (!controller) {
        /*
        res.status(ERR_BAD_REQUEST).send({
            msg: 'Controller not found'
        });
        */
        return;
    }

    const { sender } = controller;

    const filename = sender.state.name || 'noname.txt';
    const content = sender.state.gcode || '';
    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(filename)}`);
    res.setHeader('Connection', 'close');

    res.write(content);
    res.end();
};
