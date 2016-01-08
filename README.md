# hubot-googledrive-search
Search your google drive with hubot!
This is still a work in progress...

# Installation

* In your project repo run:
    npm install hubot-googledrive-search --save
* Then add the follwing to your external-scripts.json:
    [
      'hubot-googledrive-search'
    ]

# Configuration
This script requires you to generate oauth2 credentials for the drive account that you want hubot to be able to access. Currently this scipt is configured to give hubot access to all of drive (the specific scope used is: 'https://www.googleapis.com/auth/drive').

1. Generate a client secret.json file by following *step 1* here: https://developers.google.com/drive/v2/web/quickstart/nodejs
2. Set the environemnt variables that hubot needs (found in your client secret.json file):
    * heroku config:add DRIVE_CLIENT_ID="your_client_id"
    * heroku config:add DRIVE_CLIENT_SECRET="your_client_secret"
    * heroku config:add DRIVE_REDIRECT_URL="the_first_uri_in_the_list"
3. Load the script and attempt to interact with hubot. You will have to authorize the app to get your inital token and refresh token. The script will then store the refresh token in the hubot brain for future use, so this process should onlye need to be done once. Here's a sample interaction:
```
user>> @hubot search title= My Cool File
hubot>> Authorize this app by visiting: https://google.com/some_thing_with_your_client_info
        Then use @hubot drive set code <code>
user>> @hubot drive set code 123412351235
hubot>> drive code successfully set
user>> @hubot search title= My Cool File
hubot>> Name= My Cool File : https://google.drive/1234h123h4123h
```

# Features
