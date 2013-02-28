# Tasks

simple task manager with iOS and a web client

* automatic sync with conflict resolution and full history
* reminders with local, push and chrome desktop notifications
 
### Technology (research)

* node.js
* MongoDB
* Apple Push Notifications
* OpenID

### Design Notes

Authoritative server for the sync, web and iOS clients.

##### Task

    {  name: "Do something",
	   description: "Elaborate on what you do",
	   categories: ["low", "work"],
	   done: false,
	   reminder: { 
		 type: "discrete",
         time: "2012-12-28T06:15:33.035Z"
       },
	   timestamp: 1362086325042	// ticks
    }

For the reminder there is type `"discrete"` (on-page notification and app-badge) and `"important"` (chrome desktop notification and alert with sound on the device). On the device, local notifications are used by default. In case the task was created / changed and not yet synchronized with the device, push notifications are used.

##### Patch

	{  batchId: 23,
       clientId: "client-ios-123",
	   timestamp: 1362086325042	// ticks
	   $add: { ..task to add.. },
	   $edit: { 
	     name: {
	       old: "Do something",
           new: "Do something new" 
	     },
         categories: {
		   $add: ["high"],
           $remove: ["home"]
         }
         done: true,
         reminder: {
		   time: null
         }
       },
	   $remove: "..id of task to remove.."
	}

Patches are submitted in sync batches from clients. An auto-increase numbering scheme is used. When requesting sync data, clients send the latest batch number and get all the batches submitted later (excluding their own).

The current set of tasks can always be reconstructed from the **complete** set of patches. However, when a new batch is submitted, only for some tasks a history has to be traversed again. If the timestamp of the patch is higher than the timestamp of the current version, it can simply be applied on the top of it.

##### Reminders

On the server, there is a list of pending reminders for the clients that are out-of-date. Each time a new sync batch is submitted and merged, we make sure that all the added and modified reminders are kept watched. As soon as the reminder's time is reached, we check whether some of the clients are still out of date and send them a push notification.
