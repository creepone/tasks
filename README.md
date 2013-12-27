# Tasks

simple task manager with iOS and a web client

* sync with automatic conflict resolution and full history
* reminders with local, push and chrome desktop notifications
 
### Technology (research)

node.js, MongoDB, IndexedDB, Apple Push Notifications, OpenID, [ratchet](http://maker.github.com/ratchet/), [openid-selector](http://code.google.com/p/openid-selector/), [keychainutils](http://gorgando.com/blog/tag/sfhfkeychainutils), [dust](http://akdubya.github.com/dustjs/), [tapku](https://github.com/devinross/tapkulibrary)

### Design Notes

##### Task

    {  _id: "3c8d8095-0a0c-4079-8625-a97378bb3b84" // PK generated by clients
	   userId: ObjectId("4c2209fef3924d31102bd84b"),
	   name: "Do something",
	   notes: "Elaborate on what you do",
	   categories: ["low", "work"],
	   reminder: { 
		 important: true,
         time: "2012-12-28T06:15:33.035Z"
       },
	   lastClientPatchId: ObjectId("4c2209fef3924d31102bdabc")	// client id of the last applied patch
    }

If the reminder is set to be important, we use chrome desktop notification and alert with sound on the device, otherwise only badges on app and in web are used. On the device, local notifications are used.

##### Patch

	{  _id: ObjectId("4c2209fef3924d31102bd84a"),
	   userId: ObjectId("4c2209fef3924d31102bd84b"),
       taskId: "3c8d8095-0a0c-4079-8625-a97378bb3b84",	// id of the edited task
	   deviceId: ObjectId("4c2209fef3924d31102bd84c"),	// device that submitted the patch (optional)
	   clientPatchId: ObjectId("4c2209fef3924d31102bdabc"),	// client-generated BSON object-id
	   operation: "edit",	// add, edit, remove
	   body: { 
	     name: {
	       old: "Do something",
           new: "Do something new" 
	     },
         categories: {
		   add: ["high"],
           remove: ["home"]
         }
         reminder: {
		   time: null
         }
       }
	}

Patches are submitted from all clients. When requesting sync data, a client sends the latest patch id he got and gets all the patches submitted later (with the exception of out-of-order patches, see Syncing).

The current set of tasks can always be reconstructed from the **complete** set of patches. However, when a patch is being applied, only for some tasks a history has to be traversed again. If the client timestamp of the patch is higher than the timestamp of the current version, it can simply be applied on the top of it.

##### Device

    {  _id: ObjectId("4c2209fef3924d31102bd84c"),
	   name: "Tomas Vana's iPod Touch",
       userId: ObjectId("4c2209fef3924d31102bd84b"),
       token: "3c8d8095-0a0c-4079-8625-a97378bb3b86", // authentication token
       apnToken: "9a22f500824611e29e960800200c9a66", // updated on each startup of the app
       version: ObjectId("4c2209fef3924d31102bd84a") // last patch id that was sent to this device
       toSync: [ObjectId("4c2209fef3924d31102bd123"), ObjectId("4c2209fef3924d31102bd124")] // array of out-of-order patch ids that haven't been sent to this device yet
    }

##### User

    {  _id: ObjectId("4c2209fef3924d31102bd84b"),
	   name: "Tomas Vana",
       openid: "https://www.google.com/accounts/o8/id?id=..."
    }
    
##### Authentication

On the device, the authentication is only performed the very first time. After logging in with an openid that has been
associated with a valid account on the server (or creating this account on-demand), a device token is generated on the
server. Client stores this in the keychain and uses to authenticate for all the subsequent requests.

In the browser, the authentication has to be performed each time (unless there is a cookie for an already authenticated session).

##### Syncing

In the regular case, the process of syncing is as simple as exchanging the patches between the client and the server. However, there are some special cases to be taken care of. 

When a device starts the sync, it sends the list of patches that it generated since the last sync (state = Local). The server takes each patch, compares its timestamp with the version of each device to determine whether it will be sent with the next batch, or it has to be explicitly marked as out-of-order. It saves the patch to the database and applies it onto the server tasks.

Then the server retrieves a list of patches to be sent to the device, based on its version and the list of out-of-order patches. It sends them as a response to the initial request. 

As the next step, the device applies all the received patches onto its tasks, resolving merge conflicts if necessary and sends the server an acknowledgment with the new version (chronologically last patch id that the client now has) and the list of received out-of-order patches. The server updates this info in the device record.



