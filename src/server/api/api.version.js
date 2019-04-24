import request from 'superagent';
import settings from '../config/settings';
import { ERR_INTERNAL_SERVER_ERROR } from '../constants';


const API_VERSION = settings.api_server + '/version/snapjs';

export const getLatestVersion = (req, res) => {
    request
        .get(API_VERSION)
        .end((err, response) => {
            if (err) {
                res.status(ERR_INTERNAL_SERVER_ERROR).send({
                    msg: `Failed to connect to API server: code=${err.status}`
                });
                return;
            }

            res.send(response.body);
        });
};
