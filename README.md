# Tasks

simple todo web app with an [iOS](https://github.com/creepone/tasks-ios) client

* automatic synchronization between web and the device(s)
* clients fully functional offline
* notifications (Chrome or iOS)

#### Setup

The web server is implemented as a [node](http://nodejs.org/) application that uses the [mongo](http://www.mongodb.org/) data store. To build the scripts and stylesheets, [grunt](http://gruntjs.com/) is required (build the `default` task for production or `debug` for debugging).

Following environment variables are used for configuration:

`OPENID_REALM` **(required)**  
&nbsp;&nbsp;The realm for OpenID authentication (the URL of the application as deployed).

`MONGOHQ_URL`  
&nbsp;&nbsp;URL of the mongo instance to be used. The default is to use the db `tasks` on `localhost`.

`PORT`  
&nbsp;&nbsp;HTTP port to listen on. The default is 8081.

`APP_REGISTRATION_CODE`  
&nbsp;&nbsp;The code that will be required from new users when registering. If omitted users can register without a code.

`CERT.PEM` and `KEY.PEM`  
&nbsp;&nbsp;Base64 encoded contents of the `cert.pem` and `key.pem` files used for Apple Push Notifications, see [node-apn](https://github.com/argon/node-apn) for more info on how to get these. If omitted the todos created on the web will not be broadcast to the devices without opening the app.
