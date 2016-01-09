// Description:
//   Search your Google drive using hubot
//
// Dependencies:
//   google-api-nodejs-client --> npm googleapis
//   requires a hubot brain
//
// Commands:
//   hubot drive code <code>  
//          -  used to authenticate the bot initially (see setCode and generateAuthUrl)
//
//   hubot drive tokens  
//          -  shows the refresh token, access token, and expiration time for the access token
//
//   hubot drive search [title=<title-string>] [contains=<any-text>]
//          - returns links to files found in google drive if title contains the title-string and if file contains any-text
//          - both title and contains are not required you can provide one or both
//          - if using both put title first
//
//   hubot drive search query=<query-string>
//          - returns links to files found in google drive matching the query string
//          - see more about query strings at: https://developers.google.com/drive/v2/web/search-parameters
//
// Author:
//  Andrew Schmitt

var google = require('googleapis');
var drive = google.drive('v2');

// Make sure that these keys do not conflict with things that are already in your hubot's brain
var TOKEN_KEY = 'HUBOT_DRIVE_AUTH_TOKEN',
    REFRESH_KEY = 'HUBOT_DRIVE_REFRESH_TOKEN',
    EXPIRY_KEY = 'HUBOT_DRIVE_EXPIRE_TIME';

var CLIENT_ID = process.env.DRIVE_CLIENT_ID,
    CLIENT_SECRET = process.env.DRIVE_CLIENT_SECRET,
    REDIRECT_URL = process.env.DRIVE_REDIRECT_URL;

// Initialize the oauthClient
var OAuth2 = google.auth.OAuth2;
var oauthClient = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
google.options({
    auth: oauthClient
});

/**
 * Lists files and links for the given queryString
 * For more info on constructing query string see: https://developers.google.com/drive/v2/web/search-parameters
 * This will not handle any paging and will only return the top search results given by the drive api
 *
 * @param  query     a query string
 * @param  cb        the callback function (err, [array of file objects])
 */
var search = function(queryString, cb) {

    validateToken(function(err, resp) {
            if (err) {
                cb({
                    err: err,
                    msg: err.msg
                });
                return;
            }

            drive.files.list({
                    q: queryString
                }, function(err, resp) {
                    if (err) {
                        cb({
                            err: err,
                            msg: 'Drive Api Error: encountered an error while fetching file list'
                        });
                        return;
                    }

                    // Drive api may return either a drive#fileList or a drive#file
                    var kind = resp.kind;
                    var files = null;
                    if (kind == 'drive#file') {
                        files = [resp];
                    } else if (kind == 'drive#fileList') {
                        files = resp.items;
                    }

                    if (!files || !(files.length > 0)) {
                        cb({
                            err: err,
                            msg: 'Drive Search Error: failed to get a list of files for given parameters'
                        });
                        return;
                    }

                    cb(null, files);
                }
            });
    });

}

/**
 * Formats the search results obtained from search
 * TODO: Acutally write this....
 *
 * @param  results  the array of filess returned from search
 */
var formatSearchRes = function(results) {
    return '/code \n' + results;
}

/**
 * Stores the token and expire time into the robot brain and
 * Sets it in the oauthClient
 *
 * @param  token  the token object returned from google oauth2
 */
var storeToken = function(token) {
    oauthClient.setCredentials(token);
    robot.brain.set(TOKEN_KEY, token.access_token);
    if (token.refresh_token) {
        robot.brain.set(REFRESH_KEY, token.refresh_token);
    }
    robot.brain.set(EXPIRY_KEY, +token.expiry_date);
    robot.brain.save();
    robot.brain.resetSaveInterval(60);
}

/**
 * Initially tokens must be created from the command line.
 * This requires a user manually inputting a code so it cannot be done by the bot alone.
 * This generates the url where the code can be obtained
 */
var generateAuthUrl = function() {
    var scopes = [
        'https://www.googleapis.com/auth/drive'
    ];
    var authUrl = oauthClient.generateAuthUrl({
        access_type: 'offline', //offline means that we get a refresh token
        scope: scopes
    });

    return authUrl;
}

