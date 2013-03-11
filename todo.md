#### Server
* method for submitting patches
	- save the given patches
	- return all the patches newer than given #
	- start background job of merge
* merge logic

#### iOS
* data model
* basic UI for creating and editing the tasks
* sync manager
	- send the patches without id
	- update with received patches
	- start merge process
* merge logic

#### Web
* IndexedDB research
* basic UI for creating and editing the tasks
* sync and merge logic

### Bugs
* losing identity on restart of iOS app -> maybe the old version ?
* icons frequently missing in web -> maybe don't use this font lib ?
