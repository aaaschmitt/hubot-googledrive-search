// Description:
//   Search your Google drive using hubot
//
// Dependencies:
//   google-api-nodejs-client --> npm googleapis
//
// Commands:
//   hubot drive set code <code>  
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

var CLIENT_ID = process.env.HUBOT_DRIVE_CLIENT_ID,
    CLIENT_SECRET = process.env.HUBOT_DRIVE_CLIENT_SECRET,
    REDIRECT_URL = process.env.HUBOT_DRIVE_REDIRECT_URL,
    SCOPES = 'https://www.googleapis.com/auth/drive';

// We'll initialize the google auth in the module.exports functions
// since this is when we have access to the brain
var HubotGoogleAuth = require('hubot-google-auth');
var auth;

/**
 * Lists files and links for the given queryString
 * For more info on constructing query strings see: https://developers.google.com/drive/v2/web/search-parameters
 * This will not handle any paging and will only return the top search results given by the drive api
 *
 * @param  query     a query string
 * @param  cb        the callback function (err, [array of file objects])
 */
var search = function(queryString, cb) {

    var tokens = auth.getTokens(),
        authUrl = auth.generateAuthUrl(),
        authMsg = `Authorize this app by visiting this url :\n ${authUrl}` +
        '\nThen use @hubot drive set code <code>';

    // If there are no existing refresh tokens then the user will need to manually authenticate
    if (!tokens.refresh_token) {
        cb({
            err: null,
            msg: authMsg
        });
        return;
    }

    auth.validateToken(function(err, resp) {

        if (err) {
            console.log(err);
            cb({
                err: err,
                msg: authMsg
            });
            return;
        }

        auth.google.drive('v2').files.list({
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
        });
    });

}

/**
 * Formats the search results obtained from search
 *
 * @param  results  the array of files returned from search
 */
var formatSearchRes = function(results) {
    var res = '';
    // limit to 5 results
    for (var i = 0; i < 5 && i < results.length; i++) {
        res += `${i+1}.) ${results[i].title} \n${results[i].alternateLink}\n`;
    }

    return res;
}

// Export robot functions
var initialBrainLoad = true;
module.exports = function(robot) {

    auth = new HubotGoogleAuth('HUBOT_DRIVE', CLIENT_ID, CLIENT_SECRET, REDIRECT_URL, SCOPES, robot.brain);

    robot.respond(/drive(\s+set)?\s+code\s+([^\s]+)/i, {
        id: 'drive.set-code'
    }, function(msg) {
        var code = msg.match[2];
        msg.send('Attempting to set code...')
        auth.setCode(code, function(err, resp) {
            if (err) {
                msg.send(err.msg);
                return;
            }

            msg.send("Hubot drive code successfully set!");
        });
    });

    robot.respond(/drive tokens/i, {
        id: 'drive.show-tokens'
    }, function(msg) {
        var tokens = auth.getTokens();
        for (var name in tokens) {
            msg.send(`${name}: ${tokens[name]}`);
        }
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

            msg.send(formatSearchRes(resp));
        });
    });

    var searchRe = /drive search (title=((?:.(?!contains=))+))?\s*(contains=(.+))?/i;
    robot.respond(searchRe, {
        id: 'drive.search-title-contains'
    }, function(msg) {
        var titleStr = msg.match[2],
            containsStr = msg.match[4],
            titleQuery = `title contains '${titleStr}'`,
            containsQuery = `fullText contains '${containsStr}'`,
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

            msg.send(formatSearchRes(resp));
        });
    });
}