/**
 * Used to set the code provided by the generated auth url. 
 * This code is generated for a user and is needed to initiate the oauth2 handshake.
 *
 * @param  code  the code obtained by a user from the auth url
 */
var setCode = function(code, cb) {
    oauthClient.getToken(code, function(err, token) {
        if (err) {
            console.log(err);
            cb({
                err: err,
                msg: 'Error while trying to retrieve access token'
            });
            return;
        }
        console.log('tokens', token);
        storeToken(token);
        cb(null, {
            resp: token,
            msg: "drive code successfully set"
        });
    });
}

/**
 * Checks the current expire time and determines if the token is valid.
 * Refreshes the token if it is not valid.
 *
 * @param  cb  the callback function (err, resp), use this to make api calls
 */
var validateToken = function(cb) {
    var at = robot.brain.get(TOKEN_KEY),
        rt = robot.brain.get(REFRESH_KEY);

    if (at == null || rt == null) {
        var authMsg = `Authorize this app by visiting this url :\n ${generateAuthUrl()}` +
            '\nThen use @hubot drive set code <code>';

        cb({
            err: null,
            msg: authMsg
        });
        return;
    }

    var expirTime = robot.brain.get(EXPIRY_KEY),
        curTime = (new Date()) / 1;

    if (expirTime < curTime) {
        oauthClient.refreshAccessToken(function(err, token) {
            if (err != null) {
                cb({
                    err: err,
                    msg: 'Drive Authentication Error: error refreshing token'
                }, null);
                return;
            }

            storeToken(token);
            cb(null, {
                resp: token,
                msg: 'Token refreshed'
            });
        });
    } else {
        cb(null);
    }
}

// Export robot functions
var initialBrainLoad = true;
module.exports = function(robot) {

    robot.respond(/drive(\s+set)?\s+code\s+([^\s]+)/i, {
        id: 'drive.set-code'
    }, function(msg) {
        var code = msg.match[2];
        msg.send('Attempting to set code...')
        setCode(code, function(err, resp) {
            if (err) {
                msg.send(err.msg);
                return;
            }

            msg.send(resp.msg);
        });
    });

    robot.respond(/drive tokens/i, {
        id: 'drive.show-tokens'
    }, function(msg) {
        var tok = robot.brain.get(TOKEN_KEY),
            ref_tok = robot.brain.get(REFRESH_KEY),
            expire = robot.brain.get(EXPIRY_KEY);

        msg.send('token: ' + tok);
        msg.send('refresh token: ' + ref_tok);
        msg.send('expire date: ' + expire);
    });

    robot.respond(/drive search query=(.)+/i, {
        id: 'drive.search-query'
    }, function(msg) {
        var queryStr = msg.match[1];

        search(queryStr, function(err, resp) {
            if (err) {
                msg.send(err.msg);
                return;
            }

            msg.send(formatSearchRes(msg, resp));
        });
    });

    robot.respond(/drive search (title=(.+))?\s+(contains=(.)+)?/i, {
        id: 'drive.search-title-contains'
    }, function(msg) {
        var titleStr = msg.match[2],
            containsStr = msg.match[4],
            titleQuery = `title contains ${titleStr}`,
            containsQuery = `fullText contains ${containsStr}`,
            queryStr = `${titleQuery} and ${containsQuery}`;

        if (!containsStr && !titleStr) {
            msg.send('Must provide either a title or contains parameter to search.');
            return;
        } else if (!containsStr) {
            queryStr = titleQuery;
        } else if (!titleStr) {
            queryStr = containsQuery;
        }

        search(queryStr, function(err, resp) {
            if (err) {
                msg.send(err.msg);
                return;
            }

            msg.send(formatSearchRes(msg, resp));
        });
    });

    // Set credentials on load. Does not validate/refresh tokens
    robot.brain.on('loaded', function() {
        if (!initialBrainLoad) {
            return;
        }

        initialBrainLoad = false;
        var at = robot.brain.get(TOKEN_KEY),
            rt = robot.brain.get(REFRESH_KEY);

        oauthClient.setCredentials({
            access_token: at,
            refresh_token: rt
        });
    });
}